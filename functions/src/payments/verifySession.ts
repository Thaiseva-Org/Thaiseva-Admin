/**
 * After Stripe success redirect: verify session ownership and apply paid state.
 */
import {onRequest} from "firebase-functions/v2/https";
import {getStripe} from "./stripeClient";
import {
  httpsOpts,
  stringValue,
  withBookingHttp,
  HttpError,
  normalizeEmail,
} from "./corsAuth";
import {
  PACKAGE_HOLD_CHECKOUT,
  bookPaidPackageHold,
  markExistingBookingPaid,
  resolveCollection,
  sessionPresentment,
  upsertSightseeingFromPaidSession,
} from "./markBookingPaid";
import {upsertInstantHotelFromPaidSession} from "./instantHotelCheckout";

export const verifySession = onRequest(
  httpsOpts,
  withBookingHttp(async ({res, body, auth}) => {
    const sessionId = stringValue(body.sessionId || body.session_id, 200);
    if (!sessionId) {
      throw new HttpError(400, "sessionId is required.", "INVALID_ARGUMENT");
    }

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const meta = session.metadata || {};
    const sessionUser = stringValue(meta.userId, 128);
    const sessionEmail = normalizeEmail(
      meta.guestEmail || session.customer_email,
    );

    // Ownership: prefer UID match; fall back to email if UID missing
    if (sessionUser) {
      if (sessionUser !== auth.uid) {
        throw new HttpError(
          403,
          "This payment session does not belong to the signed-in user.",
          "FORBIDDEN",
        );
      }
    } else if (sessionEmail && auth.email && auth.token.email_verified === true) {
      if (sessionEmail !== normalizeEmail(auth.email)) {
        throw new HttpError(
          403,
          "This payment session does not belong to the signed-in user.",
          "FORBIDDEN",
        );
      }
    } else if (!sessionUser) {
      // No identity on session - refuse to prevent session enumeration
      throw new HttpError(
        403,
        "Cannot verify session ownership.",
        "FORBIDDEN",
      );
    }

    if (session.payment_status !== "paid") {
      res.status(200).json({
        success: false,
        paid: false,
        paymentStatus: session.payment_status,
        sessionId,
        message: "Payment is not completed yet.",
      });
      return;
    }

    const info = {
      sessionId: session.id,
      paymentIntentId: typeof session.payment_intent === "string" ?
        session.payment_intent :
        session.payment_intent?.id,
      amountTotal: session.amount_total,
      currency: session.currency,
      customerEmail: session.customer_email,
      presentment: sessionPresentment(session),
    };

    const bookingId = stringValue(
      meta.bookingId || session.client_reference_id,
      200,
    );
    const collection = resolveCollection(
      meta.bookingCollection || meta.bookingType,
    );

    let path: string | null = null;
    let bookingDocId: string | null = bookingId || null;
    let bookingCollection: string | null = collection;

    if (meta.checkoutKind === "instantHotel" && meta.holdId) {
      bookingDocId = await upsertInstantHotelFromPaidSession(session);
      bookingCollection = "hotelBookingData";
      path = `hotelBookingData/${bookingDocId}`;
    } else if (meta.checkoutKind === PACKAGE_HOLD_CHECKOUT && meta.holdId) {
      bookingDocId = await bookPaidPackageHold(session, info);
      bookingCollection = "travelBookingDetails";
      path = `travelBookingDetails/${bookingDocId}`;
    } else if (bookingId && collection) {
      const result = await markExistingBookingPaid(collection, bookingId, info);
      if (!result.ok && result.reason === "not_found") {
        throw new HttpError(404, "Booking not found for this session.", "NOT_FOUND");
      }
      path = result.path;
    } else if (
      meta.bookingType === "sightseeing" ||
      meta.packageId ||
      meta.bookingCollection === "travelBookingDetails"
    ) {
      bookingDocId = await upsertSightseeingFromPaidSession(session, auth.uid);
      bookingCollection = "travelBookingDetails";
      path = `travelBookingDetails/${bookingDocId}`;
    } else {
      throw new HttpError(
        400,
        "Session is not linked to a booking.",
        "NO_BOOKING",
      );
    }

    res.status(200).json({
      success: true,
      paid: true,
      sessionId: session.id,
      bookingId: bookingDocId,
      bookingCollection,
      path,
      amount:
        session.amount_total != null ? session.amount_total / 100 : null,
      currency: session.currency,
      // Stripe Adaptive Pricing: what the customer paid in their currency.
      presentment: info.presentment,
      message: "Payment verified.",
    });
  }),
);
