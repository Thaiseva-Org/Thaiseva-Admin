import * as admin from "firebase-admin";

export type NightInventory = {
  base: number;
  extra: number;
  blocked: number;
  reserved: number;
  remaining: number;
  date: string;
};

export type AvailabilityAdjustment = {
  id?: string;
  hotelUid: string;
  packageId: string;
  type: "extra" | "blocked";
  delta: number;
  startDate: string;
  endDate: string;
  reason?: string;
  note?: string;
  active: boolean;
  createdBy?: string;
  createdAt?: admin.firestore.FieldValue | admin.firestore.Timestamp;
  roomTypeName?: string;
};

export type NightBreakdown = {
  date: string;
  base: number;
  extra: number;
  blocked: number;
  reserved: number;
  remaining: number;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Format a Date as YYYY-MM-DD in Asia/Bangkok. */
export const toBangkokDateString = (value: Date): string => {
  // en-CA yields YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
};

export const parseDateInput = (value: unknown): Date | null => {
  if (!value) return null;

  if (value instanceof admin.firestore.Timestamp) {
    return value.toDate();
  }

  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as {toDate: () => Date}).toDate === "function"
  ) {
    return (value as {toDate: () => Date}).toDate();
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (DATE_RE.test(trimmed)) {
      // Force UTC noon so Bangkok date matches calendar day for ISO dates
      const d = new Date(`${trimmed}T12:00:00+07:00`);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    const d = new Date(trimmed);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  if (typeof value === "number") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  return null;
};

export const toDateString = (value: unknown): string | null => {
  if (typeof value === "string" && DATE_RE.test(value.trim())) {
    return value.trim();
  }
  const d = parseDateInput(value);
  if (!d) return null;
  return toBangkokDateString(d);
};

/** Occupied nights: [checkIn, checkOut) as YYYY-MM-DD list. */
export const listStayNights = (
  checkIn: unknown,
  checkOut: unknown,
): string[] => {
  const startStr = toDateString(checkIn);
  const endStr = toDateString(checkOut);
  if (!startStr || !endStr) return [];

  const nights: string[] = [];
  let cursor = new Date(`${startStr}T12:00:00+07:00`);
  const end = new Date(`${endStr}T12:00:00+07:00`);

  if (!(cursor < end)) return [];

  // Safety cap: 366 nights
  let guard = 0;
  while (cursor < end && guard < 366) {
    nights.push(toBangkokDateString(cursor));
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
    guard += 1;
  }
  return nights;
};

/** Inclusive date range for adjustments (start..end). */
export const listInclusiveDates = (
  startDate: string,
  endDate: string,
): string[] => {
  if (!DATE_RE.test(startDate) || !DATE_RE.test(endDate)) return [];
  const start = new Date(`${startDate}T12:00:00+07:00`);
  const end = new Date(`${endDate}T12:00:00+07:00`);
  if (start > end) return [];

  const dates: string[] = [];
  let cursor = start;
  let guard = 0;
  while (cursor <= end && guard < 400) {
    dates.push(toBangkokDateString(cursor));
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
    guard += 1;
  }
  return dates;
};

export const computeRemaining = (
  base: number,
  extra: number,
  blocked: number,
  reserved: number,
): number => Math.max(0, base + extra - blocked - reserved);

export const inventoryDocKey = (hotelUid: string, packageId: string) =>
  `${hotelUid}_${packageId}`;

export const nightDocRef = (
  db: admin.firestore.Firestore,
  hotelUid: string,
  packageId: string,
  date: string,
) =>
  db
    .collection("hotelRoomInventory")
    .doc(inventoryDocKey(hotelUid, packageId))
    .collection("nights")
    .doc(date);

export const emptyNight = (
  date: string,
  base = 0,
): NightInventory => ({
  date,
  base,
  extra: 0,
  blocked: 0,
  reserved: 0,
  remaining: computeRemaining(base, 0, 0, 0),
});

export const roomsFromBooking = (booking: Record<string, unknown>): number => {
  const raw = booking.rooms ?? booking.noOfRooms ?? booking.roomCount ?? 1;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 1;
};

export const isAcceptedHotelStatus = (booking: Record<string, unknown>) => {
  const status = String(booking.bookingStatus || booking.status || "")
    .toUpperCase();
  if (["ACCEPTED", "CONFIRMED"].includes(status)) return true;
  return booking.isBookingConfirmed === true;
};

export const isCanceledHotelStatus = (booking: Record<string, unknown>) => {
  const status = String(booking.bookingStatus || booking.status || "")
    .toUpperCase();
  return ["CANCELED", "CANCELLED", "REJECTED", "DENIED"].includes(status);
};

export type GetAvailabilityResult = {
  available: boolean;
  bookableWindowOk: boolean;
  autoBookingEnabled: boolean;
  reason: string | null;
  reasonCode: string | null;
  roomsRequested: number;
  nights: NightBreakdown[];
  hotelUid: string;
  packageId: string;
  totalRooms: number;
  packageName: string | null;
  defaultRoomInventory: number;
};

/** Default sellable rooms per room type when not configured (auto-booking). */
export const DEFAULT_ROOM_INVENTORY = 5;

export const getPackageTotalRooms = (
  packageData: Record<string, unknown> | undefined,
  options?: {useDefaultIfMissing?: boolean},
): number => {
  const useDefault = options?.useDefaultIfMissing !== false;
  if (!packageData) {
    return useDefault ? DEFAULT_ROOM_INVENTORY : 0;
  }
  // Prefer per room-type inventory fields from hotel room docs
  const raw =
    packageData.totalRooms ??
    packageData.quantity ??
    packageData.inventory ??
    packageData.numberOfRooms ??
    packageData.roomCount;

  if (raw === undefined || raw === null || raw === "") {
    return useDefault ? DEFAULT_ROOM_INVENTORY : 0;
  }

  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) {
    return useDefault ? DEFAULT_ROOM_INVENTORY : 0;
  }
  if (n === 0) return 0;
  return Math.floor(n);
};

