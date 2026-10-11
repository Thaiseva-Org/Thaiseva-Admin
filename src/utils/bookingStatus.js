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

const HOTEL_PENDING_STATUS = new Set([
  "PENDING",
  "PENDING_VERIFICATION",
  "PENDING VERIFICATION",
  "PAYMENT_PENDING",
  "PAYMENT PENDING",
  "PAYMENT_PENDING_VERIFICATION",
  "PAYMENT PENDING VERIFICATION",
  "NOT_REVIEWED",
  "NOT REVIEWED",
]);

const HOTEL_ACCEPTED_STATUS = new Set([
  "ACCEPTED",
  "CONFIRMED",
  "COMPLETED",
  "DONE",
  "AWAITING_PAYMENT",
  "AWAITING PAYMENT",
  "ACCEPTED_AWAITING_PAYMENT",
  "PARTIALLY_CONFIRMED",
  "PARTIALLY CONFIRMED",
]);

const HOTEL_CANCELED_STATUS = new Set([
  "CANCELED",
  "CANCELLED",
  "REJECTED",
  "DENIED",
]);

/**
 * Normalize hotel booking lifecycle for admin tabs / counts.
 * Prefer bookingStatus, then status. Treat confirmed flag as Accepted.
 */
export const normalizeHotelBookingStatus = (booking = {}) => {
  const rawStatus = booking.bookingStatus || booking.status || "";
  const statusUpper = upper(rawStatus).replace(/-/g, "_");
  const statusToken = statusUpper.replace(/_/g, " ").trim();

  if (HOTEL_CANCELED_STATUS.has(statusUpper) || HOTEL_CANCELED_STATUS.has(statusToken)) {
    return "Canceled";
  }

  // "Accepted - awaiting payment" and similar display strings
  if (
    statusToken.includes("ACCEPT") ||
    statusUpper.includes("AWAITING_PAYMENT") ||
    statusToken.includes("AWAITING PAYMENT")
  ) {
    return "Accepted";
  }

  // Explicit confirm flag wins over a stale "Pending" label
  if (booking.isBookingConfirmed === true) {
    return "Accepted";
  }

  // Inventory-locked instant portion of a partial booking is accepted
  if (
    booking.inventoryReserved === true &&
    (Number(booking.roomsInstant) > 0 || booking.autoAccepted === true)
  ) {
    return "Accepted";
  }

  if (
    HOTEL_PENDING_STATUS.has(statusUpper) ||
    HOTEL_PENDING_STATUS.has(statusToken)
  ) {
    return "Pending";
  }

  if (HOTEL_ACCEPTED_STATUS.has(statusUpper) || HOTEL_ACCEPTED_STATUS.has(statusToken)) {
    return "Accepted";
  }

  // Unknown non-empty values: keep original for display; empty → Pending
  if (!rawStatus) return "Pending";
  return booking.status || rawStatus;
};

/** True when booking still has pending rooms awaiting hotel accept/reject. */
export const hasHotelPendingRooms = (booking = {}) => {
  const roomsPending = Number(booking.roomsPending ?? booking.rawData?.roomsPending ?? 0);
  if (Number.isFinite(roomsPending) && roomsPending > 0) return true;
  const source = String(
    booking.sourcePath || booking.rawData?.sourcePath || ""
  ).toLowerCase();
  const status = upper(booking.bookingStatus || booking.status || "");
  return (
    source.includes("pending_partial") ||
    (status === "PENDING" &&
      Boolean(booking.siblingAutoBookingId || booking.rawData?.siblingAutoBookingId))
  );
};

/** True when booking still needs admin/hotel action (not accepted/canceled). */
export const isHotelPending = (booking = {}) =>
  normalizeHotelBookingStatus(booking) === "Pending";

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

export const isHotelWaitingForPayment = (booking = {}) => {
  if (isHotelPaymentVerified(booking)) return false;
  if (isHotelCanceled(booking)) return false;

  const due = Number(booking.amountDue);
  if (Number.isFinite(due) && due > 0 && booking.isPaymentDone !== true) {
    return true;
  }
  if (booking.payNow === true && booking.isPaymentDone !== true) {
    return true;
  }
  const st = upper(booking.bookingStatus || booking.status || "");
  if (st.includes("AWAITING") || st.includes("AWAITING_PAYMENT")) {
    return true;
  }
  // Accepted but not paid
  return isHotelAccepted(booking) && booking.isPaymentDone !== true;
};

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
  "PENDING_VERIFICATION",
  "PAYMENT PENDING",
  "PAYMENT_PENDING",
  "PAYMENT_PENDING_VERIFICATION",
  "PAYMENT PENDING VERIFICATION",
]);

