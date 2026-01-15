
import { onDocumentCreated, onDocumentUpdated } from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import { sendWhatsAppNotification } from "../utils/whatsapp";

// ============================================================================
// CAR / TAXI BOOKINGS
// ============================================================================

export const onCarBookingCreated = onDocumentCreated("car_bookings/{bookingId}", async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    // Send WhatsApp Notification for New Booking
    logger.info(`New Car Booking Triggered: ${event.params.bookingId}`);
    await sendWhatsAppNotification("hello_world");
});

export const onCarBookingStatusChange = onDocumentUpdated("car_bookings/{bookingId}", async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();

    if (!before || !after) return;

    const statusBefore = before.status;
    const statusAfter = after.status;

    if (statusBefore === statusAfter) return;

    logger.info(`Car Booking ${event.params.bookingId} status changed: ${statusBefore} -> ${statusAfter}`);

    if (['Accepted', 'ACCEPTED'].includes(statusAfter)) {
        logger.info("Sending WhatsApp Notification: Car Booking Accepted");
        await sendWhatsAppNotification("hello_world");
    }

    if (['Canceled', 'CANCELED', 'Cancelled'].includes(statusAfter)) {
        logger.info("Sending WhatsApp Notification: Car Booking Canceled");
        await sendWhatsAppNotification("hello_world");
    }
});

// ============================================================================
// VAN BOOKINGS
// ============================================================================

export const onVanBookingCreated = onDocumentCreated("vanBookings/{bookingId}", async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    logger.info(`New Van Booking Triggered: ${event.params.bookingId}`);
    await sendWhatsAppNotification("hello_world");
});

export const onVanBookingStatusChange = onDocumentUpdated("vanBookings/{bookingId}", async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();

    if (!before || !after) return;

    const statusBefore = before.status;
    const statusAfter = after.status;

    if (statusBefore === statusAfter) return;

    logger.info(`Van Booking ${event.params.bookingId} status changed: ${statusBefore} -> ${statusAfter}`);

    if (['Accepted', 'ACCEPTED'].includes(statusAfter)) {
        logger.info("Sending WhatsApp Notification: Van Booking Accepted");
        await sendWhatsAppNotification("hello_world");
    }

    if (['Canceled', 'CANCELED', 'Cancelled'].includes(statusAfter)) {
        logger.info("Sending WhatsApp Notification: Van Booking Canceled");
        await sendWhatsAppNotification("hello_world");
    }
});

// ============================================================================
// SELF DRIVE BOOKINGS
// ============================================================================

export const onSelfDriveBookingCreated = onDocumentCreated("self_driving_bookings/{bookingId}", async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    logger.info(`New Self Drive Booking Triggered: ${event.params.bookingId}`);
    await sendWhatsAppNotification("hello_world");
});

export const onSelfDriveBookingStatusChange = onDocumentUpdated("self_driving_bookings/{bookingId}", async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();

    if (!before || !after) return;

    const statusBefore = before.status;
    const statusAfter = after.status;

    if (statusBefore === statusAfter) return;

    logger.info(`Self Drive Booking ${event.params.bookingId} status changed: ${statusBefore} -> ${statusAfter}`);

    if (['Accepted', 'ACCEPTED'].includes(statusAfter)) {
        logger.info("Sending WhatsApp Notification: Self Drive Booking Accepted");
        await sendWhatsAppNotification("hello_world");
    }

    if (['Canceled', 'CANCELED', 'Cancelled'].includes(statusAfter)) {
        logger.info("Sending WhatsApp Notification: Self Drive Booking Canceled");
        await sendWhatsAppNotification("hello_world");
    }
});
