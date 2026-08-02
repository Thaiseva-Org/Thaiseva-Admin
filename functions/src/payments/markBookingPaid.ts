/**
 * Mark a booking paid after Stripe Checkout (any collection).
 */
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";

const db = () => admin.firestore();

export type PaidSessionInfo = {
  sessionId: string;
  paymentIntentId?: string | null;
  amountTotal?: number | null;
  currency?: string | null;
  customerEmail?: string | null;
};

/**
 * Collections that may be paid via Stripe Checkout.
 * Transport (car/van/self-drive) is intentionally excluded — admin quote only.
 */
export const ALLOWED_BOOKING_COLLECTIONS = new Set([
  "hotelBookingData",
  "travelBookingDetails",
]);

const COLLECTION_ALIASES: Record<string, string> = {
  hotel: "hotelBookingData",
  hotelBookingData: "hotelBookingData",
  sightseeing: "travelBookingDetails",
  package: "travelBookingDetails",
  travel: "travelBookingDetails",
  travelBookingDetails: "travelBookingDetails",
  // Transport aliases resolve to null for Stripe (not in ALLOWED set)
  car: "car_bookings",
  taxi: "car_bookings",
  car_bookings: "car_bookings",
  van: "vanBookings",
  vanBookings: "vanBookings",
  selfDrive: "self_driving_bookings",
  selfdrive: "self_driving_bookings",
  self_drive: "self_driving_bookings",
  self_driving_bookings: "self_driving_bookings",
};

/**
 * Resolve booking collection name. Returns null if unknown / not allowed.
 */
/**
 * Resolve collection for Stripe pay paths only.
 * Transport collections map but are not allowed → null.
 */
export const resolveCollection = (
  raw: string | undefined | null,
): string | null => {
  if (!raw) return null;
  const key = String(raw).trim();
  const mapped = COLLECTION_ALIASES[key] || COLLECTION_ALIASES[key.toLowerCase()];
  const candidate = mapped || key;
  if (ALLOWED_BOOKING_COLLECTIONS.has(candidate)) return candidate;
  return null;
};

/** Resolve any booking collection including transport (for non-Stripe reads). */
export const resolveAnyBookingCollection = (
  raw: string | undefined | null,
): string | null => {
  if (!raw) return null;
  const key = String(raw).trim();
  const mapped = COLLECTION_ALIASES[key] || COLLECTION_ALIASES[key.toLowerCase()];
  if (mapped) return mapped;
  if (
    [
      "hotelBookingData",
      "travelBookingDetails",
      "car_bookings",
      "vanBookings",
      "self_driving_bookings",
    ].includes(key)
  ) {
    return key;
  }
  return null;
};

/** Payment-only fields (always safe to merge). */
export const paidPatch = (info: PaidSessionInfo): Record<string, unknown> => ({
  isPaymentDone: true,
  isPaymentClear: true,
  paymentMethod: "STRIPE",
  modeOfPayment: "ONLINE",
  paymentVerificationStatus: "VERIFIED",
  paymentVerificationNote: "Paid via Stripe Checkout.",
  paymentConfirmation: {
    status: "paid",
    provider: "STRIPE",
    sessionId: info.sessionId,
    paymentIntentId: info.paymentIntentId || null,
  },
  stripeSessionId: info.sessionId,
  stripePaymentIntentId: info.paymentIntentId || null,
  paidAt: admin.firestore.FieldValue.serverTimestamp(),
  updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  ...(info.amountTotal != null ?
    {
      stripeAmountTotal: info.amountTotal,
      // Store major units for admin UI convenience
      stripeAmountMajor:
        typeof info.amountTotal === "number" ?
          info.amountTotal / 100 :
          null,
      stripeCurrency: info.currency || "thb",
    } :
    {}),
});

/**
 * Status fields after pay — collection-aware so transport stays Pending for admin
 * accept, hotel keeps Accepted, packages become Confirmed.
 */
