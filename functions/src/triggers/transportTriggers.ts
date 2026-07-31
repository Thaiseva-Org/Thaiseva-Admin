/* eslint-disable max-len */
import {getFirestore, Timestamp} from "firebase-admin/firestore";
import {onDocumentCreated, onDocumentUpdated} from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import {sendTelegramNotification} from "../utils/telegram";
import {
  customerName,
  customerPhone,
  escapeHtml,
  icon,
  money,
  pick,
} from "../utils/bookingNotification";

type BookingData = Record<string, unknown>;

const normalizedStatus = (data: BookingData): string =>
  String(data.bookingStatus || data.status || "Pending").trim().toLowerCase();

const formatTransportMsg = (type: string, title: string, data: BookingData) => {
  const date = pick(data, [
    "assignmentStart", "travelAt", "travelDate", "pickupDate", "bookingDate",
    "date", "time", "reqTime", "orderedAt", "timestamp", "createdAt",
  ], "Unknown Date");
  const finalAmount = money(data, [
    "finalAmount", "totalAmount", "totalPrice", "amount", "price", "AmountOffered",
  ]);
  const received = money(data, ["amountReceived"]);
  const remaining = money(data, ["remainingBalance"]);
  const vehicle = pick(data, [
    "vehicleSnapshot.name", "vehicleName", "selectedVehicle",
    "vehicleDetails.vehicle", "transportType", "vehicle",
  ], type);
  const registration = pick(data, [
    "vehicleSnapshot.registrationNumber", "vehicleDetails.vehicleNumber", "vanNumber",
  ], "N/A");
  const company = pick(data, ["companySnapshot.name", "companyName", "providerSnapshot.name"], "N/A");
  const driver = pick(data, ["driverSnapshot.name", "Driver.name", "driverName", "handoverSnapshot.name"], "N/A");
  const pickup = pick(data, [
    "pickup", "pickupLocation", "PickUpLocation", "from", "pickupPoint",
    "pickupDropDetails.pickup",
  ], "N/A");
  const drop = pick(data, [
    "destination", "drop", "dropLocation", "to", "dropPoint", "pickupDropDetails.drop",
  ], "N/A");
  const reference = pick(data, ["bookingReference"], "Pending reference");
  const bookingStatus = pick(data, ["bookingStatus", "status"], "Pending");
  const paymentStatus = pick(data, ["paymentStatus"], "Unpaid");

  return `<b>${title} (${escapeHtml(type)})</b>\n` +
    `🔖 ${escapeHtml(reference)}\n` +
    `${icon.customer} ${escapeHtml(customerName(data))}\n` +
    `${icon.phone} ${escapeHtml(customerPhone(data))}\n` +
    `🏢 ${escapeHtml(company)}\n` +
    `🧑‍✈️ ${escapeHtml(driver)}\n` +
    `${icon.transport} ${escapeHtml(vehicle)} · ${escapeHtml(registration)}\n` +
    `${icon.route} ${escapeHtml(pickup)} -> ${escapeHtml(drop)}\n` +
    `${icon.calendar} ${escapeHtml(date)}\n` +
    `${icon.amount} Final ${escapeHtml(finalAmount)} · Received ${escapeHtml(received)} · Remaining ${escapeHtml(remaining)}\n` +
    `📌 ${escapeHtml(bookingStatus)} · ${escapeHtml(paymentStatus)}`;
};

const customerId = (data: BookingData): string => {
  for (const field of ["userId", "uid", "authUid", "customerId"]) {
    const value = data[field];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
};

const safeNotify = async (
  eventId: string,
  type: string,
  title: string,
  customerTitle: string,
  data: BookingData,
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

  const outcomes = await Promise.allSettled([
    sendTelegramNotification(formatTransportMsg(type, title, data)),
    (async () => {
      const uid = customerId(data);
      if (!uid) return;
      await db.collection("notifications").doc("users").collection(uid).add({
        title: customerTitle,
        message: `${pick(data, ["bookingReference"], "Your booking")} is now ${pick(data, ["bookingStatus", "status"], "updated")}. Payment: ${pick(data, ["paymentStatus"], "Unpaid")}.`,
        bookingReference: pick(data, ["bookingReference"], ""),
        bookingStatus: pick(data, ["bookingStatus", "status"], "Pending"),
        paymentStatus: pick(data, ["paymentStatus"], "Unpaid"),
        customerName: customerName(data),
        pickup: pick(data, ["pickup", "pickupLocation", "PickUpLocation", "from"], "N/A"),
        destination: pick(data, ["destination", "drop", "dropLocation", "to"], "N/A"),
        company: pick(data, ["companySnapshot.name", "companyName", "providerSnapshot.name"], "N/A"),
        driver: pick(data, ["driverSnapshot.name", "Driver.name", "driverName"], "N/A"),
        vehicle: pick(data, ["vehicleSnapshot.name", "vehicleDetails.vehicle", "transportType"], "N/A"),
        finalAmount: data.finalAmount || data.AmountOffered || data.price || 0,
        amountReceived: data.amountReceived || 0,
        remainingBalance: data.remainingBalance || 0,
        timestamp: Timestamp.now(),
        read: false,
        type: "transport-booking",
      });
    })(),
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
    "Booking created",
    data,
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
  const previousStatus = normalizedStatus(before);
  const nextStatus = normalizedStatus(after);
  const previousPayments = Array.isArray(before.paymentTransactions) ? before.paymentTransactions.length : 0;
  const nextPayments = Array.isArray(after.paymentTransactions) ? after.paymentTransactions.length : 0;
  const titles: Record<string, [string, string]> = {
    accepted: [`${icon.accepted} Transport Booking Accepted`, "Booking accepted"],
    confirmed: [`${icon.accepted} Transport Booking Confirmed`, "Booking confirmed"],
    completed: ["✅ Transport Booking Completed", "Booking completed"],
    rejected: ["❌ Transport Booking Rejected", "Booking rejected"],
    canceled: [`${icon.cancelled} Transport Booking Cancelled`, "Booking canceled"],
    cancelled: [`${icon.cancelled} Transport Booking Cancelled`, "Booking canceled"],
  };
  if (previousStatus !== nextStatus && titles[nextStatus]) {
    await safeNotify(`${event.id}_status_${nextStatus}`, type, titles[nextStatus][0], titles[nextStatus][1], after);
  }
  if (nextPayments > previousPayments) {
    await safeNotify(`${event.id}_payment_${nextPayments}`, type, "💳 Transport Payment Received", "Payment received", after);
  }
};

export const onCarBookingCreated = onDocumentCreated(
  {document: "car_bookings/{bookingId}", region: "asia-east2"},
  createdHandler("Taxi / Mobile Van"),
);

export const onCarBookingStatusChange = onDocumentUpdated(
  {document: "car_bookings/{bookingId}", region: "asia-east2"},
  updateHandler("Taxi / Mobile Van"),
);

export const onVanBookingCreated = onDocumentCreated(
  {document: "vanBookings/{bookingId}", region: "asia-east2"},
  createdHandler("Van"),
);

export const onVanBookingStatusChange = onDocumentUpdated(
  {document: "vanBookings/{bookingId}", region: "asia-east2"},
  updateHandler("Van"),
);

export const onSelfDriveBookingCreated = onDocumentCreated(
  {document: "self_driving_bookings/{bookingId}", region: "asia-east2"},
  createdHandler("Self Drive"),
);

export const onSelfDriveBookingStatusChange = onDocumentUpdated(
  {document: "self_driving_bookings/{bookingId}", region: "asia-east2"},
  updateHandler("Self Drive"),
);
