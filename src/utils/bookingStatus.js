/** Shared booking status + payment helpers */

export const RECORDS_ACCEPTED_STATUSES = [
  "Accepted",
  "Confirmed",
  "Done",
  "accepted",
  "confirmed",
  "done",
  "ACCEPTED",
  "CONFIRMED",
  "DONE",
  "completed",
  "COMPLETED",
];

export const RECORDS_PENDING_STATUSES = ["Pending", "pending", "PENDING"];

export const VAN_CONFIRMED_STATUSES = new Set([
  "confirmed",
  "accepted",
  "done",
]);

export const VAN_CANCELED_STATUSES = new Set([
  "canceled",
  "cancelled",
]);

const upper = (value) => String(value || "").toUpperCase();

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

export const getSightseeingPaymentMethod = (booking = {}) =>
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

export const hasOnlineSightseeingPaymentProof = (booking = {}) =>
  Boolean(
    booking.stripeSessionId ||
      booking.stripePaymentIntentId ||
      booking.paymentConfirmation?.status === "paid"
  );

export const isThaiQrSightseeingPayment = (booking = {}) => {
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

export const isOnsiteSightseeingPayment = (booking = {}) => {
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

  // Sightseeing defaults to onsite when no online payment proof is attached.
  if (!paymentMethod && !hasOnlineSightseeingPaymentProof(booking)) {
    return true;
  }

  return false;
};

export const isStripeSightseeingPayment = (booking = {}) => {
  const paymentMethod = upper(getSightseeingPaymentMethod(booking));

  return (
    Boolean(booking.stripeSessionId || booking.stripePaymentIntentId) ||
    paymentMethod.includes("STRIPE") ||
    (paymentMethod.includes("CARD") && hasOnlineSightseeingPaymentProof(booking))
  );
};

export const requiresDeferredSightseeingPaymentVerification = (booking = {}) =>
  (isOnsiteSightseeingPayment(booking) ||
    isThaiQrSightseeingPayment(booking)) &&
  !isPaymentVerified(booking);

export const canAutoAcceptSightseeingPayment = (booking = {}) =>
  isPaymentVerified(booking) ||
  isOnsiteSightseeingPayment(booking) ||
  isThaiQrSightseeingPayment(booking);

export const isPaymentVerified = (booking = {}) => {
  const verificationStatus = upper(booking.paymentVerificationStatus);

  if (isThaiQrSightseeingPayment(booking)) {
    return booking.isPaymentDone === true || verificationStatus === "VERIFIED";
  }

  return (
    booking.isPaymentDone === true ||
    booking.paymentConfirmation?.status === "paid" ||
    booking.isPaymentClear === true ||
    verificationStatus === "VERIFIED"
  );
};

export const isPaymentUnverified = (booking = {}) => {
  const verificationStatus = upper(booking.paymentVerificationStatus);
  if (isPaymentVerified(booking)) return false;

  return (
    verificationStatus === "UNVERIFIED" ||
    verificationStatus === "PENDING_VERIFICATION" ||
    Boolean(booking.paymentConfirmation)
  );
};

export const normalizeHotelBookingStatus = (booking = {}) => {
  const rawStatus = booking.bookingStatus || booking.status || "";
  const statusUpper = upper(rawStatus);

  if (
    statusUpper === "PENDING" ||
    statusUpper === "AWAITING_PAYMENT" ||
    statusUpper === "PENDING_VERIFICATION" ||
    statusUpper === "PAYMENT_PENDING"
  ) {
    return "Pending";
  }

  if (statusUpper === "ACCEPTED" || statusUpper === "CONFIRMED") {
    return "Accepted";
  }

  if (
    statusUpper === "CANCELED" ||
    statusUpper === "CANCELLED" ||
    statusUpper === "REJECTED" ||
    statusUpper === "DENIED"
  ) {
    return "Canceled";
  }

  return booking.status || rawStatus || "Pending";
};

export const getHotelPaymentMethod = (booking = {}) =>
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

export const isStripeHotelPayment = (booking = {}) => {
  const paymentMethod = upper(getHotelPaymentMethod(booking));

  return (
    Boolean(booking.stripeSessionId || booking.stripePaymentIntentId) ||
    paymentMethod.includes("STRIPE") ||
    paymentMethod.includes("CARD")
  );
};

export const isThaiQrHotelPayment = (booking = {}) => {
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

/** Hotels support Stripe + Thai QR only (no onsite). */
export const isHotelPaymentVerified = (booking = {}) => {
  const verificationStatus = upper(booking.paymentVerificationStatus);

  if (isThaiQrHotelPayment(booking)) {
    return booking.isPaymentDone === true || verificationStatus === "VERIFIED";
  }

  if (isStripeHotelPayment(booking)) {
    // Checkout session id alone is not proof of payment
    return (
      booking.isPaymentDone === true ||
      booking.paymentConfirmation?.status === "paid" ||
      booking.isPaymentClear === true ||
      verificationStatus === "VERIFIED"
    );
  }

  return booking.isPaymentDone === true || verificationStatus === "VERIFIED";
};

export const isHotelAccepted = (booking = {}) =>
  normalizeHotelBookingStatus(booking) === "Accepted";

export const isHotelCanceled = (booking = {}) =>
  normalizeHotelBookingStatus(booking) === "Canceled";

export const isHotelWaitingForPayment = (booking = {}) =>
  isHotelAccepted(booking) && !isHotelPaymentVerified(booking);

export const isHotelRevenueEligible = (booking = {}) =>
  isHotelAccepted(booking) && isHotelPaymentVerified(booking);

const SIGHTSEEING_PENDING_STATUSES = new Set([
  "PENDING",
  "NOT REVIEWED",
  "REVIEW IN PROGRESS",
  "IN PROGRESS",
  "REVIEWED",
  "AWAITING PAYMENT",
  "PENDING VERIFICATION",
  "PAYMENT PENDING",
]);

export const normalizeSightseeingStatus = (booking = {}) => {
  const rawStatus = booking.status || "";
  const statusUpper = upper(rawStatus);

  if (SIGHTSEEING_PENDING_STATUSES.has(statusUpper)) {
    return "Pending";
  }

  if (
    statusUpper === "ACCEPTED" ||
    statusUpper === "CONFIRMED" ||
    statusUpper === "DONE" ||
    statusUpper === "COMPLETED"
  ) {
    return "Accepted";
  }

  if (
    statusUpper === "CANCELED" ||
    statusUpper === "CANCELLED" ||
    statusUpper === "REJECTED" ||
    statusUpper === "DENIED"
  ) {
    return "Canceled";
  }

  return rawStatus || "Pending";
};

export const isSightseeingPending = (booking = {}) =>
  normalizeSightseeingStatus(booking) === "Pending";

export const isSightseeingAccepted = (booking = {}) =>
  normalizeSightseeingStatus(booking) === "Accepted";

export const isSightseeingCanceled = (booking = {}) =>
  normalizeSightseeingStatus(booking) === "Canceled";

export const isSightseeingPendingReview = (booking = {}) =>
  isSightseeingPending(booking) &&
  !isOnsiteSightseeingPayment(booking) &&
  !isThaiQrSightseeingPayment(booking);

export const needsSightseeingPaymentVerification = (booking = {}) => {
  if (!isSightseeingAccepted(booking)) return false;
  if (isPaymentVerified(booking)) return false;

  return true;
};

export const isSightseeingOnsiteQueue = (booking = {}) => {
  if (isSightseeingCanceled(booking)) return false;
  if (isSightseeingRevenueEligible(booking)) return false;

  if (needsSightseeingPaymentVerification(booking)) return true;

  return (
    isSightseeingPending(booking) &&
    (isOnsiteSightseeingPayment(booking) || isThaiQrSightseeingPayment(booking))
  );
};

export const isSightseeingWaitingForPayment = (booking = {}) =>
  isSightseeingOnsiteQueue(booking);

export const isSightseeingRevenueEligible = (booking = {}) =>
  isSightseeingAccepted(booking) && isPaymentVerified(booking);

const getDeferredPaymentStatusPrefix = (booking = {}) =>
  isThaiQrSightseeingPayment(booking) ? "Thai QR" : "Onsite";

export const getSightseeingStatusLabel = (booking = {}) => {
  if (isSightseeingCanceled(booking)) return "Rejected";
  if (isSightseeingRevenueEligible(booking)) {
    if (booking.autoAccepted && isStripeSightseeingPayment(booking)) {
      return "Auto-Accepted · Paid";
    }
    return booking.autoAccepted ? "Auto-Accepted · Paid" : "Paid & Accepted";
  }
  if (needsSightseeingPaymentVerification(booking)) {
    if (booking.autoAccepted) {
      return `${getDeferredPaymentStatusPrefix(booking)} · Auto-Accepted`;
    }
    if (
      isOnsiteSightseeingPayment(booking) ||
      isThaiQrSightseeingPayment(booking)
    ) {
      return getDeferredPaymentStatusPrefix(booking);
    }
    if (isStripeSightseeingPayment(booking)) return "Awaiting Payment";
    return "Awaiting Payment";
  }
  if (
    isSightseeingPending(booking) &&
    (isOnsiteSightseeingPayment(booking) || isThaiQrSightseeingPayment(booking))
  ) {
    return `${getDeferredPaymentStatusPrefix(booking)} · Auto-Booking`;
  }
  if (isSightseeingAccepted(booking)) return "Accepted";
  return "Pending Review";
};

export const canConfirmSightseeing = (booking = {}) =>
  isSightseeingPending(booking);

export const getSightseeingPaymentStatusInfo = (booking = {}) => {
  if (isPaymentVerified(booking)) {
    return {
      label: "Verified",
      className:
        "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20",
    };
  }

  if (
    needsSightseeingPaymentVerification(booking) ||
    isPaymentUnverified(booking) ||
    requiresDeferredSightseeingPaymentVerification(booking)
  ) {
    return {
      label: isThaiQrSightseeingPayment(booking)
        ? "Thai QR"
        : isOnsiteSightseeingPayment(booking)
          ? "Onsite"
          : "Unverified",
      className:
        "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20",
    };
  }

  return {
    label: "Unpaid",
    className:
      "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-500/20",
  };
};

export const normalizeVanStatus = (booking = {}) => {
  const rawStatus = booking.status || "";
  const normalized = String(rawStatus).trim().toLowerCase();

  if (normalized === "pending") return "Pending";
  if (VAN_CONFIRMED_STATUSES.has(normalized)) return "Confirmed";
  if (VAN_CANCELED_STATUSES.has(normalized)) return "Canceled";

  return rawStatus || "Pending";
};

export const isVanConfirmed = (booking = {}) =>
  normalizeVanStatus(booking) === "Confirmed";

export const isVanCanceled = (booking = {}) =>
  normalizeVanStatus(booking) === "Canceled";

export const isAcceptedForRecords = (booking = {}, category = "") => {
  if (category === "Room Bookings") {
    const rawStatus = booking.bookingStatus || booking.status || "";
    return ["ACCEPTED", "CONFIRMED", "DONE"].includes(upper(rawStatus));
  }

  const rawStatus = booking.bookingStatus || booking.status || "";
  const normalized = String(rawStatus).trim().toLowerCase();
  return (
    normalized === "accepted" ||
    normalized === "confirmed" ||
    normalized === "done" ||
    normalized === "completed"
  );
};

export const normalizeCombinedStatus = (before = {}, after = {}) => {
  const normalize = (data) =>
    upper(data.bookingStatus || data.status || "");

  return {
    before: normalize(before),
    after: normalize(after),
  };
};

export const getHotelPaymentStatusInfo = (booking = {}) => {
  if (isHotelPaymentVerified(booking)) {
    return {
      label: "Verified",
      className:
        "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20",
    };
  }

  if (isThaiQrHotelPayment(booking)) {
    return {
      label: "Thai QR",
      className:
        "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20",
    };
  }

  if (isStripeHotelPayment(booking)) {
    return {
      label: "Unverified",
      className:
        "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20",
    };
  }

  return {
    label: "Unpaid",
    className:
      "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-500/20",
  };
};

export const needsHotelPaymentVerification = (booking = {}) => {
  if (!isHotelAccepted(booking)) return false;
  if (isHotelPaymentVerified(booking)) return false;

  return isThaiQrHotelPayment(booking) || isStripeHotelPayment(booking);
};
