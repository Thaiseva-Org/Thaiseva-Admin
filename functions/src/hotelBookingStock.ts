/**
 * Hotel booking flows on simple stock (check / lock / unlock numbers).
 * All-or-nothing: free rooms for every night or fail / pending without lock.
 */
import * as admin from "firebase-admin";
import {HttpsError, onCall} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import {
  checkStock,
  lockStock,
  unlockStock,
  loadHotel,
  loadPackage,
  resolvePackageIdByRoomName,
  getRoomPricing,
} from "./utils/hotelStock";
import {listStayNights, toDateString} from "./utils/hotelAvailability";
import {hotelStayAmount, requestedExtraBedCount} from "./utils/hotelBedPricing";

const REGION = "asia-east2";
const HOTEL_COLLECTION = "hotelBookingData";

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
  const email = stringValue(auth.token?.email).toLowerCase();
  if (
    ["admin@gmail.com", "thaiseva_admin@gmail.com"].includes(email) ||
    auth.token?.admin === true
  ) {
    return;
  }
  const user = await db().doc(`users/${auth.uid}`).get();
  const role = stringValue(user.data()?.role).toLowerCase();
  if (role === "admin" || role === "sub admin") return;
  throw new HttpsError("permission-denied", "Admin access only.");
};

const assertAdminOrHotelOwner = async (
  auth: Auth | undefined,
  hotelUid: string,
) => {
  try {
    await assertAdmin(auth);
    return;
  } catch (e) {
    if (e instanceof HttpsError && e.code === "unauthenticated") throw e;
  }
  if (!auth?.uid) {
    throw new HttpsError("unauthenticated", "Sign in is required.");
  }
  if (hotelUid && auth.uid === hotelUid) return;
  throw new HttpsError(
    "permission-denied",
    "Only admin or the hotel partner can accept this booking.",
  );
};

const resolvePackageId = async (
  hotelId: string,
  packageId: string,
  roomName?: string,
) => {
  if (packageId) return packageId;
  if (roomName) {
    return (await resolvePackageIdByRoomName(db(), hotelId, roomName)) || "";
  }
  return "";
};

const computeAmount = (
  roomPrice: number,
  nights: number,
  rooms: number,
  extraBedPrice: number,
  extraBedCount: number,
) => {
  return hotelStayAmount(roomPrice, rooms, nights, extraBedPrice, extraBedCount);
};

