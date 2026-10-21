/**
 * @file Admin portal hotel availability - simple stock numbers.
 * free = total - locked - booked
 * Reads: hotelStock nights (Firestore).
 * Writes: Cloud Functions (manageHotelAvailability / unlock).
 *
 * This service manages hotel room availability, locks, holds, and bookings
 * for the admin portal, interfacing with Firebase Firestore and Functions.
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

/**
 * Default number of rooms available if not otherwise specified.
 * @constant {number}
 */
export const DEFAULT_ROOM_INVENTORY = 5;

/**
 * Regular expression to match date strings in YYYY-MM-DD format.
 * @constant {RegExp}
 */
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The timezone used for date calculations (Bangkok time).
 * @constant {string}
 */
const BANGKOK_TZ = "Asia/Bangkok";

/**
 * Firebase Functions instance for the 'asia-east2' region.
 * @constant {import("firebase/functions").Functions}
 */
const functions = getFunctions(app, "asia-east2");

/**
 * Callable Cloud Function to manage hotel availability.
 * @constant {import("firebase/functions").HttpsCallable}
 */
const manageAvailabilityCallable = httpsCallable(
  functions,
  "manageHotelAvailability"
);

/**
 * Callable Cloud Function to release hotel inventory.
 * @constant {import("firebase/functions").HttpsCallable}
 */
const releaseInventoryCallable = httpsCallable(
  functions,
  "releaseHotelInventory"
);

/**
 * Callable Cloud Function to unlock a hotel room lock.
 * @constant {import("firebase/functions").HttpsCallable}
 */
const unlockRoomLockCallable = httpsCallable(
  functions,
  "unlockHotelRoomLock"
);

/** 
 * Format a date value as YYYY-MM-DD in Asia/Bangkok timezone.
 * Matches Cloud Functions logic.
 * 
 * @param {string|Date|object} value - The date to format. Can be a string, Date object, or Firestore Timestamp.
 * @returns {string|null} The formatted date string, or null if invalid.
 */
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

/**
 * Generate a list of inclusive dates between a start and end date.
 * 
 * @param {string} startDate - The start date in YYYY-MM-DD format.
 * @param {string} endDate - The end date in YYYY-MM-DD format.
 * @returns {string[]} An array of date strings in YYYY-MM-DD format.
 */
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

/** 
 * Sum active extra/blocked adjustments for a specific date.
 * This is the source of truth for date-based capacity.
 * 
 * @param {object[]} adjustments - Array of adjustment objects.
 * @param {string} date - The date to check in YYYY-MM-DD format.
 * @returns {{ extra: number, blocked: number }} The summed extra and blocked quantities.
 */
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

/**
 * Get the display label for a room.
 * 
 * @param {object} room - The room object.
 * @returns {string} The room label or "Room" as a fallback.
 */
const roomLabel = (room) =>
  room?.roomName || room?.packageName || room?.name || room?.id || "Room";

/**
 * Extract the base room quantity from a room object.
 * 
 * @param {object} room - The room object.
 * @returns {number} The base quantity of rooms available.
 */
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

/**
 * Check if a booking is considered accepted.
 * 
 * @param {object} b - The booking object.
 * @returns {boolean} True if the booking is accepted/confirmed, false otherwise.
 */
const isAcceptedBooking = (b) => {
  const s = String(b.bookingStatus || b.status || "").toUpperCase();
  if (["ACCEPTED", "CONFIRMED"].includes(s)) return true;
  return b.isBookingConfirmed === true;
};

/**
 * Check if a booking is considered canceled.
 * 
 * @param {object} b - The booking object.
 * @returns {boolean} True if the booking is canceled/rejected/denied, false otherwise.
 */
const isCanceledBooking = (b) => {
  const s = String(b.bookingStatus || b.status || "").toUpperCase();
  return ["CANCELED", "CANCELLED", "REJECTED", "DENIED"].includes(s);
};

/**
 * Get the number of rooms associated with a booking.
 * 
 * @param {object} b - The booking object.
 * @returns {number} The number of rooms booked (defaults to 1).
 */
const roomsFromBooking = (b) => {
  const n = Number(b.rooms ?? b.noOfRooms ?? b.roomCount ?? 1);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 1;
};

