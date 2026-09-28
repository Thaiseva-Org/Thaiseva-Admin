/**
 * Shared Stripe Checkout Session creation.
 */
import type Stripe from "stripe";
import * as logger from "firebase-functions/logger";
import {
  getDefaultCancelUrl,
  getDefaultSuccessUrl,
  getStripe,
  toStripeUnitAmount,
} from "./stripeClient";
import {isAllowedRedirectUrl, stringValue} from "./corsAuth";

/** Best-effort expire a previous Checkout so double-pay is less likely. */
export const expireCheckoutSessionSafe = async (
  sessionId: string | null | undefined,
): Promise<void> => {
  const id = stringValue(sessionId, 200);
  if (!id || !id.startsWith("cs_")) return;
  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(id);
    if (
      session.status === "open" &&
      session.payment_status === "unpaid"
    ) {
      await stripe.checkout.sessions.expire(id);
      logger.info(`[stripe] expired old session ${id}`);
    }
  } catch (err) {
    logger.warn(`[stripe] could not expire session ${id}`, err);
  }
};

export type CheckoutMeta = {
  bookingId?: string;
  bookingCollection?: string;
  bookingType?: string;
  userId?: string;
  /** Extra metadata keys (string values only). */
  extra?: Record<string, string>;
};

export type CreateCheckoutInput = {
  amount: number;
  currency?: string;
  productName: string;
  productDescription?: string;
  customerEmail?: string;
  successUrl?: string;
  cancelUrl?: string;
  metadata: CheckoutMeta;
  /** Idempotency key for Stripe */
  idempotencyKey?: string;
  /** Unix timestamp; Stripe requires at least 30 minutes. */
  expiresAt?: number;
};

export type CheckoutResult = {
  id: string;
  url: string | null;
  amount: number;
  currency: string;
  expiresAt: number | null;
};

const pickUrl = (requested: unknown, fallback: string): string => {
  const u = stringValue(requested, 2000);
  if (u && isAllowedRedirectUrl(u)) return u;
  return fallback;
};

/** Stripe rejects bad customer_email; only pass plausible addresses. */
const safeCustomerEmail = (email: unknown): string | undefined => {
  const e = stringValue(email, 200).toLowerCase();
  if (!e) return undefined;
  // Basic RFC-ish check; Stripe still validates
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return undefined;
  return e;
};

export const createCheckoutSessionCore = async (
  input: CreateCheckoutInput,
): Promise<CheckoutResult> => {
  const stripe = getStripe();
  const currency = (input.currency || "thb").toLowerCase();
  const unitAmount = toStripeUnitAmount(input.amount);

  const meta: Record<string, string> = {
    bookingId: stringValue(input.metadata.bookingId, 200),
    bookingCollection: stringValue(input.metadata.bookingCollection, 80),
    bookingType: stringValue(input.metadata.bookingType, 40),
    userId: stringValue(input.metadata.userId, 128),
  };
  if (input.metadata.extra) {
    for (const [k, v] of Object.entries(input.metadata.extra)) {
      if (k && v != null) {
        const key = k.slice(0, 40);
        const val = String(v).slice(0, 500);
        if (val) meta[key] = val;
      }
    }
  }

  // Strip empty metadata keys (Stripe rejects empty strings in some cases)
  for (const k of Object.keys(meta)) {
    if (!meta[k]) delete meta[k];
  }

  // Stripe metadata: max 50 keys
  const metaKeys = Object.keys(meta);
  if (metaKeys.length > 50) {
    for (const k of metaKeys.slice(50)) delete meta[k];
  }

  const customerEmail = safeCustomerEmail(input.customerEmail);

  const params: Stripe.Checkout.SessionCreateParams = {
    mode: "payment",
    // Card only for hosted Checkout (PromptPay etc. can be added later)
    payment_method_types: ["card"],
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency,
          unit_amount: unitAmount,
          product_data: {
            name: stringValue(input.productName, 200) || "Thaiseva Booking",
            description: input.productDescription ?
              stringValue(input.productDescription, 500) || undefined :
              undefined,
          },
        },
      },
    ],
    success_url: pickUrl(input.successUrl, getDefaultSuccessUrl()),
    cancel_url: pickUrl(input.cancelUrl, getDefaultCancelUrl()),
    client_reference_id: meta.bookingId || undefined,
    metadata: meta,
    payment_intent_data: {
      metadata: meta,
    },
    ...(input.expiresAt ? {expires_at: input.expiresAt} : {}),
  };

  if (customerEmail) {
    params.customer_email = customerEmail;
  }

  const session = await stripe.checkout.sessions.create(
    params,
    input.idempotencyKey ?
      {idempotencyKey: input.idempotencyKey.slice(0, 255)} :
      undefined,
  );

  return {
    id: session.id,
    url: session.url,
    amount: input.amount,
    currency,
    expiresAt: session.expires_at || null,
  };
};
