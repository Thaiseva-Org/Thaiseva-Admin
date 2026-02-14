import { onDocumentCreated, onDocumentUpdated } from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import { sendWhatsAppNotification } from "../utils/whatsapp";

export const forceHotelBookingPending = onDocumentCreated("hotelBookingData/{bookingId}", async (event) => {
    const snapshot = event.data;
    if (!snapshot) {
        return;
    }

    const bookingData = snapshot.data();


    // Send WhatsApp Notification to Admin
    await sendWhatsAppNotification("notification", [`New Hotel Booking: ${event.params.bookingId}`]);

    // Check if the booking is not in the desired "Pending" state
    // We strictly enforce "Pending" and isBookingConfirmed: false
    if (bookingData.status !== "Pending" || bookingData.isBookingConfirmed !== false) {
        logger.info(`Enforcing Manual Approval for Hotel Booking ${event.params.bookingId}. Resetting to Pending.`);

        await snapshot.ref.update({
            status: "Pending",
            bookingStatus: "PENDING",
            isBookingConfirmed: false,
            autoAccepted: false // Ensure this flag is off if it exists
        });
    }
});

export const onHotelBookingStatusChangeV3 = onDocumentUpdated("hotelBookingData/{bookingId}", async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();

    if (!before || !after) return;

    const statusBefore = before.status;
    const statusAfter = after.status;

    // Check if status actually changed
    if (statusBefore === statusAfter) return;

    logger.info(`Hotel Booking ${event.params.bookingId} status changed: ${statusBefore} -> ${statusAfter}`);

    // Status: Accepted
    if (statusAfter === "Accepted" || statusAfter === "ACCEPTED") {
        logger.info("Sending WhatsApp Notification: Booking Accepted");
        await sendWhatsAppNotification("notification", [`Hotel Booking ${event.params.bookingId} Accepted ✅`]);
    }

    // Status: Canceled
    if (statusAfter === "Canceled" || statusAfter === "CANCELED" || statusAfter === "Cancelled") {
        logger.info("Sending WhatsApp Notification: Booking Canceled");
        await sendWhatsAppNotification("notification", [`Hotel Booking ${event.params.bookingId} Cancelled ❌`]);
    }
});
