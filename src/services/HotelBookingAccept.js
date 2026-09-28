import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "../firebase/firebase.config";

const functions = getFunctions(app, "asia-east2");
const acceptCallable = httpsCallable(
  functions,
  "acceptHotelBookingWithAvailability"
);

/**
 * Admin/hotel accept pending booking.
 * If free stock is short, server raises night.total for the stay dates
 * automatically, then books the rooms (confirm availability → expand capacity).
 * @param {string} bookingId
 * @param {number} [acceptedRooms] Total rooms accepted so far; defaults to all.
 */
export async function acceptHotelBookingWithAvailability(bookingId, acceptedRooms) {
  const result = await acceptCallable({ bookingId, ...(acceptedRooms == null ? {} : { acceptedRooms }) });
  return result.data;
}
