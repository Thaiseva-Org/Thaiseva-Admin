import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "../firebase/firebase.config";

const functions = getFunctions(app, "asia-east2");
const acceptCallable = httpsCallable(
  functions,
  "acceptHotelBookingWithAvailability"
);

/**
 * Admin accept with capacity check + night ledger reserve.
 * @param {string} bookingId
 */
export async function acceptHotelBookingWithAvailability(bookingId) {
  const result = await acceptCallable({ bookingId });
  return result.data;
}
