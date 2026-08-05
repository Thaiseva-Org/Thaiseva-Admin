/**
 * Create Stripe Checkout for an existing unpaid booking (My Bookings).
 * Security: ownership required; package amounts re-priced from catalog;
 * previous open Checkout sessions expired to reduce double-pay risk.
 */
import * as admin from "firebase-admin";
import {onRequest} from "firebase-functions/v2/https";
import {
  createCheckoutSessionCore,
  expireCheckoutSessionSafe,
} from "../payments/createCheckoutSessionCore";
import {
  httpsOpts,
  stringValue,
  withBookingHttp,
  HttpError,
  parseNumber,
} from "../payments/corsAuth";
import {
  isCanceledBooking,
  resolveCollection,
} from "../payments/markBookingPaid";
import {trustedSightseeingAmount} from "../payments/packagePricing";
import {okStripe} from "./response";

const db = () => admin.firestore();

const amountFromBooking = (data: Record<string, unknown>): number => {
  // Prefer remaining balance after partial accept / top-up
  const due = parseNumber(data.amountDue, 0);
  if (data.isPaymentDone !== true && due > 0) {
    return Math.max(0, due);
  }
  const n = parseNumber(
    data.amountTHB ??
      data.totalAmount ??
      data.finalAmount ??
      data.AmountOffered ??
      data.price ??
      data.amount ??
      data.subtotal,
    0,
  );
  return Math.max(0, n);
};

/**
 * Hotel may only be paid when accepted (including partial instant portion).
 * Does not rely solely on isBookingConfirmed side effects.
 */
export const isBookingApprovedForPayment = (
  data: Record<string, unknown>,
): boolean => {
  if (isCanceledBooking(data)) return false;

  const st = stringValue(data.bookingStatus || data.status, 60)
    .toUpperCase()
    .replace(/-/g, "_")
    .replace(/\s+/g, "_");

  const roomsInstant = Math.max(0, parseNumber(data.roomsInstant, 0));
  const roomsPending = Math.max(0, parseNumber(data.roomsPending, 0));
  const sourcePath = stringValue(data.sourcePath, 80).toLowerCase();

  const isPartial =
    st.includes("PARTIAL") ||
    sourcePath.includes("partial") ||
    (roomsInstant > 0 && roomsPending > 0);

  // Explicit pure pending — not payable
  const purePending =
    st === "PENDING" ||
    st === "PENDING_REVIEW" ||
    st === "NOT_REVIEWED";

  if (
    purePending &&
    data.isBookingConfirmed !== true &&
    data.inventoryReserved !== true &&
    data.autoAccepted !== true &&
    roomsInstant <= 0
  ) {
    return false;
  }

  // Partially confirmed: pay only for already-accepted / inventory-locked rooms
  if (isPartial) {
    return (
      data.isBookingConfirmed === true ||
      data.inventoryReserved === true ||
      data.autoAccepted === true ||
      roomsInstant > 0 ||
      st.includes("ACCEPT") ||
      st === "AWAITING_PAYMENT"
    );
  }

  return (
    data.isBookingConfirmed === true ||
    st === "ACCEPTED" ||
    st === "CONFIRMED" ||
    st === "AWAITING_PAYMENT" ||
    st.includes("ACCEPT") ||
    data.autoAccepted === true ||
    data.inventoryReserved === true
  );
};

/**
 * Ownership for payment: prefer UID. Email match alone is allowed only when
 * the booking has no userId/authUid (guest-style records).
 */
const ownsBookingForPayment = (
  data: Record<string, unknown>,
  uid: string,
  email?: string,
): boolean => {
  const ids = [data.userId, data.authUid, data.uId, data.uid]
    .map((v) => stringValue(v, 128))
    .filter(Boolean);

  if (ids.length > 0) {
    return ids.includes(uid);
  }

  // No owner uid on doc — email match only
  if (email) {
    const emails = [
      data.guestEmail,
      data.email,
      data.userEmail,
      (data.guestDetails as {email?: string} | undefined)?.email,
    ]
      .map((v) => stringValue(v, 200).toLowerCase())
      .filter(Boolean);
    return emails.includes(email.toLowerCase());
  }
  return false;
};

const productNameFor = (
  collection: string,
  data: Record<string, unknown>,
): string => {
  if (collection === "hotelBookingData") {
    return (
      stringValue(data.hotelName || data.roomName, 120) ||
      "Hotel booking"
    );
  }
  if (collection === "travelBookingDetails") {
    return (
      stringValue(data.packageName || data.title, 120) ||
      "Sightseeing package"
    );
  }
  if (collection === "car_bookings") return "Car / taxi transfer";
  if (collection === "vanBookings") return "Van transfer";
  if (collection === "self_driving_bookings") return "Self-drive rental";
  return "Thaiseva booking";
};

const bookingTypeFor = (collection: string): string => {
  if (collection === "hotelBookingData") return "hotel";
  if (collection === "travelBookingDetails") return "sightseeing";
  if (collection === "car_bookings") return "car";
  if (collection === "vanBookings") return "van";
  if (collection === "self_driving_bookings") return "selfDrive";
  return collection;
};

