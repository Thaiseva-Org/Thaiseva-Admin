/**
 * Consistent API success payloads for STRIPE / THAI_QR / ONSITE.
 */
import type {PaymentMethod} from "./paymentMethod";

export type BookingResultBase = {
  bookingId?: string | null;
  autoBookingId?: string | null;
  pendingBookingId?: string | null;
  bookingCollection: string;
  amount: number;
  currency?: string;
  status?: string | null;
  bookingStatus?: string | null;
  path?: string | null;
  payNow?: boolean;
  duplicate?: boolean;
  [key: string]: unknown;
};

export const okStripe = (
  base: BookingResultBase,
  session: {url: string | null; id: string},
  message?: string,
) => ({
  success: true as const,
  paymentMethod: "STRIPE" as PaymentMethod,
  ...base,
  currency: base.currency || "thb",
  stripeUrl: session.url,
  stripeSessionId: session.id,
  isPaymentDone: false,
  payNow: true,
  message:
    message ||
    (session.url ?
      "Redirect the guest to stripeUrl to complete payment." :
      "Booking saved. Stripe session created without a URL."),
});

export const okThaiQr = (
  base: BookingResultBase,
  opts?: {
    customerQrPaymentConfirmed?: boolean;
    message?: string;
  },
) => ({
  success: true as const,
  paymentMethod: "THAI_QR" as PaymentMethod,
  ...base,
  currency: base.currency || "thb",
  stripeUrl: null,
  isPaymentDone: false,
  paymentVerificationStatus:
    base.paymentVerificationStatus || "PENDING_VERIFICATION",
  customerQrPaymentConfirmed: opts?.customerQrPaymentConfirmed === true,
  message:
    opts?.message ||
    "Booking saved. Awaiting QR payment verification.",
});

export const okOnsite = (
  base: BookingResultBase,
  opts?: {message?: string},
) => ({
  success: true as const,
  paymentMethod: "ONSITE" as PaymentMethod,
  ...base,
  currency: base.currency || "thb",
  stripeUrl: null,
  isPaymentDone: false,
  modeOfPayment: "OFFLINE",
  paymentVerificationStatus:
    base.paymentVerificationStatus || "PENDING_VERIFICATION",
  message:
    opts?.message ||
    "Booking confirmed. Payment due onsite.",
});

/**
 * Success without a live Stripe URL.
 * Respects base.payNow when set (e.g. booking saved, pay via My Bookings).
 */
export const okPendingNoCharge = (
  base: BookingResultBase,
  paymentMethod: PaymentMethod,
  message: string,
) => ({
  success: true as const,
  paymentMethod,
  ...base,
  currency: base.currency || "thb",
  stripeUrl: null,
  isPaymentDone: base.isPaymentDone === true,
  payNow: base.payNow === true,
  message,
});
