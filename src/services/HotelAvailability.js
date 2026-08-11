/**
 * Admin portal hotel availability — simple stock numbers.
 * free = total - locked - booked
 * Reads: hotelStock nights (Firestore).
 * Writes: Cloud Functions (manageHotelAvailability / unlock).
 */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import {
  db,
  hotelsCollection,
  hotelAvailabilityAdjustments,
  roomBookingCollection,
  app,
} from "../firebase/firebase.config";

export const DEFAULT_ROOM_INVENTORY = 5;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const BANGKOK_TZ = "Asia/Bangkok";

const functions = getFunctions(app, "asia-east2");
const manageAvailabilityCallable = httpsCallable(
  functions,
  "manageHotelAvailability"
);
const releaseInventoryCallable = httpsCallable(
  functions,
  "releaseHotelInventory"
);
const unlockRoomLockCallable = httpsCallable(
  functions,
  "unlockHotelRoomLock"
);

/** Format as YYYY-MM-DD in Asia/Bangkok (matches Cloud Functions). */
const toYmd = (value) => {
  if (!value) return null;
  if (typeof value === "string" && DATE_RE.test(value.trim())) {
    return value.trim();
  }
  let d;
  if (value?.seconds != null) {
    d = new Date(value.seconds * 1000);
  } else if (value?.toDate) {
    d = value.toDate();
  } else {
    d = new Date(value);
  }
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BANGKOK_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
};

const listInclusiveDates = (startDate, endDate) => {
  if (!startDate || !endDate || startDate > endDate) return [];
  const dates = [];
  // Noon Bangkok avoids DST edge cases
  let cur = new Date(`${startDate}T12:00:00+07:00`);
  const end = new Date(`${endDate}T12:00:00+07:00`);
  let guard = 0;
  while (cur <= end && guard < 400) {
    dates.push(toYmd(cur));
    cur = new Date(cur.getTime() + 24 * 60 * 60 * 1000);
    guard += 1;
  }
  return dates;
};

/** Sum active extra/blocked for a date (source of truth for date-based capacity). */
const sumAdjustmentsForDate = (adjustments, date) => {
  let extra = 0;
  let blocked = 0;
  for (const adj of adjustments || []) {
    const adjStart = toYmd(adj.startDate) || String(adj.startDate || "");
    const adjEnd = toYmd(adj.endDate) || String(adj.endDate || "");
    if (!adjStart || !adjEnd || date < adjStart || date > adjEnd) continue;
    const delta = Math.max(0, Number(adj.delta) || 0);
    if (adj.type === "extra") extra += delta;
    if (adj.type === "blocked" || adj.type === "block") blocked += delta;
  }
  return { extra, blocked };
};

const roomLabel = (room) =>
  room?.roomName || room?.packageName || room?.name || room?.id || "Room";

const roomBaseQty = (room) => {
  const raw = room?.totalRooms ?? room?.quantity ?? room?.numberOfRooms;
  if (raw === undefined || raw === null || raw === "") {
    return 0;
  }
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return 0;
  if (n === 0) return 0;
  return Math.floor(n);
};

const isAcceptedBooking = (b) => {
  const s = String(b.bookingStatus || b.status || "").toUpperCase();
  if (["ACCEPTED", "CONFIRMED"].includes(s)) return true;
  return b.isBookingConfirmed === true;
};

const isCanceledBooking = (b) => {
  const s = String(b.bookingStatus || b.status || "").toUpperCase();
  return ["CANCELED", "CANCELLED", "REJECTED", "DENIED"].includes(s);
};

const roomsFromBooking = (b) => {
  const n = Number(b.rooms ?? b.noOfRooms ?? b.roomCount ?? 1);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 1;
};

/** Nights occupied: [checkIn, checkOut) */
const bookingCoversDate = (booking, dateYmd) => {
  const checkIn = toYmd(booking.checkInDate || booking.checkIn);
  const checkOut = toYmd(booking.checkOutDate || booking.checkOut);
  if (!checkIn || !checkOut) return false;
  return dateYmd >= checkIn && dateYmd < checkOut;
};

