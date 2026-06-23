import { onDocumentCreated, onDocumentUpdated } from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import { sendTelegramNotification } from "../utils/telegram";

const formatTransportMsg = (type: string, title: string, id: string, data: any) => {
  const name = data.customerName || data.name || data.firstName || "Unknown Customer";
  const date = data.travelDate || data.pickupDate || data.date || "Unknown Date";
  const amount = data.totalAmount || data.price || "N/A";
  const vehicle = data.vehicleName || data.selectedVehicle || "Unknown Vehicle";

  return `<b>${title} (${type})</b>\n` +
         `🆔 <code>${id}</code>\n` +
         `👤 ${name}\n` +
         `🚙 ${vehicle}\n` +
         `📅 ${date}\n` +
         `💰 ฿${amount}`;
};

// ============================================================================
// CAR / TAXI BOOKINGS
// ============================================================================

export const onCarBookingCreated = onDocumentCreated(
  { document: "car_bookings/{bookingId}", region: "asia-east2" },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    logger.info(`New Car Booking Triggered: ${event.params.bookingId}`);
    await sendTelegramNotification(formatTransportMsg("Car", "🆕 New Transport Booking", event.params.bookingId, snapshot.data()));
  },
);

export const onCarBookingStatusChange = onDocumentUpdated(
  { document: "car_bookings/{bookingId}", region: "asia-east2" },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();

    if (!before || !after) return;

    const statusBefore = before.status;
    const statusAfter = after.status;

    if (statusBefore === statusAfter) return;

    logger.info(`Car Booking ${event.params.bookingId} status changed: ${statusBefore} -> ${statusAfter}`);

    if (["Accepted", "ACCEPTED"].includes(statusAfter)) {
      logger.info("Sending Telegram Notification: Car Booking Accepted");
      await sendTelegramNotification(formatTransportMsg("Car", "✅ Transport Booking Accepted", event.params.bookingId, after));
    }

    if (["Canceled", "CANCELED", "Cancelled"].includes(statusAfter)) {
      logger.info("Sending Telegram Notification: Car Booking Canceled");
      await sendTelegramNotification(formatTransportMsg("Car", "❌ Transport Booking Cancelled", event.params.bookingId, after));
    }
  },
);

// ============================================================================
// VAN BOOKINGS
// ============================================================================

export const onVanBookingCreated = onDocumentCreated(
  { document: "vanBookings/{bookingId}", region: "asia-east2" },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    logger.info(`New Van Booking Triggered: ${event.params.bookingId}`);
    await sendTelegramNotification(formatTransportMsg("Van", "🆕 New Transport Booking", event.params.bookingId, snapshot.data()));
  },
);

export const onVanBookingStatusChange = onDocumentUpdated(
  { document: "vanBookings/{bookingId}", region: "asia-east2" },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();

    if (!before || !after) return;

    const statusBefore = before.status;
    const statusAfter = after.status;

    if (statusBefore === statusAfter) return;

    logger.info(`Van Booking ${event.params.bookingId} status changed: ${statusBefore} -> ${statusAfter}`);

    if (["Accepted", "ACCEPTED"].includes(statusAfter)) {
      logger.info("Sending Telegram Notification: Van Booking Accepted");
      await sendTelegramNotification(formatTransportMsg("Van", "✅ Transport Booking Accepted", event.params.bookingId, after));
    }

    if (["Canceled", "CANCELED", "Cancelled"].includes(statusAfter)) {
      logger.info("Sending Telegram Notification: Van Booking Canceled");
      await sendTelegramNotification(formatTransportMsg("Van", "❌ Transport Booking Cancelled", event.params.bookingId, after));
    }
  },
);

// ============================================================================
// SELF DRIVE BOOKINGS
// ============================================================================

export const onSelfDriveBookingCreated = onDocumentCreated(
  { document: "self_driving_bookings/{bookingId}", region: "asia-east2" },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    logger.info(`New Self Drive Booking Triggered: ${event.params.bookingId}`);
    await sendTelegramNotification(formatTransportMsg("Self Drive", "🆕 New Transport Booking", event.params.bookingId, snapshot.data()));
  },
);

export const onSelfDriveBookingStatusChange = onDocumentUpdated(
  { document: "self_driving_bookings/{bookingId}", region: "asia-east2" },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();

    if (!before || !after) return;

    const statusBefore = before.status;
    const statusAfter = after.status;

    if (statusBefore === statusAfter) return;

    logger.info(`Self Drive Booking ${event.params.bookingId} status changed: ${statusBefore} -> ${statusAfter}`);

    if (["Accepted", "ACCEPTED"].includes(statusAfter)) {
      logger.info("Sending Telegram Notification: Self Drive Booking Accepted");
      await sendTelegramNotification(formatTransportMsg("Self Drive", "✅ Transport Booking Accepted", event.params.bookingId, after));
    }

    if (["Canceled", "CANCELED", "Cancelled"].includes(statusAfter)) {
      logger.info("Sending Telegram Notification: Self Drive Booking Canceled");
      await sendTelegramNotification(formatTransportMsg("Self Drive", "❌ Transport Booking Cancelled", event.params.bookingId, after));
    }
  },
);