const SIGHTSEEING_ACCEPTED_STATUSES = new Set([
  "ACCEPTED",
  "CONFIRMED",
  "DONE",
  "COMPLETED",
]);

const SIGHTSEEING_CANCELED_STATUSES = new Set([
  "CANCELED",
  "CANCELLED",
  "REJECTED",
  "DENIED",
]);

const normalizeStatusToken = (value) => upper(value).replace(/_/g, " ").trim();

/**
 * Normalize sightseeing lifecycle for admin tabs.
 *
 * Stripe path often has:
 *   status: "Pending" | "Confirmed"
 *   bookingStatus: "CONFIRMED"
 *   isPaymentDone: true, paymentVerificationStatus: "VERIFIED"
 *
 * Capacity auto-accept can rewrite status → "Pending" even after pay.
 * Paid/verified bookings must still count as Accepted → Paid & Accepted tab.
 */
export const normalizeSightseeingStatus = (booking = {}) => {
  const lifecycle = normalizeStatusToken(booking.status);
  const bookingLifecycle = normalizeStatusToken(booking.bookingStatus);

  if (
    SIGHTSEEING_CANCELED_STATUSES.has(lifecycle) ||
    SIGHTSEEING_CANCELED_STATUSES.has(bookingLifecycle)
  ) {
    return "Canceled";
  }

  if (bookingLifecycle === "PAYMENT REVIEW REQUIRED") return "Pending";

  // Fully paid (Stripe Checkout, admin-verified Thai QR, etc.)
  if (isPaymentVerified(booking)) {
    return "Accepted";
  }

  // Seat accepted / confirmed (Thai QR auto-accept, onsite, manual accept)
  if (SIGHTSEEING_ACCEPTED_STATUSES.has(lifecycle)) {
    return "Accepted";
  }
  if (SIGHTSEEING_ACCEPTED_STATUSES.has(bookingLifecycle)) {
    return "Accepted";
  }

  if (
    SIGHTSEEING_PENDING_STATUSES.has(lifecycle) ||
    SIGHTSEEING_PENDING_STATUSES.has(bookingLifecycle) ||
    lifecycle.includes("PENDING") ||
    bookingLifecycle.includes("PENDING")
  ) {
    return "Pending";
  }

  return booking.status || booking.bookingStatus || "Pending";
};

export const isSightseeingPending = (booking = {}) =>
  normalizeSightseeingStatus(booking) === "Pending";

export const isSightseeingAccepted = (booking = {}) =>
  normalizeSightseeingStatus(booking) === "Accepted";

export const isSightseeingCanceled = (booking = {}) =>
  normalizeSightseeingStatus(booking) === "Canceled";

/** Manual review queue: unpaid Stripe/card only — not Thai QR, onsite, or already paid. */
export const isSightseeingPendingReview = (booking = {}) =>
  isSightseeingPending(booking) &&
  (booking.bookingFlow === "REQUEST" || (!isOnsiteSightseeingPayment(booking) &&
  !isThaiQrSightseeingPayment(booking) &&
  !isPaymentVerified(booking)));

export const needsSightseeingPaymentVerification = (booking = {}) => {
  if (isSightseeingCanceled(booking)) return false;
  if (booking.bookingFlow === "REQUEST" && !isSightseeingAccepted(booking)) return false;
  if (isPaymentVerified(booking)) return false;
  if (
    isThaiQrSightseeingPayment(booking) ||
    isOnsiteSightseeingPayment(booking)
  ) {
    return isSightseeingPending(booking) || isSightseeingAccepted(booking);
  }
  if (!isSightseeingAccepted(booking)) return false;

  return true;
};

