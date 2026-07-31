type BookingData = Record<string, unknown>;

const upper = (value: unknown) => String(value || "").toUpperCase();

const THAI_QR_PAYMENT_VARIANTS = new Set([
  "THAI_QR",
  "THAI QR",
  "THAIQR",
  "THAI-QR",
  "PROMPTPAY",
  "PROMPT_PAY",
  "PROMPT PAY",
  "THAI_PROMPTPAY",
  "THAI PROMPTPAY",
  "QR_PAYMENT",
  "QR PAYMENT",
  "QR_CODE",
  "QR CODE",
]);

export const getHotelPaymentMethod = (booking: BookingData = {}) =>
  booking.paymentMethod ||
  booking.paymentType ||
  booking.payment_type ||
  booking.selectedPaymentMethod ||
  (booking.payment as { method?: string; type?: string } | undefined)?.method ||
  (booking.payment as { method?: string; type?: string } | undefined)?.type ||
  (booking.paymentDetails as { method?: string; type?: string } | undefined)
    ?.method ||
  (booking.paymentDetails as { method?: string; type?: string } | undefined)
    ?.type ||
  (booking.paymentConfirmation as { provider?: string; method?: string } | undefined)
    ?.provider ||
  (booking.paymentConfirmation as { provider?: string; method?: string } | undefined)
    ?.method ||
  "";

export const isThaiQrHotelPayment = (booking: BookingData = {}) => {
  const paymentMethod = upper(getHotelPaymentMethod(booking));

  if (THAI_QR_PAYMENT_VARIANTS.has(paymentMethod)) return true;

  return (
    (paymentMethod.includes("THAI") && paymentMethod.includes("QR")) ||
    paymentMethod.includes("PROMPTPAY") ||
    paymentMethod.includes("PROMPT_PAY") ||
    (paymentMethod.includes("QR") &&
      !paymentMethod.includes("STRIPE") &&
      !paymentMethod.includes("CARD"))
  );
};

export const isStripeHotelPayment = (booking: BookingData = {}) => {
  const paymentMethod = upper(getHotelPaymentMethod(booking));

  return (
    Boolean(booking.stripeSessionId || booking.stripePaymentIntentId) ||
    paymentMethod.includes("STRIPE") ||
    paymentMethod.includes("CARD")
  );
};

/** Hotels support Stripe + Thai QR only (no onsite). */
export const isHotelPaymentVerified = (booking: BookingData = {}) => {
  const verificationStatus = upper(booking.paymentVerificationStatus);

  if (isThaiQrHotelPayment(booking)) {
    return booking.isPaymentDone === true || verificationStatus === "VERIFIED";
  }

  if (isStripeHotelPayment(booking)) {
    const paymentConfirmation = booking.paymentConfirmation as
      | { status?: string }
      | undefined;

    return (
      booking.isPaymentDone === true ||
      paymentConfirmation?.status === "paid" ||
      booking.isPaymentClear === true ||
      verificationStatus === "VERIFIED" ||
      Boolean(booking.stripeSessionId || booking.stripePaymentIntentId)
    );
  }

  return booking.isPaymentDone === true || verificationStatus === "VERIFIED";
};

export const requiresHotelManualApproval = (booking: BookingData = {}) => {
  const upperStatus = (value: unknown) => String(value || "").toUpperCase();
  const isConfirmedBooking =
    booking.isBookingConfirmed === true ||
    ["CONFIRMED", "ACCEPTED"].includes(upperStatus(booking.bookingStatus)) ||
    ["CONFIRMED", "ACCEPTED"].includes(upperStatus(booking.status));

  return !(isHotelPaymentVerified(booking) && isConfirmedBooking);
};