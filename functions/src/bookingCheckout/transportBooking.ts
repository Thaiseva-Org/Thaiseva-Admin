/**
 * Transport booking APIs — two products only:
 *  1) createCarBooking   → car_bookings
 *       transportType: car | van | taxi | bike
 *  2) createSelfDriveBooking → self_driving_bookings
 *
 * No separate van booking API — van is a transportType on car booking.
 *
 * Product model (no Stripe):
 * 1) User submits trip details → Pending booking (no price charged online)
 * 2) Admin sets amount / accepts via admin portal (manageTransportBooking)
 * 3) User fetches booking from backend to see price & status
 *
 * Aligns with mobile client field names where possible:
 *   name, contact, pickup, drop, date, time, transportType, seats,
 *   isImmediateRequest, bookingType (immediate | scheduled)
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

/** Car booking transport types (all stored in car_bookings). */
const CAR_TRANSPORT_TYPES = new Set(["car", "van", "taxi", "bike"]);

type CarTransportType = "car" | "van" | "taxi" | "bike";
type Product = "carBooking" | "selfDrive";

/**
 * Resolve transportType for car bookings.
 * Accepts: car | van | taxi | bike (case-insensitive).
 * Also maps common aliases (cab→taxi, motorcycle→bike, etc.).
 */
