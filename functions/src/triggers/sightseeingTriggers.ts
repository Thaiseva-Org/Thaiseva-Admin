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

    logger.info(`[Sightseeing] New booking: ${bookingId}`, bookingData);

    const packageId = bookingData.packageId || bookingData.dataid;
    if (!packageId) {
      logger.warn(
        `[Sightseeing] Booking ${bookingId} skipped: missing packageId.`,
        bookingData,
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

      if (capacity.weeklyOk && capacity.dailyOk) {
        logger.info(
          `[Sightseeing] Auto-accepting booking ${bookingId}.`,
        );

        await snapshot.ref.update({
          status: "Accepted",
          isBookingConfirmed: true,
          autoAccepted: true,
          acceptedAt: admin.firestore.FieldValue.serverTimestamp(),
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

      if (
        bookingData.status !== "Pending" &&
        bookingData.status !== "Review In Progress"
      ) {
        await snapshot.ref.update({ status: "Pending" });
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

    const statusBefore = before.status;
    const statusAfter = after.status;

    if (statusBefore === statusAfter) return;

    if (
      after.autoAccepted &&
      (statusAfter === "Accepted" || statusAfter === "ACCEPTED")
    ) {
      logger.info(
        `[Sightseeing] Skipping accepted notification for ${event.params.bookingId} ` +
          "(auto-accepted).",
      );
      return;
    }

    logger.info(
      `[Sightseeing] Booking ${event.params.bookingId} status: ` +
        `${statusBefore} -> ${statusAfter}`,
    );

    if (statusAfter === "Accepted" || statusAfter === "ACCEPTED") {
      await sendTelegramNotification(
        formatSightseeingTelegramMessage(
          `${icon.accepted} Sightseeing Booking Accepted`,
          after,
        ),
      );
    }

    if (
      statusAfter === "Canceled" ||
      statusAfter === "CANCELED" ||
      statusAfter === "Cancelled"
    ) {
      await sendTelegramNotification(
        formatSightseeingTelegramMessage(
          `${icon.cancelled} Sightseeing Booking Cancelled`,
          after,
        ),
      );
    }
  },
);