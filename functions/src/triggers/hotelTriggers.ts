import {
  onDocumentCreated,
  onDocumentUpdated,
} from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import { sendTelegramNotification } from "../utils/telegram";
import { icon } from "../utils/bookingNotification";
import {
  buildHotelPendingEnforcementUpdate,
  formatHotelStatusTelegramMessage,
  formatNewHotelTelegramMessage,
  resolveHotelBookingMetadata,
} from "../utils/hotelBooking";
import { requiresHotelManualApproval } from "../utils/hotelPayment";

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
      await snapshot.ref.update(updateData);
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

    if (statusBefore === statusAfter) return;

    logger.info(
      `[Hotel] Booking ${event.params.bookingId} status: ` +
        `${statusBefore} -> ${statusAfter}`,
    );

    if (statusAfter === "ACCEPTED" || statusAfter === "CONFIRMED") {
      await sendTelegramNotification(
        formatHotelStatusTelegramMessage(
          `${icon.accepted} Hotel Booking Accepted`,
          after,
        ),
      );
    }

    if (statusAfter === "CANCELED" || statusAfter === "CANCELLED") {
      await sendTelegramNotification(
        formatHotelStatusTelegramMessage(
          `${icon.cancelled} Hotel Booking Cancelled`,
          after,
        ),
      );
    }
  },
);