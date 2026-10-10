import { getFirestore } from "firebase-admin/firestore";
import {
  hotelName as pickHotelName,
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
  _bookingData: BookingData,
  _metadata: Awaited<ReturnType<typeof resolveHotelBookingMetadata>>,
) => "New hotel booking. Review in the authenticated dashboard: https://admin.thaiseva.com/dashboard";

export const formatHotelStatusTelegramMessage = (_title: string, _bookingData: BookingData) =>
  "Hotel booking status changed. Review in the authenticated dashboard: https://admin.thaiseva.com/dashboard";

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