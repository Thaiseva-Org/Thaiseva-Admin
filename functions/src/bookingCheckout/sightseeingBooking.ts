import {isListingActive} from "../utils/listingStatus";
/** Package bookings: instant from day 3 within daily capacity; otherwise pay after confirmation. */
import * as admin from "firebase-admin";
import {onRequest} from "firebase-functions/v2/https";
import {createCheckoutSessionCore} from "../payments/createCheckoutSessionCore";
import {httpsOpts, stringValue, withBookingHttp, HttpError, parsePositiveInt, parseBool, normalizeEmail, assertUserMatch} from "../payments/corsAuth";
import {normalizePaymentMethod, modeOfPaymentFor} from "./paymentMethod";
import {getStripe} from "../payments/stripeClient";
import {trustedSightseeingAmount} from "../payments/packagePricing";
const flow = require("../../sightseeingFlow");
const db = () => admin.firestore();
const COLLECTION = "travelBookingDetails";

export const createSightseeingBooking = onRequest(httpsOpts, withBookingHttp(async ({res, body, auth}) => {
  const userId = assertUserMatch(auth, body.userId);
  const method = normalizePaymentMethod(body.paymentMethod || body.paymentMethodIntent);
  const packageId = stringValue(body.packageId || body.serviceId || body.id, 120);
  let pkg = await db().collection("sightseeingPackagesDetails").doc(packageId).get();
  if (!pkg.exists) {
    const found = await db().collection("sightseeingPackagesDetails").where("packageId", "==", packageId).limit(1).get();
    if (found.empty) throw new HttpError(404, "Package not found.", "PACKAGE_NOT_FOUND");
    pkg = found.docs[0];
  }
  const catalog = pkg.data() || {};
  if (!isListingActive(catalog)) throw new HttpError(409, "This package is currently unavailable.", "LISTING_INACTIVE");
  const adults = Math.min(50, Math.max(1, parsePositiveInt(body.adults, 1)));
  const children = Math.min(50, Math.max(0, parsePositiveInt(body.children, 0)));
  const arrivalDate = stringValue(body.arrivalDate || body.travelDate || body.date || body.pickUpTime, 10);
  const decision = flow.dateDecision(arrivalDate);
  if (!decision.valid) throw new HttpError(400, decision.message, decision.reasonCode);
  const duration = parsePositiveInt(catalog.period ?? catalog.duration?.days, 1);
  const end = new Date(arrivalDate);
  end.setUTCDate(end.getUTCDate() + duration - 1);
  const departureDate = stringValue(body.departureDate, 10) || end.toISOString().slice(0, 10);
  const amount = await trustedSightseeingAmount({packageId: pkg.id, adults, children});
  if (!amount || amount <= 0) throw new HttpError(400, "Package pricing is not available.", "INVALID_PRICE");
  const fullName = stringValue(body.fullName || (body.guestDetails as Record<string, unknown>)?.name || body.guestName || body.name, 120);
  if (!fullName) throw new HttpError(400, "fullName is required.", "INVALID_ARGUMENT");
  const guestEmail = normalizeEmail(body.guestEmail || body.email || auth.email);
  const guestPhone = stringValue(body.guestPhone || body.phone || body.phoneNumber, 40);
  const packageName = stringValue(catalog.packageName || catalog.title || catalog.name || catalog.meta?.title, 200);
  const id = `pkg_${userId.slice(0, 80)}_${pkg.id.slice(0, 80)}_${arrivalDate}_${departureDate}`.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 120);
  const ref = db().collection(COLLECTION).doc(id);
  const saved = await flow.reserveBooking(db(), admin, ref, {
    userId, authUid: userId, uId: userId, packageId: pkg.id, packageName, title: packageName,
    fullName, guestEmail, guestPhone, email: guestEmail, phone: guestPhone,
    guestDetails: {name: fullName, email: guestEmail, phoneNumber: guestPhone},
    arrivalDate, departureDate, pickUpTime: arrivalDate, pickUpLocation: stringValue(body.pickUpLocation, 300),
    adults, children, totalAmount: amount, price: amount, amount, currency: "THB",
    paymentMethod: method, modeOfPayment: modeOfPaymentFor(method), isPaymentDone: false,
    paymentVerificationStatus: "NOT_PAID", specialRequests: stringValue(body.specialRequests || body.notes, 1000),
    source: stringValue(body.source, 20) || "WEB",
    createdAt: admin.firestore.FieldValue.serverTimestamp(), orderedAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  const booking = saved.data;
  const response = (extra = {}) => ({success: true, bookingId: ref.id, bookingCollection: COLLECTION, amount, currency: "thb", paymentMethod: method, bookingFlow: booking.bookingFlow, status: booking.status, bookingStatus: booking.bookingStatus, isPaymentDone: booking.isPaymentDone === true, isBookingConfirmed: booking.isBookingConfirmed === true, duplicate: saved.duplicate, payNow: false, message: booking.bookingFlowMessage, ...extra});
  if (!flow.approvedForPayment(booking) || booking.isPaymentDone === true) {
    res.status(200).json(response());
    return;
  }
  if (method === "STRIPE") {
    if (amount < 20) throw new HttpError(400, "Card payment requires at least 20 THB.", "INVALID_AMOUNT");
    const paymentIntentId = stringValue(body.paymentIntentId, 200);
    if (paymentIntentId) {
      const pi = await getStripe().paymentIntents.retrieve(paymentIntentId);
      if (pi.status !== "succeeded" || pi.amount !== Math.round(amount * 100) || pi.currency !== "thb") throw new HttpError(400, "Payment does not match this booking.", "INVALID_PAYMENT");
      const used = await db().collection(COLLECTION).where("paymentIntentId", "==", pi.id).get();
      if (used.docs.some(doc => doc.id !== ref.id)) throw new HttpError(409, "Payment already used.", "PAYMENT_ALREADY_USED");
      await ref.update({isPaymentDone: true, status: "Confirmed", bookingStatus: "CONFIRMED", isBookingConfirmed: true, paymentIntentId: pi.id, paymentVerificationStatus: "VERIFIED"});
      res.status(200).json(response({isPaymentDone: true, isBookingConfirmed: true, status: "Confirmed", bookingStatus: "CONFIRMED"}));
      return;
    }
    const session = await createCheckoutSessionCore({amount, currency: "thb", productName: packageName || "Sightseeing package", customerEmail: guestEmail,
      successUrl: stringValue(body.successUrl, 2000), cancelUrl: stringValue(body.cancelUrl, 2000), expiresAt: Math.floor(Date.now() / 1000) + 1800,
      metadata: {bookingId: ref.id, bookingCollection: COLLECTION, bookingType: "sightseeing", userId},
      idempotencyKey: `package_${ref.id}_${Math.floor(Date.now() / 1800000)}`.slice(0, 255),
    });
    await ref.update({stripeSessionId: session.id});
    res.status(200).json(response({payNow: true, stripeUrl: session.url, url: session.url, stripeSessionId: session.id}));
    return;
  }
  if (method === "THAI_QR" && !parseBool(body.customerQrPaymentConfirmed || body.qrPaymentConfirmed || body.qrConfirmed)) throw new HttpError(400, "Please confirm your QR transfer.", "INVALID_ARGUMENT");
  const update = method === "THAI_QR" ? {customerQrPaymentConfirmed: true, paymentVerificationStatus: "PENDING_VERIFICATION", status: "Pending Verification", bookingStatus: "PAYMENT_PENDING_VERIFICATION"} : {status: "Confirmed", bookingStatus: "CONFIRMED", paymentVerificationStatus: "UNVERIFIED"};
  await ref.update(update);
  res.status(200).json(response(update));
}));
