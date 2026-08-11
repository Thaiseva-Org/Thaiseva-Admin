import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import {
  AvailabilityAdjustment,
  computeRemaining,
  DEFAULT_ROOM_INVENTORY,
  emptyNight,
  getPackageTotalRooms,
  isWithinBookableWindow,
  listInclusiveDates,
  listStayNights,
  nightDocRef,
  NightBreakdown,
  readAvailabilityConfig,
  roomsFromBooking,
  toDateString,
  GetAvailabilityResult,
  isAcceptedHotelStatus,
  isCanceledHotelStatus,
} from "./hotelAvailability";

type Db = admin.firestore.Firestore;
type Tx = admin.firestore.Transaction;
export type InventoryReservationKind = "hold" | "booking";

const removeTrackedRooms = (
  data: {held: number; booked: number; untracked: number},
  rooms: number,
  preferred?: InventoryReservationKind,
) => {
  let left = Math.max(0, Math.floor(rooms));
  let held = Math.max(0, data.held);
  let booked = Math.max(0, data.booked);
  let untracked = Math.max(0, data.untracked);
  const take = (value: number) => {
    const removed = Math.min(value, left);
    left -= removed;
    return value - removed;
  };

  if (preferred === "hold") held = take(held);
  if (preferred === "booking") booked = take(booked);
  untracked = take(untracked);
  if (!preferred || left > 0) booked = take(booked);
  if (!preferred || left > 0) held = take(held);
  return {held, booked, untracked, removed: Math.max(0, rooms - left)};
};

