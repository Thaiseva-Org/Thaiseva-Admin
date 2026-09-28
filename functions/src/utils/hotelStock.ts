/**
 * Simple hotel stock — one source of truth: numbers on night docs.
 *
 * free = max(0, total - locked - booked)
 *
 * Collections:
 *   hotelStock/{hotelId}_{packageId}/nights/{YYYY-MM-DD}
 *   hotelLocks/{lockId}
 */
import * as admin from "firebase-admin";
import {
  DEFAULT_ROOM_INVENTORY,
  getPackageTotalRooms,
  isWithinBookableWindow,
  listInclusiveDates,
  listStayNights,
  readAvailabilityConfig,
  toDateString,
} from "./hotelAvailability";

type Db = admin.firestore.Firestore;
type Tx = admin.firestore.Transaction;

export type StockNight = {
  date: string;
  total: number;
  locked: number;
  booked: number;
  free: number;
};

export type LockKind = "hold" | "book";
export type LockStatus = "active" | "released" | "converted" | "expired";

export type HotelLock = {
  lockId: string;
  hotelId: string;
  packageId: string;
  checkIn: string;
  checkOut: string;
  rooms: number;
  kind: LockKind;
  status: LockStatus;
  userId: string | null;
  bookingId: string | null;
  expiresAt: admin.firestore.Timestamp | null;
  nights: string[];
};

export const DEFAULT_HOLD_MINUTES = 10;
export const STOCK_COLLECTION = "hotelStock";
export const LOCKS_COLLECTION = "hotelLocks";

const asInt = (v: unknown, fallback = 0) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.floor(n));
};

const freeOf = (total: number, locked: number, booked: number) =>
  Math.max(0, total - locked - booked);

export const stockDocKey = (hotelId: string, packageId: string) =>
  `${hotelId}_${packageId}`;

export const nightRef = (
  db: Db,
  hotelId: string,
  packageId: string,
  date: string,
) =>
  db
    .collection(STOCK_COLLECTION)
    .doc(stockDocKey(hotelId, packageId))
    .collection("nights")
    .doc(date);

export const lockRef = (db: Db, lockId: string) =>
  db.collection(LOCKS_COLLECTION).doc(lockId);

/** Load room package (HotelDB rooms first, then legacy). */
export const loadPackage = async (
  db: Db,
  packageId: string,
  hotelId?: string,
) => {
  const roomId = String(packageId || "").trim();
  if (!roomId) return null;

  if (hotelId) {
    const roomSnap = await db
      .collection("HotelDB")
      .doc(hotelId)
      .collection("rooms")
      .doc(roomId)
      .get();
    if (roomSnap.exists) {
      return {
        id: roomSnap.id,
        hotelUid: hotelId,
        source: "hotel_rooms",
        ...(roomSnap.data() || {}),
      } as Record<string, unknown> & {id: string};
    }
  }

  const snap = await db.collection("hotelPackageDetails").doc(roomId).get();
  if (snap.exists) {
    return {
      id: snap.id,
      source: "hotelPackageDetails",
      ...(snap.data() || {}),
    } as Record<string, unknown> & {id: string};
  }
  return null;
};

export const resolvePackageIdByRoomName = async (
  db: Db,
  hotelId: string,
  roomName: string,
): Promise<string | null> => {
  const hid = String(hotelId || "").trim();
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
    if (
      name &&
      (name === target || name.includes(target) || target.includes(name))
    ) {
      return doc.id;
    }
  }
  return null;
};

export const loadHotel = async (db: Db, hotelId: string) => {
  const snap = await db.collection("HotelDB").doc(hotelId).get();
  if (!snap.exists) return null;
  return {id: snap.id, ...(snap.data() || {})} as Record<string, unknown> & {
    id: string;
  };
};

