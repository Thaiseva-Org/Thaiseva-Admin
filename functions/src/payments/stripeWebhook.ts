/**
 * Stripe webhook - verify signature, mark bookings paid / create package bookings.
 */
import * as logger from "firebase-functions/logger";
import {onRequest} from "firebase-functions/v2/https";
import type Stripe from "stripe";
import {getStripe, getStripeWebhookSecret} from "./stripeClient";
import {
  markExistingBookingPaid,
  resolveCollection,
  sessionPresentment,
  upsertSightseeingFromPaidSession,
} from "./markBookingPaid";
import {REGION} from "./corsAuth";
import {upsertInstantHotelFromPaidSession} from "./instantHotelCheckout";

const sessionPaid = (session: Stripe.Checkout.Session): boolean =>
  session.payment_status === "paid";

const handleCheckoutCompleted = async (session: Stripe.Checkout.Session) => {
  if (!sessionPaid(session)) {
    logger.info(
      `[stripeWebhook] skip session ${session.id} payment_status=${session.payment_status}`,
    );
    return {skipped: true as const, reason: "not_paid"};
  }

  const meta = session.metadata || {};
  const bookingId = (meta.bookingId || session.client_reference_id || "").trim();
  const collection = resolveCollection(
    meta.bookingCollection || meta.bookingType,
  );

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

  if (meta.checkoutKind === "instantHotel" && meta.holdId) {
    const id = await upsertInstantHotelFromPaidSession(session);
    return {skipped: false as const, path: `hotelBookingData/${id}`, ok: true};
  }

  // Existing booking (hotel / transport / package pay-later)
  if (bookingId && collection) {
    const result = await markExistingBookingPaid(collection, bookingId, info);
    if (result.ok) {
      return {skipped: false as const, path: result.path, ok: true};
    }
    // Fall through to sightseeing create only if package metadata present
    if (!meta.packageId && meta.bookingType !== "sightseeing") {
      return {
        skipped: false as const,
        path: result.path,
        ok: false,
        reason: result.reason,
      };
    }
  }

  // Package: checkout-first flow (no bookingId) or fallback after missing doc
  const isSightseeing =
    meta.bookingType === "sightseeing" ||
    meta.bookingCollection === "travelBookingDetails" ||
    Boolean(meta.packageId);

  if (isSightseeing) {
    const id = await upsertSightseeingFromPaidSession(session);
    return {
      skipped: false as const,
      path: `travelBookingDetails/${id}`,
      ok: true,
    };
  }

  logger.warn(
    `[stripeWebhook] no booking target for session ${session.id}`,
    meta,
  );
  return {skipped: true as const, reason: "no_target"};
};

export const stripeWebhook = onRequest(
  {
    region: REGION,
    cors: false,
    invoker: "public",
  },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).send("Method Not Allowed");
      return;
    }

    const secret = getStripeWebhookSecret();
    const sig = req.headers["stripe-signature"];
    if (!secret) {
      logger.error("[stripeWebhook] STRIPE_WEBHOOK_SECRET not set");
      res.status(500).send("Webhook not configured");
      return;
    }
    if (!sig || typeof sig !== "string") {
      res.status(400).send("Missing stripe-signature");
      return;
    }

    const stripe = getStripe();
    let event: Stripe.Event;
    try {
      const rawBody = (req as {rawBody?: Buffer}).rawBody;
      if (!rawBody || !Buffer.isBuffer(rawBody)) {
        // Without raw body, signature verification is unreliable
        logger.error("[stripeWebhook] missing rawBody");
        res.status(400).send("Raw body required");
        return;
      }
      event = stripe.webhooks.constructEvent(rawBody, sig, secret);
    } catch (err) {
      logger.warn("[stripeWebhook] signature failed", err);
      res.status(400).send("Invalid signature");
      return;
    }

    try {
      if (event.type === "checkout.session.completed") {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(session);
      } else if (event.type === "checkout.session.async_payment_succeeded") {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(session);
      } else if (event.type === "checkout.session.expired") {
        const session = event.data.object as Stripe.Checkout.Session;
        logger.info(`[stripeWebhook] session expired ${session.id}`);
      }

      res.json({received: true});
    } catch (error) {
      logger.error("[stripeWebhook] handler error", error);
      // 500 so Stripe retries
      res.status(500).json({error: "Webhook handler failed"});
    }
  },
);
