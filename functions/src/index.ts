import {onRequest} from "firebase-functions/v2/https";
import {mapNearbySearchUrl} from "./utils/consts";

import {initializeApp} from "firebase-admin/app";
import {DocumentData, getFirestore} from "firebase-admin/firestore";
import {sendEmail} from "./utils/email_sender";

initializeApp();

exports.sendEmail = onRequest(async (req, res) => {
  if (!req.body.to || !req.body.subject || !req.body.text) {
    res
      .status(400)
      .json({error: "Missing to, subject, or text in request body"});
    return;
  }
  const result = sendEmail(req.body.to, req.body.subject, req.body.text);
  res.json({result});
});

exports.findNearestLocations = onRequest(async (req, res) => {
  const {lat, lng} = req.query;
  if (!lat || !lng) {
    res.status(400).json({error: "Missing lat or lng query parameter"});
    return;
  }
  const placesRes = await fetch(
    mapNearbySearchUrl({lat: lat as string, lng: lng as string})
  );
  const places = await placesRes.json();
  const placeIds = places.results.map((place: any) => place.place_id);

  const snapshot: DocumentData = await getFirestore()
    .collection("shops")
    .where("id", "in", placeIds)
    .get();

  const filteredPlaces = snapshot.docs.filter((doc: any) => {
    const place = doc.data();
    return place;
  });

  res.json(filteredPlaces);
});