export const loadStockConfig = async (
  db: Db,
  hotelId: string,
  legacyHotel?: Record<string, unknown> | null,
) => {
  const snap = await db
    .collection("HotelDB")
    .doc(hotelId)
    .collection("availability")
    .doc("config")
    .get();
  if (snap.exists) {
    const cfg = readAvailabilityConfig(snap.data());
    return {
      ...cfg,
      defaultTotal:
        Number(snap.data()?.defaultTotal ?? cfg.defaultRoomInventory) ||
        DEFAULT_ROOM_INVENTORY,
      configured: true,
    };
  }
  const inlineConfigured = Boolean(
    legacyHotel?.availabilityConfig ||
      (legacyHotel?.hotel as Record<string, unknown> | undefined)
        ?.availabilityConfig,
  );
  const fallback = readAvailabilityConfig(legacyHotel || undefined);
  return {
    ...fallback,
    defaultTotal: fallback.defaultRoomInventory || DEFAULT_ROOM_INVENTORY,
    configured: inlineConfigured,
    autoBookingEnabled: inlineConfigured ? fallback.autoBookingEnabled : true,
  };
};

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
    room?.roomName || room?.packageName || room?.name || room?.id || "Room",
  );

const resolveDefaultTotal = async (
  db: Db,
  hotelId: string,
  packageId: string,
): Promise<number> => {
  const [hotel, pkg, config] = await Promise.all([
    loadHotel(db, hotelId),
    loadPackage(db, packageId, hotelId),
    loadStockConfig(db, hotelId),
  ]);
  if (pkg) {
    const fromPkg = getPackageTotalRooms(pkg, {useDefaultIfMissing: false});
    if (fromPkg > 0) return fromPkg;
  }
  if (config.configured && config.defaultTotal > 0) return config.defaultTotal;
  if (hotel) {
    const nested = hotel.hotel as Record<string, unknown> | undefined;
    const hotelTotal = Number(
      hotel.totalRooms ?? nested?.totalRooms ?? config.defaultTotal,
    );
    if (Number.isFinite(hotelTotal) && hotelTotal > 0) {
      return Math.floor(hotelTotal);
    }
  }
  return config.defaultTotal || DEFAULT_ROOM_INVENTORY;
};

const nightFromData = (
  date: string,
  data: Record<string, unknown> | undefined,
  defaultTotal: number,
): StockNight => {
  const total = asInt(data?.total, defaultTotal);
  const locked = asInt(data?.locked, 0);
  const booked = asInt(data?.booked, 0);
  return {
    date,
    total,
    locked,
    booked,
    free: freeOf(total, locked, booked),
  };
};

