import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "../firebase/firebase.config";

const functions = getFunctions(app, "asia-east2");

// Prefer new stock APIs; fall back names still work on server (same stock data).
const lockCallable = httpsCallable(functions, "lockHotelStock");
const unlockCallable = httpsCallable(functions, "unlockHotelStock");
const startHoldCallable = httpsCallable(functions, "startHotelBookingHold");
const completeHoldCallable = httpsCallable(functions, "completeHotelBookingHold");
const releaseHoldCallable = httpsCallable(functions, "releaseHotelBookingHold");

/**
 * 1) Booking started → soft-lock free rooms (default 10 min).
 * All-or-nothing on stock numbers.
 */
export async function startHotelBookingHold(payload) {
  try {
    const result = await lockCallable({
      ...payload,
      action: "hold",
      kind: "hold",
    });
    const data = result.data || {};
    return {
      ...data,
      holdId: data.lockId || data.holdId,
      lockId: data.lockId || data.holdId,
      locked: data.ok !== false,
      roomsHeld: data.rooms || data.roomsHeld || 0,
    };
  } catch (e) {
    // Fallback to compatibility function name
    const result = await startHoldCallable(payload);
    return result.data;
  }
}

/**
 * 2) Booking done → convert hold to booked + create booking.
 */
export async function completeHotelBookingHold(payload) {
  const result = await completeHoldCallable({
    ...payload,
    lockId: payload.lockId || payload.holdId,
    holdId: payload.holdId || payload.lockId,
  });
  return result.data;
}

/**
 * 3) User left without booking → unlock rooms immediately.
 * @param {string} holdId
 */
export async function releaseHotelBookingHold(holdId) {
  try {
    const result = await unlockCallable({ lockId: holdId, holdId });
    return result.data;
  } catch (e) {
    const result = await releaseHoldCallable({ holdId });
    return result.data;
  }
}

/** Direct stock lock (hold or book). */
export async function lockHotelStock(payload) {
  const result = await lockCallable(payload);
  return result.data;
}

/** Direct stock unlock. */
export async function unlockHotelStock(payload) {
  const result = await unlockCallable(
    typeof payload === "string" ? { lockId: payload } : payload
  );
  return result.data;
}