export const createCheckoutSession = onRequest(
  httpsOpts,
  withBookingHttp(async ({res, body, auth}) => {
    const bookingId = stringValue(body.bookingId || body.id, 200);
    const collectionRaw = stringValue(
      body.bookingCollection || body.collection || body.bookingType,
      80,
    );
    const collection = resolveCollection(collectionRaw);
    if (!bookingId || !collection) {
      throw new HttpError(
        400,
        "bookingId and a valid bookingCollection/bookingType are required.",
        "INVALID_ARGUMENT",
      );
    }

    // Transport: amount is admin-quoted; no Stripe Checkout
    if (
      collection === "car_bookings" ||
      collection === "vanBookings" ||
      collection === "self_driving_bookings"
    ) {
      throw new HttpError(
        400,
        "Stripe is not available for transport bookings. Admin sets the amount; fetch the booking for price.",
        "TRANSPORT_NO_STRIPE",
      );
    }

    const ref = db().collection(collection).doc(bookingId);
    const snap = await ref.get();
    if (!snap.exists) {
      throw new HttpError(404, "Booking not found.", "NOT_FOUND");
    }
    const data = snap.data() || {};

    if (!ownsBookingForPayment(data, auth.uid, auth.email)) {
      throw new HttpError(
        403,
        "You do not own this booking.",
        "FORBIDDEN",
      );
    }

    if (isCanceledBooking(data)) {
      throw new HttpError(
        400,
        "This booking was canceled and cannot be paid.",
        "CANCELED",
      );
    }

    if (data.isPaymentDone === true) {
      throw new HttpError(
        400,
        "This booking is already paid.",
        "ALREADY_PAID",
      );
    }

    // Hotel: only accept payment when accepted / awaiting payment
    // (including partially confirmed instant portion — not pure pending)
    if (collection === "hotelBookingData") {
      if (!isBookingApprovedForPayment(data)) {
        throw new HttpError(
          400,
          "This hotel request is still pending. Payment opens after acceptance.",
          "NOT_ACCEPTED",
        );
      }
    }

    // Trusted amount: re-price packages from catalog (blocks client underpayment)
    let amount = amountFromBooking(data);
    if (collection === "travelBookingDetails") {
      const trusted = await trustedSightseeingAmount(data);
      if (trusted != null && trusted > 0) {
        amount = trusted;
        // Keep Firestore amount aligned with what we charge
        if (Math.abs(amountFromBooking(data) - trusted) > 0.01) {
          await ref.set(
            {
              totalAmount: trusted,
              price: trusted,
              amount: trusted,
              amountCorrectedAt:
                admin.firestore.FieldValue.serverTimestamp(),
              amountCorrectedFrom: amountFromBooking(data),
            },
            {merge: true},
          );
        }
      }
    }

    // Hotel: never trust client-mutated amount if amountTHB missing — use stored only
    // (hotel create is Functions-only; amount already server-set)

    if (amount < 20) {
      throw new HttpError(
        400,
        "Booking has no payable amount (min 20 THB).",
        "INVALID_AMOUNT",
      );
    }
    if (amount > 500_000) {
      throw new HttpError(
        400,
        "Amount exceeds maximum allowed for online payment.",
        "INVALID_AMOUNT",
      );
    }

    // Expire previous open Checkout to reduce double-charge risk
    await expireCheckoutSessionSafe(stringValue(data.stripeSessionId, 200));

    let session;
    try {
      session = await createCheckoutSessionCore({
        amount,
        currency: stringValue(data.currency, 10).toLowerCase() || "thb",
        productName: productNameFor(collection, data),
        customerEmail:
          stringValue(data.guestEmail || data.email || data.userEmail, 200) ||
          auth.email,
        successUrl: stringValue(body.successUrl || body.success_url, 2000),
        cancelUrl: stringValue(body.cancelUrl || body.cancel_url, 2000),
        metadata: {
          bookingId,
          bookingCollection: collection,
          bookingType: bookingTypeFor(collection),
          userId: auth.uid,
        },
        idempotencyKey:
          `pay_${collection}_${bookingId}_${Date.now()}`.slice(0, 255),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Stripe error";
      throw new HttpError(
        502,
        `Could not create payment link: ${msg}`,
        "STRIPE_ERROR",
      );
    }

    await ref.set(
      {
        stripeSessionId: session.id,
        paymentMethod: "STRIPE",
        modeOfPayment: "ONLINE",
        // Store what we charged so ops can reconcile
        stripeChargeAmount: amount,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      {merge: true},
    );

    res.status(200).json(
      okStripe(
        {
          bookingId,
          bookingCollection: collection,
          amount,
          currency: session.currency,
          status: stringValue(data.status, 40),
          bookingStatus: stringValue(data.bookingStatus, 40),
          payNow: true,
        },
        session,
      ),
    );
  }),
);