const readAvailabilityConfig = (hotelData = {}) => {
  const nested =
    hotelData.availabilityConfig ||
    hotelData.hotel?.availabilityConfig ||
    hotelData;
  return {
    bookingOpenFrom: nested.bookingOpenFrom || "",
    bookingOpenTo: nested.bookingOpenTo || "",
    timezone: nested.timezone || "Asia/Bangkok",
    notifyOnFull: nested.notifyOnFull !== false,
    notifyOnFreed: nested.notifyOnFreed !== false,
    autoBookingEnabled: nested.autoBookingEnabled !== false,
    defaultRoomInventory:
      Number(nested.defaultRoomInventory) || DEFAULT_ROOM_INVENTORY,
  };
};

/** Firestore path segments and equality filters must be strings. */
const asId = (value) => {
  if (value == null || value === "") return "";
  return String(value);
};

const availabilityCollection = (hotelUid) =>
  collection(db, "HotelDB", asId(hotelUid), "availability");

const availabilityConfigRef = (hotelUid) =>
  doc(db, "HotelDB", asId(hotelUid), "availability", "config");

const loadAvailabilityConfig = async (hotelUid, legacyHotelData = {}) => {
  try {
    const snap = await getDoc(availabilityConfigRef(hotelUid));
    if (snap.exists()) {
      return { ...readAvailabilityConfig(snap.data()), configured: true };
    }
  } catch (error) {
    console.warn("[HotelAvailability] config read failed", error);
  }
  const inlineConfigured = Boolean(
    legacyHotelData.availabilityConfig ||
      legacyHotelData.hotel?.availabilityConfig
  );
  const fallback = readAvailabilityConfig(legacyHotelData);
  return {
    ...fallback,
    configured: inlineConfigured,
    autoBookingEnabled: inlineConfigured
      ? fallback.autoBookingEnabled
      : false,
  };
};

const loadRoom = async (hotelUid, packageId) => {
  const hid = asId(hotelUid);
  const rid = asId(packageId);
  if (!hid || !rid) return null;
  const snap = await getDoc(doc(db, "HotelDB", hid, "rooms", rid));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
};

const loadAdjustments = async (hotelUid, packageId) => {
  const hid = asId(hotelUid);
  const rid = asId(packageId);
  if (!hid || !rid) return [];
  const results = [];

  try {
    const snap = await getDocs(availabilityCollection(hid));
    results.push(
      ...snap.docs
        .filter((d) => d.id !== "config")
        .map((d) => ({ id: d.id, ...d.data(), storage: "hotel" }))
        .filter(
          (a) =>
            a.active !== false &&
            ["extra", "blocked"].includes(a.type) &&
            asId(a.packageId) === rid
        )
    );
  } catch (error) {
    console.warn("[HotelAvailability] hotel availability read failed", error);
  }

  // Compatibility for records created before availability became a HotelDB
  // subcollection. New writes never use this top-level collection.
  try {
    const q = query(
      hotelAvailabilityAdjustments,
      where("hotelUid", "==", hid)
    );
    const snap = await getDocs(q);
    results.push(
      ...snap.docs
        .map((d) => ({ id: d.id, ...d.data(), storage: "legacy" }))
        .filter(
          (a) => a.active !== false && asId(a.packageId) === rid
        )
    );
  } catch (error) {
    console.warn("[HotelAvailability] legacy adjustments read failed", error);
  }

  return results;
};

const matchesRoomType = (b, packageId, roomNameHint) => {
  const rid = asId(packageId);
  if (!rid) return true;
  const bid = asId(b.packageId || b.roomId || b.roomTypeId);
  if (bid && bid === rid) return true;
  // Fallback: match room name when packageId missing on old bookings
  if (roomNameHint) {
    const bn = String(b.roomName || b.packageName || "").toLowerCase().trim();
    const hn = String(roomNameHint).toLowerCase().trim();
    if (bn && hn && (bn === hn || bn.includes(hn) || hn.includes(bn))) {
      return true;
    }
  }
  // If booking has no package id at all, include for hotel-level list only when no rid
  return false;
};

