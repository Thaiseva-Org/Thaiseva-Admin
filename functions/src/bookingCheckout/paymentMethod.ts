/**
 * Normalize client paymentMethod to STRIPE | THAI_QR | ONSITE.
 */

export type PaymentMethod = "STRIPE" | "THAI_QR" | "ONSITE";

const upper = (v: unknown) => String(v || "").trim().toUpperCase();

const THAI_QR = new Set([
  "THAI_QR",
  "THAI QR",
  "THAIQR",
  "THAI-QR",
  "PROMPTPAY",
  "PROMPT_PAY",
  "PROMPT PAY",
  "THAI_PROMPTPAY",
  "QR_PAYMENT",
  "QR PAYMENT",
  "QR_CODE",
  "QR CODE",
  "QR",
]);

const ONSITE = new Set([
  "ONSITE",
  "ON_SITE",
  "ON SITE",
  "OFFLINE",
  "OFF_SITE",
  "OFF SITE",
  "CASH",
  "CASH ON SITE",
  "PAY ON SITE",
  "PAY AT SITE",
  "PAY ON ARRIVAL",
  "PAY LATER",
  "MANUAL",
  "BANK TRANSFER",
  "BANK_TRANSFER",
]);

const STRIPE = new Set([
  "STRIPE",
  "CARD",
  "CREDIT_CARD",
  "CREDIT CARD",
  "DEBIT",
  "DEBIT_CARD",
]);

/**
 * Normalize payment method. Default STRIPE when empty (card-first product).
 */
export const normalizePaymentMethod = (
  value: unknown,
  fallback: PaymentMethod = "STRIPE",
): PaymentMethod => {
  const raw = upper(value);
  if (!raw) return fallback;

  if (STRIPE.has(raw) || raw.includes("STRIPE") || raw.includes("CARD")) {
    return "STRIPE";
  }
  if (THAI_QR.has(raw) || (raw.includes("QR") && !raw.includes("STRIPE"))) {
    return "THAI_QR";
  }
  if (
    ONSITE.has(raw) ||
    raw.includes("ONSITE") ||
    raw.includes("ON SITE") ||
    raw.includes("OFFLINE") ||
    raw.includes("PAY LATER")
  ) {
    return "ONSITE";
  }

  return fallback;
};

export const modeOfPaymentFor = (method: PaymentMethod): "ONLINE" | "OFFLINE" =>
  method === "ONSITE" ? "OFFLINE" : "ONLINE";
