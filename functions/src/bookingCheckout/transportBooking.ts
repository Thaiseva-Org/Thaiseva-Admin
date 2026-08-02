/**
 * Transport booking APIs (car / van / self-drive)
 *
 * Product model (no Stripe):
 * 1) User submits trip details → Pending booking (no price charged online)
 * 2) Admin sets amount / accepts via admin portal (manageTransportBooking)
 * 3) User fetches booking from backend to see price & status
 *
 * paymentMethod STRIPE is rejected. Optional preference: THAI_QR | ONSITE | PENDING_QUOTE.
 */
import * as admin from "firebase-admin";
import {onRequest} from "firebase-functions/v2/https";
import {
  httpsOpts,
  stringValue,
  withBookingHttp,
  HttpError,
  assertUserMatch,
  parseNumber,
  normalizeEmail,
} from "../payments/corsAuth";
import {normalizePaymentMethod} from "./paymentMethod";

const db = () => admin.firestore();

type TransportKind = "car" | "van" | "selfDrive";

const COLLECTION: Record<TransportKind, string> = {
  car: "car_bookings",
  van: "vanBookings",
  selfDrive: "self_driving_bookings",
};

const label: Record<TransportKind, string> = {
  car: "Car / taxi",
  van: "Van",
  selfDrive: "Self-drive",
};

/** Map client payment preference — never Stripe for transport. */
const paymentPreference = (
  raw: unknown,
): {
  paymentMethod: string;
  modeOfPayment: string;
  paymentNote: string;
} => {
  const method = normalizePaymentMethod(raw, "ONSITE");
  if (method === "STRIPE") {
    // Caller should have rejected; defensive fallback
    return {
      paymentMethod: "PENDING_ADMIN",
      modeOfPayment: "OFFLINE",
      paymentNote:
        "Transport is not paid via Stripe. Admin will quote the amount.",
    };
  }
  if (method === "THAI_QR") {
    return {
      paymentMethod: "THAI_QR",
      modeOfPayment: "ONLINE",
      paymentNote:
        "Preferred Thai QR after admin sets the price. Not verified yet.",
    };
  }
  return {
    paymentMethod: "ONSITE",
    modeOfPayment: "OFFLINE",
    paymentNote: "Pay as arranged after admin confirms amount.",
  };
};

