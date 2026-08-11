/**
 * createHotelBooking — STRIPE | THAI_QR (ONSITE rejected)
 * Reuses inventory create / complete-hold cores.
 */
import * as admin from "firebase-admin";
import {onRequest} from "firebase-functions/v2/https";
import {HttpsError} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import {
  runCreateHotelBookingWithAvailability,
  runCompleteHotelBookingHold,
} from "../hotelBookingStock";
import {
  createCheckoutSessionCore,
  expireCheckoutSessionSafe,
} from "../payments/createCheckoutSessionCore";
import {
  httpsOpts,
  stringValue,
  withBookingHttp,
  HttpError,
  assertUserMatch,
  parseNumber,
  parseBool,
} from "../payments/corsAuth";
import {normalizePaymentMethod} from "./paymentMethod";
import {okPendingNoCharge, okStripe, okThaiQr} from "./response";

const db = () => admin.firestore();
const COLLECTION = "hotelBookingData";

export const createHotelBooking = onRequest(
  httpsOpts,
  withBookingHttp(async ({res, body, auth}) => {
    const userId = assertUserMatch(auth, body.userId);
    const method = normalizePaymentMethod(
      body.paymentMethod || body.paymentMethodIntent,
    );

    if (method === "ONSITE") {
      throw new HttpError(
        400,
        "Onsite payment is not supported for hotel bookings. Use STRIPE or THAI_QR.",
        "ONSITE_NOT_SUPPORTED_FOR_HOTEL",
      );
    }

    const holdId = stringValue(body.holdId, 120);
    const payload = {
      ...body,
      userId,
      paymentMethod: method,
      paymentMethodIntent: method,
    };

    let created: Record<string, unknown>;
    try {
      if (holdId) {
        created = await runCompleteHotelBookingHold(auth.uid, payload);
      } else {
        created = await runCreateHotelBookingWithAvailability(
          auth.uid,
          payload,
        );
      }
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      throw error;
    }

    const bookingId = stringValue(
      created.bookingId || created.autoBookingId,
      200,
    );
    // Prefer charge amount for instant/accepted portion only
    let amount = parseNumber(created.amountTHB ?? created.amount, 0);
    const payNow = created.payNow === true;
    const path = stringValue(created.path, 20) || "pending";
    const autoBookingId = stringValue(created.autoBookingId, 200) || null;
    const pendingBookingId = stringValue(created.pendingBookingId, 200) || null;

    // Patch payment fields on booking docs for QR
    if (bookingId && method === "THAI_QR") {
      const qrConfirmed = parseBool(
        body.customerQrPaymentConfirmed || body.qrConfirmed,
      );
      const ids = [bookingId, autoBookingId || "", pendingBookingId || ""].filter(
        Boolean,
      );
      const unique = [...new Set(ids)];
      await Promise.all(
        unique.map((id) =>
          db()
            .collection(COLLECTION)
            .doc(id)
            .set(
              {
                paymentMethod: "THAI_QR",
                modeOfPayment: "ONLINE",
                isPaymentDone: false,
                paymentVerificationStatus: "PENDING_VERIFICATION",
                paymentVerificationNote:
                  "Customer Thai QR. Awaiting admin verification.",
                customerQrPaymentConfirmed: qrConfirmed,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              },
              {merge: true},
            ),
        ),
      );

      res.status(200).json(
        okThaiQr(
          {
            bookingId,
            autoBookingId,
            pendingBookingId,
            bookingCollection: COLLECTION,
            amount,
            currency: "thb",
            status: stringValue(created.status, 40),
            bookingStatus: stringValue(created.bookingStatus, 40),
            path,
            payNow,
            roomsInstant: created.roomsInstant,
            roomsPending: created.roomsPending,
            holdId: created.holdId || holdId || null,
            duplicate: created.duplicate === true,
            paymentVerificationStatus: "PENDING_VERIFICATION",
          },
          {
            customerQrPaymentConfirmed: qrConfirmed,
            message: payNow ?
              "Booking saved. Complete Thai QR payment; admin will verify." :
              "Booking request saved (pending hotel). Thai QR when accepted.",
          },
        ),
      );
      return;
    }

    // STRIPE + payment due now
    if (method === "STRIPE" && payNow && amount > 0 && bookingId) {
      // Charge the accepted booking doc (auto) when partial
      const chargeBookingId = autoBookingId || bookingId;
      let hotelName = stringValue(body.hotelName || body.roomName, 120);

      try {
        const snap = await db().collection(COLLECTION).doc(chargeBookingId).get();
        const d = snap.data() || {};
        hotelName = stringValue(d.hotelName || d.roomName, 120) || hotelName;
        const docAmount = parseNumber(d.amountTHB ?? d.amount ?? d.subtotal, 0);
        if (docAmount > 0) amount = docAmount;

        if (d.isPaymentDone === true) {
          res.status(200).json(
            okPendingNoCharge(
              {
                bookingId: chargeBookingId,
                autoBookingId,
                pendingBookingId,
                bookingCollection: COLLECTION,
                amount,
                currency: "thb",
                status: stringValue(d.status || created.status, 40),
                bookingStatus: stringValue(
                  d.bookingStatus || created.bookingStatus,
                  40,
                ),
                path,
                payNow: false,
                duplicate: true,
                isPaymentDone: true,
              },
              "STRIPE",
              "This booking is already paid.",
            ),
          );
          return;
        }
      } catch {
        // continue with create response amount
      }

      if (amount < 20) {
        res.status(200).json(
          okPendingNoCharge(
            {
              bookingId: chargeBookingId,
              autoBookingId,
              pendingBookingId,
              bookingCollection: COLLECTION,
              amount,
              currency: "thb",
              status: stringValue(created.status, 40),
              bookingStatus: stringValue(created.bookingStatus, 40),
              path,
              payNow: false,
              roomsInstant: created.roomsInstant,
              roomsPending: created.roomsPending,
            },
            "STRIPE",
            "Booking saved but amount is too low for online card payment.",
          ),
        );
        return;
      }

      try {
        // Reduce double-pay if a previous open session exists on this booking
        try {
          const prev = await db().collection(COLLECTION).doc(chargeBookingId).get();
          await expireCheckoutSessionSafe(
            stringValue(prev.data()?.stripeSessionId, 200),
          );
        } catch {
          // ignore
        }

        const session = await createCheckoutSessionCore({
          amount,
          currency: "thb",
          productName: hotelName || "Hotel booking",
          customerEmail:
            stringValue(body.guestEmail || body.email, 200) || auth.email,
          successUrl: stringValue(body.successUrl || body.success_url, 2000),
          cancelUrl: stringValue(body.cancelUrl || body.cancel_url, 2000),
          metadata: {
            bookingId: chargeBookingId,
            bookingCollection: COLLECTION,
            bookingType: "hotel",
            userId,
          },
          idempotencyKey:
            `hotel_${chargeBookingId}_${userId}_${Math.floor(Date.now() / 60_000)}`.slice(
              0,
              255,
            ),
        });

        await db()
          .collection(COLLECTION)
          .doc(chargeBookingId)
          .set(
            {
              paymentMethod: "STRIPE",
              modeOfPayment: "ONLINE",
              stripeSessionId: session.id,
              isPaymentDone: false,
              paymentVerificationStatus: "PENDING_VERIFICATION",
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            {merge: true},
          );

        res.status(200).json(
          okStripe(
            {
              bookingId: chargeBookingId,
              autoBookingId,
              pendingBookingId,
              bookingCollection: COLLECTION,
              amount,
              currency: "thb",
              status: stringValue(created.status, 40),
              bookingStatus: stringValue(created.bookingStatus, 40),
              path,
              payNow: true,
              roomsInstant: created.roomsInstant,
              roomsPending: created.roomsPending,
              holdId: created.holdId || holdId || null,
              duplicate: created.duplicate === true,
            },
            session,
          ),
        );
        return;
      } catch (err) {
        logger.error("[createHotelBooking] Stripe failed", err);
        // Booking exists — client can retry via createCheckoutSession
        res.status(200).json(
          okPendingNoCharge(
            {
              bookingId: chargeBookingId,
              autoBookingId,
              pendingBookingId,
              bookingCollection: COLLECTION,
              amount,
              currency: "thb",
              status: stringValue(created.status, 40),
              bookingStatus: stringValue(created.bookingStatus, 40),
              path,
              payNow: true,
              roomsInstant: created.roomsInstant,
              roomsPending: created.roomsPending,
              stripeError: true,
              holdId: created.holdId || holdId || null,
            },
            "STRIPE",
            "Booking saved but payment link failed. Use My Bookings / createCheckoutSession to pay.",
          ),
        );
        return;
      }
    }

    // Stripe but no charge yet (pending-only request)
    res.status(200).json(
      okPendingNoCharge(
        {
          bookingId,
          autoBookingId,
          pendingBookingId,
          bookingCollection: COLLECTION,
          amount,
          currency: "thb",
          status: stringValue(created.status, 40),
          bookingStatus: stringValue(created.bookingStatus, 40),
          path,
          payNow: false,
          roomsInstant: created.roomsInstant,
          roomsPending: created.roomsPending,
          holdId: created.holdId || holdId || null,
          duplicate: created.duplicate === true,
        },
        "STRIPE",
        "Booking request saved. Payment will be available after the hotel accepts.",
      ),
    );
  }),
);
