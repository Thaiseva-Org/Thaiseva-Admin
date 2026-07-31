import { normalizeVanStatus } from "./bookingStatus";
import { toDate } from "./bookingTimestamps";

/** Normalize manual or mobile van booking documents for admin UI */
export const normalizeVanBooking = (docData = {}, source = "manual") => {
  const isMobile = source === "mobile";

  const bookingDateRaw = isMobile
    ? docData.time || docData.timestamp || docData.bookingDate || docData.createdAt
    : docData.bookingDate || docData.createdAt;

  const bookingDate = toDate(bookingDateRaw);

  return {
    ...docData,
    id: docData.id,
    source: isMobile ? "mobile" : "manual",
    guestName: isMobile
      ? docData.name || docData.guestName || "N/A"
      : docData.guestName || docData.name || "N/A",
    guestPhone: isMobile
      ? docData.contact || docData.phone || docData.guestPhone || "N/A"
      : docData.guestPhone || docData.phone || "N/A",
    pickupLocation: isMobile
      ? docData.pickup || docData.pickupLocation || "N/A"
      : docData.pickupLocation || docData.pickup || "N/A",
    dropLocation: isMobile
      ? docData.drop || docData.dropLocation || "N/A"
      : docData.dropLocation || docData.drop || "N/A",
    vanType: docData.vanTypeName || docData.vanType || docData.transportType || "Van",
    vanTypeName: docData.vanTypeName || docData.vanType || docData.transportType || "Van",
    price: Number(docData.price || docData.amount || docData.AmountOffered || 0),
    amount: Number(docData.amount || docData.price || docData.AmountOffered || 0),
    bookingDate: bookingDateRaw,
    bookingDateObj: bookingDate,
    status: normalizeVanStatus(docData),
    transportType: docData.transportType || "Van",
  };
};

export const mapVanBookingForMobileWrite = (formData = {}) => ({
  name: formData.guestName,
  contact: formData.guestPhone,
  pickup: formData.pickupLocation,
  drop: formData.dropLocation,
  time: formData.bookingDate,
  price: Number(formData.price || 0),
  amount: Number(formData.price || 0),
});

export const mapVanBookingForManualWrite = (formData = {}) => ({
  guestName: formData.guestName,
  guestPhone: formData.guestPhone,
  pickupLocation: formData.pickupLocation,
  dropLocation: formData.dropLocation,
  bookingDate: formData.bookingDate,
  vanTypeName: formData.vanTypeName,
  vanType: formData.vanTypeName || formData.vanType,
  price: Number(formData.price || 0),
  amount: Number(formData.price || 0),
});