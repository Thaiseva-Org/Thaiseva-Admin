/**
 * createSightseeingBooking — STRIPE | THAI_QR | ONSITE
 */
import * as admin from "firebase-admin";
import {onRequest} from "firebase-functions/v2/https";
import {createCheckoutSessionCore} from "../payments/createCheckoutSessionCore";
import {
  httpsOpts,
  stringValue,
  withBookingHttp,
  HttpError,
  parsePositiveInt,
  parseBool,
  normalizeEmail,
  assertUserMatch,
  parseNumber,
} from "../payments/corsAuth";
import {
  normalizePaymentMethod,
  modeOfPaymentFor,
} from "./paymentMethod";
import {okOnsite, okStripe, okThaiQr} from "./response";

const db = () => admin.firestore();
const COLLECTION = "travelBookingDetails";

const loadPackage = async (
  packageId: string,
): Promise<Record<string, unknown> | null> => {
  if (!packageId) return null;
  const direct = await db().collection("sightseeingPackagesDetails").doc(packageId).get();
  if (direct.exists) {
    return {id: direct.id, ...(direct.data() || {})};
  }

  const byField = await db()
    .collection("sightseeingPackagesDetails")
    .where("packageId", "==", packageId)
    .limit(1)
    .get();
  if (!byField.empty) {
    const d = byField.docs[0];
    return {id: d.id, ...(d.data() || {})};
  }
  return null;
};

const adultPriceOf = (pkg: Record<string, unknown>): number => {
  const ps = (pkg.pricingStructure || {}) as Record<string, unknown>;
  return Math.max(
    0,
    parseNumber(
      ps.pricePerAdult ??
        pkg.pricePerAdult ??
        pkg.adultPrice ??
        pkg.startingPrice ??
        pkg.price,
      0,
    ),
  );
};

const childPriceOf = (pkg: Record<string, unknown>, adult: number): number => {
  const ps = (pkg.pricingStructure || {}) as Record<string, unknown>;
  const child = parseNumber(
    ps.pricePerChild ?? pkg.pricePerChild ?? pkg.childPrice,
    NaN,
  );
  if (Number.isFinite(child) && child > 0) return child;
  return adult > 0 ? adult * 0.5 : 0;
};

const computeAmount = (
  pkg: Record<string, unknown>,
  adults: number,
  children: number,
): number => {
  const a = adultPriceOf(pkg);
  const c = childPriceOf(pkg, a);
  return Math.round(a * adults + c * children);
};

const buildDocId = (
  userId: string,
  packageId: string,
  arrival: string,
  departure: string,
) =>
  `pkg_${userId}_${packageId}_${arrival}_${departure}`
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 140);

const toDateStr = (v: unknown): string => {
  const s = stringValue(v, 40);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return s;
};

