/**
 * Stripe client from environment (functions/.env or runtime config).
 */
import * as path from "path";
import Stripe from "stripe";
import * as dotenv from "dotenv";

// Load functions/.env in emulator / local; Cloud Run injects env at deploy
dotenv.config();
dotenv.config({path: path.join(__dirname, "../../.env")});

let stripeSingleton: Stripe | null = null;

export const getStripeSecretKey = (): string => {
  const key =
    process.env.STRIPE_SECRET_KEY ||
    process.env.STRIPE_SECRET ||
    "";
  return key.trim();
};

export const getStripeWebhookSecret = (): string =>
  (process.env.STRIPE_WEBHOOK_SECRET || "").trim();

export const getDefaultSuccessUrl = (): string =>
  (process.env.STRIPE_SUCCESS_URL ||
    "https://thaiseva.com/booking/success?session_id={CHECKOUT_SESSION_ID}")
    .trim();

export const getDefaultCancelUrl = (): string =>
  (process.env.STRIPE_CANCEL_URL || "https://thaiseva.com/booking/cancel")
    .trim();

export const getStripe = (): Stripe => {
  const key = getStripeSecretKey();
  if (!key) {
    throw new Error(
      "STRIPE_SECRET_KEY is not configured on the server.",
    );
  }
  if (!stripeSingleton) {
    // Use account default API version from the installed Stripe SDK types.
    stripeSingleton = new Stripe(key);
  }
  return stripeSingleton;
};

/** THB Checkout amounts are in satang (smallest unit). */
export const toStripeUnitAmount = (amountMajor: number): number => {
  const n = Math.round(Number(amountMajor) * 100);
  if (!Number.isFinite(n) || n < 1) {
    throw new Error("Amount must be at least 0.01 for Stripe Checkout.");
  }
  return n;
};