const writeNight = (
  tx: Tx,
  ref: admin.firestore.DocumentReference,
  hotelId: string,
  packageId: string,
  night: {date: string; total: number; locked: number; booked: number},
) => {
  const total = asInt(night.total, 0);
  const locked = asInt(night.locked, 0);
  const booked = asInt(night.booked, 0);
  tx.set(
    ref,
    {
      hotelId,
      packageId,
      date: night.date,
      total,
      locked,
      booked,
      free: freeOf(total, locked, booked),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    {merge: true},
  );
};

export type CheckStockResult = {
  ok: true;
  hotelId: string;
  packageId: string;
  packageName: string | null;
  checkIn: string;
  checkOut: string;
  roomsRequested: number;
  free: number;
  canLock: boolean;
  autoBookingEnabled: boolean;
  bookableWindowOk: boolean;
  nights: StockNight[];
  bottleneckDate: string | null;
  reasonCode: string | null;
  reason: string | null;
};

/**
 * Read stock for a stay. Missing nights treated as full default free (no write).
 */
export const checkStock = async (
  db: Db,
  params: {
    hotelId: string;
    packageId: string;
    checkIn: unknown;
    checkOut: unknown;
    rooms?: number;
  },
): Promise<CheckStockResult> => {
  const hotelId = String(params.hotelId || "").trim();
  const packageId = String(params.packageId || "").trim();
  const checkIn = toDateString(params.checkIn);
  const checkOut = toDateString(params.checkOut);
  const roomsRequested = Math.max(1, asInt(params.rooms, 1));

  if (!hotelId || !packageId || !checkIn || !checkOut) {
    throw new Error("hotelId, packageId, checkIn, checkOut are required");
  }

  const nightsList = listStayNights(checkIn, checkOut);
  if (nightsList.length === 0) {
    throw new Error("Invalid stay dates (need at least one night)");
  }

  const [hotel, pkg, config, defaultTotal] = await Promise.all([
    loadHotel(db, hotelId),
    loadPackage(db, packageId, hotelId),
    loadStockConfig(db, hotelId),
    resolveDefaultTotal(db, hotelId, packageId),
  ]);

  if (!hotel) {
    throw new Error("Hotel not found");
  }

  const refs = nightsList.map((d) => nightRef(db, hotelId, packageId, d));
  const snaps = await db.getAll(...refs);

  const nights: StockNight[] = nightsList.map((date, i) => {
    const snap = snaps[i];
    if (!snap.exists) {
      return nightFromData(date, undefined, defaultTotal);
    }
    return nightFromData(date, snap.data() || {}, defaultTotal);
  });

  let free = Number.POSITIVE_INFINITY;
  let bottleneckDate: string | null = null;
  for (const n of nights) {
    if (n.free < free) {
      free = n.free;
      bottleneckDate = n.date;
    }
  }
  if (!Number.isFinite(free)) free = 0;

  const bookableWindowOk = isWithinBookableWindow(
    checkIn,
    checkOut,
    config.bookingOpenFrom,
    config.bookingOpenTo,
  );
  const autoBookingEnabled = config.autoBookingEnabled !== false;

  let reasonCode: string | null = null;
  let reason: string | null = null;
  if (!bookableWindowOk) {
    reasonCode = "WINDOW";
    reason = "Stay is outside the hotel bookable window.";
  } else if (!autoBookingEnabled) {
    reasonCode = "MANUAL_ONLY";
    reason = "Auto-booking is off; rooms cannot be locked instantly.";
  } else if (free < roomsRequested) {
    reasonCode = "INSUFFICIENT_STOCK";
    reason = `Only ${free} room(s) free for these dates.`;
  }

  const canLock =
    bookableWindowOk && autoBookingEnabled && free >= roomsRequested;

  return {
    ok: true,
    hotelId,
    packageId,
    packageName: pkg ? getRoomDisplayName(pkg) : null,
    checkIn,
    checkOut,
    roomsRequested,
    free,
    canLock,
    autoBookingEnabled,
    bookableWindowOk,
    nights,
    bottleneckDate,
    reasonCode,
    reason,
  };
};

export type StockTotalExpand = {
  date: string;
  totalBefore: number;
  totalAfter: number;
  freeBefore: number;
  added: number;
};

export type LockStockResult =
  | {
      ok: true;
      lockId: string;
      kind: LockKind;
      rooms: number;
      hotelId: string;
      packageId: string;
      checkIn: string;
      checkOut: string;
      nights: string[];
      expiresAt: string | null;
      status: LockStatus;
      converted?: boolean;
      /** Nights where total was raised to fit this book (admin accept pending). */
      expandedTotals?: StockTotalExpand[];
    }
  | {ok: false; error: string; code: string};

/**
 * Lock rooms (all-or-nothing).
 * action: hold | book | convert
 *
 * Admin pending-accept options:
 * - expandTotalIfNeeded: if free < rooms, raise total so free becomes enough, then book
 * - force: skip autoBookingEnabled / bookable-window gates (manual accept path)
 */
export const lockStock = async (
  db: Db,
  params: {
    action?: "hold" | "book" | "convert";
    kind?: LockKind;
    lockId?: string;
    hotelId?: string;
    packageId?: string;
    checkIn?: unknown;
    checkOut?: unknown;
    rooms?: number;
    holdMinutes?: number;
    userId?: string | null;
    bookingId?: string | null;
    /** When free is short, raise night.total so the book can succeed (accept pending). */
    expandTotalIfNeeded?: boolean;
    /** Bypass auto-booking-off / window checks (admin or hotel owner accept). */
    force?: boolean;
  },
): Promise<LockStockResult> => {
  const action =
    (params.action as string) ||
    (params.kind === "book" ? "book" : params.lockId ? "convert" : "hold");

  // --- convert hold → book ---
  if (action === "convert") {
    const lockId = String(params.lockId || "").trim();
    if (!lockId) {
      return {ok: false, error: "lockId is required to convert.", code: "INVALID"};
    }

    // Pre-read lock for defaults (all TX reads happen inside runTransaction).
    const preSnap = await lockRef(db, lockId).get();
    if (!preSnap.exists) {
      return {ok: false, error: "Lock not found.", code: "NOT_FOUND"};
    }
    const pre = preSnap.data() || {};
    const preHotelId = String(pre.hotelId || "");
    const prePackageId = String(pre.packageId || "");
    const defaultTotal = await resolveDefaultTotal(db, preHotelId, prePackageId);

    try {
      return await db.runTransaction(async (tx) => {
        const lRef = lockRef(db, lockId);
        const lSnap = await tx.get(lRef);
        if (!lSnap.exists) {
          return {
            ok: false as const,
            error: "Lock not found.",
            code: "NOT_FOUND",
          };
        }
        const lock = lSnap.data() || {};
        const status = String(lock.status || "");
        if (params.userId && String(lock.userId || "") !== params.userId) {
          return {
            ok: false as const,
            error: "This hold belongs to another user.",
            code: "NOT_OWNER",
          };
        }
        if (status === "converted") {
          if (params.bookingId && lock.bookingId !== params.bookingId) {
            return {
              ok: false as const,
              error: "Hold was converted for another booking.",
              code: "ALREADY_CONVERTED",
            };
          }
          return {
            ok: true as const,
            lockId,
            kind: "book" as LockKind,
            rooms: asInt(lock.rooms, 0),
            hotelId: String(lock.hotelId || ""),
            packageId: String(lock.packageId || ""),
            checkIn: String(lock.checkIn || ""),
            checkOut: String(lock.checkOut || ""),
            nights: (lock.nights as string[]) || [],
            expiresAt: null,
            status: "converted" as LockStatus,
            converted: true,
          };
        }
        if (status !== "active") {
          return {
            ok: false as const,
            error: `Lock is ${status}, cannot convert.`,
            code: "NOT_ACTIVE",
          };
        }
        if (String(lock.kind) !== "hold") {
          return {
            ok: false as const,
            error: "Only hold locks can be converted.",
            code: "WRONG_KIND",
          };
        }

        const expiresAt = lock.expiresAt as admin.firestore.Timestamp | null;
        if (expiresAt && expiresAt.toMillis() < Date.now()) {
          return {
            ok: false as const,
            error: "Hold expired.",
            code: "EXPIRED",
          };
        }

        const hotelId = String(lock.hotelId || "");
        const packageId = String(lock.packageId || "");
        const rooms = asInt(lock.rooms, 0);
        const nights =
          (lock.nights as string[]) ||
          listStayNights(lock.checkIn, lock.checkOut);

        const nightStates: Array<{
          ref: admin.firestore.DocumentReference;
          date: string;
          total: number;
          locked: number;
          booked: number;
        }> = [];
        for (const date of nights) {
          const ref = nightRef(db, hotelId, packageId, date);
          const snap = await tx.get(ref);
          const cur = nightFromData(
            date,
            snap.exists ? snap.data() : undefined,
            defaultTotal,
          );
          nightStates.push({
            ref,
            date,
            total: cur.total || defaultTotal,
            locked: Math.max(0, cur.locked - rooms),
            booked: cur.booked + rooms,
          });
        }

        for (const night of nightStates) {
          writeNight(tx, night.ref, hotelId, packageId, night);
        }

        const bookingId =
          String(params.bookingId || lock.bookingId || "").trim() || null;

        tx.set(
          lRef,
          {
            kind: "book",
            status: "converted",
            bookingId,
            expiresAt: null,
            convertedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          {merge: true},
        );

        return {
          ok: true as const,
          lockId,
          kind: "book" as LockKind,
          rooms,
          hotelId,
          packageId,
          checkIn: String(lock.checkIn || ""),
          checkOut: String(lock.checkOut || ""),
          nights,
          expiresAt: null,
          status: "converted" as LockStatus,
          converted: true,
        };
      });
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : "Convert failed",
        code: "TX_FAILED",
      };
    }
  }

  // --- new hold or book ---
  const kind: LockKind = action === "book" ? "book" : "hold";
  const hotelId = String(params.hotelId || "").trim();
  const packageId = String(params.packageId || "").trim();
  const checkIn = toDateString(params.checkIn);
  const checkOut = toDateString(params.checkOut);
  const rooms = Math.max(1, asInt(params.rooms, 1));
  const holdMinutes = Math.max(
    1,
    asInt(params.holdMinutes, DEFAULT_HOLD_MINUTES) || DEFAULT_HOLD_MINUTES,
  );

  if (!hotelId || !packageId || !checkIn || !checkOut) {
    return {
      ok: false,
      error: "hotelId, packageId, checkIn, checkOut are required.",
      code: "INVALID",
    };
  }

  const nightsList = listStayNights(checkIn, checkOut);
  if (nightsList.length === 0) {
    return {ok: false, error: "Invalid stay dates.", code: "INVALID_DATES"};
  }

  const force = params.force === true;
  const expandTotalIfNeeded =
    params.expandTotalIfNeeded === true && kind === "book";

  const config = await loadStockConfig(db, hotelId);
  if ((kind === "hold" || kind === "book") && !force) {
    const windowOk = isWithinBookableWindow(
      checkIn,
      checkOut,
      config.bookingOpenFrom,
      config.bookingOpenTo,
    );
    if (!windowOk) {
      return {
        ok: false,
        error: "Stay is outside the hotel bookable window.",
        code: "WINDOW",
      };
    }
    if (!config.autoBookingEnabled) {
      return {
        ok: false,
        error: "Auto-booking is off for this hotel.",
        code: "MANUAL_ONLY",
      };
    }
  }

  const defaultTotal = await resolveDefaultTotal(db, hotelId, packageId);
  const lockId =
    String(params.lockId || "").trim() ||
    db.collection(LOCKS_COLLECTION).doc().id;

  const expiresAt =
    kind === "hold" ?
      admin.firestore.Timestamp.fromMillis(
        Date.now() + holdMinutes * 60 * 1000,
      ) :
      null;

  try {
    return await db.runTransaction(async (tx) => {
      // Idempotent re-lock same id if already active
      const lRef = lockRef(db, lockId);
      const existing = await tx.get(lRef);
      if (existing.exists) {
        const prev = existing.data() || {};
        if (String(prev.status) === "active") {
          return {
            ok: true as const,
            lockId,
            kind: (String(prev.kind) === "book" ? "book" : "hold") as LockKind,
            rooms: asInt(prev.rooms, rooms),
            hotelId: String(prev.hotelId || hotelId),
            packageId: String(prev.packageId || packageId),
            checkIn: String(prev.checkIn || checkIn),
            checkOut: String(prev.checkOut || checkOut),
            nights: (prev.nights as string[]) || nightsList,
            expiresAt: prev.expiresAt ?
              (prev.expiresAt as admin.firestore.Timestamp)
                .toDate()
                .toISOString() :
              null,
            status: "active" as LockStatus,
          };
        }
      }

      const nightStates: Array<{
        ref: admin.firestore.DocumentReference;
        date: string;
        total: number;
        locked: number;
        booked: number;
        free: number;
        expand?: StockTotalExpand;
      }> = [];
      const expandedTotals: StockTotalExpand[] = [];

      for (const date of nightsList) {
        const ref = nightRef(db, hotelId, packageId, date);
        const snap = await tx.get(ref);
        const cur = nightFromData(
          date,
          snap.exists ? snap.data() : undefined,
          defaultTotal,
        );
        let total = cur.total || defaultTotal;
        let free = cur.free;
        let expand: StockTotalExpand | undefined;

        if (free < rooms) {
          if (!expandTotalIfNeeded) {
            return {
              ok: false as const,
              error: `Only ${free} free on ${date}. Need ${rooms}.`,
              code: "INSUFFICIENT_STOCK",
            };
          }
          // Raise capacity so free >= rooms: total = locked + booked + rooms
          const totalBefore = total;
          const neededTotal = cur.locked + cur.booked + rooms;
          total = Math.max(totalBefore, neededTotal);
          free = freeOf(total, cur.locked, cur.booked);
          const added = total - totalBefore;
          if (added > 0) {
            expand = {
              date,
              totalBefore,
              totalAfter: total,
              freeBefore: cur.free,
              added,
            };
            expandedTotals.push(expand);
          }
        }

        nightStates.push({
          ref,
          date,
          total,
          locked: cur.locked,
          booked: cur.booked,
          free,
          expand,
        });
      }

      for (const n of nightStates) {
        const locked = kind === "hold" ? n.locked + rooms : n.locked;
        const booked = kind === "book" ? n.booked + rooms : n.booked;
        writeNight(tx, n.ref, hotelId, packageId, {
          date: n.date,
          total: n.total,
          locked,
          booked,
        });
      }

      tx.set(lRef, {
        lockId,
        hotelId,
        packageId,
        checkIn,
        checkOut,
        rooms,
        kind,
        status: "active",
        userId: params.userId || null,
        bookingId: params.bookingId || null,
        expiresAt,
        nights: nightsList,
        expandedTotals: expandedTotals.length > 0 ? expandedTotals : null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return {
        ok: true as const,
        lockId,
        kind,
        rooms,
        hotelId,
        packageId,
        checkIn,
        checkOut,
        nights: nightsList,
        expiresAt: expiresAt ? expiresAt.toDate().toISOString() : null,
        status: "active" as LockStatus,
        expandedTotals:
          expandedTotals.length > 0 ? expandedTotals : undefined,
      };
    });
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Lock failed",
      code: "TX_FAILED",
    };
  }
};

export type UnlockStockResult =
  | {
      ok: true;
      lockId?: string;
      roomsUnlocked: number;
      nights: string[];
      status: string;
      alreadyDone?: boolean;
    }
  | {ok: false; error: string; code: string};

/**
 * Unlock by lockId (preferred) or force by stay (admin).
 */
export const unlockStock = async (
  db: Db,
  params: {
    lockId?: string;
    reason?: "released" | "expired" | "force";
    // force stay
    force?: boolean;
    hotelId?: string;
    packageId?: string;
    checkIn?: unknown;
    checkOut?: unknown;
    rooms?: number;
    target?: "locked" | "booked" | "both";
  },
): Promise<UnlockStockResult> => {
  const lockId = String(params.lockId || "").trim();
  const reason = params.reason || "released";

  if (lockId) {
    const preSnap = await lockRef(db, lockId).get();
    if (!preSnap.exists) {
      return {ok: false, error: "Lock not found.", code: "NOT_FOUND"};
    }
    const pre = preSnap.data() || {};
    const defaultTotal = await resolveDefaultTotal(
      db,
      String(pre.hotelId || ""),
      String(pre.packageId || ""),
    );

    try {
      return await db.runTransaction(async (tx) => {
        const lRef = lockRef(db, lockId);
        const lSnap = await tx.get(lRef);
        if (!lSnap.exists) {
          return {
            ok: false as const,
            error: "Lock not found.",
            code: "NOT_FOUND",
          };
        }
        const lock = lSnap.data() || {};
        const status = String(lock.status || "");
        if (status !== "active") {
          return {
            ok: true as const,
            lockId,
            roomsUnlocked: 0,
            nights: (lock.nights as string[]) || [],
            status,
            alreadyDone: true,
          };
        }

        const hotelId = String(lock.hotelId || "");
        const packageId = String(lock.packageId || "");
        const rooms = asInt(lock.rooms, 0);
        const kind = String(lock.kind) === "book" ? "book" : "hold";
        const nights =
          (lock.nights as string[]) ||
          listStayNights(lock.checkIn, lock.checkOut);

        const nightStates: Array<{
          ref: admin.firestore.DocumentReference;
          date: string;
          total: number;
          locked: number;
          booked: number;
        }> = [];
        for (const date of nights) {
          const ref = nightRef(db, hotelId, packageId, date);
          const snap = await tx.get(ref);
          const cur = nightFromData(
            date,
            snap.exists ? snap.data() : undefined,
            defaultTotal,
          );
          let locked = cur.locked;
          let booked = cur.booked;
          if (kind === "hold") {
            locked = Math.max(0, locked - rooms);
          } else {
            booked = Math.max(0, booked - rooms);
          }
          nightStates.push({
            ref,
            date,
            total: cur.total || defaultTotal,
            locked,
            booked,
          });
        }

        for (const night of nightStates) {
          writeNight(tx, night.ref, hotelId, packageId, night);
        }

        const nextStatus =
          reason === "expired" ? "expired" : "released";

        tx.set(
          lRef,
          {
            status: nextStatus,
            releasedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          {merge: true},
        );

        return {
          ok: true as const,
          lockId,
          roomsUnlocked: rooms,
          nights,
          status: nextStatus,
        };
      });
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : "Unlock failed",
        code: "TX_FAILED",
      };
    }
  }

  // Admin force by stay
  if (!params.force) {
    return {
      ok: false,
      error: "lockId or force stay params required.",
      code: "INVALID",
    };
  }

  const hotelId = String(params.hotelId || "").trim();
  const packageId = String(params.packageId || "").trim();
  const checkIn = toDateString(params.checkIn);
  const checkOut = toDateString(params.checkOut);
  const rooms = Math.max(1, asInt(params.rooms, 1));
  const target = params.target || "both";

  if (!hotelId || !packageId || !checkIn || !checkOut) {
    return {
      ok: false,
      error: "hotelId, packageId, checkIn, checkOut required for force unlock.",
      code: "INVALID",
    };
  }

  const nightsList = listStayNights(checkIn, checkOut);
  if (nightsList.length === 0) {
    return {ok: false, error: "Invalid stay dates.", code: "INVALID_DATES"};
  }

  const defaultTotal = await resolveDefaultTotal(db, hotelId, packageId);

  try {
    await db.runTransaction(async (tx) => {
      const nightStates: Array<{
        ref: admin.firestore.DocumentReference;
        date: string;
        total: number;
        locked: number;
        booked: number;
      }> = [];
      for (const date of nightsList) {
        const ref = nightRef(db, hotelId, packageId, date);
        const snap = await tx.get(ref);
        const cur = nightFromData(
          date,
          snap.exists ? snap.data() : undefined,
          defaultTotal,
        );
        let locked = cur.locked;
        let booked = cur.booked;
        if (target === "locked" || target === "both") {
          locked = Math.max(0, locked - rooms);
        }
        if (target === "booked" || target === "both") {
          booked = Math.max(0, booked - rooms);
        }
        nightStates.push({
          ref,
          date,
          total: cur.total || defaultTotal,
          locked,
          booked,
        });
      }

      for (const night of nightStates) {
        writeNight(tx, night.ref, hotelId, packageId, night);
      }
    });
    return {
      ok: true,
      roomsUnlocked: rooms,
      nights: nightsList,
      status: "force",
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Force unlock failed",
      code: "TX_FAILED",
    };
  }
};

/**
 * Admin: set absolute total for nights in range (or delta).
 */
export const setStockTotalRange = async (
  db: Db,
  params: {
    hotelId: string;
    packageId: string;
    startDate: string;
    endDate: string;
    /** Absolute total if set (preferred). */
    total?: number;
    /** Or delta: +N extra / -N block. */
    delta?: number;
  },
): Promise<{ok: boolean; dates: string[]; error?: string}> => {
  const hotelId = String(params.hotelId || "").trim();
  const packageId = String(params.packageId || "").trim();
  const startDate = toDateString(params.startDate);
  const endDate = toDateString(params.endDate);
  if (!hotelId || !packageId || !startDate || !endDate) {
    return {ok: false, dates: [], error: "Missing params"};
  }

  const dates = listInclusiveDates(startDate, endDate);
  if (dates.length === 0) {
    return {ok: false, dates: [], error: "Invalid date range"};
  }

  const defaultTotal = await resolveDefaultTotal(db, hotelId, packageId);
  const absTotal =
    params.total !== undefined && params.total !== null ?
      Math.max(0, asInt(params.total, 0)) :
      null;
  const delta =
    params.delta !== undefined && params.delta !== null ?
      Math.floor(Number(params.delta)) :
      null;

  if (absTotal === null && (delta === null || !Number.isFinite(delta))) {
    return {ok: false, dates: [], error: "total or delta required"};
  }

  await db.runTransaction(async (tx) => {
    const nightStates: Array<{
      ref: admin.firestore.DocumentReference;
      date: string;
      total: number;
      locked: number;
      booked: number;
    }> = [];
    for (const date of dates) {
      const ref = nightRef(db, hotelId, packageId, date);
      const snap = await tx.get(ref);
      const cur = nightFromData(
        date,
        snap.exists ? snap.data() : undefined,
        defaultTotal,
      );
      let total = cur.total || defaultTotal;
      if (absTotal !== null) {
        total = absTotal;
      } else if (delta !== null) {
        total = Math.max(0, total + delta);
      }
      nightStates.push({
        ref,
        date,
        total,
        locked: cur.locked,
        booked: cur.booked,
      });
    }

    for (const night of nightStates) {
      writeNight(tx, night.ref, hotelId, packageId, night);
    }
  });

  return {ok: true, dates};
};

/**
 * Admin: update room type default totalRooms and optionally seed upcoming nights.
 */
export const setPackageTotalRooms = async (
  db: Db,
  params: {
    hotelId: string;
    packageId: string;
    totalRooms: number;
    seedDays?: number;
  },
): Promise<{ok: boolean; error?: string}> => {
  const hotelId = String(params.hotelId || "").trim();
  const packageId = String(params.packageId || "").trim();
  const totalRooms = Math.max(0, asInt(params.totalRooms, 0));
  if (!hotelId || !packageId) {
    return {ok: false, error: "hotelId and packageId required"};
  }

  const roomRef = db
    .collection("HotelDB")
    .doc(hotelId)
    .collection("rooms")
    .doc(packageId);
  const snap = await roomRef.get();
  if (!snap.exists) {
    return {ok: false, error: "Room not found"};
  }

  await roomRef.set(
    {
      totalRooms,
      quantity: totalRooms,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    {merge: true},
  );

  const seedDays = Math.min(120, Math.max(0, asInt(params.seedDays, 60)));
  if (seedDays > 0) {
    const start = toDateString(new Date()) || "";
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + seedDays);
    const end = toDateString(endDate) || start;
    await setStockTotalRange(db, {
      hotelId,
      packageId,
      startDate: start,
      endDate: end,
      total: totalRooms,
    });
  }

  return {ok: true};
};

/**
 * Calendar range from stock nights (missing = default free).
 */
export const getStockCalendar = async (
  db: Db,
  params: {
    hotelId: string;
    packageId: string;
    startDate: string;
    endDate: string;
  },
) => {
  const hotelId = String(params.hotelId || "").trim();
  const packageId = String(params.packageId || "").trim();
  const startDate = toDateString(params.startDate);
  const endDate = toDateString(params.endDate);
  if (!hotelId || !packageId || !startDate || !endDate) {
    throw new Error("hotelId, packageId, startDate, endDate required");
  }

  const dates = listInclusiveDates(startDate, endDate);
  const defaultTotal = await resolveDefaultTotal(db, hotelId, packageId);
  const config = await loadStockConfig(db, hotelId);

  const nights: StockNight[] = [];
  // Batch get in chunks of 100
  for (let i = 0; i < dates.length; i += 100) {
    const chunk = dates.slice(i, i + 100);
    const refs = chunk.map((d) => nightRef(db, hotelId, packageId, d));
    const snaps = await db.getAll(...refs);
    for (let j = 0; j < chunk.length; j++) {
      const snap = snaps[j];
      nights.push(
        nightFromData(
          chunk[j],
          snap.exists ? snap.data() : undefined,
          defaultTotal,
        ),
      );
    }
  }

  return {
    hotelId,
    packageId,
    startDate,
    endDate,
    defaultTotal,
    config,
    nights,
  };
};

/** Expire active holds past expiresAt. */
export const expireStaleHolds = async (
  db: Db,
  limit = 50,
): Promise<{expired: string[]; errors: string[]}> => {
  const now = admin.firestore.Timestamp.now();
  const snap = await db
    .collection(LOCKS_COLLECTION)
    .where("status", "==", "active")
    .where("kind", "==", "hold")
    .where("expiresAt", "<=", now)
    .limit(limit)
    .get();

  const expired: string[] = [];
  const errors: string[] = [];

  for (const doc of snap.docs) {
    const result = await unlockStock(db, {
      lockId: doc.id,
      reason: "expired",
    });
    if (result.ok) expired.push(doc.id);
    else errors.push(`${doc.id}: ${result.error}`);
  }

  return {expired, errors};
};
