import * as admin from "firebase-admin";

type BookingData = admin.firestore.DocumentData;

const upper = (value: unknown) => String(value || "").toUpperCase();

const ONSITE_PAYMENT_VARIANTS = new Set([
  "ONSITE",
  "ON_SITE",
  "OFF_SITE",
  "OFFLINE",
  "OFFLINE PAYMENT",
  "OFFLINE_PAYMENT",
  "PAY OFFLINE",
  "PAY_OFFLINE",
  "ONSITE PAYMENT",
  "ONSITE_PAYMENT",
  "PAY AT SITE",
  "PAY ON SITE",
  "CASH ON SITE",
  "CASH",
  "CASH PAYMENT",
  "PAY ON ARRIVAL",
  "PAY AT HOTEL",
  "ON ARRIVAL",
  "PAY LATER",
  "PAY AT LOCATION",
  "MANUAL",
  "MANUAL PAYMENT",
  "BANK TRANSFER",
  "BANK_TRANSFER",
]);

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

export const getSightseeingPaymentMethod = (booking: BookingData = {}) =>
  booking.paymentMethod ||
  booking.paymentType ||
  booking.payment_type ||
  booking.selectedPaymentMethod ||
  booking.payment?.method ||
  booking.payment?.type ||
  booking.paymentDetails?.method ||
  booking.paymentDetails?.type ||
  booking.paymentConfirmation?.provider ||
  booking.paymentConfirmation?.method ||
  "";

const hasOnlineSightseeingPaymentProof = (booking: BookingData = {}) =>
  Boolean(
    booking.stripeSessionId ||
      booking.stripePaymentIntentId ||
      booking.paymentConfirmation?.status === "paid",
  );

export const isThaiQrSightseeingPayment = (booking: BookingData = {}) => {
  const paymentMethod = upper(getSightseeingPaymentMethod(booking));

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

export const isOnsiteSightseeingPayment = (booking: BookingData = {}) => {
  if (isThaiQrSightseeingPayment(booking)) return false;

  const paymentMethod = upper(getSightseeingPaymentMethod(booking));

  if (ONSITE_PAYMENT_VARIANTS.has(paymentMethod)) return true;
  if (
    paymentMethod.includes("ONSITE") ||
    paymentMethod.includes("ON SITE") ||
    paymentMethod.includes("OFFLINE") ||
    paymentMethod.includes("OFF SITE") ||
    paymentMethod.includes("PAY LATER") ||
    paymentMethod.includes("MANUAL")
  ) {
    return true;
  }
  if (paymentMethod.includes("CASH") && !paymentMethod.includes("CARD")) {
    return true;
  }

  if (!paymentMethod && !hasOnlineSightseeingPaymentProof(booking)) {
    return true;
  }

  return false;
};

export const isStripeSightseeingPayment = (booking: BookingData = {}) => {
  const paymentMethod = upper(getSightseeingPaymentMethod(booking));

  // Intent only — session id alone is NOT proof of payment
  return (
    paymentMethod.includes("STRIPE") ||
    paymentMethod.includes("CARD") ||
    Boolean(booking.stripeSessionId || booking.stripePaymentIntentId)
  );
};

export const isSightseeingPaymentVerified = (booking: BookingData = {}) => {
  const verificationStatus = upper(booking.paymentVerificationStatus);

  if (isThaiQrSightseeingPayment(booking)) {
    return booking.isPaymentDone === true || verificationStatus === "VERIFIED";
  }

  if (isStripeSightseeingPayment(booking)) {
    // Require real paid markers — not just a Checkout session id
    return (
      booking.isPaymentDone === true ||
      booking.paymentConfirmation?.status === "paid" ||
      booking.isPaymentClear === true ||
      verificationStatus === "VERIFIED"
    );
  }

  return (
    booking.isPaymentDone === true ||
    booking.paymentConfirmation?.status === "paid" ||
    booking.isPaymentClear === true ||
    verificationStatus === "VERIFIED"
  );
};

export const canAutoAcceptSightseeingPayment = (booking: BookingData = {}) =>
  isSightseeingPaymentVerified(booking) ||
  isOnsiteSightseeingPayment(booking) ||
  isThaiQrSightseeingPayment(booking);

export const requiresDeferredSightseeingPaymentVerification = (
  booking: BookingData = {},
) =>
  (isOnsiteSightseeingPayment(booking) ||
    isThaiQrSightseeingPayment(booking)) &&
  !isSightseeingPaymentVerified(booking);

export const buildSightseeingAutoAcceptPaymentFields = (
  booking: BookingData = {},
): Record<string, unknown> => {
  const isThaiQr = isThaiQrSightseeingPayment(booking);
  const isOnsite = isOnsiteSightseeingPayment(booking);

  const fields: Record<string, unknown> = {
    paymentMethod:
      getSightseeingPaymentMethod(booking) ||
      (isThaiQr ? "THAI_QR" : isOnsite ? "ONSITE" : ""),
  };

  if (requiresDeferredSightseeingPaymentVerification(booking)) {
    fields.paymentVerificationStatus =
      booking.paymentVerificationStatus || "UNVERIFIED";
    fields.paymentVerificationNote =
      booking.paymentVerificationNote ||
      (isThaiQr ?
        "Accepted automatically for Thai QR payment. Awaiting admin verification." :
        "Accepted automatically for onsite payment. Awaiting admin verification.");
  } else if (isSightseeingPaymentVerified(booking)) {
    // Stripe (or already-verified) → keep verified + Accepted-compatible fields
    fields.paymentVerificationStatus = "VERIFIED";
    fields.isPaymentDone = true;
    fields.paymentMethod =
      getSightseeingPaymentMethod(booking) ||
      (isStripeSightseeingPayment(booking) ? "STRIPE" : fields.paymentMethod);
  }

  return fields;
};