const buildBookingDoc = (params: {
  userId: string;
  hotelId: string;
  packageId: string;
  packageName: string;
  hotelName: string;
  checkIn: string;
  checkOut: string;
  rooms: number;
  nights: number;
  adults: number;
  children: number;
  fullName: string;
  guestEmail: string;
  guestPhone: string;
  amountTHB: number;
  roomPrice: number;
  extraBedCountRequested: number;
  extraBedPrice: number;
  accepted: boolean;
  stockLockId: string | null;
  notes?: string;
}) => {
  const {
    userId,
    hotelId,
    packageId,
    packageName,
    hotelName,
    checkIn,
    checkOut,
    rooms,
    nights,
    adults,
    children,
    fullName,
    guestEmail,
    guestPhone,
    amountTHB,
    roomPrice,
    extraBedCountRequested,
    extraBedPrice,
    accepted,
    stockLockId,
    notes,
  } = params;

  return {
    userId,
    authUid: userId,
    hotelUid: hotelId,
    hotelId,
    hotelName,
    packageId,
    roomId: packageId,
    packageName,
    roomName: packageName,
    checkInDate: checkIn,
    checkOutDate: checkOut,
    checkIn,
    checkOut,
    rooms,
    noOfRooms: rooms,
    nights,
    adults,
    children,
    fullName,
    guestName: fullName,
    guestEmail,
    guestPhone,
    phone: guestPhone,
    email: guestEmail,
    amountTHB,
    amountDue: accepted ? amountTHB : 0,
    totalAmount: amountTHB,
    totalPrice: amountTHB,
    roomPrice,
    pricePerNight: roomPrice,
    extraBed: extraBedCountRequested > 0,
    extraBedRequested: extraBedCountRequested > 0,
    extraBedCountRequested,
    extraBedCount: Math.min(extraBedCountRequested, accepted ? rooms : 0),
    extraBedPrice,
    notes: notes || "",
    bookingStatus: accepted ? "ACCEPTED" : "PENDING",
    status: accepted ? "Accepted" : "Pending",
    isBookingConfirmed: accepted,
    autoAccepted: accepted,
    acceptanceMethod: accepted ? "AUTO_STOCK" : "MANUAL",
    inventoryReserved: accepted && Boolean(stockLockId),
    inventoryReleased: false,
    stockLockId: stockLockId || null,
    stockModel: "v2_numbers",
    sourcePath: accepted ? "stock_auto" : "stock_pending",
    isPaymentDone: false,
    paymentMethod: null,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
};

/**
 * Create booking: all free + auto ON → lock book + Accepted; else Pending no lock.
 * Exported for HTTPS checkout + callable.
 */
export async function runCreateHotelBookingWithAvailability(
  uid: string,
  body: Data,
): Promise<Record<string, unknown>> {
  const hotelId = stringValue(body.hotelId || body.hotelUid, 120);
  let packageId = stringValue(body.packageId || body.roomId, 120);
  const roomNameHint = stringValue(body.roomName, 150);
  const checkIn = toDateString(body.checkIn || body.checkInDate);
  const checkOut = toDateString(body.checkOut || body.checkOutDate);
  const rooms = parsePositiveInt(body.rooms || body.noOfRooms, 1);
  const adults = Math.max(1, parsePositiveInt(body.adults, 1));
  const children = Math.max(0, parsePositiveInt(body.children, 0));
  const fullName = stringValue(body.fullName || body.guestName, 120);
  const guestEmail = stringValue(body.guestEmail || body.email, 200).toLowerCase();
  const guestPhone = stringValue(body.guestPhone || body.phone, 40);
  let extraBedCountRequested: number;
  try {
    extraBedCountRequested = requestedExtraBedCount(body, rooms);
  } catch (error) {
    throw new HttpsError("invalid-argument", (error as Error).message);
  }
  const notes = stringValue(body.notes || body.specialRequests, 1000);

  if (!hotelId || !checkIn || !checkOut) {
    throw new HttpsError(
      "invalid-argument",
      "hotelId, checkIn, checkOut required.",
    );
  }
  packageId = await resolvePackageId(hotelId, packageId, roomNameHint);
  if (!packageId) {
    throw new HttpsError("invalid-argument", "packageId or roomName required.");
  }

  const nightsList = listStayNights(checkIn, checkOut);
  if (nightsList.length < 1) {
    throw new HttpsError("invalid-argument", "Check-out must be after check-in.");
  }

  const [hotel, pkg, stock] = await Promise.all([
    loadHotel(db(), hotelId),
    loadPackage(db(), packageId, hotelId),
    checkStock(db(), {
      hotelId,
      packageId,
      checkIn,
      checkOut,
      rooms,
    }),
  ]);
  if (!hotel) throw new HttpsError("not-found", "Hotel not found.");

  const pricing = getRoomPricing(pkg, hotel);
  const amountTHB = computeAmount(
    pricing.roomPrice,
    nightsList.length,
    rooms,
    pricing.extraBedPrice,
    extraBedCountRequested,
  );

  const canAuto = stock.canLock;
  let stockLockId: string | null = null;
  let accepted = false;

  if (canAuto) {
    const lock = await lockStock(db(), {
      action: "book",
      kind: "book",
      hotelId,
      packageId,
      checkIn,
      checkOut,
      rooms,
      userId: uid,
    });
    if (lock.ok) {
      stockLockId = lock.lockId;
      accepted = true;
    } else {
      logger.warn("[createBooking] lock failed, pending", lock);
    }
  }

  const bookingRef = db().collection(HOTEL_COLLECTION).doc();
  if (stockLockId) {
    await db().collection("hotelLocks").doc(stockLockId).set(
      {bookingId: bookingRef.id},
      {merge: true},
    );
  }

  const paymentMethod = stringValue(
    body.paymentMethod || body.paymentMethodIntent,
    40,
  );

  const doc = {
    ...buildBookingDoc({
      userId: uid,
      hotelId,
      packageId,
      packageName: pricing.roomName,
      hotelName: pricing.hotelName,
      checkIn,
      checkOut,
      rooms,
      nights: nightsList.length,
      adults,
      children,
      fullName: fullName || "Guest",
      guestEmail,
      guestPhone,
      amountTHB,
      roomPrice: pricing.roomPrice,
      extraBedCountRequested,
      extraBedPrice: pricing.extraBedPrice,
      accepted,
      stockLockId,
      notes,
    }),
    paymentMethod: paymentMethod || null,
    paymentMethodIntent: paymentMethod || null,
  };

  await bookingRef.set(doc);

  logger.info(
    `[createBooking] ${bookingRef.id} accepted=${accepted} lock=${stockLockId}`,
  );

  return {
    success: true,
    ok: true,
    bookingId: bookingRef.id,
    autoBookingId: accepted ? bookingRef.id : null,
    pendingBookingId: accepted ? null : bookingRef.id,
    bookingCollection: HOTEL_COLLECTION,
    path: accepted ? "auto" : "pending",
    autoAccepted: accepted,
    inventoryReserved: accepted,
    stockLockId,
    payNow: accepted,
    roomsInstant: accepted ? rooms : 0,
    roomsPending: accepted ? 0 : rooms,
    amountTHB,
    amount: amountTHB,
    free: stock.free,
    canLock: stock.canLock,
    messaging: {
      kind: accepted ? "full_instant" : stock.reasonCode === "MANUAL_ONLY" ?
        "manual_only" :
        "none_instant",
      title: accepted ? "Booking confirmed" : "Request submitted",
      message: accepted ?
        `${rooms} room(s) locked and accepted.` :
        "Rooms were not available for instant lock. Your request is pending.",
      roomsInstant: accepted ? rooms : 0,
      roomsPending: accepted ? 0 : rooms,
      canProceed: true,
    },
  };
}

export const createHotelBookingWithAvailability = onCall(
  callableOpts,
  async (request) => {
    const uid = assertAuth(request.auth as Auth | undefined);
    return runCreateHotelBookingWithAvailability(
      uid,
      (request.data || {}) as Data,
    );
  },
);

/**
 * Complete hold: convert lock → book, write booking doc.
 */
export async function runCompleteHotelBookingHold(
  uid: string,
  body: Data,
): Promise<Record<string, unknown>> {
  const lockId = stringValue(body.lockId || body.holdId, 120);
  if (!lockId) {
    throw new HttpsError("invalid-argument", "holdId/lockId required.");
  }

  const lockSnap = await db().collection("hotelLocks").doc(lockId).get();
  if (!lockSnap.exists) {
    throw new HttpsError("not-found", "Hold not found.");
  }
  const lock = lockSnap.data() || {};
  if (stringValue(lock.userId) && stringValue(lock.userId) !== uid) {
    throw new HttpsError("permission-denied", "This hold belongs to another user.");
  }
  if (String(lock.status) === "converted" && lock.bookingId) {
    return {
      success: true,
      holdId: lockId,
      lockId,
      bookingId: String(lock.bookingId),
      alreadyCompleted: true,
    };
  }
  if (String(lock.status) !== "active") {
    throw new HttpsError(
      "failed-precondition",
      `Hold is ${lock.status}, cannot complete.`,
    );
  }

  const hotelId = stringValue(lock.hotelId, 120);
  const packageId = stringValue(lock.packageId, 120);
  const checkIn = stringValue(lock.checkIn, 20);
  const checkOut = stringValue(lock.checkOut, 20);
  const rooms = parsePositiveInt(lock.rooms, 1);
  const nightsList =
    (lock.nights as string[]) || listStayNights(checkIn, checkOut);

  const fullName = stringValue(body.fullName || body.guestName, 120);
  const guestEmail = stringValue(body.guestEmail || body.email, 200).toLowerCase();
  const guestPhone = stringValue(body.guestPhone || body.phone, 40);
  const adults = Math.max(1, parsePositiveInt(body.adults, 1));
  const children = Math.max(0, parsePositiveInt(body.children, 0));
  let extraBedCountRequested: number;
  try {
    extraBedCountRequested = requestedExtraBedCount(body, rooms);
  } catch (error) {
    throw new HttpsError("invalid-argument", (error as Error).message);
  }
  const notes = stringValue(body.notes, 1000);

  const converted = await lockStock(db(), {
    action: "convert",
    lockId,
    userId: uid,
  });
  if (!converted.ok) {
    if (converted.code === "EXPIRED") {
      await unlockStock(db(), {lockId, reason: "expired"});
      throw new HttpsError(
        "deadline-exceeded",
        "Hold expired and rooms were unlocked. Start booking again.",
      );
    }
    throw new HttpsError("failed-precondition", converted.error);
  }

  const [hotel, pkg] = await Promise.all([
    loadHotel(db(), hotelId),
    loadPackage(db(), packageId, hotelId),
  ]);
  const pricing = getRoomPricing(pkg, hotel);
  const amountTHB = computeAmount(
    pricing.roomPrice,
    nightsList.length,
    rooms,
    pricing.extraBedPrice,
    extraBedCountRequested,
  );

  const bookingRef = db().collection(HOTEL_COLLECTION).doc();
  await db().collection("hotelLocks").doc(lockId).set(
    {bookingId: bookingRef.id},
    {merge: true},
  );

  const paymentMethod = stringValue(
    body.paymentMethod || body.paymentMethodIntent,
    40,
  );

  const doc = {
    ...buildBookingDoc({
      userId: uid,
      hotelId,
      packageId,
      packageName: pricing.roomName,
      hotelName: pricing.hotelName,
      checkIn,
      checkOut,
      rooms,
      nights: nightsList.length,
      adults,
      children,
      fullName: fullName || "Guest",
      guestEmail,
      guestPhone,
      amountTHB,
      roomPrice: pricing.roomPrice,
      extraBedCountRequested,
      extraBedPrice: pricing.extraBedPrice,
      accepted: true,
      stockLockId: lockId,
      notes,
    }),
    paymentMethod: paymentMethod || null,
    paymentMethodIntent: paymentMethod || null,
  };

  await bookingRef.set(doc);

  logger.info(`[completeHold] ${lockId} → booking ${bookingRef.id}`);

  return {
    success: true,
    ok: true,
    holdId: lockId,
    lockId,
    bookingId: bookingRef.id,
    autoBookingId: bookingRef.id,
    pendingBookingId: null,
    bookingCollection: HOTEL_COLLECTION,
    path: "auto",
    autoAccepted: true,
    inventoryReserved: true,
    stockLockId: lockId,
    payNow: true,
    roomsInstant: rooms,
    roomsPending: 0,
    amountTHB,
    amount: amountTHB,
    bookingStatus: "ACCEPTED",
  };
}

export const completeHotelBookingHold = onCall(callableOpts, async (request) => {
  const uid = assertAuth(request.auth as Auth | undefined);
  return runCompleteHotelBookingHold(uid, (request.data || {}) as Data);
});

/**
 * Admin/owner accept pending booking → lock kind book (all-or-nothing).
 *
 * Pending was created when free stock was short (or auto-book off). Confirming
 * availability means: raise night.total where needed so free covers the rooms,
 * then book. That automatically increases sellable rooms for those stay dates.
 */
export const acceptHotelBookingWithAvailability = onCall(
  callableOpts,
  async (request) => {
    const input = (request.data || {}) as Data;
    const bookingId = stringValue(input.bookingId, 120);
    if (!bookingId) {
      throw new HttpsError("invalid-argument", "bookingId is required.");
    }

    const snap = await db().collection(HOTEL_COLLECTION).doc(bookingId).get();
    if (!snap.exists) {
      throw new HttpsError("not-found", "Booking not found.");
    }
    const booking = snap.data() || {};
    const hotelId = stringValue(booking.hotelUid || booking.hotelId, 120);
    await assertAdminOrHotelOwner(request.auth as Auth | undefined, hotelId);

    const status = stringValue(booking.bookingStatus || booking.status, 40)
      .toUpperCase();
    if (["CANCELED", "CANCELLED", "REJECTED", "DENIED"].includes(status)) {
      throw new HttpsError("failed-precondition", "Cannot accept cancelled booking.");
    }

    const requestedRooms = parsePositiveInt(
      booking.roomsRequestedTotal || booking.rooms || booking.noOfRooms, 1,
    );
    const acceptedBefore = Math.max(0, Number(
      booking.acceptedRooms ?? booking.roomsInstant ??
      (booking.inventoryReserved === true && booking.isBookingConfirmed === true ?
        booking.rooms || booking.noOfRooms : 0),
    ) || 0);
    const targetRooms = input.acceptedRooms == null ? requestedRooms : Number(input.acceptedRooms);
    if (!Number.isInteger(targetRooms) || targetRooms < 1 || targetRooms > requestedRooms) {
      throw new HttpsError("invalid-argument", "acceptedRooms must be 1 to requested rooms.");
    }
    if (targetRooms <= acceptedBefore ||
      (booking.inventoryReserved === true && booking.stockLockId &&
        requestedRooms <= acceptedBefore)) {
      return {
        ok: true,
        alreadyAccepted: true,
        bookingId,
        inventoryReserved: true,
        stockLockId: booking.stockLockId,
        roomsInstant: acceptedBefore,
        roomsPending: Math.max(0, requestedRooms - acceptedBefore),
        amountTHB: booking.amountTHB,
        amountDue: booking.amountDue,
        extraBedCountRequested: booking.extraBedCountRequested,
        extraBedCount: booking.extraBedCount,
      };
    }

    let packageId = stringValue(booking.packageId || booking.roomId, 120);
    packageId = await resolvePackageId(
      hotelId,
      packageId,
      stringValue(booking.roomName || booking.packageName, 150),
    );
    const checkIn = toDateString(booking.checkInDate || booking.checkIn);
    const checkOut = toDateString(booking.checkOutDate || booking.checkOut);
    const rooms = targetRooms;
    const roomsToAccept = targetRooms - acceptedBefore;

    if (!hotelId || !packageId || !checkIn || !checkOut) {
      throw new HttpsError(
        "failed-precondition",
        "Booking missing hotel/package/dates.",
      );
    }

    // If already has hold lock, convert it (no expand — rooms already locked)
    const [hotel, pkg] = await Promise.all([
      loadHotel(db(), hotelId),
      loadPackage(db(), packageId, hotelId),
    ]);
    const pricing = getRoomPricing(pkg, hotel);
    const nights = listStayNights(checkIn, checkOut).length;
    if (!Number.isFinite(pricing.roomPrice) || pricing.roomPrice <= 0 ||
        !Number.isFinite(pricing.extraBedPrice) || pricing.extraBedPrice < 0 ||
        nights < 1) {
      throw new HttpsError("failed-precondition", "Hotel pricing or stay dates are invalid.");
    }
    let extraBedCountRequested: number;
    try {
      extraBedCountRequested = requestedExtraBedCount(booking, requestedRooms);
    } catch (error) {
      throw new HttpsError("failed-precondition", (error as Error).message);
    }
    const extraBedCount = Math.min(extraBedCountRequested, rooms);
    const amountTHB = hotelStayAmount(
      pricing.roomPrice, rooms, nights, pricing.extraBedPrice, extraBedCount,
    );
    const amountPaid = Math.max(0, Number(booking.amountPaid) || 0);
    const amountDue = Math.max(0, amountTHB - amountPaid);

    const existingLockId = acceptedBefore === 0 ?
      stringValue(booking.stockLockId || booking.holdId, 120) : "";
    let stockLockId: string | null = null;
    let expandedTotals:
      | Array<{
          date: string;
          totalBefore: number;
          totalAfter: number;
          freeBefore: number;
          added: number;
        }>
      | undefined;

    if (existingLockId) {
      const lockSnap = await db().collection("hotelLocks").doc(existingLockId).get();
      if (lockSnap.exists && String(lockSnap.data()?.status) === "active" &&
          Number(lockSnap.data()?.rooms) === roomsToAccept) {
        if (String(lockSnap.data()?.kind) === "hold") {
          const conv = await lockStock(db(), {
            action: "convert",
            lockId: existingLockId,
            bookingId,
          });
          if (!conv.ok) {
            throw new HttpsError("resource-exhausted", conv.error);
          }
          stockLockId = existingLockId;
        } else {
          stockLockId = existingLockId;
        }
      }
    }

    if (!stockLockId) {
      // Pure pending: confirm availability → expand total on short nights, then book
      const lock = await lockStock(db(), {
        action: "book",
        kind: "book",
        hotelId,
        packageId,
        checkIn,
        checkOut,
        rooms: roomsToAccept,
        bookingId,
        userId: stringValue(booking.userId || booking.authUid, 120) || null,
        expandTotalIfNeeded: true,
        force: true,
      });
      if (!lock.ok) {
        throw new HttpsError(
          "resource-exhausted",
          lock.error || "Could not reserve rooms for this accept.",
          {code: lock.code},
        );
      }
      stockLockId = lock.lockId;
      expandedTotals = lock.expandedTotals;
      await db().collection("hotelLocks").doc(stockLockId).set(
        {bookingId},
        {merge: true},
      );
    }

    const roomsAdded = (expandedTotals || []).reduce(
      (sum, e) => sum + (e.added || 0), 0,
    );
    const priorLockIds = Array.isArray(booking.stockLockIds) ?
      booking.stockLockIds.map((id: unknown) => stringValue(id, 120)).filter(Boolean) :
      (acceptedBefore > 0 && booking.stockLockId ? [stringValue(booking.stockLockId, 120)] : []);
    const stockLockIds = [...new Set([...priorLockIds, stockLockId])];
    await snap.ref.set(
      {
        bookingStatus: rooms < requestedRooms ? "PARTIALLY_ACCEPTED" : "ACCEPTED",
        status: rooms < requestedRooms ? "Partially Accepted" : "Accepted",
        isBookingConfirmed: true,
        inventoryReserved: true,
        inventoryReleased: false,
        stockLockId,
        stockLockIds,
        stockModel: "v2_numbers",
        acceptanceMethod:
          roomsAdded > 0 ? "MANUAL_STOCK_EXPAND_TOTAL" : "MANUAL_STOCK",
        stockExpandedOnAccept: roomsAdded > 0,
        stockExpandedTotals: expandedTotals || null,
        acceptedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        rooms: rooms,
        noOfRooms: rooms,
        roomsRequestedTotal: requestedRooms,
        acceptedRooms: rooms,
        roomsPending: requestedRooms - rooms,
        roomsInstant: rooms,
        extraBed: extraBedCountRequested > 0,
        extraBedCountRequested,
        extraBedCount,
        roomPrice: pricing.roomPrice,
        extraBedPrice: pricing.extraBedPrice,
        amountTHB,
        amount: amountTHB,
        totalAmount: amountTHB,
        amountDue,
        payNow: amountDue > 0,
        isPaymentDone: amountDue === 0 && booking.isPaymentDone === true,
        isPaymentClear: amountDue === 0 && booking.isPaymentClear === true,
        paymentVerificationStatus: amountDue > 0 ?
          "PENDING_VERIFICATION" :
          booking.paymentVerificationStatus || "VERIFIED",
        ...(amountDue > 0 ? {stripeSessionId: null, stripeChargeAmount: null} : {}),
      },
      {merge: true},
    );

    logger.info(
      `[acceptBooking] ${bookingId} lock=${stockLockId} expandedNights=${
        expandedTotals?.length || 0
      }`,
    );

    return {
      ok: true,
      bookingId,
      inventoryReserved: true,
      stockLockId,
      roomsInstant: rooms,
      roomsPending: requestedRooms - rooms,
      extraBedCountRequested,
      extraBedCount,
      amountTHB,
      amountDue,
      payNow: amountDue > 0,
      stockExpanded: roomsAdded > 0,
      expandedTotals: expandedTotals || [],
    };
  },
);

/** Admin preview stay using stock numbers. */
export const getHotelAvailability = onCall(callableOpts, async (request) => {
  await assertAdmin(request.auth as Auth | undefined);
  const input = (request.data || {}) as Data;
  const hotelId = stringValue(input.hotelId || input.hotelUid, 120);
  let packageId = stringValue(input.packageId || input.roomId, 120);
  packageId = await resolvePackageId(
    hotelId,
    packageId,
    stringValue(input.roomName, 150),
  );
  const result = await checkStock(db(), {
    hotelId,
    packageId,
    checkIn: input.checkIn || input.checkInDate,
    checkOut: input.checkOut || input.checkOutDate,
    rooms: parsePositiveInt(input.rooms, 1),
  });
  return {...result, audience: "admin"};
});

export const getHotelAvailabilityCalendar = onCall(
  callableOpts,
  async (request) => {
    await assertAdmin(request.auth as Auth | undefined);
    const input = (request.data || {}) as Data;
    const hotelId = stringValue(input.hotelId || input.hotelUid, 120);
    const packageId = stringValue(input.packageId || input.roomId, 120);
    const startDate = toDateString(input.startDate);
    const endDate = toDateString(input.endDate);
    if (!hotelId || !packageId || !startDate || !endDate) {
      throw new HttpsError(
        "invalid-argument",
        "hotelId, packageId, startDate, endDate required.",
      );
    }
    const {getStockCalendar} = await import("./utils/hotelStock");
    const cal = await getStockCalendar(db(), {
      hotelId,
      packageId,
      startDate,
      endDate,
    });
    // Shape for admin UI: map free/total/locked/booked
    return {
      ok: true,
      audience: "admin",
      hotelUid: hotelId,
      packageId,
      nights: cal.nights.map((n) => ({
        date: n.date,
        base: n.total,
        total: n.total,
        extra: 0,
        blocked: 0,
        held: n.locked,
        locked: n.locked,
        booked: n.booked,
        untracked: 0,
        reserved: n.locked + n.booked,
        remaining: n.free,
        free: n.free,
      })),
      availabilityConfig: cal.config,
      defaultTotal: cal.defaultTotal,
    };
  },
);

/**
 * Admin unlock / release inventory for a booking.
 */
export const releaseHotelInventory = onCall(callableOpts, async (request) => {
  await assertAdmin(request.auth as Auth | undefined);
  const input = (request.data || {}) as Data;
  const bookingId = stringValue(input.bookingId, 120);
  if (!bookingId) {
    throw new HttpsError("invalid-argument", "bookingId required.");
  }
  const snap = await db().collection(HOTEL_COLLECTION).doc(bookingId).get();
  if (!snap.exists) throw new HttpsError("not-found", "Booking not found.");
  const booking = snap.data() || {};

  const lockId = stringValue(booking.stockLockId || booking.holdId, 120);
  const lockIds = Array.isArray(booking.stockLockIds) ?
    booking.stockLockIds.map((id: unknown) => stringValue(id, 120)).filter(Boolean) :
    (lockId ? [lockId] : []);
  let result;
  if (lockIds.length > 0) {
    const results = await Promise.all(lockIds.map((id: string) =>
      unlockStock(db(), {lockId: id, reason: "released"}),
    ));
    result = results.find((item) => !item.ok) || results[0];
  } else {
    result = await unlockStock(db(), {
      force: true,
      hotelId: stringValue(booking.hotelUid || booking.hotelId, 120),
      packageId: stringValue(booking.packageId || booking.roomId, 120),
      checkIn: booking.checkInDate || booking.checkIn,
      checkOut: booking.checkOutDate || booking.checkOut,
      rooms: parsePositiveInt(booking.rooms || booking.noOfRooms, 1),
      target: "booked",
    });
  }

  if (result.ok) {
    await snap.ref.set(
      {
        inventoryReserved: false,
        inventoryReleased: true,
        inventoryReleasedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      {merge: true},
    );
  }

  return {
    ok: result.ok,
    audience: "admin",
    alreadyReleased: result.ok && "alreadyDone" in result ? result.alreadyDone : false,
    freedNights: result.ok ? result.nights : [],
    error: result.ok ? undefined : result.error,
  };
});

/** Admin force unlock — same as unlockHotelStock force. */
export const unlockHotelRoomLock = onCall(callableOpts, async (request) => {
  await assertAdmin(request.auth as Auth | undefined);
  const input = (request.data || {}) as Data;
  const lockId = stringValue(input.lockId || input.holdId, 120);
  if (lockId) {
    const result = await unlockStock(db(), {
      lockId,
      reason: input.force ? "force" : "released",
    });
    if (!result.ok) {
      throw new HttpsError("failed-precondition", result.error);
    }
    return result;
  }
  const result = await unlockStock(db(), {
    force: true,
    hotelId: stringValue(input.hotelId || input.hotelUid, 120),
    packageId: stringValue(input.packageId || input.roomId, 120),
    checkIn: input.checkIn || input.checkInDate,
    checkOut: input.checkOut || input.checkOutDate,
    rooms: parsePositiveInt(input.rooms, 1),
    target:
      (stringValue(input.target, 20) as "locked" | "booked" | "both") || "both",
  });
  if (!result.ok) {
    throw new HttpsError("failed-precondition", result.error);
  }
  return result;
});

