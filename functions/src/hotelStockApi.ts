import {assertActiveAccount} from "./activeAccount";
/**
 * Simple hotel stock APIs — check / lock / unlock (+ expire + admin manage).
 *
 * All share the same number-based data:
 *   free = total - locked - booked
 */
import * as admin from "firebase-admin";
import {HttpsError, onCall, onRequest} from "firebase-functions/v2/https";
import {onSchedule} from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";
import {
  checkStock,
  lockStock,
  unlockStock,
  setStockTotalRange,
  setPackageTotalRooms,
  getStockCalendar,
  expireStaleHolds,
  loadHotel,
  loadPackage,
  resolvePackageIdByRoomName,
  loadStockConfig,
  DEFAULT_HOLD_MINUTES,
} from "./utils/hotelStock";
import {toDateString} from "./utils/hotelAvailability";

const REGION = "asia-east2";
type Data = Record<string, unknown>;
type Auth = {uid: string; token?: Record<string, unknown>};

const db = () => admin.firestore();
const stringValue = (v: unknown, max = 500) =>
  String(v ?? "")
    .trim()
    .slice(0, max);

const parsePositiveInt = (v: unknown, fallback = 1) => {
  const n = Number.parseInt(String(v ?? ""), 10);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return n;
};

const callableOpts = {
  region: REGION,
  cors: true as const,
  invoker: "public" as const,
};

const allowedWebsiteOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "https://thaiseva.com",
  "https://www.thaiseva.com",
  "https://admin.thaiseva.com",
  "https://thaiseva-85cda.web.app",
  "https://thaiseva-85cda.firebaseapp.com",
  "https://thaiseva-demo.web.app",
  "https://thaiseva-demo.firebaseapp.com",
  "https://gothai-ffea1.web.app",
  "https://gothai-ffea1.firebaseapp.com",
];

const applyWebsiteCors = (
  req: {headers: Record<string, unknown>},
  res: {
    set: (k: string, v: string) => void;
    status: (n: number) => {end: () => void; json: (b: unknown) => void};
  },
) => {
  const origin = stringValue(req.headers.origin);
  const allowed =
    !origin ||
    allowedWebsiteOrigins.includes(origin) ||
    origin.endsWith(".web.app") ||
    origin.endsWith(".firebaseapp.com") ||
    origin.endsWith(".vercel.app") ||
    origin.startsWith("http://localhost:") ||
    origin.startsWith("http://127.0.0.1:");
  if (allowed) {
    res.set("Access-Control-Allow-Origin", origin || "*");
    res.set("Vary", "Origin");
  }
  res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Requested-With",
  );
  res.set("Access-Control-Max-Age", "3600");
};

const assertAuth = (auth: Auth | undefined) => {
  if (!auth?.uid) {
    throw new HttpsError("unauthenticated", "Sign in is required.");
  }
  return auth.uid;
};

const assertAdmin = async (auth: Auth | undefined) => {
  if (!auth?.uid) {
    throw new HttpsError("unauthenticated", "Sign in is required.");
  }
  await assertActiveAccount(auth.uid, auth.token || {});
  if (
    auth.token?.admin === true
  ) {
    return;
  }
  const user = await db().doc(`users/${auth.uid}`).get();
  const role = stringValue(user.data()?.role).toLowerCase();
  if (role === "admin") {
    return;
  }
  throw new HttpsError("permission-denied", "Admin access only.");
};

const resolvePackageId = async (
  hotelId: string,
  input: Data,
): Promise<string> => {
  let packageId = stringValue(input.packageId || input.roomId, 120);
  if (packageId) return packageId;
  const roomName = stringValue(input.roomName || input.packageName, 200);
  if (roomName && hotelId) {
    const resolved = await resolvePackageIdByRoomName(db(), hotelId, roomName);
    if (resolved) return resolved;
  }
  return "";
};

const parseStay = async (input: Data) => {
  const hotelId = stringValue(input.hotelId || input.hotelUid, 120);
  const packageId = await resolvePackageId(hotelId, input);
  const checkIn = toDateString(input.checkIn || input.checkInDate);
  const checkOut = toDateString(input.checkOut || input.checkOutDate);
  const rooms = parsePositiveInt(input.rooms || input.noOfRooms, 1);
  return {hotelId, packageId, checkIn, checkOut, rooms};
};

