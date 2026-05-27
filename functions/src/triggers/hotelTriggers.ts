import {
  onDocumentCreated,
  onDocumentUpdated,
} from "firebase-functions/v2/firestore";
import { getFirestore } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import { sendWhatsAppNotification } from "../utils/whatsapp";

const isMissingHotelName = (hotelName: unknown) => {
  if (typeof hotelName !== "string") return true;

  const normalizedName = hotelName.trim().toLowerCase();
  return !normalizedName || normalizedName === "hotel";
};

const getHotelNameByUid = async (hotelUid?: string) => {
  if (!hotelUid) return null;

  const hotelSnapshot = await getFirestore()
    .collection("HotelDB")
    .doc(hotelUid)
    .get();

  if (!hotelSnapshot.exists) return null;

  const hotelData = hotelSnapshot.data() || {};
  return (
    hotelData.hotelInformation?.hotelName ||
    hotelData.hotel?.hotelName ||
    hotelData.hotelName ||
    null
  );
};

export const forceHotelBookingPending = onDocumentCreated(
  {
    document: "hotelBookingData/{bookingId}",
    region: "asia-east2",
  },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const bookingData = snapshot.data();
    const isPaidBooking =
      bookingData.isPaymentDone === true ||
      bookingData.paymentConfirmation?.status === "paid" ||
      bookingData.paymentVerificationStatus === "VERIFIED";
    const isConfirmedBooking =
      bookingData.isBookingConfirmed === true ||
      String(bookingData.bookingStatus || "").toUpperCase() === "CONFIRMED" ||
      String(bookingData.status || "").toUpperCase() === "CONFIRMED";
    const hotelName = await getHotelNameByUid(bookingData.hotelUid);
    const shouldSaveHotelName =
      hotelName && isMissingHotelName(bookingData.hotelName);
    const updateData: Record<string, unknown> = {};

    await sendWhatsAppNotification("notification", [
      `New Hotel Booking: ${event.params.bookingId}`,
    ]);

    if (shouldSaveHotelName) {
      updateData.hotelName = hotelName;
    }

    if (isPaidBooking && isConfirmedBooking) {
      if (Object.keys(updateData).length > 0) {
        await snapshot.ref.update(updateData);
      }

      logger.info(
        `Hotel Booking ${event.params.bookingId} is paid and confirmed. ` +
          "Skipping Pending enforcement.",
      );
      return;
    }

    if (
      bookingData.status !== "Pending" ||
      bookingData.isBookingConfirmed !== false
    ) {
      logger.info(
        "Enforcing manual approval for Hotel Booking " +
          `${event.params.bookingId}. Resetting to Pending.`,
      );

      await snapshot.ref.update({
        ...updateData,
        status: "Pending",
        bookingStatus: "PENDING",
        isBookingConfirmed: false,
        autoAccepted: false,
      });
    } else if (Object.keys(updateData).length > 0) {
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

    const statusBefore = before.status || before.bookingStatus;
    const statusAfter = after.status || after.bookingStatus;

    if (statusBefore === statusAfter) return;

    logger.info(
      `Hotel Booking ${event.params.bookingId} status changed: ` +
        `${statusBefore} -> ${statusAfter}`,
    );

    if (statusAfter === "Accepted" || statusAfter === "ACCEPTED") {
      logger.info("Sending WhatsApp Notification: Booking Accepted");
      await sendWhatsAppNotification("notification", [
        `Hotel Booking ${event.params.bookingId} Accepted`,
      ]);
    }

    if (
      statusAfter === "Canceled" ||
      statusAfter === "CANCELED" ||
      statusAfter === "Cancelled"
    ) {
      logger.info("Sending WhatsApp Notification: Booking Canceled");
      await sendWhatsAppNotification("notification", [
        `Hotel Booking ${event.params.bookingId} Cancelled`,
      ]);
    }
  },
);
