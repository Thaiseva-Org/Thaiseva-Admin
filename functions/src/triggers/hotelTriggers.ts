import {
  onDocumentCreated,
  onDocumentUpdated,
} from "firebase-functions/v2/firestore";
import { getFirestore } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import { sendTelegramNotification } from "../utils/telegram";

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

    const name = bookingData.customerName || bookingData.name || bookingData.firstName || "Unknown Customer";
    const finalHotelName = shouldSaveHotelName ? hotelName : (bookingData.hotelName || "Unknown Hotel");
    const checkIn = bookingData.checkInDate || bookingData.checkIn || "Unknown";
    const checkOut = bookingData.checkOutDate || bookingData.checkOut || "Unknown";
    const amount = bookingData.totalAmount || bookingData.price || "N/A";

    const message = `<b>🏨 New Hotel Booking</b>\n` +
                    `🆔 <code>${event.params.bookingId}</code>\n` +
                    `👤 ${name}\n` +
                    `🏢 ${finalHotelName}\n` +
                    `📅 ${checkIn} - ${checkOut}\n` +
                    `💰 ฿${amount}`;

    await sendTelegramNotification(message);

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

    const name = after.customerName || after.name || after.firstName || "Unknown Customer";
    const finalHotelName = after.hotelName || "Unknown Hotel";

    if (statusAfter === "Accepted" || statusAfter === "ACCEPTED") {
      logger.info("Sending Telegram Notification: Booking Accepted");
      await sendTelegramNotification(
        `<b>✅ Hotel Booking Accepted</b>\n` +
        `🆔 <code>${event.params.bookingId}</code>\n` +
        `👤 ${name}\n` +
        `🏢 ${finalHotelName}`
      );
    }

    if (
      statusAfter === "Canceled" ||
      statusAfter === "CANCELED" ||
      statusAfter === "Cancelled"
    ) {
      logger.info("Sending Telegram Notification: Booking Canceled");
      await sendTelegramNotification(
        `<b>❌ Hotel Booking Cancelled</b>\n` +
        `🆔 <code>${event.params.bookingId}</code>\n` +
        `👤 ${name}\n` +
        `🏢 ${finalHotelName}`
      );
    }
  },
);