// ---------------------------------------------------------------------------
// 1) CHECK — public HTTPS
// ---------------------------------------------------------------------------

export const checkHotelStock = onRequest(
  {
    region: REGION,
    cors: false,
    invoker: "public",
  },
  async (req, res) => {
    applyWebsiteCors(req, res);
    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }
    if (req.method !== "POST" && req.method !== "GET") {
      res.status(405).json({ok: false, error: "Method not allowed"});
      return;
    }

    try {
      let body: Data = {};
      if (req.method === "GET") {
        body = (req.query || {}) as Data;
      } else {
        body = (req.body?.data || req.body || {}) as Data;
      }

      const stay = await parseStay(body);
      if (!stay.hotelId || !stay.packageId || !stay.checkIn || !stay.checkOut) {
        res.status(400).json({
          ok: false,
          error: "hotelId, packageId, checkIn, checkOut are required.",
        });
        return;
      }

      const result = await checkStock(db(), {
        hotelId: stay.hotelId,
        packageId: stay.packageId,
        checkIn: stay.checkIn,
        checkOut: stay.checkOut,
        rooms: stay.rooms,
      });

      res.status(200).json({
        success: true,
        ...result,
        // Compatibility aliases for older website UI
        physicalRemaining: result.free,
        maxInstantRooms: result.canLock ? result.free : 0,
        roomsInstant: result.canLock ?
          Math.min(result.free, result.roomsRequested) :
          0,
        roomsPending: result.canLock ?
          0 :
          result.roomsRequested,
        messaging: {
          kind: !result.bookableWindowOk ?
            "window" :
            !result.autoBookingEnabled ?
              "manual_only" :
              result.canLock ?
                "full_instant" :
                "none_instant",
          title: result.canLock ?
            `${result.roomsRequested} room(s) available` :
            "Not enough free rooms",
          message: result.canLock ?
            `${result.free} free for your dates. You can lock ${result.roomsRequested} now.` :
            result.reason || "Not enough free rooms for these dates.",
          roomsInstant: result.canLock ? result.roomsRequested : 0,
          roomsPending: result.canLock ? 0 : result.roomsRequested,
          canProceed: true,
        },
      });
    } catch (e) {
      logger.error("[checkHotelStock]", e);
      res.status(500).json({
        ok: false,
        success: false,
        error: e instanceof Error ? e.message : "Check failed",
      });
    }
  },
);

// ---------------------------------------------------------------------------
// 2) LOCK — callable
// ---------------------------------------------------------------------------

export const lockHotelStock = onCall(callableOpts, async (request) => {
  const uid = assertAuth(request.auth as Auth | undefined);
  const input = (request.data || {}) as Data;
  const action = stringValue(
    input.action ||
      (input.lockId && !input.hotelId && !input.hotelUid ?
        "convert" :
        input.kind || "hold"),
    20,
  ).toLowerCase();

  if (action === "convert") {
    const lockId = stringValue(input.lockId || input.holdId, 120);
    const result = await lockStock(db(), {
      action: "convert",
      lockId,
      bookingId: stringValue(input.bookingId, 120) || null,
      userId: uid,
    });
    if (!result.ok) {
      throw new HttpsError(
        result.code === "EXPIRED" ?
          "deadline-exceeded" :
          result.code === "INSUFFICIENT_STOCK" ?
            "resource-exhausted" :
            result.code === "NOT_FOUND" ?
              "not-found" :
              "failed-precondition",
        result.error,
        {code: result.code},
      );
    }
    return result;
  }

  const stay = await parseStay(input);
  if (!stay.hotelId || !stay.packageId || !stay.checkIn || !stay.checkOut) {
    throw new HttpsError(
      "invalid-argument",
      "hotelId, packageId, checkIn, checkOut are required.",
    );
  }

  const kind = action === "book" || stringValue(input.kind) === "book" ?
    "book" :
    "hold";

  const result = await lockStock(db(), {
    action: kind,
    kind,
    hotelId: stay.hotelId,
    packageId: stay.packageId,
    checkIn: stay.checkIn,
    checkOut: stay.checkOut,
    rooms: stay.rooms,
    holdMinutes: parsePositiveInt(input.holdMinutes, DEFAULT_HOLD_MINUTES),
    userId: uid,
    bookingId: stringValue(input.bookingId, 120) || null,
    lockId: stringValue(input.lockId, 120) || undefined,
  });

  if (!result.ok) {
    throw new HttpsError(
      result.code === "INSUFFICIENT_STOCK" ?
        "resource-exhausted" :
        result.code === "WINDOW" || result.code === "MANUAL_ONLY" ?
          "failed-precondition" :
          "failed-precondition",
      result.error,
      {code: result.code},
    );
  }

  logger.info(
    `[lockHotelStock] ${result.lockId} kind=${result.kind} rooms=${result.rooms}`,
  );
  return {
    ...result,
    // Compatibility with old hold client
    holdId: result.lockId,
    locked: true,
    roomsHeld: result.rooms,
    holdUntil: result.expiresAt,
    message:
      result.kind === "hold" ?
        `${result.rooms} room(s) locked for ${DEFAULT_HOLD_MINUTES} minutes.` :
        `${result.rooms} room(s) booked on stock.`,
  };
});

