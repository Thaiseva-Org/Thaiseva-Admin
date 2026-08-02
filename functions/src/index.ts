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
import {
  getHotelAvailability,
  getHotelAvailabilityCalendar,
  manageHotelAvailability,
  releaseHotelInventory,
} from "./hotelAvailabilityWorkflow";
import {
  checkHotelAvailability,
  createHotelBookingWithAvailability,
  acceptHotelBookingWithAvailability,
  startHotelBookingHold,
  completeHotelBookingHold,
  releaseHotelBookingHold,
  expireHotelBookingHolds,
} from "./hotelBookingWithAvailability";
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

// Hotel room availability — ADMIN PORTAL ONLY (Admin / Sub Admin)
exports.getHotelAvailability = getHotelAvailability;
exports.getHotelAvailabilityCalendar = getHotelAvailabilityCalendar;
exports.manageHotelAvailability = manageHotelAvailability;
exports.releaseHotelInventory = releaseHotelInventory;

// Website / app hotel booking with inventory (auto-accept vs pending)
exports.checkHotelAvailability = checkHotelAvailability;
exports.createHotelBookingWithAvailability = createHotelBookingWithAvailability;
// Admin manual accept with capacity check + night ledger reserve
exports.acceptHotelBookingWithAvailability = acceptHotelBookingWithAvailability;
// Soft hold: start (lock) → complete (book) → release (unlock) + TTL expire
exports.startHotelBookingHold = startHotelBookingHold;
exports.completeHotelBookingHold = completeHotelBookingHold;
exports.releaseHotelBookingHold = releaseHotelBookingHold;
exports.expireHotelBookingHolds = expireHotelBookingHolds;

// Website/app booking create APIs (HTTPS + CORS) — paymentMethod: STRIPE | THAI_QR | ONSITE
exports.createHotelBooking = createHotelBooking;
exports.createSightseeingBooking = createSightseeingBooking;
exports.createCarBooking = createCarBooking;
exports.createVanBooking = createVanBooking;
exports.createSelfDriveBooking = createSelfDriveBooking;
exports.getTransportBooking = getTransportBooking;
exports.createCheckoutSession = createCheckoutSession;
exports.verifySession = verifySession;
exports.stripeWebhook = stripeWebhook;


// exports.sendEmail = onRequest(async (req, res) => {
//   if (!req.body.to || !req.body.subject || !req.body.text) {
//     res
//       .status(400)
//       .json({ error: "Missing to, subject, or text in request body" });
//     return;
//   }
//   const result = sendEmail(req.body.to, req.body.subject, req.body.text);
//   res.json({ result });
// });

// exports.findNearestLocations = onRequest(async (req, res) => {
//   const { lat, lng } = req.query;
//   if (!lat || !lng) {
//     res.status(400).json({ error: "Missing lat or lng query parameter" });
//     return;
//   }
//   const placesRes = await fetch(
//     mapNearbySearchUrl({ lat: lat as string, lng: lng as string })
//   );
//   const places = await placesRes.json();
//   const placeIds = places.results.map((place: { place_id: string }) =>
//     place.place_id
//   );

//   const snapshot: QuerySnapshot = await getFirestore()
//     .collection("shops")
//     .where("id", "in", placeIds)
//     .get();

//   const filteredPlaces = snapshot.docs.map((doc: QueryDocumentSnapshot) => {
//     return doc.data();
//   });

//   res.json(filteredPlaces);
// });