export const statusAfterPaid = (
  collection: string,
  existing: Record<string, unknown> = {},
): Record<string, unknown> => {
  const col = resolveCollection(collection) || collection;

  // Transport: payment ≠ assignment; keep workflow status
  if (
    col === "car_bookings" ||
    col === "vanBookings" ||
    col === "self_driving_bookings"
  ) {
    return {
      paymentStatus: "Paid",
    };
  }

  // Hotel: do not invent acceptance for pending/canceled
  if (col === "hotelBookingData") {
    const st = String(existing.bookingStatus || existing.status || "").toUpperCase();
    if (
      st === "PENDING" ||
      st === "CANCELED" ||
      st === "CANCELLED" ||
      st === "REJECTED" ||
      !st
    ) {
      return {};
    }
    if (st.includes("ACCEPT")) {
      return {
        isBookingConfirmed: true,
        bookingStatus: "ACCEPTED",
        status: "Accepted",
      };
    }
    return {
      isBookingConfirmed: true,
      bookingStatus: "CONFIRMED",
      status: "Confirmed",
    };
  }

  // Sightseeing / default: paid → confirmed
  return {
    bookingStatus: "CONFIRMED",
    status: "Confirmed",
    isBookingConfirmed: true,
  };
};

export const isCanceledBooking = (data: Record<string, unknown>): boolean => {
  const st = String(data.bookingStatus || data.status || "").toUpperCase();
  return (
    st.includes("CANCEL") ||
    st.includes("REJECT") ||
    st.includes("DENIED") ||
    data.canceled === true
  );
};

/**
 * Update existing booking by collection + id. Idempotent if already paid.
 */