const buildHandler = (kind: TransportKind) =>
  withBookingHttp(async ({res, body, auth}) => {
    const userId = assertUserMatch(auth, body.userId);
    const collection = COLLECTION[kind];

    // Explicit: no card/Stripe checkout for transport
    const rawPay = body.paymentMethod || body.paymentMethodIntent;
    if (rawPay != null && String(rawPay).trim() !== "") {
      const normalized = normalizePaymentMethod(rawPay, "ONSITE");
      if (normalized === "STRIPE") {
        throw new HttpError(
          400,
          "Stripe is not available for transport bookings. Submit the request; admin will set the amount. Fetch the booking later for price.",
          "TRANSPORT_NO_STRIPE",
        );
      }
    }

    const customerName = stringValue(
      body.customerName || body.fullName || body.guestName || body.name,
      120,
    );
    const customerPhone = stringValue(
      body.customerPhone || body.guestPhone || body.phone || body.contact,
      40,
    );
    const customerEmail = normalizeEmail(
      body.customerEmail || body.guestEmail || body.email || auth.email,
    );
    const pickup = stringValue(
      body.pickup || body.pickupLocation || body.from,
      300,
    );
    const destination = stringValue(
      body.destination || body.drop || body.dropLocation || body.to,
      300,
    );
    const notes = stringValue(body.notes || body.specialRequests, 500);

    // Optional client hint only — NOT the billable amount (admin sets AmountOffered/finalAmount)
    const requestedAmountHint = Math.max(
      0,
      parseNumber(
        body.requestedAmount ?? body.amountHint ?? body.budget,
        0,
      ),
    );

    if (!customerName || !customerPhone) {
      throw new HttpError(
        400,
        "customerName and customerPhone are required.",
        "INVALID_ARGUMENT",
      );
    }
    if (!pickup || !destination) {
      throw new HttpError(
        400,
        "pickup and destination are required.",
        "INVALID_ARGUMENT",
      );
    }
    if (requestedAmountHint > 200_000) {
      throw new HttpError(
        400,
        "requestedAmount hint is out of range.",
        "INVALID_AMOUNT",
      );
    }

    const travelAtRaw =
      body.travelAt || body.bookingDate || body.time || body.date;
    let travelAt: admin.firestore.Timestamp | string | null = null;
    if (travelAtRaw) {
      const d = new Date(String(travelAtRaw));
      if (!Number.isNaN(d.getTime())) {
        travelAt = admin.firestore.Timestamp.fromDate(d);
      } else {
        travelAt = stringValue(travelAtRaw, 80);
      }
    }

    const pay = paymentPreference(rawPay);

    const baseDoc: Record<string, unknown> = {
      customerName,
      customerPhone,
      customerEmail,
      fullName: customerName,
      guestName: customerName,
      guestPhone: customerPhone,
      guestEmail: customerEmail,
      name: customerName,
      contact: customerPhone,
      username: customerName,
      phoneNo: customerPhone,
      pickup,
      pickupLocation: pickup,
      destination,
      drop: destination,
      dropLocation: destination,
      travelAt,
      notes,
      // Billable fields empty until admin quotes / accepts
      amount: null,
      price: null,
      AmountOffered: null,
      finalAmount: null,
      requestedAmountHint: requestedAmountHint > 0 ? requestedAmountHint : null,
      amountStatus: "AWAITING_ADMIN_QUOTE",
      currency: "THB",
      userId,
      authUid: userId,
      source: "WEB",
      transportType: kind,
      bookingKind: kind,
      status: "Pending",
      bookingStatus: "Pending",
      isPaymentDone: false,
      paymentVerificationStatus: "NOT_APPLICABLE",
      paymentVerificationNote: pay.paymentNote,
      paymentMethod: pay.paymentMethod,
      modeOfPayment: pay.modeOfPayment,
      stripeSessionId: null,
      // Explicit: online card checkout not used for transport
      stripeEnabled: false,
      orderedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (kind === "van" && travelAt) {
      baseDoc.bookingDate = travelAt;
    }
    if (kind === "car" && travelAt) {
      baseDoc.time = travelAt;
    }

    const ref = db().collection(collection).doc();
    await ref.set(baseDoc);
    const bookingId = ref.id;

    res.status(200).json({
      success: true,
      paymentMethod: pay.paymentMethod,
      bookingId,
      bookingCollection: collection,
      transportType: kind,
      service: label[kind],
      status: "Pending",
      bookingStatus: "Pending",
      amount: null,
      finalAmount: null,
      AmountOffered: null,
      amountStatus: "AWAITING_ADMIN_QUOTE",
      currency: "thb",
      stripeUrl: null,
      payNow: false,
      isPaymentDone: false,
      message:
        "Transport request saved. Admin will set the price. " +
        "Call getTransportBooking (or read the booking) to fetch amount and status.",
    });
  });

/**
 * Fetch one transport booking for the signed-in owner (after admin updates amount).
 */
export const getTransportBooking = onRequest(
  httpsOpts,
  withBookingHttp(async ({res, body, auth}) => {
    const bookingId = stringValue(body.bookingId || body.id, 200);
    const kindRaw = stringValue(
      body.bookingKind || body.transportType || body.bookingType,
      40,
    ).toLowerCase();
    const collectionRaw = stringValue(
      body.bookingCollection || body.collection,
      80,
    );

    let collection: string | null = null;
    if (collectionRaw === "car_bookings" || kindRaw === "car" || kindRaw === "taxi") {
      collection = "car_bookings";
    } else if (collectionRaw === "vanBookings" || kindRaw === "van") {
      collection = "vanBookings";
    } else if (
      collectionRaw === "self_driving_bookings" ||
      kindRaw === "selfdrive" ||
      kindRaw === "self_drive"
    ) {
      collection = "self_driving_bookings";
    }

    if (!bookingId) {
      throw new HttpError(400, "bookingId is required.", "INVALID_ARGUMENT");
    }

    // If collection known, read one; else search all three (owner-scoped)
    const tryCols = collection ?
      [collection] :
      ["car_bookings", "vanBookings", "self_driving_bookings"];

    let found: {
      id: string;
      collection: string;
      data: Record<string, unknown>;
    } | null = null;

    for (const col of tryCols) {
      const snap = await db().collection(col).doc(bookingId).get();
      if (snap.exists) {
        found = {
          id: snap.id,
          collection: col,
          data: (snap.data() || {}) as Record<string, unknown>,
        };
        break;
      }
    }

    if (!found) {
      throw new HttpError(404, "Booking not found.", "NOT_FOUND");
    }

    const data = found.data;
    const ownerIds = [data.userId, data.authUid, data.uId, data.uid]
      .map((v) => stringValue(v, 128))
      .filter(Boolean);
    if (!ownerIds.includes(auth.uid)) {
      throw new HttpError(403, "You do not own this booking.", "FORBIDDEN");
    }

    const amount = numberOrNull(
      data.finalAmount ?? data.AmountOffered ?? data.price ?? data.amount,
    );

    res.status(200).json({
      success: true,
      bookingId: found.id,
      bookingCollection: found.collection,
      transportType: data.transportType || data.bookingKind || null,
      status: data.status || data.bookingStatus || "Pending",
      bookingStatus: data.bookingStatus || data.status || "Pending",
      amount,
      finalAmount: numberOrNull(data.finalAmount),
      AmountOffered: numberOrNull(data.AmountOffered),
      amountStatus:
        amount != null && amount > 0 ?
          "QUOTED" :
          data.amountStatus || "AWAITING_ADMIN_QUOTE",
      currency: stringValue(data.currency, 10) || "THB",
      isPaymentDone: data.isPaymentDone === true,
      paymentMethod: data.paymentMethod || null,
      customerName: data.customerName || data.fullName || data.name || null,
      customerPhone: data.customerPhone || data.contact || data.phoneNo || null,
      pickup: data.pickup || data.pickupLocation || null,
      destination: data.destination || data.drop || data.dropLocation || null,
      travelAt: data.travelAt || data.bookingDate || data.time || null,
      notes: data.notes || null,
      stripeUrl: null,
      payNow: false,
      message:
        amount != null && amount > 0 ?
          "Admin has set the amount for this booking." :
          "Waiting for admin to set the amount.",
    });
  }),
);

const numberOrNull = (v: unknown): number | null => {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export const createCarBooking = onRequest(httpsOpts, buildHandler("car"));
export const createVanBooking = onRequest(httpsOpts, buildHandler("van"));
export const createSelfDriveBooking = onRequest(
  httpsOpts,
  buildHandler("selfDrive"),
);