export const createSightseeingBooking = onRequest(
  httpsOpts,
  withBookingHttp(async ({res, body, auth}) => {
    const userId = assertUserMatch(auth, body.userId);
    const method = normalizePaymentMethod(
      body.paymentMethod || body.paymentMethodIntent,
    );
    const packageId = stringValue(body.packageId || body.serviceId || body.id, 120);
    if (!packageId) {
      throw new HttpError(400, "packageId is required.", "INVALID_ARGUMENT");
    }

    const pkg = await loadPackage(packageId);
    if (!pkg) {
      throw new HttpError(404, "Package not found.", "PACKAGE_NOT_FOUND");
    }

    const adults = Math.min(50, Math.max(1, parsePositiveInt(body.adults, 1)));
    const children = Math.min(50, Math.max(0, parsePositiveInt(body.children, 0)));
    const amount = computeAmount(pkg, adults, children);
    if (amount <= 0) {
      throw new HttpError(
        400,
        "Package pricing is not available.",
        "INVALID_PRICE",
      );
    }

    const fullName = stringValue(body.fullName || body.guestName || body.name, 120);
    const guestEmail = normalizeEmail(
      body.guestEmail || body.email || auth.email,
    );
    const guestPhone = stringValue(
      body.guestPhone || body.phone || body.phoneNumber,
      40,
    );
    const arrivalDate = toDateStr(
      body.arrivalDate || body.travelDate || body.date || body.pickUpTime,
    );
    const departureDate = toDateStr(
      body.departureDate || body.endDate || arrivalDate,
    );
    const packageName = stringValue(
      pkg.title || pkg.packageName || body.packageName,
      200,
    );
    const pickUpLocation = stringValue(body.pickUpLocation || body.pickup, 300);
    const specialRequests = stringValue(body.specialRequests || body.notes, 500);
    const qrConfirmed = parseBool(
      body.customerQrPaymentConfirmed || body.qrConfirmed,
    );

    // Travel date required for all payment methods (including Stripe metadata)
    if (!arrivalDate) {
      throw new HttpError(
        400,
        "arrivalDate / travelDate is required.",
        "INVALID_ARGUMENT",
      );
    }

    // --- STRIPE: checkout first, booking after pay ---
    if (method === "STRIPE") {
      if (amount < 20) {
        throw new HttpError(
          400,
          "Amount must be at least 20 THB for card payment.",
          "INVALID_AMOUNT",
        );
      }
      if (!fullName) {
        throw new HttpError(
          400,
          "fullName is required.",
          "INVALID_ARGUMENT",
        );
      }
      try {
        const session = await createCheckoutSessionCore({
          amount,
          currency: "thb",
          productName: packageName || "Sightseeing package",
          productDescription: `${adults} adult(s), ${children} child(ren)`,
          customerEmail: guestEmail || auth.email,
          successUrl: stringValue(body.successUrl || body.success_url, 2000),
          cancelUrl: stringValue(body.cancelUrl || body.cancel_url, 2000),
          metadata: {
            bookingCollection: COLLECTION,
            bookingType: "sightseeing",
            userId,
            extra: {
              packageId: stringValue(pkg.id || packageId, 120),
              packageName,
              fullName,
              guestEmail,
              guestPhone,
              arrivalDate,
              departureDate,
              pickUpLocation,
              pickUpTime: arrivalDate,
              adults: String(adults),
              children: String(children),
              amount: String(amount),
              specialRequests,
            },
          },
          // Minute bucket: retries within 60s share session; later can get a new one
          idempotencyKey:
            `ss_${userId}_${packageId}_${arrivalDate}_${adults}_${children}_${Math.floor(Date.now() / 60_000)}`.slice(
              0,
              255,
            ),
        });

        res.status(200).json(
          okStripe(
            {
              bookingId: null,
              bookingCollection: COLLECTION,
              amount,
              currency: "thb",
              status: null,
              bookingStatus: null,
              payNow: true,
              packageId: stringValue(pkg.id || packageId, 120),
              packageName,
            },
            session,
            "Redirect to stripeUrl. Booking is created after successful payment.",
          ),
        );
        return;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Stripe error";
        throw new HttpError(
          502,
          `Could not create payment link: ${msg}`,
          "STRIPE_ERROR",
        );
      }
    }

    // --- THAI_QR / ONSITE: immediate Firestore write ---
    if (!fullName) {
      throw new HttpError(400, "fullName is required.", "INVALID_ARGUMENT");
    }

    const docId = buildDocId(
      userId,
      stringValue(pkg.id || packageId, 120),
      arrivalDate || "na",
      departureDate || "na",
    );
    const ref = db().collection(COLLECTION).doc(docId);
    const existing = await ref.get();
    if (existing.exists) {
      const prev = existing.data() || {};
      const base = {
        bookingId: docId,
        bookingCollection: COLLECTION,
        amount: parseNumber(prev.totalAmount ?? prev.price ?? amount, amount),
        currency: "thb",
        status: stringValue(prev.status, 40),
        bookingStatus: stringValue(prev.bookingStatus, 40),
        duplicate: true,
        isBookingConfirmed: prev.isBookingConfirmed === true,
        paymentVerificationStatus: prev.paymentVerificationStatus,
      };
      if (method === "THAI_QR") {
        res.status(200).json(
          okThaiQr(base, {
            customerQrPaymentConfirmed:
              prev.customerQrPaymentConfirmed === true || qrConfirmed,
            message: "Existing package booking found (duplicate).",
          }),
        );
        return;
      }
      res.status(200).json(
        okOnsite(base, {message: "Existing package booking found (duplicate)."}),
      );
      return;
    }

    const modeOfPayment = modeOfPaymentFor(method);
    const isOnsite = method === "ONSITE";

    const doc: Record<string, unknown> = {
      fullName,
      guestEmail,
      guestPhone,
      email: guestEmail,
      phone: guestPhone,
      guestDetails: {
        name: fullName,
        email: guestEmail,
        phoneNumber: guestPhone,
      },
      title: packageName,
      packageName,
      packageId: stringValue(pkg.id || packageId, 120),
      userId,
      authUid: userId,
      uId: userId,
      arrivalDate,
      departureDate,
      pickUpTime: body.pickUpTime || arrivalDate,
      pickUpLocation,
      adults,
      children,
      totalAmount: amount,
      price: amount,
      amount,
      currency: "THB",
      paymentMethod: method,
      modeOfPayment,
      isPaymentDone: false,
      stripeSessionId: null,
      specialRequests,
      source: "WEB",
      orderedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (method === "THAI_QR") {
      Object.assign(doc, {
        paymentVerificationStatus: "PENDING_VERIFICATION",
        paymentVerificationNote:
          "Customer declared Thai QR transfer. Awaiting admin verification.",
        customerQrPaymentConfirmed: qrConfirmed,
        bookingStatus: "PAYMENT_PENDING_VERIFICATION",
        status: "Pending Verification",
        isBookingConfirmed: false,
      });
    } else {
      Object.assign(doc, {
        paymentVerificationStatus: "PENDING_VERIFICATION",
        paymentVerificationNote: "Onsite payment. Due at service.",
        customerQrPaymentConfirmed: false,
        bookingStatus: "CONFIRMED",
        status: "Confirmed",
        isBookingConfirmed: true,
      });
    }

    await ref.set(doc);

    const base = {
      bookingId: docId,
      bookingCollection: COLLECTION,
      amount,
      currency: "thb",
      status: stringValue(doc.status, 40),
      bookingStatus: stringValue(doc.bookingStatus, 40),
      isBookingConfirmed: doc.isBookingConfirmed === true,
      paymentVerificationStatus: doc.paymentVerificationStatus,
      packageId: stringValue(pkg.id || packageId, 120),
      packageName,
      duplicate: false,
    };

    if (method === "THAI_QR") {
      res.status(200).json(
        okThaiQr(base, {customerQrPaymentConfirmed: qrConfirmed}),
      );
      return;
    }

    res.status(200).json(
      okOnsite(base, {
        message: isOnsite ?
          "Booking confirmed. Payment due onsite." :
          "Booking saved.",
      }),
    );
  }),
);
