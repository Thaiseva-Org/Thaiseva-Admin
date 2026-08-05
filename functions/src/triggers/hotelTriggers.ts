import {
  onDocumentCreated,
  onDocumentUpdated,
} from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import {getFirestore} from "firebase-admin/firestore";
import {sendTelegramNotification} from "../utils/telegram";
import {icon} from "../utils/bookingNotification";
import {
  buildHotelPendingEnforcementUpdate,
  formatHotelStatusTelegramMessage,
  formatNewHotelTelegramMessage,
  resolveHotelBookingMetadata,
} from "../utils/hotelBooking";
import {requiresHotelManualApproval} from "../utils/hotelPayment";
import {
  bookingInventoryFields,
  releaseRoomsInTransaction,
  loadHotel,
  loadAvailabilityConfig,
} from "../utils/hotelInventoryTx";
import {
  moneyText,
  notifyCustomer,
  resolveCustomerUid,
} from "../utils/customerNotify";

export const forceHotelBookingPending = onDocumentCreated(
  {
    document: "hotelBookingData/{bookingId}",
    region: "asia-east2",
  },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const bookingData = snapshot.data();
    const bookingId = event.params.bookingId;
    const metadata = await resolveHotelBookingMetadata(bookingData);

    // Auto-book path already accepted + reserved — only notify if needed
    if (
      bookingData.inventoryReserved === true ||
      bookingData.sourcePath === "auto" ||
      bookingData.autoAccepted === true
    ) {
      await sendTelegramNotification(
        formatNewHotelTelegramMessage(bookingData, metadata),
      );
      logger.info(
        `[Hotel] Booking ${bookingId} already auto-reserved; ` +
          "skipping pending enforcement.",
      );
      return;
    }

    await sendTelegramNotification(
      formatNewHotelTelegramMessage(bookingData, metadata),
    );

    const updateData = buildHotelPendingEnforcementUpdate(
      bookingData,
      metadata,
    );

    if (!requiresHotelManualApproval(bookingData)) {
      if (Object.keys(updateData).length > 0) {
        await snapshot.ref.update(updateData);
      }

      logger.info(
        `[Hotel] Booking ${bookingId} is paid and confirmed. ` +
          "Skipping pending enforcement.",
      );
      return;
    }

    if (updateData.status === "Pending") {
      logger.info(
        `[Hotel] Enforcing manual approval for booking ${bookingId}.`,
      );
      await snapshot.ref.update({
        ...updateData,
        pendingReasonCode:
          bookingData.pendingReasonCode || "PAYMENT_REVIEW",
        pendingReason:
          bookingData.pendingReason ||
          "Awaiting manual review / payment verification.",
      });
      return;
    }

    if (Object.keys(updateData).length > 0) {
      await snapshot.ref.update(updateData);
    }
  },
);