export const markExistingBookingPaid = async (
  collection: string,
  bookingId: string,
  info: PaidSessionInfo,
): Promise<{ok: boolean; alreadyPaid?: boolean; path: string; reason?: string}> => {
  const col = resolveCollection(collection);
  if (!col || !bookingId) {
    return {ok: false, path: "", reason: "invalid_target"};
  }
  const ref = db().collection(col).doc(bookingId);
  const snap = await ref.get();
  if (!snap.exists) {
    logger.warn(`[markPaid] missing ${col}/${bookingId}`);
    return {ok: false, path: `${col}/${bookingId}`, reason: "not_found"};
  }
  const data = snap.data() || {};

  if (isCanceledBooking(data)) {
    logger.warn(`[markPaid] skipped canceled ${col}/${bookingId}`);
    // Still record payment proof for ops, do not revive status
    await ref.set(
      {
        ...paidPatch(info),
        paymentVerificationNote:
          "Stripe paid but booking was canceled/rejected — review refund.",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      {merge: true},
    );
    return {ok: true, path: `${col}/${bookingId}`, reason: "canceled_paid"};
  }

  if (data.isPaymentDone === true) {
    // Second successful Checkout for same booking — flag for ops/refund review
    if (
      data.stripeSessionId &&
      info.sessionId &&
      data.stripeSessionId !== info.sessionId
    ) {
      logger.error(
        `[markPaid] DOUBLE_PAY ${col}/${bookingId} prev=${data.stripeSessionId} new=${info.sessionId}`,
      );
      await ref.set(
        {
          possibleDoublePayment: true,
          secondaryStripeSessionId: info.sessionId,
          secondaryPaidAt: admin.firestore.FieldValue.serverTimestamp(),
          paymentVerificationNote:
            "Possible double Stripe payment — review refund in Stripe Dashboard.",
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        {merge: true},
      );
    }
    return {ok: true, alreadyPaid: true, path: `${col}/${bookingId}`};
  }

  // Soft amount check (log only — Stripe amount is authoritative for paid state)
  if (info.amountTotal != null) {
    const paidMajor = info.amountTotal / 100;
    const expected = Number(
      data.stripeChargeAmount ??
        data.amountTHB ??
        data.totalAmount ??
        data.finalAmount ??
        data.AmountOffered ??
        data.price ??
        data.amount ??
        0,
    );
    if (Number.isFinite(expected) && expected > 0) {
      const diff = Math.abs(paidMajor - expected);
      if (diff > 1) {
        logger.warn(
          `[markPaid] amount mismatch ${col}/${bookingId}: paid=${paidMajor} expected=${expected}`,
        );
      }
    }
  }

  await ref.set(
    {
      ...paidPatch(info),
      ...statusAfterPaid(col, data),
    },
    {merge: true},
  );
  logger.info(`[markPaid] ${col}/${bookingId} session=${info.sessionId}`);
  return {ok: true, path: `${col}/${bookingId}`};
};

/** Build sightseeing doc fields from Checkout session metadata. */
export const sightseeingDocFromSession = (
  session: {
    id: string;
    amount_total?: number | null;
    currency?: string | null;
    customer_email?: string | null;
    payment_intent?: string | {id?: string} | null;
    metadata?: Record<string, string> | null;
  },
  fallbackUserId?: string,
): Record<string, unknown> => {
  const meta = session.metadata || {};
  const adults = Number(meta.adults || 1) || 1;
  const children = Number(meta.children || 0) || 0;
  const amountMajor =
    session.amount_total != null ?
      session.amount_total / 100 :
      Number(meta.amount || 0);
  const pi =
    typeof session.payment_intent === "string" ?
      session.payment_intent :
      session.payment_intent?.id;
  const userId = meta.userId || fallbackUserId || "";

  const payInfo: PaidSessionInfo = {
    sessionId: session.id,
    paymentIntentId: pi,
    amountTotal: session.amount_total,
    currency: session.currency,
    customerEmail: session.customer_email,
  };

  return {
    fullName: meta.fullName || "",
    guestEmail: meta.guestEmail || session.customer_email || "",
    guestPhone: meta.guestPhone || "",
    email: meta.guestEmail || session.customer_email || "",
    phone: meta.guestPhone || "",
    guestDetails: {
      name: meta.fullName || "",
      email: meta.guestEmail || session.customer_email || "",
      phoneNumber: meta.guestPhone || "",
    },
    title: meta.packageName || meta.title || "Sightseeing package",
    packageName: meta.packageName || meta.title || "",
    packageId: meta.packageId || "",
    userId,
    authUid: userId,
    uId: userId,
    arrivalDate: meta.arrivalDate || meta.travelDate || "",
    departureDate: meta.departureDate || "",
    pickUpTime: meta.pickUpTime || meta.arrivalDate || "",
    pickUpLocation: meta.pickUpLocation || "",
    specialRequests: meta.specialRequests || "",
    adults,
    children,
    totalAmount: amountMajor,
    price: amountMajor,
    amount: amountMajor,
    currency: (session.currency || "thb").toUpperCase(),
    source: "WEB",
    orderedAt: admin.firestore.FieldValue.serverTimestamp(),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    ...paidPatch(payInfo),
    bookingStatus: "CONFIRMED",
    status: "Confirmed",
    isBookingConfirmed: true,
  };
};

/**
 * Create or mark paid sightseeing booking from a paid Checkout session.
 * Doc id = session id (idempotent).
 */
export const upsertSightseeingFromPaidSession = async (
  session: {
    id: string;
    amount_total?: number | null;
    currency?: string | null;
    customer_email?: string | null;
    payment_intent?: string | {id?: string} | null;
    metadata?: Record<string, string> | null;
  },
  fallbackUserId?: string,
): Promise<string> => {
  const docId = session.id;
  const ref = db().collection("travelBookingDetails").doc(docId);
  const existing = await ref.get();
  const pi =
    typeof session.payment_intent === "string" ?
      session.payment_intent :
      session.payment_intent?.id;
  const payInfo: PaidSessionInfo = {
    sessionId: session.id,
    paymentIntentId: pi,
    amountTotal: session.amount_total,
    currency: session.currency,
    customerEmail: session.customer_email,
  };

  if (existing.exists) {
    if (existing.data()?.isPaymentDone !== true) {
      await ref.set(
        {
          ...paidPatch(payInfo),
          ...statusAfterPaid("travelBookingDetails", existing.data() || {}),
        },
        {merge: true},
      );
    }
    return docId;
  }

  await ref.set(sightseeingDocFromSession(session, fallbackUserId));
  logger.info(`[markPaid] created travelBookingDetails/${docId}`);
  return docId;
};
