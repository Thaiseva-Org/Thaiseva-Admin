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

const asNumber = (v: unknown, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
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
  const reserved = asNumber(d.reserved, 0);
  return {
    ref,
    exists: true,
    data: {
      date,
      base,
      extra,
      blocked,
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
    reserved: number;
  },
  date: string,
) => {
  const remaining = computeRemaining(
    data.base,
    data.extra,
    data.blocked,
    data.reserved,
  );
  tx.set(
    ref,
    {
      ...data,
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
  const allowExtraBed = Boolean(
    selected.allowExtraBed === true ||
      selected.extraBed === true ||
      (selected.policies as Record<string, unknown> | undefined)?.allowExtraBed ===
        true ||
      (hotelData.policies as Record<string, unknown> | undefined)?.allowExtraBed ===
        true ||
      (hotelData.policies as Record<string, unknown> | undefined)?.extraBed === true,
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
  if (snap.exists) return readAvailabilityConfig(snap.data());
  return readAvailabilityConfig(legacyHotel || undefined);
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
    let base = defaultBase;
    let extra = 0;
    let blocked = 0;
    let ledgerReserved = 0;

    if (snap.exists) {
      const d = snap.data() || {};
      base = asNumber(d.base, defaultBase);
      extra = asNumber(d.extra, 0);
      blocked = asNumber(d.blocked, 0);
      ledgerReserved = asNumber(d.reserved, 0);
    } else {
      for (const adj of adjustments) {
        if (date >= adj.startDate && date <= adj.endDate) {
          if (adj.type === "extra") extra += Math.max(0, asNumber(adj.delta, 0));
          if (adj.type === "blocked") {
            blocked += Math.max(0, asNumber(adj.delta, 0));
          }
        }
      }
    }

    const reserved = ledgerReserved + (legacyByDate[date] || 0);
    return {
      date,
      base,
      extra,
      blocked,
      reserved,
      remaining: computeRemaining(base, extra, blocked, reserved),
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

  // Default 5 rooms when not set; hotel defaultRoomInventory can override
  let totalRooms = getPackageTotalRooms(pkg, {useDefaultIfMissing: false});
  if (totalRooms <= 0) {
    totalRooms = config.defaultRoomInventory || DEFAULT_ROOM_INVENTORY;
  }
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
  reason?: string;
  reasonCode?: string;
  nights?: NightBreakdown[];
  fullNights?: string[];
};

/**
 * Atomically reserve rooms for each night. Fails if any night insufficient.
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
  },
): Promise<ReserveResult> => {
  const hotelUid = String(params.hotelUid).trim();
  const packageId = String(params.packageId).trim();
  const rooms = Math.max(1, Math.floor(params.rooms));
  const nights = listStayNights(params.checkIn, params.checkOut);

  if (!hotelUid || !packageId || nights.length === 0) {
    return {
      ok: false,
      reason: "Invalid hotel, room type, or dates.",
      reasonCode: "DATES_INCOMPLETE",
    };
  }

  const pkg = await loadPackage(db, packageId, hotelUid);
  const defaultBase = getPackageTotalRooms(pkg || undefined);
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
        if (!state.exists) {
          let extra = 0;
          let blocked = 0;
          for (const adj of adjustments) {
            if (date >= adj.startDate && date <= adj.endDate) {
              if (adj.type === "extra") {
                extra += Math.max(0, asNumber(adj.delta, 0));
              }
              if (adj.type === "blocked") {
                blocked += Math.max(0, asNumber(adj.delta, 0));
              }
            }
          }
          const ledgerReserved = 0;
          const effectiveReserved = ledgerReserved + (legacyByDate[date] || 0);
          state.data = {
            date,
            base: defaultBase,
            extra,
            blocked,
            reserved: ledgerReserved,
            remaining: computeRemaining(
              defaultBase,
              extra,
              blocked,
              effectiveReserved,
            ),
          };
        } else if (state.data.base !== defaultBase) {
          // Keep base in sync with package totalRooms when possible
          state.data.base = defaultBase;
          const effectiveReserved =
            state.data.reserved + (legacyByDate[date] || 0);
          state.data.remaining = computeRemaining(
            defaultBase,
            state.data.extra,
            state.data.blocked,
            effectiveReserved,
          );
        } else {
          const effectiveReserved =
            state.data.reserved + (legacyByDate[date] || 0);
          state.data.remaining = computeRemaining(
            state.data.base,
            state.data.extra,
            state.data.blocked,
            effectiveReserved,
          );
        }
        nightStates.push(state);
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
        const reserved = state.data.reserved + rooms;
        const remaining = writeNight(
          tx,
          state.ref,
          {
            base: state.data.base,
            extra: state.data.extra,
            blocked: state.data.blocked,
            reserved,
          },
          state.data.date,
        );
        after.push({
          date: state.data.date,
          base: state.data.base,
          extra: state.data.extra,
          blocked: state.data.blocked,
          reserved,
          remaining,
        });
        if (remaining === 0) fullNights.push(state.data.date);
      }

      // Audit
      const auditRef = db.collection("hotelInventoryAuditLogs").doc();
      tx.set(auditRef, {
        action: "reserve",
        hotelUid,
        packageId,
        bookingId: params.bookingId,
        rooms,
        nights,
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
  });
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
  const defaultBase = getPackageTotalRooms(pkg || undefined) || 0;

  try {
    return await db.runTransaction(async (tx) => {
      const snap = await tx.get(docRef);
      if (!snap.exists) return {ok: false};
      const data = snap.data() || {};

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

      const freedNights: string[] = [];
      for (const date of nights) {
        const state = await readNightInTx(
          tx,
          db,
          hotelUid,
          packageId,
          date,
          defaultBase,
        );
        const prevRemaining = state.data.remaining;
        const reserved = Math.max(0, state.data.reserved - rooms);
        const remaining = writeNight(
          tx,
          state.ref,
          {
            base: state.data.base || defaultBase,
            extra: state.data.extra,
            blocked: state.data.blocked,
            reserved,
          },
          date,
        );
        if (prevRemaining === 0 && remaining > 0) {
          freedNights.push(date);
        }
      }

      tx.update(docRef, {
        inventoryReleased: true,
        inventoryReserved: false,
        inventoryReleasedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      const auditRef = db.collection("hotelInventoryAuditLogs").doc();
      tx.set(auditRef, {
        action: params.auditAction,
        hotelUid,
        packageId,
        bookingId: params.docId,
        rooms,
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
  const startDate = String(adjustment.startDate || "");
  const endDate = String(adjustment.endDate || "");

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
  const defaultBase = getPackageTotalRooms(pkg);
  if (defaultBase <= 0) {
    return {
      ok: false,
      error:
        "Set room quantity on this room type (when adding/editing the hotel) before adjustments.",
    };
  }

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
          const base = state.exists ? state.data.base : defaultBase;
          const extra = state.exists ? state.data.extra : 0;
          const reserved = state.exists ? state.data.reserved : 0;
          const blocked = (state.exists ? state.data.blocked : 0) + delta;
          const capacity = base + extra - blocked;
          if (capacity < reserved) {
            throw new Error(
              `Cannot block rooms on ${state.data.date}: ` +
                `${reserved} already reserved.`,
            );
          }
        }
      }

      for (const state of states) {
        const base = state.exists ? state.data.base : defaultBase;
        const reserved = state.exists ? state.data.reserved : 0;
        let extra = state.exists ? state.data.extra : 0;
        let blocked = state.exists ? state.data.blocked : 0;
        // Apply other active adjustments if night was missing
        if (!state.exists) {
          // base only; this adjustment applied below
        }
        if (type === "extra") extra += delta;
        if (type === "blocked") blocked += delta;
        writeNight(
          tx,
          state.ref,
          {base, extra, blocked, reserved},
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

  const dates = listInclusiveDates(adj.startDate, adj.endDate);
  const defaultBase = getPackageTotalRooms(
    (await loadPackage(db, adj.packageId, adj.hotelUid)) || undefined,
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
  return {hotelUid, packageId, checkIn, checkOut, rooms};
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
  const defaultBase = getPackageTotalRooms(pkg || undefined);
  return computeNightsBreakdown(db, hotelUid, packageId, dates, defaultBase);
};