export const onHotelBookingStatusChangeV3 = onDocumentUpdated(
  {
    document: "hotelBookingData/{bookingId}",
    region: "asia-east2",
  },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();

    if (!before || !after) return;

    const normalizeStatus = (data: Record<string, unknown>) =>
      String(data.bookingStatus || data.status || "").toUpperCase();

    const statusBefore = normalizeStatus(before);
    const statusAfter = normalizeStatus(after);
    const bookingId = event.params.bookingId;

    // Release inventory when moving into canceled / rejected (idempotent)
    const terminalStatuses = new Set([
      "CANCELED",
      "CANCELLED",
      "REJECTED",
      "DENIED",
    ]);
    const wasTerminal = terminalStatuses.has(statusBefore);
    const becameTerminal =
      terminalStatuses.has(statusAfter) && !wasTerminal;

    if (becameTerminal && after.inventoryReserved === true) {
      try {
        const fields = bookingInventoryFields(after);
        const result = await releaseRoomsInTransaction(getFirestore(), {
          ...fields,
          bookingId,
        });
        logger.info(
          `[Hotel] Inventory release for ${bookingId}: ` +
            JSON.stringify(result),
        );

        if (result.ok && result.freedNights && result.freedNights.length > 0) {
          const hotel = await loadHotel(getFirestore(), fields.hotelUid);
          const config = await loadAvailabilityConfig(
            getFirestore(),
            fields.hotelUid,
            hotel,
          );
          if (config.notifyOnFreed) {
            await sendTelegramNotification(
              `<b>Availability restored</b>\n` +
                `Booking ${bookingId} cancelled.\n` +
                `Dates: ${result.freedNights.join(", ")}`,
            );
          }
        }
      } catch (error) {
        logger.error(`[Hotel] Inventory release failed for ${bookingId}`, error);
      }
    }

    // Payment became verified / done → notify customer (app + website)
    const paidBefore =
      before.isPaymentDone === true ||
      String(before.paymentVerificationStatus || "").toUpperCase() ===
        "VERIFIED";
    const paidAfter =
      after.isPaymentDone === true ||
      String(after.paymentVerificationStatus || "").toUpperCase() ===
        "VERIFIED";
    if (!paidBefore && paidAfter) {
      const uid = resolveCustomerUid(after);
      const amt = moneyText(after);
      await notifyCustomer({
        userId: uid,
        title: "Hotel payment confirmed",
        message:
          `Your hotel payment was confirmed` +
          (amt ? ` (${amt})` : "") +
          ". Open My Bookings for details.",
        type: "hotel-booking",
        bookingId,
        bookingCollection: "hotelBookingData",
        eventKey: `hotel_${bookingId}_paid`,
        data: {
          bookingStatus: after.bookingStatus || after.status,
          isPaymentDone: true,
          amount: amt,
        },
      });
    }

    if (statusBefore === statusAfter) return;

    logger.info(
      `[Hotel] Booking ${bookingId} status: ` +
        `${statusBefore} -> ${statusAfter}`,
    );

    const uid = resolveCustomerUid(after);

    if (statusAfter === "ACCEPTED" || statusAfter === "CONFIRMED") {
      // Avoid double notify for auto-accepted bookings
      if (after.autoAccepted === true && after.acceptanceNotifiedAt) {
        logger.info(
          `[Hotel] Skipping accepted notification for ${bookingId} ` +
            "(already notified).",
        );
      } else {
        await sendTelegramNotification(
          formatHotelStatusTelegramMessage(
            `${icon.accepted} Hotel Booking Accepted`,
            after,
          ),
        );
        await notifyCustomer({
          userId: uid,
          title: "Hotel booking accepted",
          message:
            "Your hotel booking was accepted. " +
            (after.isPaymentDone === true ?
              "Payment is confirmed." :
              "Complete payment if still required."),
          type: "hotel-booking",
          bookingId,
          bookingCollection: "hotelBookingData",
          eventKey: `hotel_${bookingId}_status_${statusAfter}`,
          data: {
            bookingStatus: after.bookingStatus || after.status,
            isPaymentDone: after.isPaymentDone === true,
          },
        });
      }
    }

    if (statusAfter === "CANCELED" || statusAfter === "CANCELLED") {
      await sendTelegramNotification(
        formatHotelStatusTelegramMessage(
          `${icon.cancelled} Hotel Booking Cancelled`,
          after,
        ),
      );
      await notifyCustomer({
        userId: uid,
        title: "Hotel booking canceled",
        message: "Your hotel booking was canceled.",
        type: "hotel-booking",
        bookingId,
        bookingCollection: "hotelBookingData",
        eventKey: `hotel_${bookingId}_status_CANCELED`,
        data: {
          bookingStatus: after.bookingStatus || after.status,
        },
      });
    }

    if (statusAfter === "PENDING" && statusBefore !== "PENDING") {
      await notifyCustomer({
        userId: uid,
        title: "Hotel booking update",
        message: "Your hotel booking status was updated to pending review.",
        type: "hotel-booking",
        bookingId,
        bookingCollection: "hotelBookingData",
        eventKey: `hotel_${bookingId}_status_PENDING`,
      });
    }
  },
);