// ---------------------------------------------------------------------------
// 3) UNLOCK — callable
// ---------------------------------------------------------------------------

export const unlockHotelStock = onCall(callableOpts, async (request) => {
  const uid = assertAuth(request.auth as Auth | undefined);
  const input = (request.data || {}) as Data;
  const lockId = stringValue(input.lockId || input.holdId, 120);
  const force = input.force === true;

  if (force) {
    await assertAdmin(request.auth as Auth | undefined);
    const stay = await parseStay(input);
    const result = await unlockStock(db(), {
      force: true,
      hotelId: stay.hotelId,
      packageId: stay.packageId,
      checkIn: stay.checkIn || undefined,
      checkOut: stay.checkOut || undefined,
      rooms: stay.rooms,
      target:
        (stringValue(input.target, 20) as "locked" | "booked" | "both") ||
        "both",
    });
    if (!result.ok) {
      throw new HttpsError("failed-precondition", result.error);
    }
    return result;
  }

  if (!lockId) {
    throw new HttpsError("invalid-argument", "lockId is required.");
  }

  // Owner or admin
  const lockSnap = await db().collection("hotelLocks").doc(lockId).get();
  if (!lockSnap.exists) {
    throw new HttpsError("not-found", "Lock not found.");
  }
  const lock = lockSnap.data() || {};
  const ownerId = stringValue(lock.userId);
  if (ownerId && ownerId !== uid) {
    try {
      await assertAdmin(request.auth as Auth | undefined);
    } catch {
      throw new HttpsError(
        "permission-denied",
        "Only the lock owner or admin can unlock.",
      );
    }
  }

  const result = await unlockStock(db(), {
    lockId,
    reason: "released",
  });
  if (!result.ok) {
    throw new HttpsError("failed-precondition", result.error);
  }

  logger.info(`[unlockHotelStock] ${lockId} rooms=${result.roomsUnlocked}`);
  return {
    ...result,
    holdId: lockId,
    roomsUnlocked: result.roomsUnlocked,
  };
});

// ---------------------------------------------------------------------------
// Expire holds (scheduler)
// ---------------------------------------------------------------------------

export const expireHotelStockHolds = onSchedule(
  {
    schedule: "every 5 minutes",
    region: REGION,
    timeZone: "Asia/Bangkok",
  },
  async () => {
    const result = await expireStaleHolds(db(), 80);
    if (result.expired.length || result.errors.length) {
      logger.info(
        `[expireHotelStockHolds] expired=${result.expired.length} ` +
          `errors=${result.errors.length}`,
      );
    }
  },
);

// ---------------------------------------------------------------------------
// Admin manage (same stock numbers)
// ---------------------------------------------------------------------------

