import { initializeApp } from "firebase-admin/app";
import {
  autoAcceptSightseeingBookings,
  onSightseeingBookingStatusChange,
} from "./triggers/sightseeingTriggers";
import {
  forceHotelBookingPending,
  onHotelBookingStatusChangeV3,
} from "./triggers/hotelTriggers";
import {
  onCarBookingCreated,
  onCarBookingStatusChange,
  onVanBookingCreated,
  onVanBookingStatusChange,
  onSelfDriveBookingCreated,
  onSelfDriveBookingStatusChange,
} from "./triggers/transportTriggers";
import { deleteUserFunction } from "./accountDeletion";
import {
  initializeLegacyTransportBooking,
  createManualVanBooking,
  seedTransportDemoData,
  manageTransportBooking,
  manageTransportResource,
} from "./transportWorkflow";

// Simple stock APIs (numbers: free = total - locked - booked)
import {
  checkHotelStock,
  lockHotelStock,
  unlockHotelStock,
  expireHotelStockHolds,
  manageHotelStock,
  // Compatibility aliases for old website clients
  checkHotelAvailability,
  startHotelBookingHold,
  releaseHotelBookingHold,
  expireHotelBookingHolds,
} from "./hotelStockApi";

import {
  createHotelBookingWithAvailability,
  acceptHotelBookingWithAvailability,
  completeHotelBookingHold,
  getHotelAvailability,
  getHotelAvailabilityCalendar,
  releaseHotelInventory,
  unlockHotelRoomLock,
} from "./hotelBookingStock";

import {createHotelBooking} from "./bookingCheckout/hotelBooking";
import {createSightseeingBooking} from "./bookingCheckout/sightseeingBooking";
import {
  createCarBooking,
  createVanBooking,
  createSelfDriveBooking,
  getTransportBooking,
} from "./bookingCheckout/transportBooking";
import {createCheckoutSession} from "./bookingCheckout/payExisting";
import {stripeWebhook} from "./payments/stripeWebhook";
import {verifySession} from "./payments/verifySession";

initializeApp();

exports.autoAcceptSightseeingBookingsV2 = autoAcceptSightseeingBookings;
exports.forceHotelBookingPending = forceHotelBookingPending;
exports.onHotelBookingStatusChangeV3 = onHotelBookingStatusChangeV3;
exports.onSightseeingBookingStatusChange = onSightseeingBookingStatusChange;
exports.onCarBookingCreated = onCarBookingCreated;
exports.onCarBookingStatusChange = onCarBookingStatusChange;
exports.onVanBookingCreated = onVanBookingCreated;
exports.onVanBookingStatusChange = onVanBookingStatusChange;
exports.onSelfDriveBookingCreated = onSelfDriveBookingCreated;
exports.onSelfDriveBookingStatusChange = onSelfDriveBookingStatusChange;
exports.deleteUserFunction = deleteUserFunction;
exports.manageTransportBooking = manageTransportBooking;
exports.manageTransportResource = manageTransportResource;
exports.initializeLegacyTransportBooking = initializeLegacyTransportBooking;
exports.createManualVanBooking = createManualVanBooking;
exports.seedTransportDemoData = seedTransportDemoData;

// --- Simple hotel stock (primary) ---
exports.checkHotelStock = checkHotelStock;
exports.lockHotelStock = lockHotelStock;
exports.unlockHotelStock = unlockHotelStock;
exports.expireHotelStockHolds = expireHotelStockHolds;
exports.manageHotelStock = manageHotelStock;

// --- Compatibility names (same stock data) ---
exports.checkHotelAvailability = checkHotelAvailability;
exports.startHotelBookingHold = startHotelBookingHold;
exports.completeHotelBookingHold = completeHotelBookingHold;
exports.releaseHotelBookingHold = releaseHotelBookingHold;
exports.expireHotelBookingHolds = expireHotelBookingHolds;
exports.createHotelBookingWithAvailability = createHotelBookingWithAvailability;
exports.acceptHotelBookingWithAvailability = acceptHotelBookingWithAvailability;
exports.getHotelAvailability = getHotelAvailability;
exports.getHotelAvailabilityCalendar = getHotelAvailabilityCalendar;
exports.manageHotelAvailability = manageHotelStock;
exports.releaseHotelInventory = releaseHotelInventory;
exports.unlockHotelRoomLock = unlockHotelRoomLock;

// Website/app booking create APIs (HTTPS + CORS)
exports.createHotelBooking = createHotelBooking;
exports.createSightseeingBooking = createSightseeingBooking;
exports.createCarBooking = createCarBooking;
exports.createVanBooking = createVanBooking;
exports.createSelfDriveBooking = createSelfDriveBooking;
exports.getTransportBooking = getTransportBooking;
exports.createCheckoutSession = createCheckoutSession;
exports.verifySession = verifySession;
exports.stripeWebhook = stripeWebhook;
