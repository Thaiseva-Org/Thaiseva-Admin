import { getFirestore } from "firebase-admin/firestore";
import {
  customerName,
  customerPhone,
  escapeHtml,
  hotelName as pickHotelName,
  icon,
  money,
  packageName,
  pick,
} from "./bookingNotification";

type BookingData = Record<string, unknown>;

const isMissingHotelName = (hotelName: unknown) => {
  if (typeof hotelName !== "string") return true;

  const normalizedName = hotelName.trim().toLowerCase();
  return !normalizedName || normalizedName === "hotel";
};

export const getHotelNameByUid = async (hotelUid?: string) => {
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

export const resolveHotelBookingMetadata = async (bookingData: BookingData) => {
  const hotelName = await getHotelNameByUid(bookingData.hotelUid as string | undefined);
  const shouldSaveHotelName =
    hotelName && isMissingHotelName(bookingData.hotelName);

  const finalHotelName = shouldSaveHotelName ?
    hotelName :
    pickHotelName(bookingData, "Unknown Hotel");

  return {
    hotelName,
    shouldSaveHotelName,
    finalHotelName,
    room: packageName(bookingData, "Room not selected"),
    checkIn: pick(bookingData, ["checkInDate", "checkIn"], "Unknown"),
    checkOut: pick(bookingData, ["checkOutDate", "checkOut"], "Unknown"),
    amount: money(bookingData, [
      "totalAmount",
      "totalPrice",
      "amountTHB",
      "amount",
      "priceForStay.totalAmount",
      "price",
    ]),
  };
};

export const formatNewHotelTelegramMessage = (
  bookingData: BookingData,
  metadata: Awaited<ReturnType<typeof resolveHotelBookingMetadata>>,
) =>
  `<b>${icon.hotel} New Hotel Booking</b>\n` +
  `${icon.customer} ${escapeHtml(customerName(bookingData))}\n` +
  `${icon.phone} ${escapeHtml(customerPhone(bookingData))}\n` +
  `${icon.hotel} ${escapeHtml(metadata.finalHotelName)}\n` +
  `${icon.package} ${escapeHtml(metadata.room)}\n` +
  `${icon.calendar} ${escapeHtml(metadata.checkIn)} - ${escapeHtml(metadata.checkOut)}\n` +
  `${icon.amount} ${escapeHtml(metadata.amount)}`;

export const formatHotelStatusTelegramMessage = (
  title: string,
  bookingData: BookingData,
) => {
  const finalHotelName = pickHotelName(bookingData, "Unknown Hotel");
  const room = packageName(bookingData, "Room not selected");

  return `<b>${title}</b>\n` +
    `${icon.customer} ${escapeHtml(customerName(bookingData))}\n` +
    `${icon.phone} ${escapeHtml(customerPhone(bookingData))}\n` +
    `${icon.hotel} ${escapeHtml(finalHotelName)}\n` +
    `${icon.package} ${escapeHtml(room)}`;
};

export const buildHotelPendingEnforcementUpdate = (
  bookingData: BookingData,
  metadata: Awaited<ReturnType<typeof resolveHotelBookingMetadata>>,
): Record<string, unknown> => {
  const updateData: Record<string, unknown> = {};

  if (metadata.shouldSaveHotelName && metadata.hotelName) {
    updateData.hotelName = metadata.hotelName;
  }

  if (
    bookingData.status !== "Pending" ||
    bookingData.isBookingConfirmed !== false
  ) {
    return {
      ...updateData,
      status: "Pending",
      bookingStatus: "PENDING",
      isBookingConfirmed: false,
      autoAccepted: false,
    };
  }

  return updateData;
};