
import { onDocumentCreated, onDocumentUpdated } from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import { sendWhatsAppNotification } from "../utils/whatsapp";

// ============================================================================
// CAR / TAXI BOOKINGS
// ============================================================================

export const onCarBookingCreated = onDocumentCreated({ document: "car_bookings/{bookingId}", region: "asia-east2" }, async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    // Send WhatsApp Notification for New Booking
    logger.info(`New Car Booking Triggered: ${event.params.bookingId}`);
    await sendWhatsAppNotification("notification", [`New Car Booking: ${event.params.bookingId}`]);
});

export const onCarBookingStatusChange = onDocumentUpdated({ document: "car_bookings/{bookingId}", region: "asia-east2" }, async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();

    if (!before || !after) return;

    const statusBefore = before.status;
    const statusAfter = after.status;

    if (statusBefore === statusAfter) return;

    logger.info(`Car Booking ${event.params.bookingId} status changed: ${statusBefore} -> ${statusAfter}`);

    if (['Accepted', 'ACCEPTED'].includes(statusAfter)) {
        logger.info("Sending WhatsApp Notification: Car Booking Accepted");
        await sendWhatsAppNotification("notification", [`Car Booking ${event.params.bookingId} Accepted ✅`]);
    }

    if (['Canceled', 'CANCELED', 'Cancelled'].includes(statusAfter)) {
        logger.info("Sending WhatsApp Notification: Car Booking Canceled");
        await sendWhatsAppNotification("notification", [`Car Booking ${event.params.bookingId} Cancelled ❌`]);
    }
});

// ============================================================================
// VAN BOOKINGS
// ============================================================================

export const onVanBookingCreated = onDocumentCreated({ document: "vanBookings/{bookingId}", region: "asia-east2" }, async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    logger.info(`New Van Booking Triggered: ${event.params.bookingId}`);
    await sendWhatsAppNotification("notification", [`New Van Booking: ${event.params.bookingId}`]);
});

export const onVanBookingStatusChange = onDocumentUpdated({ document: "vanBookings/{bookingId}", region: "asia-east2" }, async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();

    if (!before || !after) return;

    const statusBefore = before.status;
    const statusAfter = after.status;

    if (statusBefore === statusAfter) return;

    logger.info(`Van Booking ${event.params.bookingId} status changed: ${statusBefore} -> ${statusAfter}`);

    if (['Accepted', 'ACCEPTED'].includes(statusAfter)) {
        logger.info("Sending WhatsApp Notification: Van Booking Accepted");
        await sendWhatsAppNotification("notification", [`Van Booking ${event.params.bookingId} Accepted ✅`]);
    }

    if (['Canceled', 'CANCELED', 'Cancelled'].includes(statusAfter)) {
        logger.info("Sending WhatsApp Notification: Van Booking Canceled");
        await sendWhatsAppNotification("notification", [`Van Booking ${event.params.bookingId} Cancelled ❌`]);
    }
});

// ============================================================================
// SELF DRIVE BOOKINGS
// ============================================================================

export const onSelfDriveBookingCreated = onDocumentCreated({ document: "self_driving_bookings/{bookingId}", region: "asia-east2" }, async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    logger.info(`New Self Drive Booking Triggered: ${event.params.bookingId}`);
    await sendWhatsAppNotification("notification", [`New Self Drive Booking: ${event.params.bookingId}`]);
});

export const onSelfDriveBookingStatusChange = onDocumentUpdated({ document: "self_driving_bookings/{bookingId}", region: "asia-east2" }, async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();

    if (!before || !after) return;

    const statusBefore = before.status;
    const statusAfter = after.status;

    if (statusBefore === statusAfter) return;

    logger.info(`Self Drive Booking ${event.params.bookingId} status changed: ${statusBefore} -> ${statusAfter}`);

    if (['Accepted', 'ACCEPTED'].includes(statusAfter)) {
        logger.info("Sending WhatsApp Notification: Self Drive Booking Accepted");
        await sendWhatsAppNotification("notification", [`Self Drive Booking ${event.params.bookingId} Accepted ✅`]);
    }

    if (['Canceled', 'CANCELED', 'Cancelled'].includes(statusAfter)) {
        logger.info("Sending WhatsApp Notification: Self Drive Booking Canceled");
        await sendWhatsAppNotification("notification", [`Self Drive Booking ${event.params.bookingId} Cancelled ❌`]);
    }
});