const loadAcceptedBookings = async (hotelUid, packageId, roomNameHint = "") => {
  const hid = asId(hotelUid);
  const rid = asId(packageId);
  if (!hid) return [];

  const filterList = (docs) =>
    docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter(
        (b) =>
          isAcceptedBooking(b) &&
          !isCanceledBooking(b) &&
          matchesRoomType(b, rid, roomNameHint)
      );

  const mergeById = (lists) => {
    const map = new Map();
    for (const list of lists) {
      for (const b of list) {
        const key =
          b.id ||
          `${b.checkInDate || b.checkIn || ""}-${b.guest || b.fullName || ""}-${b.rooms || 1}`;
        if (!map.has(key)) map.set(key, b);
      }
    }
    return Array.from(map.values());
  };

  const chunks = [];

  // Query by packageId when present (fast path)
  try {
    if (rid) {
      const q = query(
        roomBookingCollection,
        where("hotelUid", "==", hid),
        where("packageId", "==", rid)
      );
      const snap = await getDocs(q);
      chunks.push(filterList(snap.docs));
    }
  } catch {
    /* fall through */
  }

  // Always also scan hotel-level so roomId-only / legacy bookings are not missed
  // when the packageId query returned a partial set.
  try {
    const q = query(roomBookingCollection, where("hotelUid", "==", hid));
    const snap = await getDocs(q);
    chunks.push(filterList(snap.docs));
  } catch {
    try {
      const q = query(roomBookingCollection, where("hotelId", "==", hid));
      const snap = await getDocs(q);
      chunks.push(filterList(snap.docs));
    } catch (e2) {
      console.warn("[HotelAvailability] bookings query failed", e2);
    }
  }

  return mergeById(chunks);
};

const loadActiveLocks = async (hotelUid, packageId) => {
  const hid = asId(hotelUid);
  const rid = asId(packageId);
  if (!hid || !rid) return [];
  try {
    const snap = await getDocs(
      query(collection(db, "hotelLocks"), where("hotelId", "==", hid))
    );
    const now = Date.now();
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((lock) => {
        if (asId(lock.packageId) !== rid) return false;
        if (lock.status !== "active") return false;
        if (lock.kind !== "hold") return true;
        const until = lock.expiresAt?.toMillis
          ? lock.expiresAt.toMillis()
          : new Date(lock.expiresAt || 0).getTime();
        return !lock.expiresAt || (Number.isFinite(until) && until > now);
      });
  } catch (error) {
    console.warn("[HotelAvailability] active locks query failed", error);
    return [];
  }
};

const guestNameOf = (b) =>
  b.fullName ||
  b.guestDetails?.name ||
  b.guestName ||
  b.name ||
  b.customerName ||
  "Guest";

const summarizeBooking = (b) => ({
  id: b.id || b.bookingId || "",
  guest: guestNameOf(b),
  phone: b.guestPhone || b.phone || b.guestDetails?.phone || b.guestDetails?.phoneNumber || "",
  rooms: roomsFromBooking(b),
  checkIn: toYmd(b.checkInDate || b.checkIn) || "—",
  checkOut: toYmd(b.checkOutDate || b.checkOut) || "—",
  status: b.bookingStatus || b.status || "Accepted",
  roomName: b.roomName || b.packageName || "",
});

/** Dates in range that have at least one accepted booking (for list UI). */
const buildBookedDatesList = (nights) =>
  (nights || [])
    .filter((n) => (n.reserved || 0) > 0)
    .map((n) => ({
      date: n.date,
      roomsBooked: n.reserved,
      remaining: n.remaining,
      base: n.base,
      bookings: n.bookings || [],
    }));

