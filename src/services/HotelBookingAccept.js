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
 */
export async function acceptHotelBookingWithAvailability(bookingId) {
  const result = await acceptCallable({ bookingId });
  return result.data;
}
