export const BOOKING_STATUSES = [
  "All",
  "Pending",
  "Accepted",
  "Completed",
  "Rejected",
  "Canceled",
];

export const PAYMENT_STATUSES = [
  "All",
  "Unpaid",
  "Partially Paid",
  "Paid",
  "Refunded",
];

export const PAYMENT_METHODS = [
  "Cash",
  "UPI",
  "Card",
  "Bank Transfer",
  "Payment Link",
  "Other",
];

export const toDateValue = (value) => {
  if (!value) return null;
  if (value?.toDate) return value.toDate();
  if (typeof value?.seconds === "number") return new Date(value.seconds * 1000);
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const normalizeTransportStatus = (booking = {}) => {
  const raw = String(booking.bookingStatus || booking.status || "Pending")
    .trim()
    .toLowerCase();
  if (["accepted", "confirmed"].includes(raw)) return "Accepted";
  if (["completed", "done"].includes(raw)) return "Completed";
  if (["rejected", "denied"].includes(raw)) return "Rejected";
  if (["canceled", "cancelled"].includes(raw)) return "Canceled";
  return "Pending";
};

export const getTransportAmount = (booking = {}) => {
  const value = Number(
    booking.finalAmount ??
      booking.AmountOffered ??
      booking.price ??
      booking.amount ??
      booking.totalAmount ??
      0
  );
  return Number.isFinite(value) && value > 0 ? value : 0;
};

export const getTransportPayment = (booking = {}) => {
  const finalAmount = getTransportAmount(booking);
  const amountReceived = Math.max(0, Number(booking.amountReceived) || 0);
  const amountRefunded = Math.max(0, Number(booking.amountRefunded) || 0);
  const netReceived = Math.max(0, amountReceived - amountRefunded);
  let paymentStatus = booking.paymentStatus;
  if (!paymentStatus) {
    paymentStatus = netReceived <= 0
      ? "Unpaid"
      : netReceived < finalAmount
        ? "Partially Paid"
        : "Paid";
  }
  if (amountRefunded > 0) {
    paymentStatus = "Refunded";
  }
  return {
    finalAmount,
    amountReceived,
    amountRefunded,
    remainingBalance: Math.max(0, finalAmount - netReceived),
    paymentStatus,
  };
};

const first = (...values) => values.find((value) => value !== undefined && value !== null && value !== "") || "";

export const normalizeTransportBooking = (data = {}, kind, source = "manual") => {
  const status = normalizeTransportStatus(data);
  const payment = getTransportPayment(data);
  const isSelfDrive = kind === "selfDrive";
  const travelRaw = first(
    data.assignmentStart,
    data.travelAt,
    data.travelDate,
    data.pickupDate,
    data.bookingDate,
    data.date,
    isSelfDrive ? data.time : data.reqTime
  );
  const createdRaw = first(data.createdAt, data.timestamp, data.time, data.orderedAt);
  const customerName = first(data.customerName, data.name, data.username, data.guestName, "Unknown customer");
  const customerPhone = first(data.customerPhone, data.contact, data.phoneNo, data.guestPhone, data.phone, "—");
  const pickup = first(
    data.pickup,
    data.pickupLocation,
    data.PickUpLocation,
    data.from,
    data.fromLocation?.primary,
    "—"
  );
  const destination = first(
    data.destination,
    data.drop,
    data.dropLocation,
    data.to,
    data.toLocation?.primary,
    "—"
  );
  return {
    ...data,
    kind,
    source,
    bookingStatus: status,
    displayStatus: status,
    bookingReference: data.bookingReference || `${kind.toUpperCase()}-${String(data.id || "").slice(0, 8).toUpperCase()}`,
    customerName,
    customerPhone,
    pickup,
    destination,
    vehicleType: first(data.vehicleSnapshot?.vehicleType, data.transportType, data.type, data.vanTypeName, data.vanType, "—"),
    companyName: first(data.companySnapshot?.name, data.companyName, "—"),
    driverName: first(data.driverSnapshot?.name, data.Driver?.name, data.driverName, "—"),
    vehicleName: first(data.vehicleSnapshot?.name, data.vehicleDetails?.vehicle, data.vanNumber, "—"),
    registrationNumber: first(data.vehicleSnapshot?.registrationNumber, data.vehicleDetails?.vehicleNumber, data.vanNumber, "—"),
    travelDateValue: toDateValue(travelRaw),
    createdDateValue: toDateValue(createdRaw),
    ...payment,
    licenceVerificationStatus: data.licenceVerificationStatus || "Pending",
    passportVerificationStatus: data.passportVerificationStatus || "Pending",
    paymentTransactions: Array.isArray(data.paymentTransactions) ? data.paymentTransactions : [],
    refundTransactions: Array.isArray(data.refundTransactions) ? data.refundTransactions : [],
    activityHistory: Array.isArray(data.activityHistory) ? data.activityHistory : [],
    statusHistory: Array.isArray(data.statusHistory) ? data.statusHistory : [],
  };
};

export const formatMoney = (value) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);

export const formatTransportDate = (value) => {
  const date = toDateValue(value);
  return date ? date.toLocaleString() : "—";
};

export const validActionsFor = (status) => {
  if (status === "Pending") return ["view", "edit", "accept", "reject", "cancel"];
  if (status === "Accepted") return ["view", "payment", "assignment", "complete", "cancel"];
  if (status === "Completed") return ["view", "payment"];
  return ["view"];
};