/** 
 * Check if a booking covers a specific date.
 * Nights occupied: [checkIn, checkOut)
 * 
 * @param {object} booking - The booking object.
 * @param {string} dateYmd - The date to check in YYYY-MM-DD format.
 * @returns {boolean} True if the booking covers the given date, false otherwise.
 */
const bookingCoversDate = (booking, dateYmd) => {
  const checkIn = toYmd(booking.checkInDate || booking.checkIn);
  const checkOut = toYmd(booking.checkOutDate || booking.checkOut);
  if (!checkIn || !checkOut) return false;
  return dateYmd >= checkIn && dateYmd < checkOut;
};

/**
 * Read the availability configuration from hotel data.
 * 
 * @param {object} [hotelData={}] - The raw hotel data document.
 * @returns {object} The standardized availability configuration.
 */
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

/** 
 * Convert a value to a string suitable for Firestore path segments or equality filters.
 * 
 * @param {any} value - The value to convert.
 * @returns {string} The string representation or empty string if null/undefined.
 */
const asId = (value) => {
  if (value == null || value === "") return "";
  return String(value);
};

/**
 * Get the collection reference for a hotel's availability.
 * 
 * @param {string} hotelUid - The UID of the hotel.
 * @returns {import("firebase/firestore").CollectionReference} The Firestore collection reference.
 */
const availabilityCollection = (hotelUid) =>
  collection(db, "HotelDB", asId(hotelUid), "availability");

/**
 * Get the document reference for a hotel's availability configuration.
 * 
 * @param {string} hotelUid - The UID of the hotel.
 * @returns {import("firebase/firestore").DocumentReference} The Firestore document reference.
 */
const availabilityConfigRef = (hotelUid) =>
  doc(db, "HotelDB", asId(hotelUid), "availability", "config");

/**
 * Load the availability configuration for a hotel.
 * Attempts to load from the dedicated config doc, falling back to legacy hotel data.
 * 
 * @param {string} hotelUid - The UID of the hotel.
 * @param {object} [legacyHotelData={}] - Legacy hotel data to use as a fallback.
 * @returns {Promise<object>} A promise resolving to the availability configuration object.
 */
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

/**
 * Load room details from a hotel.
 * 
 * @param {string} hotelUid - The UID of the hotel.
 * @param {string} packageId - The ID of the room/package.
 * @returns {Promise<object|null>} A promise resolving to the room object or null if not found.
 */
const loadRoom = async (hotelUid, packageId) => {
  const hid = asId(hotelUid);
  const rid = asId(packageId);
  if (!hid || !rid) return null;
  const snap = await getDoc(doc(db, "HotelDB", hid, "rooms", rid));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
};

/**
 * Load capacity adjustments (extra/blocked) for a specific room.
 * 
 * @param {string} hotelUid - The UID of the hotel.
 * @param {string} packageId - The ID of the room/package.
 * @returns {Promise<object[]>} A promise resolving to an array of adjustment objects.
 */
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

/**
 * Check if a booking matches a given room type.
 * 
 * @param {object} b - The booking object.
 * @param {string} packageId - The ID of the package/room type.
 * @param {string} [roomNameHint] - Optional room name hint for legacy bookings without a packageId.
 * @returns {boolean} True if the booking matches the room type.
 */
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

/**
 * Load accepted bookings for a specific hotel and room type.
 * 
 * @param {string} hotelUid - The UID of the hotel.
 * @param {string} packageId - The ID of the package/room type.
 * @param {string} [roomNameHint=""] - Optional room name hint for matching legacy bookings.
 * @returns {Promise<object[]>} A promise resolving to an array of accepted bookings.
 */
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

/**
 * Load active locks or holds for a specific room type.
 * 
 * @param {string} hotelUid - The UID of the hotel.
 * @param {string} packageId - The ID of the package/room type.
 * @returns {Promise<object[]>} A promise resolving to an array of active lock objects.
 */
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

/**
 * Extract the guest name from a booking object.
 * 
 * @param {object} b - The booking object.
 * @returns {string} The guest's name, or "Guest" as a fallback.
 */
const guestNameOf = (b) =>
  b.fullName ||
  b.guestDetails?.name ||
  b.guestName ||
  b.name ||
  b.customerName ||
  "Guest";

/**
 * Summarize a booking object to its core details.
 * 
 * @param {object} b - The raw booking object.
 * @returns {object} A summarized booking object.
 */
