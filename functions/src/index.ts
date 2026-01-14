import { initializeApp } from "firebase-admin/app";
import { autoAcceptSightseeingBookings } from "./triggers/bookingTriggers";

initializeApp();

exports.autoAcceptSightseeingBookingsV2 = autoAcceptSightseeingBookings;

import { forceHotelBookingPending, onHotelBookingStatusChangeV2 } from "./triggers/hotelTriggers";
exports.forceHotelBookingPending = forceHotelBookingPending;
exports.onHotelBookingStatusChangeV2 = onHotelBookingStatusChangeV2;

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