/** free = total - locked - booked */
const freeOf = (total, locked, booked) =>
  Math.max(0, Number(total || 0) - Number(locked || 0) - Number(booked || 0));

/** Simple stock night path (shared with website lock/check). */
const stockNightRef = (hotelUid, packageId, date) =>
  doc(
    db,
    "hotelStock",
    `${asId(hotelUid)}_${asId(packageId)}`,
    "nights",
    asId(date)
  );

const readStockNight = async (hotelUid, packageId, date, defaultTotal) => {
  const snap = await getDoc(stockNightRef(hotelUid, packageId, date));
  if (!snap.exists()) {
    return {
      exists: false,
      total: defaultTotal,
      locked: 0,
      booked: 0,
      free: defaultTotal,
    };
  }
  const d = snap.data() || {};
  const total = Number(d.total ?? defaultTotal) || 0;
  const locked = Math.max(0, Number(d.locked) || 0);
  const booked = Math.max(0, Number(d.booked) || 0);
  return {
    exists: true,
    total,
    locked,
    booked,
    free: freeOf(total, locked, booked),
  };
};

/**
 * Admin calendar for Manage Room Availability UI.
 */
export const getHotelAvailabilityCalendar = async ({
  hotelUid,
  packageId,
  startDate,
  endDate,
}) => {
  const hid = asId(hotelUid);
  const rid = asId(packageId);
  const from = toYmd(startDate) || asId(startDate);
  const to = toYmd(endDate) || asId(endDate);

  if (!hid || !rid || !from || !to) {
    throw new Error("hotelUid, packageId, startDate, and endDate are required.");
  }

  const hotelSnap = await getDoc(doc(hotelsCollection, hid));
  const hotelData = hotelSnap.exists() ? hotelSnap.data() : {};
  const availabilityConfig = await loadAvailabilityConfig(hid, hotelData);
  const room = await loadRoom(hid, rid);
  const base = roomBaseQty(room);

  const roomNameHint =
    room?.roomName || room?.packageName || room?.name || "";

  const [bookings, locks] = await Promise.all([
    loadAcceptedBookings(hid, rid, roomNameHint),
    loadActiveLocks(hid, rid),
  ]);

  const dates = listInclusiveDates(from, to);
  // Stock is the single source of truth (same docs website locks against).
  const nights = await Promise.all(
    dates.map(async (date) => {
      const stock = await readStockNight(hid, rid, date, base);
      const dayBookings = bookings
        .filter((b) => bookingCoversDate(b, date))
        .map(summarizeBooking);
      const dayHolds = locks
        .filter(
          (lock) =>
            lock.kind === "hold" &&
            bookingCoversDate(
              {
                checkInDate: lock.checkIn,
                checkOutDate: lock.checkOut,
              },
              date
            )
        )
        .map((lock) => ({
          id: lock.id,
          rooms: Number(lock.rooms) || 0,
          userId: lock.userId || "",
          checkIn: toYmd(lock.checkIn) || "—",
          checkOut: toYmd(lock.checkOut) || "—",
          holdUntil: lock.expiresAt?.toDate
            ? lock.expiresAt.toDate().toISOString()
            : lock.expiresAt || null,
        }));

      const total = stock.total;
      const locked = stock.locked;
      const booked = stock.booked;
      const free = stock.free;
      return {
        date,
        total,
        base: total,
        extra: 0,
        blocked: 0,
        held: locked,
        locked,
        booked,
        untracked: 0,
        reserved: locked + booked,
        remaining: free,
        free,
        bookings: dayBookings,
        holds: dayHolds,
        source: stock.exists ? "hotelStock" : "default",
      };
    })
  );
  const bookedDates = buildBookedDatesList(nights);

  const bookingMap = new Map();
  for (const n of nights) {
    for (const b of n.bookings || []) {
      if (b.id && !bookingMap.has(b.id)) bookingMap.set(b.id, b);
    }
  }
  const bookingsInRange = Array.from(bookingMap.values()).sort((a, b) =>
    String(a.checkIn).localeCompare(String(b.checkIn))
  );

  return {
    ok: true,
    audience: "admin",
    nights,
    bookedDates,
    bookingsInRange,
    holdsInRange: locks,
    adjustments: [],
    availabilityConfig,
    package: room
      ? {
          id: room.id,
          packageName: roomLabel(room),
          roomName: roomLabel(room),
          totalRooms: base,
          maxAdults: room.maxAdults,
          maxChildren: room.maxChildren,
          source: "hotel_rooms",
        }
      : null,
  };
};