const summarizeBooking = (b) => ({
  id: b.id || b.bookingId || "",
  guest: guestNameOf(b),
  phone: b.guestPhone || b.phone || b.guestDetails?.phone || b.guestDetails?.phoneNumber || "",
  rooms: roomsFromBooking(b),
  checkIn: toYmd(b.checkInDate || b.checkIn) || "-",
  checkOut: toYmd(b.checkOutDate || b.checkOut) || "-",
  status: b.bookingStatus || b.status || "Accepted",
  roomName: b.roomName || b.packageName || "",
});

/** 
 * Build a list of dates in range that have at least one accepted booking.
 * Used for listing occupied dates in the UI.
 * 
 * @param {object[]} nights - Array of night stock objects.
 * @returns {object[]} Array of booked date summaries.
 */
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

/** 
 * Calculate the number of free rooms.
 * formula: free = total - locked - booked
 * 
 * @param {number} total - Total rooms available.
 * @param {number} locked - Number of rooms locked/held.
 * @param {number} booked - Number of rooms confirmed booked.
 * @returns {number} The calculated free rooms (min 0).
 */
const freeOf = (total, locked, booked) =>
  Math.max(0, Number(total || 0) - Number(locked || 0) - Number(booked || 0));

/** 
 * Get the Firestore document reference for a simple stock night.
 * Shared path with the website's lock/check logic.
 * 
 * @param {string} hotelUid - The UID of the hotel.
 * @param {string} packageId - The ID of the package/room type.
 * @param {string} date - The date string (YYYY-MM-DD).
 * @returns {import("firebase/firestore").DocumentReference} The Firestore document reference.
 */
const stockNightRef = (hotelUid, packageId, date) =>
  doc(
    db,
    "hotelStock",
    `${asId(hotelUid)}_${asId(packageId)}`,
    "nights",
    asId(date)
  );

/**
 * Read the stock availability for a specific night.
 * 
 * @param {string} hotelUid - The UID of the hotel.
 * @param {string} packageId - The ID of the package/room type.
 * @param {string} date - The date string (YYYY-MM-DD).
 * @param {number} defaultTotal - The default total rooms if the document doesn't exist.
 * @returns {Promise<object>} A promise resolving to the stock object for that night.
 */
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
 * Generate an admin calendar for the Manage Room Availability UI.
 * Aggregates stock, bookings, and holds over a date range.
 * 
 * @param {object} params - The calendar parameters.
 * @param {string} params.hotelUid - The UID of the hotel.
 * @param {string} params.packageId - The ID of the room package.
 * @param {string} params.startDate - The start date in YYYY-MM-DD format.
 * @param {string} params.endDate - The end date in YYYY-MM-DD format.
 * @returns {Promise<object>} A promise resolving to the calendar payload for the UI.
 * @throws {Error} If required parameters are missing.
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
          checkIn: toYmd(lock.checkIn) || "-",
          checkOut: toYmd(lock.checkOut) || "-",
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
 * Fetch an admin preview of availability for a specific stay range.
 * Assesses whether the requested rooms are available for the entire duration.
 * 
 * @param {object} params - The preview parameters.
 * @param {string} params.hotelUid - The UID of the hotel.
 * @param {string} params.packageId - The ID of the room package.
 * @param {string} params.checkIn - The check-in date (YYYY-MM-DD).
 * @param {string} params.checkOut - The check-out date (YYYY-MM-DD).
 * @param {number} [params.rooms=1] - The number of rooms requested.
 * @returns {Promise<object>} A promise resolving to the availability status and reason.
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
 * Update hotel availability using the Cloud Function.
 * This ensures inventory and its audit/allocation records are updated atomically.
 * A failed server update must never fall back to partial client writes.
 * 
 * @param {object} payload - The payload containing the action and parameters.
 * @param {string} [payload.action] - The action to perform (e.g., 'setTotalRooms', 'addExtra').
 * @param {string} [payload.hotelUid] - The hotel UID.
 * @param {string} [payload.hotelId] - Alternative for hotel UID.
 * @param {string} [payload.startDate] - Start date of the change.
 * @param {string} [payload.endDate] - End date of the change.
 * @param {number} [payload.delta] - Change quantity.
 * @param {number} [payload.quantity] - Alternative for change quantity.
 * @returns {Promise<object>} A promise resolving to the result of the Cloud Function.
 * @throws {Error} If the server update fails.
 */
