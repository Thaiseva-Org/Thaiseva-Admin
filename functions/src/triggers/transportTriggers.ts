/* eslint-disable max-len */
import {getFirestore, Timestamp} from "firebase-admin/firestore";
import {onDocumentCreated, onDocumentUpdated} from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import {sendTelegramNotification} from "../utils/telegram";
import {
  pick, icon,
} from "../utils/bookingNotification";
import {
  moneyText,
  notifyCustomer,
  resolveCustomerUid,
} from "../utils/customerNotify";

type BookingData = Record<string, unknown>;

const REGION = "asia-east2";

const normalizedStatus = (data: BookingData): string =>
  String(data.bookingStatus || data.status || "Pending").trim().toLowerCase();

const formatTransportMsg = (_type: string, _title: string, _data: BookingData) =>
  "Transport booking updated. Review in the authenticated dashboard: https://admin.thaiseva.com/dashboard";

const amountNumber = (data: BookingData): number => {
  const n = Number(
    data.finalAmount ?? data.AmountOffered ?? data.price ?? data.amount ?? 0,
  );
  return Number.isFinite(n) ? n : 0;
};

const collectionForType = (type: string): string => {
  const t = type.toLowerCase();
  if (t.includes("self")) return "self_driving_bookings";
  // car / van / taxi / bike all use car_bookings
  return "car_bookings";
};

const safeNotify = async (
  eventId: string,
  type: string,
  title: string,
  customerTitle: string,
  customerMessage: string,
  data: BookingData,
  bookingId: string,
) => {
  const db = getFirestore();
  const eventRef = db.doc(`transportNotificationEvents/${eventId}`);
  try {
    await eventRef.create({createdAt: Timestamp.now(), title, type});
  } catch (error) {
    const code = (error as {code?: number | string}).code;
    if (code === 6 || code === "already-exists") return;
    logger.warn("Unable to reserve transport notification event", {eventId, error});
  }

  const uid = resolveCustomerUid(data);
  const amount = moneyText(data);

  const outcomes = await Promise.allSettled([
    sendTelegramNotification(formatTransportMsg(type, title, data)),
    notifyCustomer({
      userId: uid,
      title: customerTitle,
      message: customerMessage + (amount ? ` Amount: ${amount}.` : ""),
      type: "transport-booking",
      bookingId,
      bookingCollection: collectionForType(type),
      eventKey: `cust_${eventId}`,
      data: {
        bookingReference: pick(data, ["bookingReference"], ""),
        bookingStatus: pick(data, ["bookingStatus", "status"], "Pending"),
        paymentStatus: pick(data, ["paymentStatus"], "Unpaid"),
        amountStatus: data.amountStatus || null,
        finalAmount: amountNumber(data),
        AmountOffered: data.AmountOffered ?? null,
        pickup: pick(data, ["pickup", "pickupLocation", "PickUpLocation", "from"], "N/A"),
        destination: pick(data, ["destination", "drop", "dropLocation", "to"], "N/A"),
      },
    }),
  ]);

  outcomes.forEach((outcome, index) => {
    if (outcome.status === "rejected") {
      logger.error("Transport notification delivery failed", {
        eventId,
        channel: index === 0 ? "telegram" : "in-app",
        error: outcome.reason,
      });
    }
  });
  await eventRef.set({completedAt: Timestamp.now()}, {merge: true}).catch((error) =>
    logger.warn("Unable to complete notification marker", {eventId, error}));
};

const createdHandler = (type: string) => async (event: {
  id: string;
  params: {bookingId: string};
  data?: {data(): BookingData};
}) => {
  const data = event.data?.data();
  if (!data) return;
  await safeNotify(
    `${event.id}_created`,
    type,
    `${icon.new} New Transport Booking`,
    "Transport request received",
    "We received your transport request. Admin will set the price soon.",
    data,
    event.params.bookingId,
  );
};