/**
 * Admin preview for a stay range.
 */
export const getHotelAvailability = async ({
  hotelUid,
  packageId,
  checkIn,
  checkOut,
  rooms = 1,
}) => {
  const startDate = toYmd(checkIn);
  const endDate = toYmd(checkOut);
  if (!startDate || !endDate) {
    return {
      ok: true,
      available: false,
      reasonCode: "DATES_INCOMPLETE",
      reason: "Invalid dates",
      nights: [],
    };
  }
  // Stay nights are [checkIn, checkOut) → last calendar day for inclusive list is day before checkout
  const stayEnd = new Date(`${endDate}T12:00:00`);
  stayEnd.setDate(stayEnd.getDate() - 1);
  const lastNight = toYmd(stayEnd);
  if (!lastNight || lastNight < startDate) {
    return {
      ok: true,
      available: false,
      reasonCode: "DATES_INCOMPLETE",
      reason: "Stay must include at least one night",
      nights: [],
    };
  }

  const cal = await getHotelAvailabilityCalendar({
    hotelUid,
    packageId,
    startDate,
    endDate: lastNight,
  });

  const roomsRequested = Math.max(1, Math.floor(Number(rooms) || 1));
  const short = (cal.nights || []).filter(
    (n) => n.remaining < roomsRequested
  );
  const autoOn = cal.availabilityConfig?.autoBookingEnabled !== false;

  if (!autoOn) {
    return {
      ok: true,
      available: false,
      autoBookingEnabled: false,
      reasonCode: "AUTO_BOOKING_DISABLED",
      reason: "Auto booking is disabled for this hotel.",
      nights: cal.nights,
      totalRooms: cal.package?.totalRooms ?? 0,
    };
  }

  return {
    ok: true,
    available: short.length === 0,
    autoBookingEnabled: true,
    reasonCode: short.length ? "ROOMS_FULL" : null,
    reason: short.length
      ? `Not enough rooms on: ${short.map((n) => n.date).join(", ")}`
      : null,
    nights: cal.nights,
    totalRooms: cal.package?.totalRooms ?? 0,
    roomsRequested,
  };
};

/**
 * Use the Cloud Function so inventory and its audit/allocation records are updated
 * atomically. A failed server update must never fall back to partial client writes.
 */
export const manageHotelAvailability = async (payload) => {
  const action = payload?.action;
  const hotelUid = asId(payload?.hotelUid || payload?.hotelId).trim();

  // Server path (preferred) — keeps inventory in sync for website/app booking
  try {
    const result = await manageAvailabilityCallable({
      ...payload,
      hotelUid,
      hotelId: hotelUid,
      action,
      startDate: toYmd(payload?.startDate) || payload?.startDate || null,
      endDate: toYmd(payload?.endDate) || payload?.endDate || null,
      delta: payload?.delta ?? payload?.quantity,
      quantity: payload?.quantity ?? payload?.delta,
    });
    return result?.data || { ok: true, audience: "admin" };
  } catch (cfError) {
    console.error("[HotelAvailability] server update failed", cfError);
    throw new Error(
      cfError?.message ||
        cfError?.details ||
        "Could not update availability. No inventory changes were saved."
    );
  }
};