export const readAvailabilityConfig = (
  hotelData: Record<string, unknown> | undefined,
) => {
  const nestedHotelConfig = (
    hotelData?.hotel as Record<string, unknown> | undefined
  )?.availabilityConfig as Record<string, unknown> | undefined;
  const nested =
    (hotelData?.availabilityConfig as Record<string, unknown> | undefined) ||
    nestedHotelConfig ||
    hotelData;

  // Auto-booking ON by default for every hotel (admin can turn off)
  const autoBookingEnabled = nested?.autoBookingEnabled !== false;

  return {
    bookingOpenFrom: nested?.bookingOpenFrom ?
      String(nested.bookingOpenFrom) :
      null,
    bookingOpenTo: nested?.bookingOpenTo ? String(nested.bookingOpenTo) : null,
    timezone: String(nested?.timezone || "Asia/Bangkok"),
    notifyOnFull: nested?.notifyOnFull !== false,
    notifyOnFreed: nested?.notifyOnFreed !== false,
    autoBookingEnabled,
    defaultRoomInventory: Number(
      nested?.defaultRoomInventory ?? DEFAULT_ROOM_INVENTORY,
    ) || DEFAULT_ROOM_INVENTORY,
  };
};

export const isWithinBookableWindow = (
  checkIn: string,
  checkOut: string,
  openFrom: string | null,
  openTo: string | null,
): boolean => {
  if (openFrom && checkIn < openFrom) return false;
  // checkOut is exclusive night; last night is day before checkOut
  if (openTo && checkIn > openTo) return false;
  if (openTo && checkOut > openTo) {
    // allow checkout on openTo+1? Prefer last night <= openTo
    const lastNight = listStayNights(checkIn, checkOut).slice(-1)[0];
    if (lastNight && lastNight > openTo) return false;
  }
  return true;
};