const updateHandler = (type: string) => async (event: {
  id: string;
  params: {bookingId: string};
  data?: {before: {data(): BookingData}; after: {data(): BookingData}};
}) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  if (!before || !after) return;

  const bookingId = event.params.bookingId;
  const previousStatus = normalizedStatus(before);
  const nextStatus = normalizedStatus(after);
  const prevAmount = amountNumber(before);
  const nextAmount = amountNumber(after);
  const prevAmountStatus = String(before.amountStatus || "");
  const nextAmountStatus = String(after.amountStatus || "");
  const previousPayments = Array.isArray(before.paymentTransactions) ?
    before.paymentTransactions.length :
    0;
  const nextPayments = Array.isArray(after.paymentTransactions) ?
    after.paymentTransactions.length :
    0;

  const titles: Record<string, [string, string, string]> = {
    accepted: [
      `${icon.accepted} Transport Booking Accepted`,
      "Booking accepted",
      "Your transport booking was accepted.",
    ],
    confirmed: [
      `${icon.accepted} Transport Booking Confirmed`,
      "Booking confirmed",
      "Your transport booking is confirmed.",
    ],
    completed: [
      "✅ Transport Booking Completed",
      "Booking completed",
      "Your transport booking is completed.",
    ],
    rejected: [
      "❌ Transport Booking Rejected",
      "Booking rejected",
      "Your transport booking was rejected.",
    ],
    canceled: [
      `${icon.cancelled} Transport Booking Cancelled`,
      "Booking canceled",
      "Your transport booking was canceled.",
    ],
    cancelled: [
      `${icon.cancelled} Transport Booking Cancelled`,
      "Booking canceled",
      "Your transport booking was canceled.",
    ],
  };

  // Status change → notify app + website
  if (previousStatus !== nextStatus && titles[nextStatus]) {
    const [tg, custTitle, custMsg] = titles[nextStatus];
    await safeNotify(
      `${event.id}_status_${nextStatus}`,
      type,
      tg,
      custTitle,
      custMsg,
      after,
      bookingId,
    );
  }

  // Admin set / changed price (main product path - no Stripe)
  const amountBecameQuoted =
    nextAmount > 0 &&
    (prevAmount !== nextAmount ||
      (prevAmountStatus !== nextAmountStatus &&
        nextAmountStatus.toUpperCase().includes("QUOTE") === false &&
        nextAmount > 0) ||
      (prevAmount <= 0 && nextAmount > 0));

  if (amountBecameQuoted && previousStatus === nextStatus) {
    // Only this branch if status didn't already notify with amount
    await safeNotify(
      `${event.id}_amount_${nextAmount}`,
      type,
      `${icon.amount} Transport Price Updated`,
      "Price ready for your trip",
      `Admin set the price for your transport booking (${moneyText(after) || "see app"}). Open the booking to view details.`,
      {
        ...after,
        amountStatus: after.amountStatus || "QUOTED",
      },
      bookingId,
    );
  } else if (amountBecameQuoted && previousStatus !== nextStatus) {
    // Status change already notified - still send dedicated price notice if amount newly set
    if (prevAmount <= 0 && nextAmount > 0) {
      await safeNotify(
        `${event.id}_amount_${nextAmount}`,
        type,
        `${icon.amount} Transport Price Updated`,
        "Price ready for your trip",
        `Admin set the price for your transport booking (${moneyText(after) || "see app"}).`,
        after,
        bookingId,
      );
    }
  }

  if (nextPayments > previousPayments) {
    await safeNotify(
      `${event.id}_payment_${nextPayments}`,
      type,
      "💳 Transport Payment Received",
      "Payment received",
      "A payment was recorded on your transport booking.",
      after,
      bookingId,
    );
  }
};

export const onCarBookingCreated = onDocumentCreated(
  {document: "car_bookings/{bookingId}", region: REGION},
  createdHandler("Car Booking"),
);

export const onCarBookingStatusChange = onDocumentUpdated(
  {document: "car_bookings/{bookingId}", region: REGION},
  updateHandler("Car Booking"),
);

export const onSelfDriveBookingCreated = onDocumentCreated(
  {document: "self_driving_bookings/{bookingId}", region: REGION},
  createdHandler("Self Drive"),
);

export const onSelfDriveBookingStatusChange = onDocumentUpdated(
  {document: "self_driving_bookings/{bookingId}", region: REGION},
  updateHandler("Self Drive"),
);