export const setBookableWindow = async (hotelUid, config) =>
  manageHotelAvailability({
    action: "setBookableWindow",
    hotelUid,
    autoBookingEnabled: config.autoBookingEnabled !== false,
    defaultRoomInventory: Number(config.defaultRoomInventory) || 5,
    ...config,
  });

export const setTotalRooms = async (hotelUid, packageId, totalRooms) =>
  manageHotelAvailability({
    action: "setTotalRooms",
    hotelUid,
    packageId,
    totalRooms,
  });

export const addExtraRooms = async (payload) =>
  manageHotelAvailability({ action: "addExtra", ...payload });

export const blockRooms = async (payload) =>
  manageHotelAvailability({ action: "block", ...payload });

/** @deprecated Adjustments removed — use setTotalRange / addExtra / block on stock totals. */
export const endAvailabilityAdjustment = async () => ({
  ok: true,
  deprecated: true,
  message: "Adjustments removed. Use addExtra/block to change night totals.",
});

/**
 * Admin ops — free night-ledger rooms for a booking (not just flags).
 * Prefer Cloud Function; never clear inventoryReserved without ledger decrement.
 */
export const releaseHotelInventory = async (bookingId) => {
  if (!bookingId) throw new Error("bookingId is required.");

  try {
    const result = await releaseInventoryCallable({ bookingId });
    return result?.data || { ok: true };
  } catch (cfError) {
    console.warn(
      "[HotelAvailability] releaseHotelInventory CF failed",
      cfError
    );
    throw new Error(
      cfError?.message ||
        cfError?.details ||
        "Could not release inventory. Cancel the booking instead so the server unlocks rooms."
    );
  }
};

/**
 * Full unlock: free rooms for the whole stay (check-in → check-out) and
 * remove the lock document when it is a hold.
 *
 * @param {object} payload
 * @param {string} [payload.holdId] — soft hold: free nights + delete hold doc
 * @param {string} [payload.bookingId] — booking: free nights + delete related holds
 * @param {string} [payload.hotelUid] — with packageId/checkIn/checkOut for manual force unlock
 * @param {string} [payload.packageId]
 * @param {string} [payload.checkIn]
 * @param {string} [payload.checkOut]
 * @param {number} [payload.rooms]
 * @param {boolean} [payload.force] — re-free ledger even if already marked released
 */
export const unlockHotelRoomLock = async (payload = {}) => {
  const hasTarget =
    payload.lockId ||
    payload.holdId ||
    payload.bookingId ||
    (payload.hotelUid &&
      payload.packageId &&
      (payload.checkIn || payload.checkInDate) &&
      (payload.checkOut || payload.checkOutDate));
  if (!hasTarget) {
    throw new Error(
      "Provide lockId, holdId, bookingId, or hotelUid + packageId + checkIn + checkOut."
    );
  }

  try {
    const result = await unlockRoomLockCallable({
      ...payload,
      lockId: payload.lockId || payload.holdId,
      force: payload.force === true || !payload.lockId,
    });
    return result?.data || { ok: true };
  } catch (cfError) {
    console.warn("[HotelAvailability] unlockHotelRoomLock CF failed", cfError);
    throw new Error(
      cfError?.message ||
        cfError?.details ||
        "Could not unlock room lock."
    );
  }
};

export const availabilityColour = (night) => {
  if (!night) return "grey";
  const free = night.free ?? night.remaining ?? 0;
  const total = night.total ?? night.base ?? 0;
  if (free <= 0) return "red";
  if (total > 0 && free <= Math.max(1, Math.ceil(total * 0.2))) {
    return "orange";
  }
  return "green";
};

/** Theme-aligned cell colours (primary blue system). */
export const colourClasses = {
  green: "bg-emerald-50 text-emerald-800 border-emerald-200",
  orange: "bg-amber-50 text-amber-900 border-amber-200",
  red: "bg-red-50 text-red-800 border-red-200",
  blue: "bg-primary-50 text-primary-800 border-primary-200",
  grey: "bg-neutral-100 text-neutral-600 border-neutral-200",
};
