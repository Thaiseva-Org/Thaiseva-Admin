export {recordHotelPrivacyLifecycle} from "./privacyLifecycle";
import { initializeApp } from "firebase-admin/app";
export {getFoodOrderPhoto} from "./orderMedia";
export {getIdentityDocument} from "./identityMedia";
export { createVerifiedAccount } from "./verifiedSignup";
export {createSubAdmin, exportCustomerData} from "./privilegedAccounts";
export {
  sendEmailOtp, resendEmailOtp, verifyEmailOtp,
} from "./emailOtp";
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
  onSelfDriveBookingCreated,
  onSelfDriveBookingStatusChange,
} from "./triggers/transportTriggers";
import { deleteUserFunction } from "./accountDeletion";
import {
  initializeLegacyTransportBooking,
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
  createSelfDriveBooking,
  createTaxiBooking,
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
exports.onSelfDriveBookingCreated = onSelfDriveBookingCreated;
exports.onSelfDriveBookingStatusChange = onSelfDriveBookingStatusChange;
exports.deleteUserFunction = deleteUserFunction;
exports.manageTransportBooking = manageTransportBooking;
exports.manageTransportResource = manageTransportResource;
exports.initializeLegacyTransportBooking = initializeLegacyTransportBooking;

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
// Transport: 2 products only — car booking (car|van|taxi|bike) + self-drive
exports.createCarBooking = createCarBooking;
exports.createSelfDriveBooking = createSelfDriveBooking;
// Legacy alias → createCarBooking with transportType taxi
exports.createTaxiBooking = createTaxiBooking;
exports.getTransportBooking = getTransportBooking;
exports.createCheckoutSession = createCheckoutSession;
exports.verifySession = verifySession;
exports.stripeWebhook = stripeWebhook;
export {runPrivacyRetention, previewPrivacyRetention} from "./retentionMaintenance";