const asNumber = (v: unknown, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

/** Sum active extra/blocked deltas that cover a calendar date. */
const sumAdjustmentsForDate = (
  adjustments: Array<{
    type?: string;
    delta?: number;
    startDate?: unknown;
    endDate?: unknown;
  }>,
  date: string,
): {extra: number; blocked: number} => {
  let extra = 0;
  let blocked = 0;
  for (const adj of adjustments) {
    // Normalize possible Timestamp / Date / string to YYYY-MM-DD
    const start =
      toDateString(adj.startDate) || String(adj.startDate || "").slice(0, 10);
    const end =
      toDateString(adj.endDate) || String(adj.endDate || "").slice(0, 10);
    if (!start || !end || !/^\d{4}-\d{2}-\d{2}$/.test(start) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
      continue;
    }
    if (date < start || date > end) continue;
    const delta = Math.max(0, asNumber(adj.delta, 0));
    if (adj.type === "extra") extra += delta;
    if (adj.type === "blocked" || adj.type === "block") blocked += delta;
  }
  return {extra, blocked};
};

/**
 * Capacity fields for a night:
 * - base: package total (or ledger base)
 * - extra/blocked: max(ledger, sum of active adjustments)
 *   so date extras always apply even if ledger was written before the adjustment
 *   or materialization partially failed. allowAdminExtra top-ups stay on ledger.
 * - reserved: ledger reserved only (caller may add legacy outside)
 */
const mergeNightCapacity = (
  date: string,
  defaultBase: number,
  ledger: {
    exists: boolean;
    base?: number;
    extra?: number;
    blocked?: number;
    held?: number;
    booked?: number;
    untracked?: number;
    reserved?: number;
  },
  adjustments: Array<{
    type?: string;
    delta?: number;
    startDate?: unknown;
    endDate?: unknown;
  }>,
): {
  date: string;
  base: number;
  extra: number;
  blocked: number;
  held: number;
  booked: number;
  untracked: number;
  reserved: number;
  remaining: number;
} => {
  const adj = sumAdjustmentsForDate(adjustments, date);
  // The room document is authoritative. Existing materialized nights must not
  // keep selling an old quantity after an admin/partner changes totalRooms.
  const base = Number.isFinite(defaultBase) ?
    Math.max(0, defaultBase) :
    asNumber(ledger.base, 0);
  const extra = Math.max(asNumber(ledger.extra, 0), adj.extra);
  const blocked = Math.max(asNumber(ledger.blocked, 0), adj.blocked);
  const rawReserved = Math.max(0, asNumber(ledger.reserved, 0));
  const hasBreakdown =
    ledger.held !== undefined ||
    ledger.booked !== undefined ||
    ledger.untracked !== undefined;
  const held = Math.max(0, asNumber(ledger.held, 0));
  const booked = Math.max(0, asNumber(ledger.booked, 0));
  const untracked = hasBreakdown ?
    Math.max(0, asNumber(ledger.untracked, rawReserved - held - booked)) :
    rawReserved;
  const reserved = held + booked + untracked;
  return {
    date,
    base,
    extra,
    blocked,
    held,
    booked,
    untracked,
    reserved,
    remaining: computeRemaining(base, extra, blocked, reserved),
  };
};

const readNightInTx = async (
  tx: Tx,
  db: Db,
  hotelUid: string,
  packageId: string,
  date: string,
  defaultBase: number,
) => {
  const ref = nightDocRef(db, hotelUid, packageId, date);
  const snap = await tx.get(ref);
  if (!snap.exists) {
    return {ref, data: emptyNight(date, defaultBase), exists: false};
  }
  const d = snap.data() || {};
  const base = asNumber(d.base, defaultBase);
  const extra = asNumber(d.extra, 0);
  const blocked = asNumber(d.blocked, 0);
  const rawReserved = Math.max(0, asNumber(d.reserved, 0));
  const hasBreakdown =
    d.held !== undefined || d.booked !== undefined || d.untracked !== undefined;
  const held = Math.max(0, asNumber(d.held, 0));
  const booked = Math.max(0, asNumber(d.booked, 0));
  const untracked = hasBreakdown ?
    Math.max(0, asNumber(d.untracked, rawReserved - held - booked)) :
    rawReserved;
  const reserved = held + booked + untracked;
  return {
    ref,
    exists: true,
    data: {
      date,
      base,
      extra,
      blocked,
      held,
      booked,
      untracked,
      reserved,
      remaining: computeRemaining(base, extra, blocked, reserved),
    },
  };
};

const writeNight = (
  tx: Tx,
  ref: admin.firestore.DocumentReference,
  data: {
    base: number;
    extra: number;
    blocked: number;
    held?: number;
    booked?: number;
    untracked?: number;
    reserved?: number;
  },
  date: string,
) => {
  const hasBreakdown =
    data.held !== undefined ||
    data.booked !== undefined ||
    data.untracked !== undefined;
  const held = Math.max(0, Math.floor(asNumber(data.held, 0)));
  const booked = Math.max(0, Math.floor(asNumber(data.booked, 0)));
  const untracked = Math.max(
    0,
    Math.floor(
      asNumber(
        data.untracked,
        hasBreakdown ? asNumber(data.reserved, 0) - held - booked : data.reserved,
      ),
    ),
  );
  const reserved = held + booked + untracked;
  const remaining = computeRemaining(
    data.base,
    data.extra,
    data.blocked,
    reserved,
  );
  tx.set(
    ref,
    {
      ...data,
      held,
      booked,
      untracked,
      reserved,
      date,
      remaining,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    {merge: true},
  );
  return remaining;
};

/**
 * Room types are created with the hotel (HotelDB/{hotelUid}/rooms/{roomId}).
 * Falls back to legacy hotelPackageDetails for older data.
 */
export const loadPackage = async (
  db: Db,
  packageId: string,
  hotelUid?: string,
) => {
  const roomId = String(packageId || "").trim();
  if (!roomId) return null;

  if (hotelUid) {
    const roomSnap = await db
      .collection("HotelDB")
      .doc(hotelUid)
      .collection("rooms")
      .doc(roomId)
      .get();
    if (roomSnap.exists) {
      return {
        id: roomSnap.id,
        hotelUid,
        source: "hotel_rooms",
        ...(roomSnap.data() || {}),
      } as Record<string, unknown> & {id: string};
    }
  }

  // Legacy package collection
  const snap = await db.collection("hotelPackageDetails").doc(roomId).get();
  if (snap.exists) {
    return {
      id: snap.id,
      source: "hotelPackageDetails",
      ...(snap.data() || {}),
    } as Record<string, unknown> & {id: string};
  }

  // Last resort: collection group style scan not available; try without hotelUid on rooms via known hotels is too expensive
  return null;
};

/** Resolve room doc id from room display name when packageId is missing. */
export const resolvePackageIdByRoomName = async (
  db: Db,
  hotelUid: string,
  roomName: string,
): Promise<string | null> => {
  const hid = String(hotelUid || "").trim();
  const target = String(roomName || "").trim().toLowerCase();
  if (!hid || !target) return null;

  const roomsSnap = await db
    .collection("HotelDB")
    .doc(hid)
    .collection("rooms")
    .get();

  for (const doc of roomsSnap.docs) {
    const d = doc.data() || {};
    const name = String(
      d.roomName || d.packageName || d.name || d.title || "",
    )
      .trim()
      .toLowerCase();
    if (name && (name === target || name.includes(target) || target.includes(name))) {
      return doc.id;
    }
  }

  return null;
};

/** Server-side room price for website/admin booking amount. */
export const getRoomPricing = (
  pkg: Record<string, unknown> | null | undefined,
  hotel: Record<string, unknown> | null | undefined,
) => {
  const selected = pkg || {};
  const hotelData = hotel || {};
  const roomPrice = Number(
    (selected.pricing as Record<string, unknown> | undefined)
      ?.pricePerNightAfterDiscount ??
      selected.price ??
      (selected.pricing as Record<string, unknown> | undefined)?.basePrice ??
      (hotelData.pricing as Record<string, unknown> | undefined)?.startingPrice ??
      hotelData.price ??
      (hotelData.hotel as Record<string, unknown> | undefined)?.startingPrice ??
      0,
  );
  const extraBedPrice = Number(
    selected.extraBedPrice ??
      (selected.policies as Record<string, unknown> | undefined)?.extraBedPrice ??
      (hotelData.policies as Record<string, unknown> | undefined)?.extraBedPrice ??
      0,
  );
  const policiesExtra =
    (selected.policies as Record<string, unknown> | undefined)?.extraBed;
  const hotelPoliciesExtra =
    (hotelData.policies as Record<string, unknown> | undefined)?.extraBed;
  const extraBedTruthy = (v: unknown) =>
    v === true ||
    v === "Available" ||
    v === "available" ||
    String(v || "").toLowerCase() === "yes";
  const allowExtraBed = Boolean(
    selected.allowExtraBed === true ||
      selected.hasExtraBed === true ||
      selected.extraBed === true ||
      extraBedTruthy(policiesExtra) ||
      (selected.policies as Record<string, unknown> | undefined)?.allowExtraBed ===
        true ||
      (hotelData.policies as Record<string, unknown> | undefined)?.allowExtraBed ===
        true ||
      hotelPoliciesExtra === true ||
      extraBedTruthy(hotelPoliciesExtra),
  );
  const hotelName = String(
    hotelData.hotelName ||
      (hotelData.hotel as Record<string, unknown> | undefined)?.hotelName ||
      (hotelData.hotelInformation as Record<string, unknown> | undefined)
        ?.hotelName ||
      hotelData.name ||
      "Hotel Booking",
  );
  const roomName = String(
    selected.roomName ||
      selected.packageName ||
      selected.name ||
      selected.title ||
      "Room",
  );
  return {roomPrice, extraBedPrice, allowExtraBed, hotelName, roomName};
};

export const getRoomDisplayName = (room: Record<string, unknown> | undefined) =>
  String(
    room?.roomName ||
      room?.packageName ||
      room?.name ||
      room?.id ||
      "Room",
  );

export const loadHotel = async (db: Db, hotelUid: string) => {
  const snap = await db.collection("HotelDB").doc(hotelUid).get();
  if (!snap.exists) return null;
  return {id: snap.id, ...(snap.data() || {})} as Record<string, unknown> & {
    id: string;
  };
};

/**
 * Availability settings live under the hotel. Inline config is read only as a
 * compatibility fallback for hotels created before the subcollection existed.
 */
export const loadAvailabilityConfig = async (
  db: Db,
  hotelUid: string,
  legacyHotel?: Record<string, unknown> | null,
) => {
  const snap = await db
    .collection("HotelDB")
    .doc(hotelUid)
    .collection("availability")
    .doc("config")
    .get();
  if (snap.exists) {
    return {...readAvailabilityConfig(snap.data()), configured: true};
  }
  const inlineConfigured = Boolean(
    legacyHotel?.availabilityConfig ||
      (legacyHotel?.hotel as Record<string, unknown> | undefined)
        ?.availabilityConfig,
  );
  const fallback = readAvailabilityConfig(legacyHotel || undefined);
  return {
    ...fallback,
    configured: inlineConfigured,
    // Never auto-sell a legacy hotel until availability has been explicitly saved.
    autoBookingEnabled: inlineConfigured ? fallback.autoBookingEnabled : false,
  };
};

/** New nested records plus legacy top-level records during migration. */
export const loadActiveAvailabilityAdjustments = async (
  db: Db,
  hotelUid: string,
  packageId: string,
): Promise<Array<AvailabilityAdjustment & {
  id: string;
  storage: "hotel" | "legacy";
}>> => {
  const [nestedSnap, legacySnap] = await Promise.all([
    db.collection("HotelDB").doc(hotelUid).collection("availability").get(),
    db
      .collection("hotelAvailabilityAdjustments")
      .where("hotelUid", "==", hotelUid)
      .get(),
  ]);

  const accepts = (data: Record<string, unknown>) =>
    data.active !== false &&
    String(data.packageId || "") === packageId &&
    (data.type === "extra" || data.type === "blocked");

  return [
    ...nestedSnap.docs
      .filter((doc) => doc.id !== "config" && accepts(doc.data()))
      .map((doc) => ({
        id: doc.id,
        ...(doc.data() as Omit<AvailabilityAdjustment, "id">),
        storage: "hotel" as const,
      })),
    ...legacySnap.docs
      .filter((doc) => accepts(doc.data()))
      .map((doc) => ({
        id: doc.id,
        ...(doc.data() as Omit<AvailabilityAdjustment, "id">),
        storage: "legacy" as const,
      })),
  ];
};

/**
 * Accepted stays that never wrote the night ledger (legacy manual accept).
 * Map date → rooms so capacity does not ignore them.
 */
export const loadUnreservedAcceptedRoomsByDate = async (
  db: Db,
  hotelUid: string,
  packageId: string,
  dates: string[],
): Promise<Record<string, number>> => {
  const result: Record<string, number> = {};
  for (const d of dates) result[d] = 0;
  if (!hotelUid || !packageId || dates.length === 0) return result;

  const dateSet = new Set(dates);
  const minDate = dates.reduce((a, b) => (a < b ? a : b));
  const maxDate = dates.reduce((a, b) => (a > b ? a : b));

  type BookingRow = Record<string, unknown> & {id: string};

  const collect = async (field: "hotelUid" | "hotelId"): Promise<BookingRow[]> => {
    try {
      const snap = await db
        .collection("hotelBookingData")
        .where(field, "==", hotelUid)
        .get();
      return snap.docs.map((d) => ({id: d.id, ...(d.data() || {})}) as BookingRow);
    } catch {
      return [];
    }
  };

  const bookings: BookingRow[] = [
    ...(await collect("hotelUid")),
    ...(await collect("hotelId")),
  ];
  const seen = new Set<string>();

  for (const b of bookings) {
    if (seen.has(b.id)) continue;
    seen.add(b.id);
    if (isCanceledHotelStatus(b)) continue;
    if (!isAcceptedHotelStatus(b)) continue;
    // Already counted in night ledger
    if (b.inventoryReserved === true) continue;

    const pid = String(b.packageId || b.roomId || "").trim();
    if (pid) {
      if (pid !== packageId) continue;
    } else {
      // Skip legacy rows without packageId — unsafe to attribute to a room type
      continue;
    }

    const checkIn = toDateString(b.checkInDate || b.checkIn);
    const checkOut = toDateString(b.checkOutDate || b.checkOut);
    if (!checkIn || !checkOut) continue;
    // Overlap with requested date range
    if (checkOut <= minDate || checkIn > maxDate) continue;

    const rooms = roomsFromBooking(b);
    for (const date of dates) {
      if (date >= checkIn && date < checkOut && dateSet.has(date)) {
        result[date] = (result[date] || 0) + rooms;
      }
    }
  }

  return result;
};

/**
 * Compute night breakdown. Creates virtual nights from package base when
 * ledger docs are missing (lazy materialization).
 * Merges legacy accepted bookings that never wrote the ledger.
 */
export const computeNightsBreakdown = async (
  db: Db,
  hotelUid: string,
  packageId: string,
  nights: string[],
  defaultBase: number,
): Promise<NightBreakdown[]> => {
  if (nights.length === 0) return [];

  const parentRef = db
    .collection("hotelRoomInventory")
    .doc(`${hotelUid}_${packageId}`);

  // Batch get night docs
  const refs = nights.map((d) => parentRef.collection("nights").doc(d));
  const snaps = await db.getAll(...refs);

  // Also load active adjustments to apply if night doc missing or for display
  const adjustments = await loadActiveAvailabilityAdjustments(
    db,
    hotelUid,
    packageId,
  );

  const legacyByDate = await loadUnreservedAcceptedRoomsByDate(
    db,
    hotelUid,
    packageId,
    nights,
  );

  return nights.map((date, i) => {
    const snap = snaps[i];
    const d = snap.exists ? snap.data() || {} : {};
    const merged = mergeNightCapacity(
      date,
      defaultBase,
      {
        exists: snap.exists,
        base: asNumber(d.base, defaultBase),
        extra: asNumber(d.extra, 0),
        blocked: asNumber(d.blocked, 0),
        held: d.held as number | undefined,
        booked: d.booked as number | undefined,
        untracked: d.untracked as number | undefined,
        reserved: asNumber(d.reserved, 0),
      },
      adjustments,
    );

    // Legacy accepted bookings that never wrote the ledger
    const legacyBooked = legacyByDate[date] || 0;
    const booked = merged.booked + legacyBooked;
    const reserved = merged.held + booked + merged.untracked;
    return {
      date: merged.date,
      base: merged.base,
      extra: merged.extra,
      blocked: merged.blocked,
      held: merged.held,
      booked,
      untracked: merged.untracked,
      reserved,
      remaining: computeRemaining(
        merged.base,
        merged.extra,
        merged.blocked,
        reserved,
      ),
    };
  });
};

export const evaluateAvailability = async (
  db: Db,
  params: {
    hotelUid: string;
    packageId: string;
    checkIn: unknown;
    checkOut: unknown;
    rooms?: number;
    /** Manual accept may proceed when auto-book is OFF; capacity still required. */
    forManualAccept?: boolean;
  },
): Promise<GetAvailabilityResult> => {
  const hotelUid = String(params.hotelUid || "").trim();
  const packageId = String(params.packageId || "").trim();
  const roomsRequested = Math.max(1, Math.floor(Number(params.rooms) || 1));
  const forManualAccept = params.forManualAccept === true;

  const baseMeta = {
    hotelUid,
    packageId,
    roomsRequested,
    autoBookingEnabled: true,
    defaultRoomInventory: DEFAULT_ROOM_INVENTORY,
  };

  if (!hotelUid || !packageId) {
    return {
      ...baseMeta,
      available: false,
      bookableWindowOk: false,
      reason: "Hotel or room type is missing.",
      reasonCode: "ROOM_TYPE_MISSING",
      nights: [],
      totalRooms: 0,
      packageName: null,
    };
  }

  const checkInStr = toDateString(params.checkIn);
  const checkOutStr = toDateString(params.checkOut);
  if (!checkInStr || !checkOutStr) {
    return {
      ...baseMeta,
      available: false,
      bookableWindowOk: false,
      reason: "Check-in or check-out date is incomplete.",
      reasonCode: "DATES_INCOMPLETE",
      nights: [],
      totalRooms: 0,
      packageName: null,
    };
  }

  const nights = listStayNights(checkInStr, checkOutStr);
  if (nights.length === 0) {
    return {
      ...baseMeta,
      available: false,
      bookableWindowOk: false,
      reason: "Stay must include at least one night.",
      reasonCode: "DATES_INCOMPLETE",
      nights: [],
      totalRooms: 0,
      packageName: null,
    };
  }

  const [pkg, hotel] = await Promise.all([
    loadPackage(db, packageId, hotelUid),
    loadHotel(db, hotelUid),
  ]);

  const config = await loadAvailabilityConfig(db, hotelUid, hotel);
  baseMeta.autoBookingEnabled = config.autoBookingEnabled;
  baseMeta.defaultRoomInventory = config.defaultRoomInventory;

  if (!pkg) {
    return {
      ...baseMeta,
      available: false,
      bookableWindowOk: false,
      reason: "Room type was not found.",
      reasonCode: "ROOM_TYPE_MISSING",
      nights: [],
      totalRooms: 0,
      packageName: null,
    };
  }

  const totalRooms = getPackageTotalRooms(pkg, {useDefaultIfMissing: false});
  const packageName = getRoomDisplayName(pkg);

  if (totalRooms <= 0) {
    return {
      ...baseMeta,
      available: false,
      bookableWindowOk: true,
      reason: "Room quantity is not configured.",
      reasonCode: "ROOM_QTY_NOT_CONFIGURED",
      nights: [],
      totalRooms: 0,
      packageName,
    };
  }

  const bookableWindowOk = isWithinBookableWindow(
    checkInStr,
    checkOutStr,
    config.bookingOpenFrom,
    config.bookingOpenTo,
  );

  if (!bookableWindowOk) {
    return {
      ...baseMeta,
      available: false,
      bookableWindowOk: false,
      reason: "Stay is outside the hotel bookable date window.",
      reasonCode: "OUTSIDE_BOOKABLE_WINDOW",
      nights: [],
      totalRooms,
      packageName,
    };
  }

  // Capacity OK but hotel has auto-booking turned off → not auto-available
  // Manual accept may ignore this gate (admin can accept while auto is OFF).
  if (!config.autoBookingEnabled && !forManualAccept) {
    const breakdown = await computeNightsBreakdown(
      db,
      hotelUid,
      packageId,
      nights,
      totalRooms,
    );
    return {
      ...baseMeta,
      available: false,
      bookableWindowOk: true,
      autoBookingEnabled: false,
      reason: "Auto booking is disabled for this hotel. Booking stays pending for manual review.",
      reasonCode: "AUTO_BOOKING_DISABLED",
      nights: breakdown,
      totalRooms,
      packageName,
    };
  }

  const breakdown = await computeNightsBreakdown(
    db,
    hotelUid,
    packageId,
    nights,
    totalRooms,
  );

  const shortNights = breakdown.filter((n) => n.remaining < roomsRequested);
  if (shortNights.length > 0) {
    return {
      ...baseMeta,
      available: false,
      bookableWindowOk: true,
      reason: `Not enough rooms on: ${shortNights.map((n) => n.date).join(", ")}`,
      reasonCode: "ROOMS_FULL",
      nights: breakdown,
      totalRooms,
      packageName,
    };
  }

  return {
    ...baseMeta,
    available: true,
    bookableWindowOk: true,
    reason: null,
    reasonCode: null,
    nights: breakdown,
    totalRooms,
    packageName,
  };
};

/**
 * How many rooms can be auto-booked for the full stay (min remaining across nights).
 * When auto-book is OFF, maxInstantRooms is 0 (all requests go pending) but
 * physicalRemaining still reports real free stock for messaging.
 */
export const evaluateStayCapacity = async (
  db: Db,
  params: {
    hotelUid: string;
    packageId: string;
    checkIn: unknown;
    checkOut: unknown;
    roomsRequested?: number;
  },
): Promise<{
  ok: boolean;
  hotelUid: string;
  packageId: string;
  packageName: string | null;
  totalRooms: number;
  roomsRequested: number;
  autoBookingEnabled: boolean;
  bookableWindowOk: boolean;
  physicalRemaining: number;
  maxInstantRooms: number;
  nights: NightBreakdown[];
  reason: string | null;
  reasonCode: string | null;
}> => {
  const roomsRequested = Math.max(
    1,
    Math.floor(Number(params.roomsRequested) || 1),
  );
  // Evaluate as if 1 room — we only need night breakdown + flags
  const base = await evaluateAvailability(db, {
    hotelUid: params.hotelUid,
    packageId: params.packageId,
    checkIn: params.checkIn,
    checkOut: params.checkOut,
    rooms: 1,
  });

  const physicalRemaining =
    base.nights.length > 0 ?
      Math.min(...base.nights.map((n) => n.remaining)) :
      0;

  // Auto path only when auto ON and bookable; else instant = 0
  let maxInstantRooms = 0;
  if (
    base.autoBookingEnabled !== false &&
    base.bookableWindowOk &&
    base.reasonCode !== "ROOM_TYPE_MISSING" &&
    base.reasonCode !== "ROOM_QTY_NOT_CONFIGURED" &&
    base.reasonCode !== "DATES_INCOMPLETE" &&
    base.reasonCode !== "OUTSIDE_BOOKABLE_WINDOW"
  ) {
    // When auto is off evaluateAvailability returns early with nights still filled
    if (base.reasonCode === "AUTO_BOOKING_DISABLED") {
      maxInstantRooms = 0;
    } else {
      maxInstantRooms = Math.max(0, physicalRemaining);
    }
  }

  // If auto disabled, still expose physical remaining from breakdown
  const physical =
    base.reasonCode === "AUTO_BOOKING_DISABLED" || base.nights.length > 0 ?
      physicalRemaining :
      0;

  return {
    ok: true,
    hotelUid: base.hotelUid,
    packageId: base.packageId,
    packageName: base.packageName,
    totalRooms: base.totalRooms,
    roomsRequested,
    autoBookingEnabled: base.autoBookingEnabled !== false,
    bookableWindowOk: base.bookableWindowOk,
    physicalRemaining: physical,
    maxInstantRooms,
    nights: base.nights,
    reason: base.reason,
    reasonCode: base.reasonCode,
  };
};

export type ReserveResult = {
  ok: boolean;
  alreadyReserved?: boolean;
  reason?: string;
  reasonCode?: string;
  nights?: NightBreakdown[];
  fullNights?: string[];
};

/**
 * Atomically reserve rooms for each night. Fails if any night insufficient.
 * When allowAdminExtra is true (manual admin accept), shortfall is covered by
 * increasing night.extra so admin-confirmed rooms can be locked on those dates.
 */
export const reserveRoomsInTransaction = async (
  db: Db,
  params: {
    hotelUid: string;
    packageId: string;
    checkIn: unknown;
    checkOut: unknown;
    rooms: number;
    bookingId: string;
    /** Stable idempotency key for this exact inventory allocation. */
    allocationId?: string;
    reservationKind?: InventoryReservationKind;
    /** Optional source document written in the same transaction as the ledger. */
    owner?: {
      collection: "hotelBookingData" | "hotelBookingHolds";
      docId: string;
      data: Record<string, unknown>;
    };
    /** Admin confirm-available: add temporary capacity (extra) if short. */
    allowAdminExtra?: boolean;
  },
): Promise<ReserveResult> => {
  const hotelUid = String(params.hotelUid).trim();
  const packageId = String(params.packageId).trim();
  const rooms = Math.max(1, Math.floor(params.rooms));
  const allowAdminExtra = params.allowAdminExtra === true;
  const reservationKind = params.reservationKind || "booking";
  const allocationId = String(params.allocationId || params.bookingId).trim();
  const nights = listStayNights(params.checkIn, params.checkOut);

  if (!hotelUid || !packageId || nights.length === 0) {
    return {
      ok: false,
      reason: "Invalid hotel, room type, or dates.",
      reasonCode: "DATES_INCOMPLETE",
    };
  }

  const pkg = await loadPackage(db, packageId, hotelUid);
  const defaultBase = getPackageTotalRooms(pkg || undefined, {
    useDefaultIfMissing: false,
  });
  if (defaultBase <= 0) {
    return {
      ok: false,
      reason: "Room quantity is not configured.",
      reasonCode: "ROOM_QTY_NOT_CONFIGURED",
    };
  }

  // Preload adjustments for materializing missing nights
  const adjustments = await loadActiveAvailabilityAdjustments(
    db,
    hotelUid,
    packageId,
  );

  // Legacy accepted bookings not yet on ledger (avoid overbook on reserve)
  const legacyByDate = await loadUnreservedAcceptedRoomsByDate(
    db,
    hotelUid,
    packageId,
    nights,
  );

  try {
    return await db.runTransaction(async (tx) => {
      const allocationRef = db
        .collection("hotelInventoryAllocations")
        .doc(allocationId);
      const allocationSnap = await tx.get(allocationRef);
      if (allocationSnap.exists && allocationSnap.data()?.status === "ACTIVE") {
        return {
          ok: true,
          alreadyReserved: true,
          nights: allocationSnap.data()?.nightBreakdown || [],
        };
      }

      const nightStates = [];
      for (const date of nights) {
        const state = await readNightInTx(
          tx,
          db,
          hotelUid,
          packageId,
          date,
          defaultBase,
        );
        // Always merge active date adjustments so "extra rooms for dates"
        // count even when a night doc was created earlier without them.
        const merged = mergeNightCapacity(
          date,
          defaultBase,
          {
            exists: state.exists,
            base: state.data.base,
            extra: state.data.extra,
            blocked: state.data.blocked,
            held: state.data.held,
            booked: state.data.booked,
            untracked: state.data.untracked,
            reserved: state.data.reserved,
          },
          adjustments,
        );
        // Prefer current package base when configured
        const base =
          defaultBase > 0 ? defaultBase : merged.base;
        const effectiveReserved =
          merged.reserved + (legacyByDate[date] || 0);
        state.data = {
          date,
          base,
          extra: merged.extra,
          blocked: merged.blocked,
          held: merged.held,
          booked: merged.booked,
          untracked: merged.untracked,
          // Keep ledger reserved (not legacy) for the write path
          reserved: merged.reserved,
          remaining: computeRemaining(
            base,
            merged.extra,
            merged.blocked,
            effectiveReserved,
          ),
        };
        nightStates.push(state);
      }

      // Admin confirm-available: top up capacity with `extra` when short
      if (allowAdminExtra) {
        for (const state of nightStates) {
          if (state.data.remaining < rooms) {
            const need = rooms - state.data.remaining;
            state.data.extra = asNumber(state.data.extra, 0) + need;
            state.data.remaining = computeRemaining(
              state.data.base,
              state.data.extra,
              state.data.blocked,
              state.data.reserved + (legacyByDate[state.data.date] || 0),
            );
          }
        }
      }

      const short = nightStates.filter(
        (s) => s.data.remaining < rooms,
      );
      if (short.length > 0) {
        return {
          ok: false,
          reason: `Not enough rooms on: ${short.map((s) => s.data.date).join(", ")}`,
          reasonCode: "ROOMS_FULL",
          fullNights: short.map((s) => s.data.date),
          nights: nightStates.map((s) => s.data),
        };
      }

      const after: NightBreakdown[] = [];
      const fullNights: string[] = [];
      for (const state of nightStates) {
        const held =
          state.data.held + (reservationKind === "hold" ? rooms : 0);
        const booked =
          state.data.booked + (reservationKind === "booking" ? rooms : 0);
        const untracked = state.data.untracked;
        const reserved = held + booked + untracked;
        const remaining = writeNight(
          tx,
          state.ref,
          {
            base: state.data.base,
            extra: state.data.extra,
            blocked: state.data.blocked,
            held,
            booked,
            untracked,
            reserved,
          },
          state.data.date,
        );
        after.push({
          date: state.data.date,
          base: state.data.base,
          extra: state.data.extra,
          blocked: state.data.blocked,
          held,
          booked,
          untracked,
          reserved,
          remaining,
        });
        if (remaining === 0) fullNights.push(state.data.date);
      }

      tx.set(allocationRef, {
        allocationId,
        status: "ACTIVE",
        kind: reservationKind,
        hotelUid,
        packageId,
        sourceId: params.bookingId,
        rooms,
        nights,
        nightBreakdown: after,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      if (params.owner?.docId) {
        const ownerRef = db
          .collection(params.owner.collection)
          .doc(params.owner.docId);
        tx.set(
          ownerRef,
          {
            ...params.owner.data,
            inventoryAllocationId: allocationId,
            inventoryReservationKind: reservationKind,
          },
          {merge: true},
        );
      }

      // Audit
      const auditRef = db.collection("hotelInventoryAuditLogs").doc();
      tx.set(auditRef, {
        action: "reserve",
        hotelUid,
        packageId,
        bookingId: params.bookingId,
        allocationId,
        reservationKind,
        rooms,
        nights,
        allowAdminExtra,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return {ok: true, nights: after, fullNights};
    });
  } catch (error) {
    logger.error("[HotelInventory] reserve failed", error);
    return {
      ok: false,
      reason: "Inventory reservation failed.",
      reasonCode: "RESERVE_ERROR",
    };
  }
};

/** Convert a checkout hold into a booked allocation without changing reserved. */
export const transferHeldRoomsToBookingInTransaction = async (
  db: Db,
  params: {
    holdId: string;
    bookingId: string;
    hotelUid: string;
    packageId: string;
    checkIn: unknown;
    checkOut: unknown;
    rooms: number;
    bookingData: Record<string, unknown>;
  },
): Promise<{ok: boolean; alreadyTransferred?: boolean; nights?: NightBreakdown[]}> => {
  const holdId = String(params.holdId || "").trim();
  const bookingId = String(params.bookingId || "").trim();
  const hotelUid = String(params.hotelUid || "").trim();
  const packageId = String(params.packageId || "").trim();
  const rooms = Math.max(1, Math.floor(Number(params.rooms) || 1));
  const nights = listStayNights(params.checkIn, params.checkOut);
  if (!holdId || !bookingId || !hotelUid || !packageId || nights.length === 0) {
    return {ok: false};
  }

  const pkg = await loadPackage(db, packageId, hotelUid);
  const defaultBase = getPackageTotalRooms(pkg || undefined, {
    useDefaultIfMissing: false,
  });
  const holdRef = db.collection("hotelBookingHolds").doc(holdId);
  const bookingRef = db.collection("hotelBookingData").doc(bookingId);
  const holdAllocationRef = db.collection("hotelInventoryAllocations").doc(holdId);
  const bookingAllocationRef = db
    .collection("hotelInventoryAllocations")
    .doc(bookingId);

  try {
    return await db.runTransaction(async (tx) => {
      const [holdSnap, holdAllocationSnap, bookingAllocationSnap] =
        await Promise.all([
          tx.get(holdRef),
          tx.get(holdAllocationRef),
          tx.get(bookingAllocationRef),
        ]);

      if (
        bookingAllocationSnap.exists &&
        bookingAllocationSnap.data()?.status === "ACTIVE"
      ) {
        return {ok: true, alreadyTransferred: true};
      }
      if (!holdSnap.exists) return {ok: false};

      const states = [];
      for (const date of nights) {
        states.push(
          await readNightInTx(tx, db, hotelUid, packageId, date, defaultBase),
        );
      }

      const after: NightBreakdown[] = [];
      for (const state of states) {
        let remainingToClassify = rooms;
        const heldMoved = Math.min(state.data.held, remainingToClassify);
        remainingToClassify -= heldMoved;
        const legacyMoved = Math.min(
          state.data.untracked,
          remainingToClassify,
        );
        remainingToClassify -= legacyMoved;
        if (remainingToClassify > 0) {
          throw new Error(`Hold allocation is missing on ${state.data.date}.`);
        }
        const held = state.data.held - heldMoved;
        const booked = state.data.booked + heldMoved + legacyMoved;
        const untracked = state.data.untracked - legacyMoved;
        const reserved = held + booked + untracked;
        const remaining = writeNight(
          tx,
          state.ref,
          {
            base: state.data.base,
            extra: state.data.extra,
            blocked: state.data.blocked,
            held,
            booked,
            untracked,
            reserved,
          },
          state.data.date,
        );
        after.push({
          date: state.data.date,
          base: state.data.base,
          extra: state.data.extra,
          blocked: state.data.blocked,
          held,
          booked,
          untracked,
          reserved,
          remaining,
        });
      }

      tx.set(
        bookingRef,
        {
          ...params.bookingData,
          inventoryAllocationId: bookingId,
          inventoryReservationKind: "booking",
        },
        {merge: true},
      );
      tx.set(
        holdRef,
        {
          inventoryReleased: true,
          inventoryReserved: false,
          inventoryTransferredToBookingId: bookingId,
          inventoryTransferredAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        {merge: true},
      );
      if (holdAllocationSnap.exists) {
        tx.set(
          holdAllocationRef,
          {
            status: "TRANSFERRED",
            transferredToAllocationId: bookingId,
            transferredAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          {merge: true},
        );
      }
      tx.set(bookingAllocationRef, {
        allocationId: bookingId,
        status: "ACTIVE",
        kind: "booking",
        sourceId: bookingId,
        sourceHoldId: holdId,
        hotelUid,
        packageId,
        rooms,
        nights,
        nightBreakdown: after,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      tx.set(db.collection("hotelInventoryAuditLogs").doc(), {
        action: "transfer_hold_to_booking",
        holdId,
        bookingId,
        hotelUid,
        packageId,
        rooms,
        nights,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return {ok: true, nights: after};
    });
  } catch (error) {
    logger.error("[HotelInventory] hold transfer failed", error);
    return {ok: false};
  }
};

/**
 * Idempotent release of reserved rooms for a booking.
 */
export const releaseRoomsInTransaction = async (
  db: Db,
  params: {
    hotelUid: string;
    packageId: string;
    checkIn: unknown;
    checkOut: unknown;
    rooms: number;
    bookingId: string;
    allocationId?: string;
  },
): Promise<{ok: boolean; freedNights?: string[]; alreadyReleased?: boolean}> => {
  return releaseInventoryDocInTransaction(db, {
    hotelUid: params.hotelUid,
    packageId: params.packageId,
    checkIn: params.checkIn,
    checkOut: params.checkOut,
    rooms: params.rooms,
    collection: "hotelBookingData",
    docId: params.bookingId,
    auditAction: "release",
    reservationKind: "booking",
    allocationId: params.allocationId,
  });
};

/**
 * Force-unlock every night from check-in → check-out (booked stay window).
 * Decrements night-ledger reserved even if flags are already wrong/stuck.
 * Does not require a booking/hold doc (ops repair tool).
 */
export const forceUnlockStayNights = async (
  db: Db,
  params: {
    hotelUid: string;
    packageId: string;
    checkIn: unknown;
    checkOut: unknown;
    rooms: number;
    /** Optional audit id (bookingId / holdId) */
    sourceId?: string;
    auditAction?: string;
  },
): Promise<{ok: boolean; freedNights: string[]; nights: string[]; rooms: number}> => {
  const hotelUid = String(params.hotelUid || "").trim();
  const packageId = String(params.packageId || "").trim();
  const rooms = Math.max(1, Math.floor(Number(params.rooms) || 1));
  const nights = listStayNights(params.checkIn, params.checkOut);

  if (!hotelUid || !packageId || nights.length === 0) {
    return {ok: false, freedNights: [], nights, rooms};
  }

  const pkg = await loadPackage(db, packageId, hotelUid);
  const defaultBase = getPackageTotalRooms(pkg || undefined, {
    useDefaultIfMissing: false,
  });

  try {
    return await db.runTransaction(async (tx) => {
      // ALL reads first
      const nightStates = [];
      for (const date of nights) {
        nightStates.push(
          await readNightInTx(tx, db, hotelUid, packageId, date, defaultBase),
        );
      }

      // ALL writes after
      const freedNights: string[] = [];
      for (const state of nightStates) {
        if (!state.exists && state.data.reserved <= 0) continue;
        const prevReserved = asNumber(state.data.reserved, 0);
        const prevRemaining = state.data.remaining;
        const next = removeTrackedRooms(state.data, rooms);
        const reserved = next.held + next.booked + next.untracked;
        const remaining = writeNight(
          tx,
          state.ref,
          {
            base: state.data.base || defaultBase,
            extra: state.data.extra,
            blocked: state.data.blocked,
            held: next.held,
            booked: next.booked,
            untracked: next.untracked,
            reserved,
          },
          state.data.date,
        );
        if (prevRemaining === 0 && remaining > 0) {
          freedNights.push(state.data.date);
        } else if (prevReserved > reserved) {
          freedNights.push(state.data.date);
        }
      }

      const auditRef = db.collection("hotelInventoryAuditLogs").doc();
      tx.set(auditRef, {
        action: params.auditAction || "force_unlock_stay",
        hotelUid,
        packageId,
        bookingId: params.sourceId || null,
        rooms,
        nights,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return {ok: true, freedNights, nights, rooms};
    });
  } catch (error) {
    logger.error("[HotelInventory] forceUnlockStayNights failed", error);
    return {ok: false, freedNights: [], nights, rooms};
  }
};

/**
 * Full unlock for a checkout hold:
 * 1) free night ledger for the whole stay
 * 2) delete the hold lock document entirely
 */
export const unlockAndDeleteHold = async (
  db: Db,
  holdId: string,
  options?: {force?: boolean},
): Promise<{
  ok: boolean;
  holdId: string;
  deleted: boolean;
  alreadyReleased?: boolean;
  freedNights?: string[];
  reason?: string;
}> => {
  const id = String(holdId || "").trim();
  if (!id) return {ok: false, holdId: "", deleted: false, reason: "holdId required"};

  const holdRef = db.collection("hotelBookingHolds").doc(id);
  const snap = await holdRef.get();
  if (!snap.exists) {
    return {
      ok: true,
      holdId: id,
      deleted: false,
      alreadyReleased: true,
      reason: "hold_not_found",
    };
  }

  const hold = snap.data() || {};
  const hotelUid = String(hold.hotelUid || "").trim();
  const packageId = String(hold.packageId || "").trim();
  const rooms = Math.max(
    0,
    Math.floor(Number(hold.roomsHeld ?? hold.rooms ?? hold.roomsRequested) || 0),
  );
  const checkIn = hold.checkIn || hold.checkInDate;
  const checkOut = hold.checkOut || hold.checkOutDate;
  const force = options?.force === true;

  // Free ledger if still locked, or force re-unlock when stuck
  if (
    rooms > 0 &&
    hotelUid &&
    packageId &&
    (hold.inventoryReserved === true || force) &&
    (hold.inventoryReleased !== true || force)
  ) {
    if (hold.inventoryReserved === true && hold.inventoryReleased !== true) {
      await releaseHoldRoomsInTransaction(db, {
        hotelUid,
        packageId,
        checkIn,
        checkOut,
        rooms,
        holdId: id,
      });
    } else if (force) {
      await forceUnlockStayNights(db, {
        hotelUid,
        packageId,
        checkIn,
        checkOut,
        rooms,
        sourceId: id,
        auditAction: "force_unlock_hold",
      });
    }
  }

  // Remove whole lock document
  await holdRef.delete();

  await db.collection("hotelInventoryAuditLogs").add({
    action: "delete_hold_lock",
    holdId: id,
    hotelUid,
    packageId,
    rooms,
    checkIn: checkIn || null,
    checkOut: checkOut || null,
    force,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return {
    ok: true,
    holdId: id,
    deleted: true,
    freedNights: listStayNights(checkIn, checkOut),
  };
};

/**
 * Full unlock for a booking stay (check-in → check-out nights).
 * Frees night ledger; marks booking unlocked. Optionally deletes related hold docs.
 */
export const unlockBookingStayLock = async (
  db: Db,
  bookingId: string,
  options?: {force?: boolean; deleteRelatedHolds?: boolean},
): Promise<{
  ok: boolean;
  bookingId: string;
  freedNights?: string[];
  holdsDeleted?: string[];
  alreadyReleased?: boolean;
  reason?: string;
}> => {
  const id = String(bookingId || "").trim();
  if (!id) {
    return {ok: false, bookingId: "", reason: "bookingId required"};
  }

  const ref = db.collection("hotelBookingData").doc(id);
  const snap = await ref.get();
  if (!snap.exists) {
    return {ok: false, bookingId: id, reason: "booking_not_found"};
  }

  const booking = snap.data() || {};
  const fields = bookingInventoryFields(booking);
  const force = options?.force === true;
  const deleteRelatedHolds = options?.deleteRelatedHolds !== false;
  const rooms = Math.max(1, fields.rooms || 1);

  let alreadyReleased = false;
  let freedNights: string[] = [];

  if (
    fields.hotelUid &&
    fields.packageId &&
    (booking.inventoryReserved === true || force)
  ) {
    if (booking.inventoryReserved === true && booking.inventoryReleased !== true) {
      const result = await releaseRoomsInTransaction(db, {
        ...fields,
        rooms,
        bookingId: id,
      });
      alreadyReleased = result.alreadyReleased === true;
      freedNights = result.freedNights || [];
    } else if (force) {
      const result = await forceUnlockStayNights(db, {
        hotelUid: fields.hotelUid,
        packageId: fields.packageId,
        checkIn: fields.checkIn,
        checkOut: fields.checkOut,
        rooms,
        sourceId: id,
        auditAction: "force_unlock_booking",
      });
      freedNights = result.freedNights || [];
    } else {
      alreadyReleased = true;
    }
  } else {
    alreadyReleased = booking.inventoryReleased === true;
  }

  await ref.set(
    {
      inventoryReserved: false,
      inventoryReleased: true,
      inventoryReleasedAt: admin.firestore.FieldValue.serverTimestamp(),
      inventoryUnlockedBy: "unlockHotelRoomLock",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    {merge: true},
  );

  const holdsDeleted: string[] = [];
  if (deleteRelatedHolds) {
    const holdIds = new Set<string>();
    const hid = String(booking.holdId || booking.inventoryFromHoldId || "").trim();
    if (hid) holdIds.add(hid);

    // Also find holds that transferred inventory to this booking
    try {
      const q = await db
        .collection("hotelBookingHolds")
        .where("inventoryTransferredToBookingId", "==", id)
        .limit(10)
        .get();
      for (const d of q.docs) holdIds.add(d.id);
    } catch {
      /* index may be missing — holdId field path is enough */
    }
    try {
      const q2 = await db
        .collection("hotelBookingHolds")
        .where("bookingId", "==", id)
        .limit(10)
        .get();
      for (const d of q2.docs) holdIds.add(d.id);
    } catch {
      /* optional */
    }

    for (const holdId of holdIds) {
      // Hold may have already transferred inventory (don't double-free ledger)
      // Only delete the lock doc unless hold still has inventoryReserved
      const holdSnap = await db.collection("hotelBookingHolds").doc(holdId).get();
      if (!holdSnap.exists) continue;
      const hold = holdSnap.data() || {};
      if (hold.inventoryReserved === true && hold.inventoryReleased !== true) {
        await unlockAndDeleteHold(db, holdId, {force});
      } else {
        await holdSnap.ref.delete();
      }
      holdsDeleted.push(holdId);
    }
  }

  return {
    ok: true,
    bookingId: id,
    freedNights,
    holdsDeleted,
    alreadyReleased,
  };
};

/**
 * Idempotent release for a temporary checkout hold (`hotelBookingHolds`).
 * Same night-ledger decrement as booking release.
 */
export const releaseHoldRoomsInTransaction = async (
  db: Db,
  params: {
    hotelUid: string;
    packageId: string;
    checkIn: unknown;
    checkOut: unknown;
    rooms: number;
    holdId: string;
  },
): Promise<{ok: boolean; freedNights?: string[]; alreadyReleased?: boolean}> => {
  return releaseInventoryDocInTransaction(db, {
    hotelUid: params.hotelUid,
    packageId: params.packageId,
    checkIn: params.checkIn,
    checkOut: params.checkOut,
    rooms: params.rooms,
    collection: "hotelBookingHolds",
    docId: params.holdId,
    auditAction: "release_hold",
    reservationKind: "hold",
  });
};

/**
 * Shared ledger release for bookings or holds.
 * Doc must track inventoryReserved / inventoryReleased.
 */
const releaseInventoryDocInTransaction = async (
  db: Db,
  params: {
    hotelUid: string;
    packageId: string;
    checkIn: unknown;
    checkOut: unknown;
    rooms: number;
    collection: "hotelBookingData" | "hotelBookingHolds";
    docId: string;
    auditAction: string;
    reservationKind: InventoryReservationKind;
    allocationId?: string;
  },
): Promise<{ok: boolean; freedNights?: string[]; alreadyReleased?: boolean}> => {
  const hotelUid = String(params.hotelUid).trim();
  const packageId = String(params.packageId).trim();
  const rooms = Math.max(1, Math.floor(params.rooms));
  const nights = listStayNights(params.checkIn, params.checkOut);

  if (!hotelUid || !packageId || nights.length === 0 || !params.docId) {
    return {ok: false};
  }

  const docRef = db.collection(params.collection).doc(params.docId);
  const pkg = await loadPackage(db, packageId, hotelUid);
  const defaultBase = getPackageTotalRooms(pkg || undefined, {
    useDefaultIfMissing: false,
  });

  try {
    return await db.runTransaction(async (tx) => {
      // ALL reads first (Firestore transaction rule)
      const snap = await tx.get(docRef);
      if (!snap.exists) return {ok: false};
      const data = snap.data() || {};

      const allocationRef = db
        .collection("hotelInventoryAllocations")
        .doc(String(params.allocationId || params.docId));
      const allocationSnap = await tx.get(allocationRef);

      if (data.inventoryReleased === true) {
        return {ok: true, alreadyReleased: true};
      }
      if (data.inventoryReserved !== true) {
        tx.update(docRef, {
          inventoryReleased: true,
          inventoryReleasedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return {ok: true, alreadyReleased: true};
      }

      const nightStates = [];
      for (const date of nights) {
        nightStates.push(
          await readNightInTx(tx, db, hotelUid, packageId, date, defaultBase),
        );
      }

      // ALL writes after reads
      const freedNights: string[] = [];
      for (const state of nightStates) {
        const prevRemaining = state.data.remaining;
        const next = removeTrackedRooms(
          state.data,
          rooms,
          params.reservationKind,
        );
        const reserved = next.held + next.booked + next.untracked;
        const remaining = writeNight(
          tx,
          state.ref,
          {
            base: state.data.base || defaultBase,
            extra: state.data.extra,
            blocked: state.data.blocked,
            held: next.held,
            booked: next.booked,
            untracked: next.untracked,
            reserved,
          },
          state.data.date,
        );
        if (prevRemaining === 0 && remaining > 0) {
          freedNights.push(state.data.date);
        }
      }

      tx.update(docRef, {
        inventoryReleased: true,
        inventoryReserved: false,
        inventoryReleasedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      if (allocationSnap.exists) {
        tx.set(
          allocationRef,
          {
            status: "RELEASED",
            releasedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          {merge: true},
        );
      }

      const auditRef = db.collection("hotelInventoryAuditLogs").doc();
      tx.set(auditRef, {
        action: params.auditAction,
        hotelUid,
        packageId,
        bookingId: params.docId,
        rooms,
        reservationKind: params.reservationKind,
        nights,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return {ok: true, freedNights};
    });
  } catch (error) {
    logger.error("[HotelInventory] release failed", error);
    return {ok: false};
  }
};

/**
 * Apply extra or blocked adjustment and materialize affected nights.
 */
export const applyAvailabilityAdjustment = async (
  db: Db,
  adjustment: AvailabilityAdjustment & {createdBy: string},
): Promise<{ok: boolean; adjustmentId?: string; error?: string}> => {
  const hotelUid = String(adjustment.hotelUid || "").trim();
  const packageId = String(adjustment.packageId || "").trim();
  const type = adjustment.type;
  const delta = Math.max(0, Math.floor(Number(adjustment.delta) || 0));
  const startDate =
    toDateString(adjustment.startDate) ||
    String(adjustment.startDate || "").trim();
  const endDate =
    toDateString(adjustment.endDate) ||
    String(adjustment.endDate || "").trim();

  if (!hotelUid || !packageId) {
    return {ok: false, error: "hotelUid and packageId are required."};
  }
  if (type !== "extra" && type !== "blocked") {
    return {ok: false, error: "type must be extra or blocked."};
  }
  if (delta <= 0) {
    return {ok: false, error: "Quantity must be greater than zero."};
  }
  const dates = listInclusiveDates(startDate, endDate);
  if (dates.length === 0) {
    return {ok: false, error: "Invalid start/end dates."};
  }

  const pkg = await loadPackage(db, packageId, hotelUid);
  if (!pkg) return {ok: false, error: "Room type not found."};
  const defaultBase = getPackageTotalRooms(pkg, {useDefaultIfMissing: false});
  if (defaultBase <= 0) {
    return {
      ok: false,
      error:
        "Set room quantity on this room type (when adding/editing the hotel) before adjustments.",
    };
  }

  // Existing active adjustments so missing nights materialize with full capacity
  const existingAdjustments = await loadActiveAvailabilityAdjustments(
    db,
    hotelUid,
    packageId,
  );

  const adjRef = db
    .collection("HotelDB")
    .doc(hotelUid)
    .collection("availability")
    .doc();

  try {
    await db.runTransaction(async (tx) => {
      // Read all nights first
      const states = [];
      for (const date of dates) {
        const state = await readNightInTx(
          tx,
          db,
          hotelUid,
          packageId,
          date,
          defaultBase,
        );
        states.push(state);
      }

      if (type === "blocked") {
        for (const state of states) {
          // Start from merged current capacity (ledger + other adjustments)
          const merged = mergeNightCapacity(
            state.data.date,
            defaultBase,
            {
              exists: state.exists,
              base: state.data.base,
              extra: state.data.extra,
              blocked: state.data.blocked,
              held: state.data.held,
              booked: state.data.booked,
              untracked: state.data.untracked,
              reserved: state.data.reserved,
            },
            existingAdjustments,
          );
          const blocked = merged.blocked + delta;
          const capacity = merged.base + merged.extra - blocked;
          if (capacity < merged.reserved) {
            throw new Error(
              `Cannot block rooms on ${state.data.date}: ` +
                `${merged.reserved} already reserved.`,
            );
          }
        }
      }

      for (const state of states) {
        const merged = mergeNightCapacity(
          state.data.date,
          defaultBase,
          {
            exists: state.exists,
            base: state.data.base,
            extra: state.data.extra,
            blocked: state.data.blocked,
            held: state.data.held,
            booked: state.data.booked,
            untracked: state.data.untracked,
            reserved: state.data.reserved,
          },
          existingAdjustments,
        );
        let extra = merged.extra;
        let blocked = merged.blocked;
        if (type === "extra") extra += delta;
        if (type === "blocked") blocked += delta;
        writeNight(
          tx,
          state.ref,
          {
            base: defaultBase > 0 ? defaultBase : merged.base,
            extra,
            blocked,
            held: merged.held,
            booked: merged.booked,
            untracked: merged.untracked,
            reserved: merged.reserved,
          },
          state.data.date,
        );
      }

      tx.set(adjRef, {
        hotelUid,
        packageId,
        recordType: "adjustment",
        type,
        delta,
        startDate,
        endDate,
        reason: adjustment.reason || "",
        note: adjustment.note || "",
        active: true,
        ledgerMaterialized: true,
        roomTypeName:
          adjustment.roomTypeName || getRoomDisplayName(pkg),
        createdBy: adjustment.createdBy,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      const auditRef = db.collection("hotelInventoryAuditLogs").doc();
      tx.set(auditRef, {
        action: type === "extra" ? "add_extra" : "block",
        hotelUid,
        packageId,
        adjustmentId: adjRef.id,
        delta,
        startDate,
        endDate,
        createdBy: adjustment.createdBy,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    return {ok: true, adjustmentId: adjRef.id};
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to apply adjustment.";
    logger.error("[HotelInventory] apply adjustment failed", error);
    return {ok: false, error: message};
  }
};

/**
 * Deactivate adjustment and reverse its effect on nights still in range.
 */
export const deactivateAdjustment = async (
  db: Db,
  hotelUid: string,
  adjustmentId: string,
  actorUid: string,
): Promise<{ok: boolean; error?: string}> => {
  const nestedRef = db
    .collection("HotelDB")
    .doc(hotelUid)
    .collection("availability")
    .doc(adjustmentId);
  const nestedSnap = await nestedRef.get();
  const adjRef = nestedSnap.exists ?
    nestedRef :
    db.collection("hotelAvailabilityAdjustments").doc(adjustmentId);
  const snap = nestedSnap.exists ? nestedSnap : await adjRef.get();
  if (!snap.exists) return {ok: false, error: "Adjustment not found."};
  const adj = snap.data() as AvailabilityAdjustment;
  if (!adj.active) return {ok: true};

  const adjStart =
    toDateString(adj.startDate) || String(adj.startDate || "");
  const adjEnd = toDateString(adj.endDate) || String(adj.endDate || "");
  const dates = listInclusiveDates(adjStart, adjEnd);
  const defaultBase = getPackageTotalRooms(
    (await loadPackage(db, adj.packageId, adj.hotelUid)) || undefined,
    {useDefaultIfMissing: false},
  );

  try {
    await db.runTransaction(async (tx) => {
      const fresh = await tx.get(adjRef);
      if (!fresh.exists || !(fresh.data()?.active)) return;

      for (const date of dates) {
        const state = await readNightInTx(
          tx,
          db,
          adj.hotelUid,
          adj.packageId,
          date,
          defaultBase,
        );
        if (!state.exists) continue;
        let extra = state.data.extra;
        let blocked = state.data.blocked;
        if (adj.type === "extra") {
          extra = Math.max(0, extra - asNumber(adj.delta, 0));
        }
        if (adj.type === "blocked") {
          blocked = Math.max(0, blocked - asNumber(adj.delta, 0));
        }
        // Ensure remaining stays valid vs reserved
        const capacity =
          state.data.base + extra - blocked;
        if (capacity < state.data.reserved) {
          throw new Error(
            `Cannot end adjustment: would leave reserved rooms without capacity on ${date}.`,
          );
        }
        writeNight(
          tx,
          state.ref,
          {
            base: state.data.base,
            extra,
            blocked,
            held: state.data.held,
            booked: state.data.booked,
            untracked: state.data.untracked,
            reserved: state.data.reserved,
          },
          date,
        );
      }

      tx.update(adjRef, {
        active: false,
        endedAt: admin.firestore.FieldValue.serverTimestamp(),
        endedBy: actorUid,
      });
    });
    return {ok: true};
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to end adjustment.";
    return {ok: false, error: message};
  }
};

/**
 * Update room-type totalRooms (HotelDB rooms first, legacy package second)
 * and patch base on existing night docs in a range.
 */
export const updatePackageTotalRooms = async (
  db: Db,
  packageId: string,
  totalRooms: number,
  actorUid: string,
  options?: {fromDate?: string; days?: number; hotelUid?: string},
): Promise<{ok: boolean; error?: string}> => {
  const qty = Math.floor(Number(totalRooms));
  if (!Number.isFinite(qty) || qty < 0) {
    return {ok: false, error: "totalRooms must be a non-negative integer."};
  }

  const hotelUidHint = String(options?.hotelUid || "").trim();
  const pkg = await loadPackage(db, packageId, hotelUidHint || undefined);
  if (!pkg) return {ok: false, error: "Room type not found."};
  const hotelUid = String(pkg.hotelUid || hotelUidHint || "");

  // Primary: hotel room type from Add Hotel flow
  if (hotelUid) {
    const roomRef = db
      .collection("HotelDB")
      .doc(hotelUid)
      .collection("rooms")
      .doc(packageId);
    const roomSnap = await roomRef.get();
    if (roomSnap.exists) {
      await roomRef.set(
        {
          totalRooms: qty,
          quantity: qty,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          totalRoomsUpdatedBy: actorUid,
        },
        {merge: true},
      );
    }
  }

  // Legacy package mirror (if exists)
  const pkgRef = db.collection("hotelPackageDetails").doc(packageId);
  const pkgSnap = await pkgRef.get();
  if (pkgSnap.exists) {
    await pkgRef.update({
      totalRooms: qty,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      totalRoomsUpdatedBy: actorUid,
    });
  }

  if (!hotelUid) return {ok: true};

  // Patch nights from today (or fromDate) for ~120 days (or custom)
  const from =
    options?.fromDate ||
    toDateString(new Date()) ||
    new Date().toISOString().slice(0, 10);
  const dayCount = options?.days ?? 120;
  const start = new Date(`${from}T12:00:00+07:00`);
  const dates: string[] = [];
  for (let i = 0; i < dayCount; i++) {
    const d = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
    dates.push(
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Bangkok",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(d),
    );
  }

  // Batch updates in chunks of 400
  const chunkSize = 400;
  for (let i = 0; i < dates.length; i += chunkSize) {
    const chunk = dates.slice(i, i + chunkSize);
    const batch = db.batch();
    const refs = chunk.map((date) =>
      nightDocRef(db, hotelUid, packageId, date),
    );
    const snaps = await db.getAll(...refs);
    snaps.forEach((snap, idx) => {
      if (!snap.exists) return;
      const d = snap.data() || {};
      const extra = asNumber(d.extra, 0);
      const blocked = asNumber(d.blocked, 0);
      const reserved = asNumber(d.reserved, 0);
      const capacity = qty + extra - blocked;
      if (capacity < reserved) {
        // Skip nights that would break reserved; leave base as-is
        return;
      }
      batch.set(
        refs[idx],
        {
          base: qty,
          remaining: computeRemaining(qty, extra, blocked, reserved),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        {merge: true},
      );
    });
    await batch.commit();
  }

  await db.collection("hotelInventoryAuditLogs").add({
    action: "update_base",
    hotelUid,
    packageId,
    totalRooms: qty,
    createdBy: actorUid,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return {ok: true};
};

export const bookingInventoryFields = (booking: Record<string, unknown>) => {
  const hotelUid = String(booking.hotelUid || booking.hotelId || "").trim();
  const packageId = String(booking.packageId || booking.roomId || "").trim();
  const checkIn = booking.checkInDate || booking.checkIn;
  const checkOut = booking.checkOutDate || booking.checkOut;
  const rooms = roomsFromBooking(booking);
  const allocationId = String(booking.inventoryAllocationId || "").trim() ||
    undefined;
  return {hotelUid, packageId, checkIn, checkOut, rooms, allocationId};
};

/**
 * Read calendar nights for admin UI (range inclusive).
 */
export const getCalendarRange = async (
  db: Db,
  hotelUid: string,
  packageId: string,
  startDate: string,
  endDate: string,
): Promise<NightBreakdown[]> => {
  const dates = listInclusiveDates(startDate, endDate);
  const pkg = await loadPackage(db, packageId, hotelUid);
  const defaultBase = getPackageTotalRooms(pkg || undefined, {
    useDefaultIfMissing: false,
  });
  return computeNightsBreakdown(db, hotelUid, packageId, dates, defaultBase);
};
