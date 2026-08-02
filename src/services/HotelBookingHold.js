import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "../firebase/firebase.config";

const functions = getFunctions(app, "asia-east2");

const startHoldCallable = httpsCallable(functions, "startHotelBookingHold");
const completeHoldCallable = httpsCallable(functions, "completeHotelBookingHold");
const releaseHoldCallable = httpsCallable(functions, "releaseHotelBookingHold");

/**
 * 1) Booking started → soft-lock free rooms (default 10 min).
 * @param {object} payload hotelId, packageId/roomId, checkIn, checkOut, rooms, holdMinutes?
 */
export async function startHotelBookingHold(payload) {
  const result = await startHoldCallable(payload);
  return result.data;
}

/**
 * 2) Booking done → create Accepted/Pending booking(s); keep locked rooms booked.
 * @param {object} payload holdId + guest fields (fullName, guestEmail, ...)
 */
export async function completeHotelBookingHold(payload) {
  const result = await completeHoldCallable(payload);
  return result.data;
}

/**
 * 3) User left without booking → unlock rooms immediately.
 * @param {string} holdId
 */
export async function releaseHotelBookingHold(holdId) {
  const result = await releaseHoldCallable({ holdId });
  return result.data;
}
