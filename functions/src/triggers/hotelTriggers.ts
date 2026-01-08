import { onDocumentCreated } from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";

export const forceHotelBookingPending = onDocumentCreated("hotelBookingData/{bookingId}", async (event) => {
    const snapshot = event.data;
    if (!snapshot) {
        return;
    }

    const bookingData = snapshot.data();

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