const resolveCarTransportType = (
  raw: unknown,
  fixed?: CarTransportType,
): CarTransportType => {
  if (fixed) return fixed;
  const v = stringValue(raw, 40).toLowerCase().replace(/[\s_-]+/g, "");
  if (!v || v === "car" || v === "sedan") return "car";
  if (v === "taxi" || v === "cab") return "taxi";
  if (v === "van" || v === "minivan" || v === "luxuryvan") return "van";
  if (
    v === "bike" ||
    v === "motorcycle" ||
    v === "motorbike" ||
    v === "scooter"
  ) {
    return "bike";
  }
  if (CAR_TRANSPORT_TYPES.has(v)) return v as CarTransportType;
  throw new HttpError(
    400,
    "transportType must be one of: car, van, taxi, bike.",
    "INVALID_TRANSPORT_TYPE",
  );
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

const serviceLabelFor = (
  product: Product,
  transportType: string | null,
): string => {
  if (product === "selfDrive") return "Self-drive";
  const labels: Record<string, string> = {
    car: "Car booking",
    van: "Van booking",
    taxi: "Taxi booking",
    bike: "Bike booking",
  };
  return labels[transportType || "car"] || "Car booking";
};

const buildHandler = (
  product: Product,
  fixedTransportType?: CarTransportType,
) =>
  withBookingHttp(async ({res, body, auth}) => {
    const userId = assertUserMatch(auth, body.userId);

    const isCar = product === "carBooking";
    const collection = isCar ? "car_bookings" : "self_driving_bookings";
    const transportType = isCar ?
      resolveCarTransportType(
        body.transportType ?? body.vehicleType ?? body.type ?? "car",
        fixedTransportType,
      ) :
      null;

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

    // Mobile field names first, then web aliases
    const name = stringValue(
      body.name || body.customerName || body.fullName || body.guestName,
      120,
    );
    const contact = stringValue(
      body.contact || body.customerPhone || body.guestPhone || body.phone,
      40,
    );
    const customerEmail = normalizeEmail(
      body.customerEmail || body.guestEmail || body.email || auth.email,
    );
    const pickup = stringValue(
      body.pickup || body.pickupLocation || body.from,
      300,
    );
    const drop = stringValue(
      body.drop || body.destination || body.dropLocation || body.to,
      300,
    );
    const notes = stringValue(body.notes || body.specialRequests, 500);
    let licenceLink = isCar ? "" : stringValue(
      body.licenceLink ||
        body.licenseLink ||
        body.drivingLicenceLink ||
        body.drivingLicenseLink ||
        body.licenceUrl ||
        body.licenseUrl ||
        body.drivingLicenceUrl ||
        body.drivingLicenseUrl ||
        body.licence ||
        body.license,
      2000,
    );
    let passportLink = isCar ? "" : stringValue(
      body.passportLink ||
        body.passportDocumentLink ||
        body.passportUrl ||
        body.passportDocumentUrl ||
        body.passport ||
        body.passportImage,
      2000,
    );

    if (!isCar && (!licenceLink || !passportLink)) {
      try {
        const userSnap = await db().collection("users").doc(userId).get();
        if (userSnap.exists) {
          const userData = userSnap.data() || {};
          if (!licenceLink) {
            licenceLink = stringValue(
              userData.licenceLink || userData.licenseLink,
              2000,
            );
          }
          if (!passportLink) {
            passportLink = stringValue(
              userData.passportLink || userData.passportUrl,
              2000,
            );
          }
        }
      } catch (e) {
        // Ignore fetch errors, just proceed with what we have
      }
    }

    // seats (mobile); optional
    const seatsRaw = body.seats ?? body.seatCount ?? body.passengers;
    let seats: number | null = null;
    if (seatsRaw != null && seatsRaw !== "") {
      const n = Math.floor(parseNumber(seatsRaw, 0));
      if (n < 1 || n > 50) {
        throw new HttpError(
          400,
          "seats must be between 1 and 50.",
          "INVALID_SEATS",
        );
      }
      seats = n;
    }

    // Immediate vs scheduled (mobile)
    const isImmediateRequest =
      body.isImmediateRequest === true ||
      body.isImmediateRequest === "true" ||
      String(body.bookingType || "").toLowerCase() === "immediate";
    const bookingType = isImmediateRequest ? "immediate" : "scheduled";

    // date + time as mobile stores them (strings); also accept ISO travelAt
    const dateStr = stringValue(body.date, 40) || null;
    const timeStr = stringValue(body.time, 40) || null;

    const travelAtRaw =
      body.travelAt ||
      body.bookingDate ||
      (dateStr && timeStr ? `${dateStr} ${timeStr}` : dateStr || timeStr);
    let travelAt: admin.firestore.Timestamp | string | null = null;
    if (travelAtRaw) {
      const d = new Date(String(travelAtRaw));
      if (!Number.isNaN(d.getTime())) {
        travelAt = admin.firestore.Timestamp.fromDate(d);
      } else {
        travelAt = stringValue(travelAtRaw, 80);
      }
    }

    const requestedAmountHint = Math.max(
      0,
      parseNumber(
        body.requestedAmount ?? body.amountHint ?? body.budget,
        0,
      ),
    );

    if (!name || !contact) {
      throw new HttpError(
        400,
        "name (or customerName) and contact (or customerPhone) are required.",
        "INVALID_ARGUMENT",
      );
    }
    if (!pickup || !drop) {
      throw new HttpError(
        400,
        "pickup and drop (or destination) are required.",
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

    const pay = paymentPreference(rawPay);

    // Admin workflow: car_bookings are managed under bookingKind "taxi"
    const bookingKind = isCar ? "taxi" : "selfDrive";
    const serviceLabel = serviceLabelFor(product, transportType);

    const baseDoc: Record<string, unknown> = {
      // --- Mobile-aligned fields ---
      userId,
      name,
      contact,
      pickup,
      drop,
      date: dateStr,
      time: timeStr || travelAt,
      transportType: isCar ? transportType : "selfDrive",
      seats,
      isImmediateRequest,
      bookingType,
      status: "pending",
      timestamp: admin.firestore.FieldValue.serverTimestamp(),

      // --- Web / admin aliases ---
      customerName: name,
      customerPhone: contact,
      customerEmail,
      fullName: name,
      guestName: name,
      guestPhone: contact,
      guestEmail: customerEmail,
      username: name,
      phoneNo: contact,
      pickupLocation: pickup,
      destination: drop,
      dropLocation: drop,
      travelAt,
      notes,
      amount: null,
      price: null,
      AmountOffered: null,
      finalAmount: null,
      requestedAmountHint: requestedAmountHint > 0 ? requestedAmountHint : null,
      amountStatus: "AWAITING_ADMIN_QUOTE",
      currency: "THB",
      authUid: userId,
      source: stringValue(body.source, 40) || "WEB",
      transportProduct: product,
      bookingKind,
      vehicleType: isCar ?
        String(transportType).charAt(0).toUpperCase() +
          String(transportType).slice(1) :
        stringValue(body.vehicleType || body.vehicle || "Self Drive", 40),
      bookingStatus: "Pending",
      isPaymentDone: false,
      paymentVerificationStatus: "NOT_APPLICABLE",
      paymentVerificationNote: pay.paymentNote,
      paymentMethod: pay.paymentMethod,
      modeOfPayment: pay.modeOfPayment,
      stripeSessionId: null,
      stripeEnabled: false,
      orderedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      ...(isCar ? {} : {
        licenceLink: licenceLink || null,
        passportLink: passportLink || null,
        licenceVerificationStatus: "Pending",
        passportVerificationStatus: "Pending",
      }),
    };

    const ref = db().collection(collection).doc();
    await ref.set(baseDoc);
    const bookingId = ref.id;

    res.status(200).json({
      success: true,
      paymentMethod: pay.paymentMethod,
      bookingId,
      bookingCollection: collection,
      transportProduct: product,
      transportType: isCar ? transportType : "selfDrive",
      bookingKind,
      bookingType,
      isImmediateRequest,
      seats,
      service: serviceLabel,
      status: "pending",
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
      body.bookingKind ||
        body.transportType ||
        body.bookingType ||
        body.transportProduct,
      40,
    )
      .toLowerCase()
      .replace(/[\s_-]+/g, "");
    const collectionRaw = stringValue(
      body.bookingCollection || body.collection,
      80,
    );

    let collection: string | null = null;
    if (collectionRaw === "car_bookings") {
      collection = "car_bookings";
    } else if (collectionRaw === "self_driving_bookings") {
      collection = "self_driving_bookings";
    } else if (
      kindRaw === "selfdrive" ||
      kindRaw === "selfdriving" ||
      kindRaw === "selfbooking"
    ) {
      collection = "self_driving_bookings";
    } else if (
      kindRaw === "car" ||
      kindRaw === "taxi" ||
      kindRaw === "van" ||
      kindRaw === "bike" ||
      kindRaw === "carbooking"
    ) {
      // All car-product types (car/van/taxi/bike) live in car_bookings
      collection = "car_bookings";
    }

    if (!bookingId) {
      throw new HttpError(400, "bookingId is required.", "INVALID_ARGUMENT");
    }

    const tryCols = collection ?
      [collection] :
      ["car_bookings", "self_driving_bookings"];

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

    const transportType =
      data.transportType ||
      (found.collection === "self_driving_bookings" ? "selfDrive" : "car");

    res.status(200).json({
      success: true,
      bookingId: found.id,
      bookingCollection: found.collection,
      transportProduct:
        data.transportProduct ||
        (found.collection === "self_driving_bookings" ?
          "selfDrive" :
          "carBooking"),
      transportType,
      bookingKind: data.bookingKind || null,
      bookingType: data.bookingType || null,
      isImmediateRequest: data.isImmediateRequest === true,
      seats: numberOrNull(data.seats),
      status: data.status || data.bookingStatus || "pending",
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
      name: data.name || data.customerName || data.fullName || null,
      contact: data.contact || data.customerPhone || data.phoneNo || null,
      customerName: data.customerName || data.name || data.fullName || null,
      customerPhone: data.customerPhone || data.contact || data.phoneNo || null,
      pickup: data.pickup || data.pickupLocation || null,
      drop: data.drop || data.destination || data.dropLocation || null,
      destination: data.destination || data.drop || data.dropLocation || null,
      date: data.date || null,
      time: data.time || null,
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

/**
 * Car booking (product #1).
 * Collection: car_bookings
 * transportType: car | van | taxi | bike
 *
 * Body (mobile-aligned):
 *   name, contact, pickup, drop, date, time, transportType, seats,
 *   isImmediateRequest, bookingType
 */
export const createCarBooking = onRequest(
  httpsOpts,
  buildHandler("carBooking"),
);

/**
 * Self-drive booking (product #2).
 * Collection: self_driving_bookings
 */
export const createSelfDriveBooking = onRequest(
  httpsOpts,
  buildHandler("selfDrive"),
);

/**
 * @deprecated Prefer createCarBooking with transportType: "taxi" (or car/van/bike).
 */
export const createTaxiBooking = onRequest(
  httpsOpts,
  buildHandler("carBooking", "taxi"),
);