export const manageHotelStock = onCall(callableOpts, async (request) => {
  await assertAdmin(request.auth as Auth | undefined);
  const input = (request.data || {}) as Data;
  const action = stringValue(input.action, 40);
  const hotelId = stringValue(input.hotelId || input.hotelUid, 120);

  if (!action) {
    throw new HttpsError("invalid-argument", "action is required.");
  }

  if (action === "setBookableWindow" || action === "setConfig") {
    if (!hotelId) {
      throw new HttpsError("invalid-argument", "hotelId is required.");
    }
    const hotelRef = db().collection("HotelDB").doc(hotelId);
    const snap = await hotelRef.get();
    if (!snap.exists) {
      throw new HttpsError("not-found", "Hotel not found.");
    }
    const availabilityConfig = {
      bookingOpenFrom: stringValue(input.bookingOpenFrom) || null,
      bookingOpenTo: stringValue(input.bookingOpenTo) || null,
      timezone: "Asia/Bangkok",
      notifyOnFull: input.notifyOnFull !== false,
      notifyOnFreed: input.notifyOnFreed !== false,
      autoBookingEnabled: input.autoBookingEnabled !== false,
      defaultRoomInventory: Math.max(
        1,
        Math.floor(Number(input.defaultRoomInventory || input.defaultTotal) || 5),
      ),
      defaultTotal: Math.max(
        1,
        Math.floor(Number(input.defaultTotal || input.defaultRoomInventory) || 5),
      ),
    };
    await hotelRef.collection("availability").doc("config").set(
      {
        ...availabilityConfig,
        recordType: "config",
        hotelUid: hotelId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      {merge: true},
    );
    return {ok: true, availabilityConfig};
  }

  if (action === "setTotalRooms" || action === "setTotal") {
    const packageId = stringValue(input.packageId || input.roomId, 120);
    const totalRooms = Math.max(0, Math.floor(Number(input.totalRooms ?? input.total) || 0));
    if (!hotelId || !packageId) {
      throw new HttpsError(
        "invalid-argument",
        "hotelId and packageId are required.",
      );
    }
    const result = await setPackageTotalRooms(db(), {
      hotelId,
      packageId,
      totalRooms,
      seedDays: Number(input.seedDays ?? 60),
    });
    if (!result.ok) {
      throw new HttpsError("failed-precondition", result.error || "Failed");
    }
    return {ok: true};
  }

  if (
    action === "setTotalRange" ||
    action === "addExtra" ||
    action === "block" ||
    action === "adjustTotal"
  ) {
    const packageId = stringValue(input.packageId || input.roomId, 120);
    const startDate = toDateString(input.startDate || input.checkIn);
    const endDate = toDateString(input.endDate || input.checkOut);
    if (!hotelId || !packageId || !startDate || !endDate) {
      throw new HttpsError(
        "invalid-argument",
        "hotelId, packageId, startDate, endDate required.",
      );
    }

    let total: number | undefined;
    let delta: number | undefined;
    if (input.total !== undefined && input.total !== null && input.total !== "") {
      total = Math.max(0, Math.floor(Number(input.total)));
    } else if (action === "addExtra") {
      delta = Math.max(0, Math.floor(Number(input.delta || input.quantity || 0)));
    } else if (action === "block") {
      delta = -Math.max(0, Math.floor(Number(input.delta || input.quantity || 0)));
    } else {
      delta = Math.floor(Number(input.delta || 0));
    }

    const result = await setStockTotalRange(db(), {
      hotelId,
      packageId,
      startDate,
      endDate,
      total,
      delta,
    });
    if (!result.ok) {
      throw new HttpsError("failed-precondition", result.error || "Failed");
    }
    return {ok: true, dates: result.dates};
  }

  if (action === "getCalendar") {
    const packageId = stringValue(input.packageId || input.roomId, 120);
    const startDate = toDateString(input.startDate);
    const endDate = toDateString(input.endDate);
    if (!hotelId || !packageId || !startDate || !endDate) {
      throw new HttpsError(
        "invalid-argument",
        "hotelId, packageId, startDate, endDate required.",
      );
    }
    const cal = await getStockCalendar(db(), {
      hotelId,
      packageId,
      startDate,
      endDate,
    });
    return {ok: true, ...cal};
  }

  if (action === "check") {
    const stay = await parseStay(input);
    const result = await checkStock(db(), {
      hotelId: stay.hotelId,
      packageId: stay.packageId,
      checkIn: stay.checkIn,
      checkOut: stay.checkOut,
      rooms: stay.rooms,
    });
    return result;
  }

  throw new HttpsError("invalid-argument", `Unknown action: ${action}`);
});

// ---------------------------------------------------------------------------
// Thin compatibility wrappers for old function names
// ---------------------------------------------------------------------------

/** @deprecated Prefer checkHotelStock */
export const checkHotelAvailability = checkHotelStock;

/** @deprecated Prefer lockHotelStock with kind hold */
export const startHotelBookingHold = onCall(callableOpts, async (request) => {
  const uid = assertAuth(request.auth as Auth | undefined);
  const input = (request.data || {}) as Data;
  const stay = await parseStay(input);
  if (!stay.hotelId || !stay.packageId || !stay.checkIn || !stay.checkOut) {
    throw new HttpsError(
      "invalid-argument",
      "hotelId, packageId, checkIn, checkOut are required.",
    );
  }
  // Old path allowed pending when no stock — new model is all-or-nothing
  const result = await lockStock(db(), {
    action: "hold",
    kind: "hold",
    hotelId: stay.hotelId,
    packageId: stay.packageId,
    checkIn: stay.checkIn,
    checkOut: stay.checkOut,
    rooms: stay.rooms,
    holdMinutes: parsePositiveInt(input.holdMinutes, DEFAULT_HOLD_MINUTES),
    userId: stringValue(input.userId, 120) || uid,
  });
  if (!result.ok) {
    // Soft-fail compatible: return unlocked hold intent for manual pending flow
    if (result.code === "INSUFFICIENT_STOCK" || result.code === "MANUAL_ONLY") {
      return {
        ok: true,
        locked: false,
        holdId: null,
        lockId: null,
        roomsHeld: 0,
        roomsPendingIntent: stay.rooms,
        message: result.error,
        code: result.code,
      };
    }
    throw new HttpsError("failed-precondition", result.error, {
      code: result.code,
    });
  }
  return {
    ok: true,
    locked: true,
    holdId: result.lockId,
    lockId: result.lockId,
    roomsHeld: result.rooms,
    roomsPendingIntent: 0,
    holdUntil: result.expiresAt,
    expiresAt: result.expiresAt,
    hotelId: result.hotelId,
    packageId: result.packageId,
    checkIn: result.checkIn,
    checkOut: result.checkOut,
    nights: result.nights,
    message: `${result.rooms} room(s) locked while you complete booking.`,
  };
});

/** @deprecated Prefer unlockHotelStock */
export const releaseHotelBookingHold = onCall(callableOpts, async (request) => {
  const uid = assertAuth(request.auth as Auth | undefined);
  const input = (request.data || {}) as Data;
  const lockId = stringValue(input.lockId || input.holdId, 120);
  if (!lockId) {
    throw new HttpsError("invalid-argument", "holdId is required.");
  }
  const lockSnap = await db().collection("hotelLocks").doc(lockId).get();
  if (lockSnap.exists) {
    const ownerId = stringValue(lockSnap.data()?.userId);
    if (ownerId && ownerId !== uid) {
      await assertAdmin(request.auth as Auth | undefined);
    }
  }
  const result = await unlockStock(db(), {lockId, reason: "released"});
  if (!result.ok && result.code !== "NOT_FOUND") {
    throw new HttpsError("failed-precondition", result.error);
  }
  return {
    ok: true,
    holdId: lockId,
    lockId,
    roomsUnlocked: result.ok ? result.roomsUnlocked : 0,
  };
});

export const expireHotelBookingHolds = expireHotelStockHolds;

// Re-export helpers used by booking wrappers
export {
  checkStock,
  lockStock,
  unlockStock,
  loadHotel,
  loadPackage,
  loadStockConfig,
  getStockCalendar,
};