export const manageHotelAvailability = async (payload) => {
  const action = payload?.action;
  const hotelUid = asId(payload?.hotelUid || payload?.hotelId).trim();

  // Server path (preferred) - keeps inventory in sync for website/app booking
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

/**
 * Configure the bookable window and auto-booking for a hotel.
 * 
 * @param {string} hotelUid - The UID of the hotel.
 * @param {object} config - Configuration object containing window settings.
 * @returns {Promise<object>} Response from the Cloud Function.
 */
export const setBookableWindow = async (hotelUid, config) =>
  manageHotelAvailability({
    action: "setBookableWindow",
    hotelUid,
    autoBookingEnabled: config.autoBookingEnabled !== false,
    defaultRoomInventory: Number(config.defaultRoomInventory) || 5,
    ...config,
  });

/**
 * Set the total number of rooms for a specific package.
 * 
 * @param {string} hotelUid - The UID of the hotel.
 * @param {string} packageId - The ID of the room package.
 * @param {number} totalRooms - The new total capacity.
 * @returns {Promise<object>} Response from the Cloud Function.
 */
export const setTotalRooms = async (hotelUid, packageId, totalRooms) =>
  manageHotelAvailability({
    action: "setTotalRooms",
    hotelUid,
    packageId,
    totalRooms,
  });

/**
 * Add extra room availability for a date range.
 * 
 * @param {object} payload - Action parameters (hotelUid, packageId, startDate, endDate, delta).
 * @returns {Promise<object>} Response from the Cloud Function.
 */
export const addExtraRooms = async (payload) =>
  manageHotelAvailability({ action: "addExtra", ...payload });

/**
 * Block room availability for a date range.
 * 
 * @param {object} payload - Action parameters (hotelUid, packageId, startDate, endDate, delta).
 * @returns {Promise<object>} Response from the Cloud Function.
 */
export const blockRooms = async (payload) =>
  manageHotelAvailability({ action: "block", ...payload });

/** 
 * End a legacy availability adjustment.
 * @deprecated Adjustments removed - use setTotalRange / addExtra / block on stock totals.
 * @returns {Promise<{ ok: boolean, deprecated: boolean, message: string }>} 
 */
export const endAvailabilityAdjustment = async () => ({
  ok: true,
  deprecated: true,
  message: "Adjustments removed. Use addExtra/block to change night totals.",
});

/**
 * Admin ops - free night-ledger rooms for a booking (not just flags).
 * Prefer Cloud Function; never clear inventoryReserved without ledger decrement.
 * 
 * @param {string} bookingId - The ID of the booking to release.
 * @returns {Promise<object>} Response from the Cloud Function.
 * @throws {Error} If bookingId is missing or if the server call fails.
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
 * @param {object} payload - Parameters determining what to unlock.
 * @param {string} [payload.holdId] - Soft hold: free nights + delete hold doc.
 * @param {string} [payload.bookingId] - Booking: free nights + delete related holds.
 * @param {string} [payload.hotelUid] - Used with packageId/checkIn/checkOut for manual force unlock.
 * @param {string} [payload.packageId] - The ID of the room package.
 * @param {string} [payload.checkIn] - Check-in date.
 * @param {string} [payload.checkOut] - Check-out date.
 * @param {number} [payload.rooms] - Number of rooms to unlock.
 * @param {boolean} [payload.force] - Re-free ledger even if already marked released.
 * @returns {Promise<object>} Response from the Cloud Function.
 * @throws {Error} If missing identifying fields or server call fails.
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

/**
 * Determine the visual color indicator based on a night's availability.
 * 
 * @param {object} night - The night stock object.
 * @returns {string} The color name ('red', 'orange', 'green', or 'grey').
 */
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

/** 
 * Theme-aligned cell colours (primary blue system).
 * Maps color names to Tailwind CSS utility classes.
 * @constant {object}
 */
export const colourClasses = {
  green: "bg-emerald-50 text-emerald-800 border-emerald-200",
  orange: "bg-amber-50 text-amber-900 border-amber-200",
  red: "bg-red-50 text-red-800 border-red-200",
  blue: "bg-primary-50 text-primary-800 border-primary-200",
  grey: "bg-neutral-100 text-neutral-600 border-neutral-200",
};
