import {
  onDocumentCreated,
  onDocumentUpdated,
} from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import { sendTelegramNotification } from "../utils/telegram";
import { icon } from "../utils/bookingNotification";
import {
  evaluateSightseeingCapacity,
  formatSightseeingTelegramMessage,
} from "../utils/sightseeingBooking";
import {
  buildSightseeingAutoAcceptPaymentFields,
  canAutoAcceptSightseeingPayment,
} from "../utils/sightseeingPayment";
import {
  moneyText,
  notifyCustomer,
  resolveCustomerUid,
} from "../utils/customerNotify";

let db: admin.firestore.Firestore;

export const autoAcceptSightseeingBookings = onDocumentCreated(
  { document: "travelBookingDetails/{bookingId}", region: "asia-east2" },
  async (event) => {
    if (!admin.apps.length) {
      admin.initializeApp();
    }
    if (!db) {
      db = admin.firestore();
    }

    const snapshot = event.data;
    if (!snapshot) {
      return;
    }

    const bookingData = snapshot.data();
    const bookingId = event.params.bookingId;

    await sendTelegramNotification(
      formatSightseeingTelegramMessage(
        `${icon.new} New Sightseeing Booking`,
        bookingData,
      ),
    );

    logger.info(`[Sightseeing] New booking: ${bookingId}`, {bookingId});

    // Versioned bookings were routed atomically by the booking API. Never
    // auto-accept a preparation/capacity request after its creation.
    if (bookingData.bookingFlowVersion === 1) return;

    const packageId = bookingData.packageId || bookingData.dataid;
    if (!packageId) {
      logger.warn(
        `[Sightseeing] Booking ${bookingId} skipped: missing packageId.`,
        {bookingId},
      );
      return;
    }

    const partnerId =
      bookingData.partnerId ||
      bookingData.providerId ||
      bookingData.agentId ||
      null;

    logger.info(
      `[Sightseeing] Processing ${bookingId}: package=${packageId}, ` +
        `partner=${partnerId}`,
    );

    try {
      const packageDocSnapshot = await db
        .collection("sightseeingPackagesDetails")
        .doc(String(packageId))
        .get();

      if (!packageDocSnapshot.exists) {
        logger.error(
          `[Sightseeing] Package ${packageId} not found for ${bookingId}.`,
        );
        return;
      }

      const flow = require("../../sightseeingFlow");
      const tourDate = bookingData.arrivalDate || bookingData.travelDate || bookingData.pickUpTime;
      if (bookingData.isPaymentDone !== true && !flow.dateDecision(String(tourDate || "").slice(0, 10)).preparationOk) return;

      if (!canAutoAcceptSightseeingPayment(bookingData)) {
        logger.info(
          `[Sightseeing] Booking ${bookingId} skipped auto-accept: ` +
            "payment method requires admin review.",
        );
        return;
      }

      const capacity = await evaluateSightseeingCapacity(
        db,
        bookingData,
        bookingId,
      );

      logger.info(
        `[Sightseeing] Capacity for ${bookingId}: ` +
          `weekly ${capacity.weeklyCount}/${capacity.weeklyLimit}, ` +
          `daily ${capacity.dailyCount}/${capacity.dailyLimit}.`,
      );

      const paymentAlreadyDone =
        bookingData.isPaymentDone === true ||
        String(bookingData.paymentVerificationStatus || "").toUpperCase() ===
          "VERIFIED" ||
        String(bookingData.paymentConfirmation?.status || "").toLowerCase() ===
          "paid";

      // Paid Stripe (or any already-verified payment): always accept.
      // Never rewrite status back to "Pending" - that hid bookings from Paid tab.
      if (paymentAlreadyDone || (capacity.weeklyOk && capacity.dailyOk)) {
        const overCapacity = paymentAlreadyDone && !(capacity.weeklyOk && capacity.dailyOk);
        logger.info(
          `[Sightseeing] Auto-accepting booking ${bookingId}` +
            (overCapacity ? " (paid; over capacity warning)." : "."),
        );

        await snapshot.ref.update({
          status: "Accepted",
          isBookingConfirmed: true,
          autoAccepted: true,
          acceptedAt: admin.firestore.FieldValue.serverTimestamp(),
          ...(overCapacity ?
            {
              capacityWarning:
                !capacity.weeklyOk && !capacity.dailyOk ?
                  "weekly and daily limits reached" :
                  !capacity.weeklyOk ?
                    "weekly limit reached" :
                    "daily tour-date limit reached",
            } :
            {}),
          ...buildSightseeingAutoAcceptPaymentFields(bookingData),
        });

        logger.info(`[Sightseeing] Booking ${bookingId} updated to Accepted.`);
        return;
      }

      const limitReason = !capacity.weeklyOk && !capacity.dailyOk ?
        "weekly and daily limits reached" :
        !capacity.weeklyOk ?
          "weekly limit reached" :
          "daily tour-date limit reached";

      logger.info(
        `[Sightseeing] Capacity blocked (${limitReason}) for ${bookingId}.`,
      );

      // Only unpaid Thai QR / onsite / review paths may sit in Pending.
      // Do not demote Confirmed/Accepted paid docs.
      if (
        !paymentAlreadyDone &&
        bookingData.status !== "Pending" &&
        bookingData.status !== "Review In Progress" &&
        bookingData.status !== "Accepted" &&
        bookingData.status !== "Confirmed"
      ) {
        await snapshot.ref.update({status: "Pending"});
      }
    } catch (error) {
      logger.error("[Sightseeing] autoAcceptSightseeingBookings failed:", error);
    }
  },
);