export const isSightseeingOnsiteQueue = (booking = {}) => {
  if (isSightseeingCanceled(booking)) return false;
  if (booking.bookingFlow === "REQUEST" && !isSightseeingAccepted(booking)) return false;
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
  if (booking.bookingFlow === "REQUEST" && isSightseeingPending(booking)) return "Awaiting Confirmation - Pay Later";
  if (isSightseeingRevenueEligible(booking)) {
    if (isStripeSightseeingPayment(booking)) {
      return booking.autoAccepted ? "Stripe · Auto-Accepted · Paid" : "Stripe · Paid";
    }
    if (booking.autoAccepted) return "Auto-Accepted · Paid";
    return "Paid & Accepted";
  }
  if (needsSightseeingPaymentVerification(booking)) {
    const prefix = getDeferredPaymentStatusPrefix(booking);
    if (isThaiQrSightseeingPayment(booking)) {
      return booking.autoAccepted
        ? "Thai QR · Pending Verify"
        : "Thai QR · Awaiting Verify";
    }
    if (booking.autoAccepted) {
      return `${prefix} · Auto-Accepted`;
    }
    if (
      isOnsiteSightseeingPayment(booking) ||
      isThaiQrSightseeingPayment(booking)
    ) {
      return `${prefix} · Pending Verify`;
    }
    if (isStripeSightseeingPayment(booking)) return "Awaiting Payment";
    return "Awaiting Payment";
  }
  if (
    isSightseeingPending(booking) &&
    (isOnsiteSightseeingPayment(booking) || isThaiQrSightseeingPayment(booking))
  ) {
    return isThaiQrSightseeingPayment(booking)
      ? "Thai QR · Auto-Booking"
      : `${getDeferredPaymentStatusPrefix(booking)} · Auto-Booking`;
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

  const verificationStatus = upper(booking.paymentVerificationStatus);
  const isPendingVerification =
    verificationStatus === "PENDING_VERIFICATION" ||
    verificationStatus === "UNVERIFIED" ||
    verificationStatus === "PENDING" ||
    upper(booking.bookingStatus) === "PAYMENT_PENDING_VERIFICATION";

  if (
    needsSightseeingPaymentVerification(booking) ||
    isPaymentUnverified(booking) ||
    requiresDeferredSightseeingPaymentVerification(booking) ||
    isPendingVerification
  ) {
    if (isThaiQrSightseeingPayment(booking)) {
      return {
        label: "Thai QR · Awaiting Verification",
        className:
          "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20",
      };
    }
    if (isOnsiteSightseeingPayment(booking)) {
      return {
        label: "Onsite · Awaiting Verification",
        className:
          "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20",
      };
    }
    return {
      label: isPendingVerification ? "Pending Verify" : "Unverified",
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

/** Human-readable payment method for admin UI */
export const formatSightseeingPaymentMethodLabel = (booking = {}) => {
  if (isThaiQrSightseeingPayment(booking)) return "Thai QR (PromptPay)";
  if (isStripeSightseeingPayment(booking)) return "Card (Stripe)";
  if (isOnsiteSightseeingPayment(booking)) return "Onsite / Cash";
  const method = getSightseeingPaymentMethod(booking);
  return method || "—";
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

  const amountDue = Number(booking.amountDue);
  const hasOpenBalance =
    Number.isFinite(amountDue) && amountDue > 0;
  const unpaid =
    booking.isPaymentDone !== true &&
    booking.isPaymentClear !== true &&
    booking.paymentConfirmation?.status !== "paid";

  // Thai QR: guest submitted proof, admin still must verify
  if (
    isThaiQrHotelPayment(booking) &&
    (booking.customerQrPaymentConfirmed === true ||
      upper(booking.paymentVerificationStatus) === "PENDING_VERIFICATION") &&
    !unpaid
  ) {
    return {
      label: "Thai QR · Pending",
      className:
        "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20",
    };
  }

  // Accepted / awaiting payment → show Unpaid (not "Unverified" just because method is Stripe)
  if (unpaid) {
    if (isThaiQrHotelPayment(booking) && booking.customerQrPaymentConfirmed === true) {
      return {
        label: "Thai QR · Pending",
        className:
          "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20",
      };
    }
    if (
      hasOpenBalance ||
      isHotelAccepted(booking) ||
      upper(booking.bookingStatus).includes("AWAITING") ||
      booking.payNow === true
    ) {
      return {
        label: hasOpenBalance ? "Unpaid · Pay now" : "Unpaid",
        className:
          "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-600/20",
      };
    }
    return {
      label: "Unpaid",
      className:
        "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-500/20",
    };
  }

  if (isThaiQrHotelPayment(booking)) {
    return {
      label: "Thai QR · Pending",
      className:
        "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20",
    };
  }

  return {
    label: "Unpaid",
    className:
      "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-600/20",
  };
};

export const needsHotelPaymentVerification = (booking = {}) => {
  if (!isHotelAccepted(booking)) return false;
  if (isHotelPaymentVerified(booking)) return false;

  return isThaiQrHotelPayment(booking) || isStripeHotelPayment(booking);
};
