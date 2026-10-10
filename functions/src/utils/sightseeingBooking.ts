import * as admin from "firebase-admin";
import {
} from "./bookingNotification";

type BookingData = admin.firestore.DocumentData;

const upper = (value: unknown) => String(value || "").toUpperCase();

export const isConfirmedSightseeingStatus = (status: unknown) => {
  const normalized = upper(status);
  return ["ACCEPTED", "CONFIRMED", "DONE"].includes(normalized);
};

export const isCanceledSightseeingStatus = (status: unknown) => {
  const normalized = upper(status);
  return ["CANCELED", "CANCELLED", "REJECTED", "DENIED"].includes(normalized);
};

const toBookingDate = (value: unknown): Date | null => {
  if (!value) return null;

  if (value instanceof admin.firestore.Timestamp) {
    return value.toDate();
  }

  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as { toDate: () => Date }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate();
  }

  if (value instanceof Date) return value;

  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const getSightseeingTourDate = (booking: BookingData = {}) =>
  toBookingDate(booking.pickUpTime) ||
  toBookingDate(booking.arrivalDate) ||
  toBookingDate(booking.travelDate) ||
  toBookingDate(booking.orderedAt) ||
  toBookingDate(booking.createdAt);

export const isSameCalendarDay = (left: Date, right: Date) =>
  left.getFullYear() === right.getFullYear() &&
  left.getMonth() === right.getMonth() &&
  left.getDate() === right.getDate();

export const formatSightseeingTelegramMessage = (_title: string, _data: BookingData) =>
  "Sightseeing booking updated. Review in the authenticated dashboard: https://admin.thaiseva.com/dashboard";

export interface SightseeingCapacityResult {
  weeklyOk: boolean;
  dailyOk: boolean;
  weeklyCount: number;
  weeklyLimit: number;
  dailyCount: number;
  dailyLimit: number;
}

export const evaluateSightseeingCapacity = async (
  db: admin.firestore.Firestore,
  bookingData: BookingData,
  bookingId: string,
): Promise<SightseeingCapacityResult> => {
  const packageId = bookingData.packageId || bookingData.dataid;
  const partnerId =
    bookingData.partnerId ||
    bookingData.providerId ||
    bookingData.agentId ||
    null;

  const packageDocSnapshot = await db
    .collection("sightseeingPackagesDetails")
    .doc(String(packageId))
    .get();
  const packageData = packageDocSnapshot.data() || {};

  const settingsDoc = await db.collection("settings").doc("sightseeingConfig").get();
  const settingsData = settingsDoc.exists ? settingsDoc.data() : {};
  const globalLimit = parseInt(String(settingsData?.globalWeeklyLimit)) || 200;
  const globalDailyLimit =
    parseInt(String(settingsData?.globalDailyLimit)) || 20;

  let weeklyLimit = globalLimit;

  if (
    partnerId &&
    packageData?.authorizedPartners &&
    Array.isArray(packageData.authorizedPartners)
  ) {
    const authorizedPartner = packageData.authorizedPartners.find(
      (partner: BookingData) =>
        partner.partnerId === partnerId || partner.id === partnerId,
    );

    if (authorizedPartner?.maxBookingsPerWeek) {
      weeklyLimit = parseInt(String(authorizedPartner.maxBookingsPerWeek));
    }
  }

  const bookingDateRaw = bookingData.orderedAt || bookingData.createdAt;
  const bookingDate = bookingDateRaw ? bookingDateRaw.toDate() : new Date();
  const startOfWeek = new Date(bookingDate);
  const day = startOfWeek.getDay() || 7;
  if (day !== 1) startOfWeek.setHours(-24 * (day - 1));
  startOfWeek.setHours(0, 0, 0, 0);

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);

  const bookingsSnapshot = await db
    .collection("travelBookingDetails")
    .where("packageId", "==", packageId)
    .get();

  const weeklyCount = bookingsSnapshot.docs.filter((docSnap) => {
    const data = docSnap.data();
    const pid = data.partnerId || data.providerId || data.agentId;
    const rawDate = data.orderedAt || data.createdAt;
    const orderDate = rawDate ? rawDate.toDate() : null;

    const matchesPartner = partnerId ? pid === partnerId : !pid;

    return (
      matchesPartner &&
      isConfirmedSightseeingStatus(data.status) &&
      orderDate &&
      orderDate >= startOfWeek &&
      orderDate <= endOfWeek
    );
  }).length;

  const tourDate = getSightseeingTourDate(bookingData);
  let dailyCount = 0;

  if (tourDate) {
    const allBookingsSnapshot = await db.collection("travelBookingDetails").get();

    dailyCount = allBookingsSnapshot.docs.filter((docSnap) => {
      if (docSnap.id === bookingId) return false;

      const data = docSnap.data();
      if (isCanceledSightseeingStatus(data.status)) return false;

      const existingTourDate = getSightseeingTourDate(data);
      return (
        existingTourDate !== null &&
        isSameCalendarDay(existingTourDate, tourDate)
      );
    }).length;
  }

  return {
    weeklyOk: weeklyCount < weeklyLimit,
    dailyOk: tourDate ? dailyCount < globalDailyLimit : false,
    weeklyCount,
    weeklyLimit,
    dailyCount,
    dailyLimit: globalDailyLimit,
  };
};