export const onSightseeingBookingStatusChange = onDocumentUpdated(
  { document: "travelBookingDetails/{bookingId}", region: "asia-east2" },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();

    if (!before || !after) return;

    const bookingId = event.params.bookingId;
    const statusBefore = String(before.status || before.bookingStatus || "");
    const statusAfter = String(after.status || after.bookingStatus || "");
    const stBefore = statusBefore.toUpperCase();
    const stAfter = statusAfter.toUpperCase();
    const uid = resolveCustomerUid(after);

    // Payment verified
    const paidBefore =
      before.isPaymentDone === true ||
      String(before.paymentVerificationStatus || "").toUpperCase() ===
        "VERIFIED";
    const paidAfter =
      after.isPaymentDone === true ||
      String(after.paymentVerificationStatus || "").toUpperCase() ===
        "VERIFIED";
    if (!paidBefore && paidAfter) {
      const amt = moneyText(after);
      await notifyCustomer({
        userId: uid,
        title: "Tour payment confirmed",
        message:
          `Your sightseeing payment was confirmed` +
          (amt ? ` (${amt})` : "") +
          ". Open My Bookings for details.",
        type: "sightseeing-booking",
        bookingId,
        bookingCollection: "travelBookingDetails",
        eventKey: `sight_${bookingId}_paid`,
        data: {
          status: after.status,
          isPaymentDone: true,
        },
      });
    }

    if (stBefore === stAfter) return;

    if (
      after.autoAccepted &&
      (stAfter === "ACCEPTED" || stAfter === "CONFIRMED")
    ) {
      // Still notify customer (they need app/web update); skip only extra Telegram noise
      logger.info(
        `[Sightseeing] Auto-accepted ${bookingId} - customer notify only.`,
      );
      await notifyCustomer({
        userId: uid,
        title: "Tour booking confirmed",
        message: "Your sightseeing booking was confirmed.",
        type: "sightseeing-booking",
        bookingId,
        bookingCollection: "travelBookingDetails",
        eventKey: `sight_${bookingId}_status_${stAfter}`,
        data: {status: after.status, autoAccepted: true},
      });
      return;
    }

    logger.info(
      `[Sightseeing] Booking ${bookingId} status: ` +
        `${statusBefore} -> ${statusAfter}`,
    );

    if (stAfter === "ACCEPTED" || stAfter === "CONFIRMED") {
      await sendTelegramNotification(
        formatSightseeingTelegramMessage(
          `${icon.accepted} Sightseeing Booking Accepted`,
          after,
        ),
      );
      await notifyCustomer({
        userId: uid,
        title: "Tour booking accepted",
        message: after.isPaymentDone === true ? "Your sightseeing booking was accepted." : "Your package request has been confirmed. Open My Bookings to complete payment.",
        type: "sightseeing-booking",
        bookingId,
        bookingCollection: "travelBookingDetails",
        eventKey: `sight_${bookingId}_status_${stAfter}`,
        data: {status: after.status},
      });
    }

    if (
      stAfter === "CANCELED" ||
      stAfter === "CANCELLED" ||
      stAfter.includes("CANCEL")
    ) {
      await sendTelegramNotification(
        formatSightseeingTelegramMessage(
          `${icon.cancelled} Sightseeing Booking Cancelled`,
          after,
        ),
      );
      await notifyCustomer({
        userId: uid,
        title: "Tour booking canceled",
        message: "Your sightseeing booking was canceled.",
        type: "sightseeing-booking",
        bookingId,
        bookingCollection: "travelBookingDetails",
        eventKey: `sight_${bookingId}_status_CANCELED`,
        data: {status: after.status},
      });
    }
  },
);