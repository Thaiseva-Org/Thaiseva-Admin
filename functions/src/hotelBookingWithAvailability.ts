/**
 * Public (website/app) + admin hotel booking paths with inventory.
 *
 * Pre-check: checkHotelAvailability — dates + rooms → how many instant vs pending
 * Soft lock (checkout):
 *   1) startHotelBookingHold — lock free rooms while guest fills form / pays
 *   2) completeHotelBookingHold — booking done → keep rooms booked + create booking
 *   3) releaseHotelBookingHold — left without booking → unlock
 *   + expireHotelBookingHolds — auto-unlock expired holds (TTL)
 * Create (direct, no hold):
 *   - all free + auto ON → reserve + Accepted → payNow
 *   - partial free → Accepted for free rooms + Pending for rest
 *   - none free / auto OFF → Pending only (still take guest info)
 * Manual accept: capacity required, then reserve.
 */
import * as admin from "firebase-admin";
import {HttpsError, onCall, onRequest} from "firebase-functions/v2/https";
import {onSchedule} from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";
import {
  evaluateAvailability,
  evaluateStayCapacity,
  reserveRoomsInTransaction,
  transferHeldRoomsToBookingInTransaction,
  releaseHoldRoomsInTransaction,
  bookingInventoryFields,
  loadHotel,
  loadPackage,
  resolvePackageIdByRoomName,
  getRoomPricing,
} from "./utils/hotelInventoryTx";
import {toDateString, listStayNights} from "./utils/hotelAvailability";

const REGION = "asia-east2";
const HOTEL_COLLECTION = "hotelBookingData";
const HOLD_COLLECTION = "hotelBookingHolds";
/** Soft lock duration while guest is in checkout (minutes). */
const HOLD_MINUTES = 10;

type Data = Record<string, unknown>;
type Auth = {uid: string; token?: Record<string, unknown>};

const db = () => admin.firestore();
const stringValue = (v: unknown, max = 500) =>
  String(v ?? "")
    .trim()
    .slice(0, max);

const parsePositiveInt = (v: unknown, fallback = 0) => {
  const n = Number.parseInt(String(v ?? ""), 10);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return n;
};

const parseBool = (v: unknown) =>
  v === true || v === "true" || v === 1 || v === "1";

const normalizeEmail = (v: unknown) => stringValue(v, 200).toLowerCase();

/** Origins allowed for browser callables + public HTTPS. */
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

/**
 * Callable opts for Firebase SDK (httpsCallable).
 * cors: true + invoker public so browser OPTIONS preflight gets CORS headers
 * (Firebase Auth is still enforced inside via request.auth + assertAdmin).
 * After deploy, ensure Cloud Run allows unauthenticated: allUsers as run.invoker.
 */
const callableOpts = {
  region: REGION,
  cors: true as const,
  invoker: "public" as const,
};

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

/** Simple per-instance rate limit for public check (best-effort across instances). */
const CHECK_RATE_WINDOW_MS = 60_000;
const CHECK_RATE_MAX = 40;
const checkRateBuckets = new Map<string, {count: number; resetAt: number}>();

const clientIp = (req: {headers: Record<string, unknown>; ip?: string}) => {
  const xf = stringValue(req.headers["x-forwarded-for"] || req.headers["X-Forwarded-For"]);
  if (xf) return xf.split(",")[0].trim().slice(0, 80);
  return stringValue(req.ip || "unknown", 80) || "unknown";
};

const allowCheckRate = (ip: string) => {
  const now = Date.now();
  const cur = checkRateBuckets.get(ip);
  if (!cur || now >= cur.resetAt) {
    checkRateBuckets.set(ip, {count: 1, resetAt: now + CHECK_RATE_WINDOW_MS});
    // Prevent unbounded map growth
    if (checkRateBuckets.size > 5000) {
      for (const [k, v] of checkRateBuckets) {
        if (now >= v.resetAt) checkRateBuckets.delete(k);
      }
    }
    return true;
  }
  if (cur.count >= CHECK_RATE_MAX) return false;
  cur.count += 1;
  return true;
};

/** Max concurrent non-expired holds per user (anti-hoarding). */
const MAX_ACTIVE_HOLDS_PER_USER = 3;

/**
 * Shared pre-check used by public HTTPS checkHotelAvailability.
 */
const runAvailabilityCheck = async (body: Data) => {
  const hotelUid = stringValue(body.hotelId || body.hotelUid, 120);
  let packageId = stringValue(body.packageId || body.roomId, 120);
  const roomNameHint = stringValue(body.roomName, 150);
  const checkInStr = toDateString(body.checkInDate || body.checkIn);
  const checkOutStr = toDateString(body.checkOutDate || body.checkOut);
  const roomsRequested = Math.max(1, parsePositiveInt(body.rooms, 1));

  if (!hotelUid || !checkInStr || !checkOutStr) {
    const err = new Error("hotelId, checkIn, and checkOut are required.") as Error & {
      statusCode?: number;
    };
    err.statusCode = 400;
    throw err;
  }

  packageId = await resolvePackageId(hotelUid, packageId, roomNameHint);
  if (!packageId) {
    const err = new Error(
      "Room type is required (packageId or roomName).",
    ) as Error & {statusCode?: number; reasonCode?: string};
    err.statusCode = 400;
    err.reasonCode = "ROOM_TYPE_MISSING";
    throw err;
  }

  const capacity = await evaluateStayCapacity(db(), {
    hotelUid,
    packageId,
    checkIn: checkInStr,
    checkOut: checkOutStr,
    roomsRequested,
  });

  const messaging = buildAvailabilityMessage(capacity);

  return {
    success: true,
    hotelUid,
    packageId,
    packageName: capacity.packageName,
    checkIn: checkInStr,
    checkOut: checkOutStr,
    roomsRequested,
    physicalRemaining: capacity.physicalRemaining,
    maxInstantRooms: capacity.maxInstantRooms,
    roomsInstant: messaging.roomsInstant,
    roomsPending: messaging.roomsPending,
    autoBookingEnabled: capacity.autoBookingEnabled,
    bookableWindowOk: capacity.bookableWindowOk,
    nights: capacity.nights,
    reasonCode: capacity.reasonCode,
    reason: capacity.reason,
    messaging,
  };
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
  if (role === "admin" || role === "sub admin") {
    return;
  }
  throw new HttpsError("permission-denied", "Admin access only.");
};

/** Admin or the hotel partner who owns this booking's hotel. */
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
  const hid = stringValue(hotelUid, 120);
  if (hid && auth.uid === hid) {
    return;
  }
  throw new HttpsError(
    "permission-denied",
    "Only admin or the hotel partner can accept this booking.",
  );
};

/** Enforce room guest limits when maxAdults/maxChildren are configured. */
const assertGuestCapacity = (
  pkg: Record<string, unknown> | null | undefined,
  adults: number,
  children: number,
  extraBedRequested: boolean,
) => {
  if (!pkg) return;
  const maxAdults = Number(pkg.maxAdults);
  const maxChildren = Number(pkg.maxChildren);
  const policies = (pkg.policies || {}) as Record<string, unknown>;
  const extraAdults = Number(
    policies.extraBedMaxAdults ?? pkg.extraBedMaxAdults ?? 0,
  );
  const extraChildren = Number(
    policies.extraBedMaxChildren ?? pkg.extraBedMaxChildren ?? 0,
  );
  const allowExtra =
    pkg.allowExtraBed === true ||
    pkg.hasExtraBed === true ||
    policies.extraBed === "Available" ||
    policies.extraBed === true;

  let adultCap = Number.isFinite(maxAdults) && maxAdults > 0 ? maxAdults : null;
  let childCap =
    Number.isFinite(maxChildren) && maxChildren >= 0 ? maxChildren : null;

  if (extraBedRequested && allowExtra) {
    if (adultCap != null) adultCap += Math.max(0, extraAdults || 1);
    if (childCap != null) childCap += Math.max(0, extraChildren || 0);
  }

  if (adultCap != null && adults > adultCap) {
    throw new HttpsError(
      "invalid-argument",
      `This room allows at most ${adultCap} adult(s).`,
      {pendingReasonCode: "GUEST_CAPACITY"},
    );
  }
  if (childCap != null && children > childCap) {
    throw new HttpsError(
      "invalid-argument",
      `This room allows at most ${childCap} child(ren).`,
      {pendingReasonCode: "GUEST_CAPACITY"},
    );
  }
};

/**
 * Stable booking id. Includes checkOut so different stay lengths do not collide.
 * Legacy ids (no checkOut) are still checked for idempotency at create time.
 */
const buildManualDocId = (
  userId: string,
  hotelId: string,
  checkIn: string,
  roomKey: string,
  suffix = "",
  checkOut = "",
) => {
  const core = checkOut ?
    `hotel_${userId}_${hotelId}_${checkIn}_${checkOut}_${roomKey}` :
    `hotel_${userId}_${hotelId}_${checkIn}_${roomKey}`;
  return `${core}${suffix ? `_${suffix}` : ""}`
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 120);
};

const bookingDocIds = (
  userId: string,
  hotelId: string,
  checkIn: string,
  checkOut: string,
  roomKey: string,
  suffix = "",
) => {
  const primary = buildManualDocId(
    userId,
    hotelId,
    checkIn,
    roomKey,
    suffix,
    checkOut,
  );
  // Legacy (pre checkOut-in-id) for duplicate detection only
  const legacy = buildManualDocId(
    userId,
    hotelId,
    checkIn,
    roomKey,
    suffix,
    "",
  );
  return {primary, legacy};
};

const computeNightsCount = (checkIn: string, checkOut: string) =>
  listStayNights(checkIn, checkOut).length;

const resolvePackageId = async (
  hotelUid: string,
  packageIdRaw: string,
  roomName: string,
): Promise<string> => {
  if (packageIdRaw) {
    const pkg = await loadPackage(db(), packageIdRaw, hotelUid);
    if (pkg) return pkg.id;
  }
  if (roomName) {
    const byName = await resolvePackageIdByRoomName(db(), hotelUid, roomName);
    if (byName) return byName;
  }
  return packageIdRaw || "";
};

/** Human-readable availability message for website UI. */
const buildAvailabilityMessage = (cap: {
  roomsRequested: number;
  maxInstantRooms: number;
  physicalRemaining: number;
  autoBookingEnabled: boolean;
  reasonCode: string | null;
  reason: string | null;
}) => {
  const req = cap.roomsRequested;
  const instant = Math.min(cap.maxInstantRooms, req);
  const pending = Math.max(0, req - instant);

  if (!cap.autoBookingEnabled) {
    return {
      kind: "manual_only" as const,
      title: "Confirmation required",
      message:
        "This hotel reviews every request. Submit your details and we will confirm with the hotel and get back to you.",
      roomsInstant: 0,
      roomsPending: req,
      canProceed: true,
    };
  }

  if (cap.reasonCode === "OUTSIDE_BOOKABLE_WINDOW") {
    return {
      kind: "window" as const,
      title: "Dates not open for booking",
      message:
        cap.reason ||
        "These dates are outside the hotel bookable window. You can still send a request for review.",
      roomsInstant: 0,
      roomsPending: req,
      canProceed: true,
    };
  }

  if (instant >= req && instant > 0) {
    return {
      kind: "full_instant" as const,
      title: `${req} room${req > 1 ? "s" : ""} available`,
      message: `Good news — ${req} room${req > 1 ? "s are" : " is"} free for your dates and can be confirmed instantly. Complete guest details and pay to lock ${req > 1 ? "them" : "it"} in.`,
      roomsInstant: req,
      roomsPending: 0,
      canProceed: true,
    };
  }

  if (instant > 0 && pending > 0) {
    return {
      kind: "partial" as const,
      title: `${instant} of ${req} rooms available now`,
      message: `${instant} room${instant > 1 ? "s" : ""} can be confirmed instantly. The remaining ${pending} room${pending > 1 ? "s" : ""} will stay pending while we confirm with the hotel and come back to you.`,
      roomsInstant: instant,
      roomsPending: pending,
      canProceed: true,
    };
  }

  // No instant rooms
  return {
    kind: "none_instant" as const,
    title: "No rooms free for instant booking",
    message:
      "No rooms are free for instant confirmation on these dates. You can still submit your details — we will confirm with the hotel and come back to you.",
    roomsInstant: 0,
    roomsPending: req,
    canProceed: true,
  };
};

const amountForRooms = (
  roomPrice: number,
  nights: number,
  roomCount: number,
  extraBed: boolean,
  extraBedPrice: number,
  allowExtraBed: boolean,
) => {
  const base = Math.round(roomPrice * nights * roomCount);
  const extra =
    extraBed && allowExtraBed ?
      Math.round(extraBedPrice * nights * roomCount) :
      0;
  return base + extra;
};

/**
 * Public pre-check (no auth): dates + room count → instant vs pending messaging.
 *
 * HTTPS (onRequest) so website can use plain fetch/POST with CORS.
 * Do NOT use httpsCallable for this endpoint — use fetch to the function URL.
 *
 * POST/GET body or query: hotelId, packageId|roomId|roomName, checkIn, checkOut, rooms
 */
export const checkHotelAvailability = onRequest(
  {
    region: REGION,
    cors: false, // manual CORS below (reliable for preflight + localhost)
    invoker: "public",
  },
  async (req, res) => {
    applyWebsiteCors(req as never, res as never);

    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }

    if (req.method !== "POST" && req.method !== "GET") {
      res.status(405).json({error: "Method Not Allowed"});
      return;
    }

    const ip = clientIp(req as never);
    if (!allowCheckRate(ip)) {
      res.set("Retry-After", "60");
      res.status(429).json({
        error: "Too many availability checks. Please wait a moment.",
        reasonCode: "RATE_LIMITED",
      });
      return;
    }

    try {
      // Support plain JSON body, Firebase callable envelope { data: {...} }, and query
      const raw =
        req.method === "GET" ?
          (req.query as Data) :
          ((req.body || {}) as Data);
      const body = (
        raw && typeof raw === "object" && raw.data && typeof raw.data === "object" ?
          (raw.data as Data) :
          raw
      ) as Data;

      const result = await runAvailabilityCheck(body);
      res.status(200).json(result);
    } catch (error) {
      const err = error as {
        statusCode?: number;
        message?: string;
        reasonCode?: string;
      };
      if (err.statusCode && err.statusCode < 500) {
        res.status(err.statusCode).json({
          error: err.message || "Bad request",
          reasonCode: err.reasonCode || null,
        });
        return;
      }
      logger.error("[HotelBooking] check failed", error);
      res.status(500).json({error: "Availability check failed."});
    }
  },
);

/**
 * Shared create core (callable + HTTPS createHotelBooking).
 */
export async function runCreateHotelBookingWithAvailability(
  authUid: string,
  body: Data,
): Promise<Record<string, unknown>> {
  try {
      const userId = stringValue(body.userId, 128) || authUid;
      if (userId !== authUid) {
        throw new HttpsError("permission-denied", "User mismatch.");
      }

      const hotelUid = stringValue(body.hotelId || body.hotelUid, 120);
      let packageId = stringValue(body.packageId || body.roomId, 120);
      const roomNameHint = stringValue(body.roomName, 150);
      const checkInStr = toDateString(body.checkInDate || body.checkIn);
      const checkOutStr = toDateString(body.checkOutDate || body.checkOut);
      const rooms = Math.max(1, parsePositiveInt(body.rooms, 1));
      const adults = Math.max(1, parsePositiveInt(body.adults, 1));
      const children = Math.max(0, parsePositiveInt(body.children, 0));
      const extraBedRequested = parseBool(body.extraBed);
      const paymentMethodIntent =
        stringValue(body.paymentMethod || body.paymentMethodIntent, 40).toUpperCase() ||
        "STRIPE";

      if (!hotelUid || !checkInStr || !checkOutStr) {
        throw new HttpsError(
          "invalid-argument",
          "Hotel and stay dates are required.",
          {pendingReasonCode: "DATES_INCOMPLETE"},
        );
      }

      packageId = await resolvePackageId(hotelUid, packageId, roomNameHint);
      if (!packageId) {
        throw new HttpsError(
          "invalid-argument",
          "Room type is required.",
          {pendingReasonCode: "ROOM_TYPE_MISSING"},
        );
      }

      const nightsCount = computeNightsCount(checkInStr, checkOutStr);
      if (nightsCount < 1) {
        throw new HttpsError(
          "invalid-argument",
          "Check-out must be after check-in.",
          {pendingReasonCode: "DATES_INCOMPLETE"},
        );
      }

      const [hotel, pkg] = await Promise.all([
        loadHotel(db(), hotelUid),
        loadPackage(db(), packageId, hotelUid),
      ]);

      if (!hotel) {
        throw new HttpsError("not-found", "Hotel not found.");
      }
      if (!pkg) {
        throw new HttpsError(
          "invalid-argument",
          "Room type was not found.",
          {pendingReasonCode: "ROOM_TYPE_MISSING"},
        );
      }

      assertGuestCapacity(pkg, adults, children, extraBedRequested);

      const pricing = getRoomPricing(pkg, hotel);
      if (!pricing.roomPrice || pricing.roomPrice <= 0) {
        throw new HttpsError(
          "failed-precondition",
          "Room pricing is not available. Please contact support.",
        );
      }

      const capacity = await evaluateStayCapacity(db(), {
        hotelUid,
        packageId,
        checkIn: checkInStr,
        checkOut: checkOutStr,
        roomsRequested: rooms,
      });
      const messaging = buildAvailabilityMessage(capacity);
      let roomsInstant = messaging.roomsInstant;
      let roomsPending = messaging.roomsPending;

      const guestEmail = normalizeEmail(body.guestEmail || body.email);
      const guestPhone = stringValue(body.guestPhone || body.phone, 40);
      const fullName = stringValue(body.fullName, 120);
      const groupId = `grp_${userId}_${hotelUid}_${checkInStr}_${packageId}`
        .replace(/[^a-zA-Z0-9_-]/g, "_")
        .slice(0, 100);

      const paymentMethod = paymentMethodIntent.includes("QR") ?
        "THAI_QR" :
        paymentMethodIntent === "OFFLINE" ?
          "OFFLINE" :
          "STRIPE";
      const modeOfPayment =
        paymentMethod === "THAI_QR" || paymentMethod === "STRIPE" ?
          "ONLINE" :
          "OFFLINE";

      const buildBase = (roomCount: number): Record<string, unknown> => ({
        fullName,
        guestEmail,
        guestPhone,
        userEmail: guestEmail,
        userPhone: guestPhone,
        nationality: stringValue(body.nationality, 20) || "OTHER",
        specialRequests: stringValue(body.specialRequests, 500),
        estimatedArrivalTime:
          stringValue(body.estimatedArrivalTime, 20) || "UNKNOWN",
        bedPreference: stringValue(body.bedPreference, 20) || "NO_PREF",
        hotelUid,
        hotelId: hotelUid,
        hotelName: pricing.hotelName,
        roomName: pricing.roomName || roomNameHint,
        packageId,
        roomId: packageId,
        checkInDate: checkInStr,
        checkOutDate: checkOutStr,
        checkIn: checkInStr,
        checkOut: checkOutStr,
        nights: nightsCount,
        rooms: roomCount,
        noOfRooms: roomCount,
        adults,
        children,
        amountTHB: amountForRooms(
          pricing.roomPrice,
          nightsCount,
          roomCount,
          extraBedRequested,
          pricing.extraBedPrice,
          pricing.allowExtraBed,
        ),
        subtotal: amountForRooms(
          pricing.roomPrice,
          nightsCount,
          roomCount,
          extraBedRequested,
          pricing.extraBedPrice,
          pricing.allowExtraBed,
        ),
        vat: 0,
        needsAirportPickup: parseBool(body.needsAirportPickup),
        extraBed: extraBedRequested && pricing.allowExtraBed,
        currency: "THB",
        paymentMethod,
        modeOfPayment,
        isPaymentDone: false,
        paymentVerificationStatus: "PENDING_VERIFICATION",
        paymentVerificationNote: "",
        customerQrPaymentConfirmed: false,
        stripeSessionId: null,
        userId,
        authUid: userId,
        source: "WEB",
        bookingGroupId: groupId,
        roomsRequestedTotal: rooms,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Idempotency: if primary (or legacy) doc exists for this exact stay, return it
      const fullIds = bookingDocIds(
        userId,
        hotelUid,
        checkInStr,
        checkOutStr,
        packageId,
      );
      const autoIds = bookingDocIds(
        userId,
        hotelUid,
        checkInStr,
        checkOutStr,
        packageId,
        "auto",
      );
      const pendIds = bookingDocIds(
        userId,
        hotelUid,
        checkInStr,
        checkOutStr,
        packageId,
        "pend",
      );
      const fullId = fullIds.primary;
      const autoId = autoIds.primary;
      const pendId = pendIds.primary;

      const loadFirstExisting = async (ids: string[]) => {
        for (const id of ids) {
          const snap = await db().collection(HOTEL_COLLECTION).doc(id).get();
          if (snap.exists) return snap;
        }
        return null;
      };

      // Prefer exact stay match (includes checkOut). Only treat as duplicate when
      // checkout matches — legacy ids may belong to a different length of stay.
      const existingFull = await loadFirstExisting([fullIds.primary]);
      const existingAuto = await loadFirstExisting([autoIds.primary]);
      const existingPend = await loadFirstExisting([pendIds.primary]);

      // Legacy fallback only when same checkOut is stored on the doc
      const legacyFull =
        !existingFull ?
          await loadFirstExisting([fullIds.legacy]) :
          null;
      const legacyAuto =
        !existingAuto ?
          await loadFirstExisting([autoIds.legacy]) :
          null;
      const legacyPend =
        !existingPend ?
          await loadFirstExisting([pendIds.legacy]) :
          null;

      const sameStay = (
        snap: admin.firestore.DocumentSnapshot | null,
      ) => {
        if (!snap?.exists) return false;
        const d = snap.data() || {};
        const out = toDateString(d.checkOutDate || d.checkOut);
        return !out || out === checkOutStr;
      };

      const resolvedFull =
        existingFull || (sameStay(legacyFull) ? legacyFull : null);
      const resolvedAuto =
        existingAuto || (sameStay(legacyAuto) ? legacyAuto : null);
      const resolvedPend =
        existingPend || (sameStay(legacyPend) ? legacyPend : null);

      if (resolvedFull || resolvedAuto || resolvedPend) {
        const autoSnap = resolvedAuto ?
          resolvedAuto :
          (resolvedFull &&
            (resolvedFull.data()?.autoAccepted === true ||
              resolvedFull.data()?.inventoryReserved === true) ?
            resolvedFull :
            null);
        const pendSnap = resolvedPend ?
          resolvedPend :
          (resolvedFull && !autoSnap ? resolvedFull : null);
        const prevAuto = autoSnap?.data() || null;
        const prevPend = pendSnap?.data() || null;
        const alreadyAuto = Boolean(
          prevAuto &&
            (prevAuto.inventoryReserved === true || prevAuto.autoAccepted === true),
        );
        const pathDup =
          alreadyAuto && prevPend ? "partial" :
            alreadyAuto ? "auto" :
              "pending";
        const primary =
          autoSnap?.id || pendSnap?.id || resolvedFull?.id || fullId;
        return {
          success: true,
          bookingId: primary,
          autoBookingId: autoSnap?.id || null,
          pendingBookingId: pendSnap?.id || null,
          bookingCollection: HOTEL_COLLECTION,
          duplicate: true,
          path: pathDup,
          payNow: alreadyAuto && prevAuto?.isPaymentDone !== true,
          autoAccepted: alreadyAuto,
          roomsInstant: alreadyAuto ? Number(prevAuto?.rooms) || 0 : 0,
          roomsPending: prevPend ? Number(prevPend.rooms) || 0 : 0,
          messaging: {
            ...messaging,
            roomsInstant: alreadyAuto ? Number(prevAuto?.rooms) || 0 : 0,
            roomsPending: prevPend ? Number(prevPend.rooms) || 0 : 0,
          },
        };
      }

      let autoBookingId: string | null = null;
      let pendingBookingId: string | null = null;
      let payNow = false;
      let path: "auto" | "pending" | "partial" = "pending";

      // --- Instant portion ---
      if (roomsInstant > 0) {
        const useId = roomsPending > 0 ? autoId : fullId;
        const acceptedBookingData = {
          ...buildBase(roomsInstant),
          bookingStatus: "ACCEPTED",
          status: "Accepted",
          isBookingConfirmed: true,
          autoAccepted: true,
          acceptanceMethod: "AUTO",
          inventoryReserved: true,
          inventoryReservedAt:
            admin.firestore.FieldValue.serverTimestamp(),
          inventoryReleased: false,
          sourcePath: roomsPending > 0 ? "auto_partial" : "auto",
          pendingReasonCode: null,
          pendingReason: null,
          roomsInstant,
          roomsPending,
          acceptanceNotifiedAt:
            admin.firestore.FieldValue.serverTimestamp(),
          siblingPendingBookingId: roomsPending > 0 ? pendId : null,
        };
        const reserve = await reserveRoomsInTransaction(db(), {
          hotelUid,
          packageId,
          checkIn: checkInStr,
          checkOut: checkOutStr,
          rooms: roomsInstant,
          bookingId: useId,
          allocationId: useId,
          reservationKind: "booking",
          owner: {
            collection: HOTEL_COLLECTION,
            docId: useId,
            data: acceptedBookingData,
          },
        });

        if (!reserve.ok) {
          // Race: demote all to pending
          logger.warn(
            `[HotelBooking] reserve failed ${useId}: ${reserve.reason}`,
          );
          roomsInstant = 0;
          roomsPending = rooms;
        } else {
          await db()
            .collection(HOTEL_COLLECTION)
            .doc(useId)
            .set(acceptedBookingData, {merge: true});
          autoBookingId = useId;
          payNow = true;
          path = roomsPending > 0 ? "partial" : "auto";
        }
      }

      // --- Pending portion ---
      if (roomsPending > 0) {
        // If we demoted after failed reserve and autoBookingId null, use fullId
        const finalPendId = autoBookingId ? pendId : fullId;

        const pendingReason =
          path === "partial" || (autoBookingId && roomsPending > 0) ?
            `${roomsPending} room${roomsPending > 1 ? "s" : ""} could not be confirmed instantly. We will confirm with the hotel and come back to you.` :
            messaging.message;

        await db()
          .collection(HOTEL_COLLECTION)
          .doc(finalPendId)
          .set({
            ...buildBase(roomsPending),
            bookingStatus: "PENDING",
            status: "Pending",
            isBookingConfirmed: false,
            autoAccepted: false,
            acceptanceMethod: null,
            inventoryReserved: false,
            sourcePath: autoBookingId ? "pending_partial" : "pending",
            pendingReasonCode:
              capacity.reasonCode ||
              (autoBookingId ? "PARTIAL_CAPACITY" : "ROOMS_FULL"),
            pendingReason,
            roomsInstant: autoBookingId ? roomsInstant : 0,
            roomsPending,
            siblingAutoBookingId: autoBookingId,
          });
        pendingBookingId = finalPendId;
        if (!autoBookingId) path = "pending";
      }

      logger.info(
        `[HotelBooking] path=${path} auto=${autoBookingId} pend=${pendingBookingId} instant=${roomsInstant} pending=${roomsPending}`,
      );

      const primaryBookingId = autoBookingId || pendingBookingId || fullId;
      const amountTHB = amountForRooms(
        pricing.roomPrice,
        nightsCount,
        roomsInstant > 0 ? roomsInstant : roomsPending,
        extraBedRequested,
        pricing.extraBedPrice,
        pricing.allowExtraBed,
      );

      return {
        success: true,
        bookingId: primaryBookingId,
        autoBookingId,
        pendingBookingId,
        bookingCollection: HOTEL_COLLECTION,
        path,
        payNow,
        autoAccepted: Boolean(autoBookingId),
        roomsRequested: rooms,
        roomsInstant: autoBookingId ? roomsInstant : 0,
        roomsPending: pendingBookingId ? roomsPending : 0,
        amountTHB: autoBookingId ?
          amountForRooms(
            pricing.roomPrice,
            nightsCount,
            roomsInstant,
            extraBedRequested,
            pricing.extraBedPrice,
            pricing.allowExtraBed,
          ) :
          amountTHB,
        pendingReasonCode: pendingBookingId ?
          capacity.reasonCode || "PARTIAL_CAPACITY" :
          null,
        pendingReason: pendingBookingId ? messaging.message : null,
        messaging: {
          ...messaging,
          roomsInstant: autoBookingId ? roomsInstant : 0,
          roomsPending: pendingBookingId ? roomsPending : 0,
        },
        status: autoBookingId ? "Accepted" : "Pending",
        bookingStatus: autoBookingId ? "ACCEPTED" : "PENDING",
      };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    logger.error("[HotelBooking] create failed", error);
    throw new HttpsError("internal", "Internal server error");
  }
}

/**
 * Customer website/app entry: create hotel booking(s) with availability decision.
 * Requires signed-in Firebase Auth (callable passes request.auth).
 */
export const createHotelBookingWithAvailability = onCall(
  callableOpts,
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Authentication is required.");
    }
    return runCreateHotelBookingWithAvailability(
      request.auth.uid,
      (request.data || {}) as Data,
    );
  },
);

/**
 * Admin: accept pending room request (full pending or remaining partial rooms).
 *
 * Partial flow (website "partially confirmed"):
 * - Instant rooms live on auto sibling (already reserved / maybe paid)
 * - Pending rooms live on pending sibling (or roomsPending on same doc)
 * On accept: reserve inventory for newly accepted rooms, recalculate amountTHB,
 * clear roomsPending, set amountDue when guest already paid for instant rooms.
 */
export const acceptHotelBookingWithAvailability = onCall(
  callableOpts,
  async (request) => {
    const input = (request.data || {}) as Data;
    let bookingId = stringValue(input.bookingId, 120);
    if (!bookingId) {
      throw new HttpsError("invalid-argument", "bookingId is required.");
    }

    let snap = await db().collection(HOTEL_COLLECTION).doc(bookingId).get();
    if (!snap.exists) {
      throw new HttpsError("not-found", "Booking not found.");
    }

    let booking = snap.data() || {};
    const hotelUidEarly = stringValue(
      booking.hotelUid || booking.hotelId,
      120,
    );
    await assertAdminOrHotelOwner(
      request.auth as Auth | undefined,
      hotelUidEarly,
    );

    // If admin acts on the already-accepted partial parent, resolve sibling pending
    const statusUpperEarly = stringValue(
      booking.bookingStatus || booking.status,
      60,
    )
      .toUpperCase()
      .replace(/-/g, "_")
      .replace(/\s+/g, "_");
    const roomsPendingEarly = Math.max(
      0,
      parsePositiveInt(booking.roomsPending, 0),
    );
    const siblingPendId = stringValue(booking.siblingPendingBookingId, 120);
    if (
      siblingPendId &&
      roomsPendingEarly > 0 &&
      (statusUpperEarly === "ACCEPTED" ||
        statusUpperEarly === "CONFIRMED" ||
        statusUpperEarly.includes("ACCEPT") ||
        booking.isBookingConfirmed === true ||
        booking.inventoryReserved === true)
    ) {
      const pendSnap = await db()
        .collection(HOTEL_COLLECTION)
        .doc(siblingPendId)
        .get();
      if (pendSnap.exists) {
        const pendStatus = stringValue(
          pendSnap.data()?.bookingStatus || pendSnap.data()?.status,
          40,
        ).toUpperCase();
        if (
          pendStatus !== "CANCELED" &&
          pendStatus !== "CANCELLED" &&
          pendStatus !== "REJECTED" &&
          pendSnap.data()?.isBookingConfirmed !== true
        ) {
          snap = pendSnap;
          booking = pendSnap.data() || {};
          bookingId = pendSnap.id;
        }
      }
    }

    const statusUpper = stringValue(
      booking.bookingStatus || booking.status,
      60,
    )
      .toUpperCase()
      .replace(/-/g, "_")
      .replace(/\s+/g, "_");

    if (
      statusUpper === "CANCELED" ||
      statusUpper === "CANCELLED" ||
      statusUpper === "REJECTED"
    ) {
      throw new HttpsError(
        "failed-precondition",
        "Cannot accept a cancelled booking.",
      );
    }

    const roomsPending = Math.max(0, parsePositiveInt(booking.roomsPending, 0));
    const roomsOnDoc = Math.max(
      1,
      parsePositiveInt(booking.rooms || booking.noOfRooms, 1),
    );
    // Instant / already-held portion on this same document (hold → partial)
    const roomsInstantExisting = Math.max(
      0,
      parsePositiveInt(booking.roomsInstant, 0) ||
        parsePositiveInt(booking.acceptedRooms, 0),
    );

    // Same-doc partial: e.g. 5 confirmed + 1 pending on one booking
    const isSameDocPartial = roomsPending > 0 && roomsInstantExisting > 0;

    // Instant rooms already counted in night ledger (hold transfer / prior reserve)
    const instantAlreadyHeld =
      booking.inventoryReserved === true ||
      isSameDocPartial ||
      (roomsInstantExisting > 0 &&
        Boolean(booking.holdId || booking.holdDeletedAfterPayment === true));

    // Already fully accepted (no remaining pending rooms)
    if (
      roomsPending === 0 &&
      (booking.inventoryReserved === true || booking.isBookingConfirmed === true) &&
      (statusUpper === "ACCEPTED" ||
        statusUpper === "CONFIRMED" ||
        statusUpper === "AWAITING_PAYMENT" ||
        booking.isBookingConfirmed === true)
    ) {
      return {
        ok: true,
        alreadyAccepted: true,
        bookingId,
        inventoryReserved: true,
        roomsInstant: roomsInstantExisting || roomsOnDoc,
        roomsPending: 0,
      };
    }

    // Rooms to newly lock: pending remainder, or full doc for pure pending
    const roomsToAccept =
      roomsPending > 0 ?
        roomsPending :
        instantAlreadyHeld && booking.isBookingConfirmed === true ?
          0 :
          roomsOnDoc;

    if (roomsToAccept <= 0) {
      return {
        ok: true,
        alreadyAccepted: true,
        bookingId,
        inventoryReserved: booking.inventoryReserved === true,
        roomsInstant: roomsInstantExisting || roomsOnDoc,
        roomsPending: 0,
      };
    }

    // After accept: all instant + newly confirmed pending
    const totalAcceptedRooms =
      roomsPending > 0 ?
        Math.max(roomsOnDoc, roomsInstantExisting + roomsPending) :
        roomsToAccept;

    const hotelUid = hotelUidEarly;
    let packageId = stringValue(booking.packageId || booking.roomId, 120);
    const roomName = stringValue(
      booking.roomName || booking.packageName,
      150,
    );
    const checkIn = booking.checkInDate || booking.checkIn;
    const checkOut = booking.checkOutDate || booking.checkOut;

    if (!hotelUid) {
      throw new HttpsError("failed-precondition", "Booking has no hotel.");
    }

    packageId = await resolvePackageId(hotelUid, packageId, roomName);
    if (!packageId) {
      throw new HttpsError(
        "failed-precondition",
        "Room type is missing on this booking. Set packageId/roomId before accepting.",
      );
    }

    // Soft capacity check for messaging only — admin confirm may add extra capacity
    const availability = await evaluateAvailability(db(), {
      hotelUid,
      packageId,
      checkIn,
      checkOut,
      rooms: roomsToAccept,
      forManualAccept: true,
    });

    // Reserve newly confirmed rooms on each stay night.
    // allowAdminExtra: if physical total is full (e.g. 5/5) but admin confirms
    // the pending room, add temporary capacity (extra) then reserve +N.
    const reserveBookingId =
      isSameDocPartial || instantAlreadyHeld ?
        `${bookingId}_pending_accept` :
        bookingId;

    const reserve = await reserveRoomsInTransaction(db(), {
      hotelUid,
      packageId,
      checkIn,
      checkOut,
      rooms: roomsToAccept,
      bookingId: reserveBookingId,
      allocationId: reserveBookingId,
      reservationKind: "booking",
      allowAdminExtra: true,
      owner: {
        collection: HOTEL_COLLECTION,
        docId: bookingId,
        data: {
          inventoryReserved: true,
          inventoryReleased: false,
          inventoryReservationPendingFinalize: true,
          inventoryAllocationId: reserveBookingId,
          inventoryReservedAt:
            admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
      },
    });
    if (!reserve.ok) {
      throw new HttpsError(
        "failed-precondition",
        reserve.reason || "Could not reserve rooms for these dates.",
      );
    }
    const reservedOk = true;

    const [hotel, pkg] = await Promise.all([
      loadHotel(db(), hotelUid),
      loadPackage(db(), packageId, hotelUid),
    ]);
    const pricing = getRoomPricing(pkg, hotel);
    const checkInStr = toDateString(checkIn) || "";
    const checkOutStr = toDateString(checkOut) || "";
    const nightsCount =
      parsePositiveInt(booking.nights, 0) ||
      (checkInStr && checkOutStr ?
        computeNightsCount(checkInStr, checkOutStr) :
        0) ||
      1;
    const extraBedRequested = booking.extraBed === true;

    // Prefer live room price; fall back to amount already stored on the pending doc
    // so accept never zeros out amountDue and incorrectly marks paid.
    const computedAccepted = amountForRooms(
      pricing.roomPrice || 0,
      nightsCount,
      totalAcceptedRooms,
      extraBedRequested,
      pricing.extraBedPrice || 0,
      pricing.allowExtraBed === true,
    );
    const computedNewOnly = amountForRooms(
      pricing.roomPrice || 0,
      nightsCount,
      roomsToAccept,
      extraBedRequested,
      pricing.extraBedPrice || 0,
      pricing.allowExtraBed === true,
    );
    const storedFull = Math.max(
      0,
      Number(booking.amountTHB ?? booking.subtotal ?? booking.amount) || 0,
    );
    const perRoomStored =
      roomsOnDoc > 0 ? storedFull / roomsOnDoc : storedFull;
    const amountForAccepted =
      computedAccepted > 0 ?
        computedAccepted :
        Math.round(perRoomStored * totalAcceptedRooms) || storedFull;
    const amountForNewOnly =
      computedNewOnly > 0 ?
        computedNewOnly :
        Math.round(perRoomStored * roomsToAccept) || amountForAccepted;

    // Sibling auto booking (instant portion of a partial group)
    const siblingAutoId = stringValue(booking.siblingAutoBookingId, 120);
    let siblingAlreadyPaid = false;
    if (siblingAutoId) {
      const siblingRef = db().collection(HOTEL_COLLECTION).doc(siblingAutoId);
      const siblingSnap = await siblingRef.get();
      if (siblingSnap.exists) {
        const sibling = siblingSnap.data() || {};
        siblingAlreadyPaid =
          sibling.isPaymentDone === true ||
          String(sibling.paymentVerificationStatus || "").toUpperCase() ===
            "VERIFIED";
        const prevInstant = Math.max(
          0,
          parsePositiveInt(
            sibling.roomsInstant ?? sibling.rooms ?? sibling.noOfRooms,
            0,
          ),
        );
        const combinedInstant = prevInstant + roomsToAccept;
        await siblingRef.set(
          {
            roomsPending: 0,
            roomsInstant: combinedInstant,
            acceptedRooms: combinedInstant,
            pendingReason: null,
            pendingReasonCode: null,
            partialResolved: "ACCEPTED",
            siblingPendingBookingId: bookingId,
            siblingPendingResolvedAt:
              admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          {merge: true},
        );
      }
    }

    // Note: amountPaid may be stored as 0 — do not use ?? (0 is valid for ?? and blocks stripe fields)
    const alreadyPaidOnThisDoc =
      booking.isPaymentDone === true ||
      booking.isPaymentClear === true ||
      String(booking.paymentVerificationStatus || "").toUpperCase() ===
        "VERIFIED" ||
      (booking.paymentConfirmation as {status?: string} | undefined)?.status ===
        "paid" ||
      Number(booking.stripeAmountMajor) > 0 ||
      Number(booking.stripeChargeAmount) > 0 ||
      Number(booking.amountPaid) > 0;
    const prevPaidRaw = [
      booking.amountPaid,
      booking.stripeAmountMajor,
      booking.stripeChargeAmount,
      alreadyPaidOnThisDoc ? booking.amountTHB ?? booking.amount : 0,
    ]
      .map((v) => Number(v))
      .find((n) => Number.isFinite(n) && n > 0);
    const prevPaid = Math.max(0, prevPaidRaw || 0);

    // Guest paid for instant rooms already → amountDue = price of newly accepted only
    const needsTopUp =
      alreadyPaidOnThisDoc &&
      amountForNewOnly > 0 &&
      (isSameDocPartial ||
        siblingAlreadyPaid ||
        roomsToAccept < totalAcceptedRooms);
    const amountPaid = alreadyPaidOnThisDoc ? prevPaid : 0;
    let amountDue = needsTopUp ?
      amountForNewOnly :
      alreadyPaidOnThisDoc ?
        Math.max(0, amountForAccepted - prevPaid) :
        amountForAccepted;

    // Pure pending accept with no prior payment must always leave a payable due
    // when there is a known room amount (never mark paid by accident).
    if (!alreadyPaidOnThisDoc && !siblingAlreadyPaid && amountForAccepted > 0) {
      amountDue = Math.max(amountDue, amountForAccepted);
    }

    const requiresPayment = amountDue > 0;
    const displayStatus = requiresPayment ?
      "Accepted - awaiting payment" :
      "Accepted";
    const bookingStatusCode = requiresPayment ?
      "AWAITING_PAYMENT" :
      "ACCEPTED";

    await snap.ref.set(
      {
        status: displayStatus,
        bookingStatus: bookingStatusCode,
        isBookingConfirmed: true,
        autoAccepted: false,
        acceptanceMethod: "MANUAL",
        inventoryReserved: true,
        inventoryReservedAt: admin.firestore.FieldValue.serverTimestamp(),
        inventoryReleased: false,
        inventoryReservationPendingFinalize: false,
        packageId,
        roomId: packageId,
        hotelUid,
        rooms: totalAcceptedRooms,
        noOfRooms: totalAcceptedRooms,
        roomsInstant: totalAcceptedRooms,
        acceptedRooms: totalAcceptedRooms,
        roomsPending: 0,
        roomsRequestedTotal:
          parsePositiveInt(booking.roomsRequestedTotal, 0) ||
          totalAcceptedRooms,
        // Full stay amount for all accepted rooms
        amountTHB: amountForAccepted,
        subtotal: amountForAccepted,
        amountDue,
        amountPaid,
        // Unpaid after accept → guest must pay (checkout uses amountDue / payNow)
        isPaymentDone: !requiresPayment && alreadyPaidOnThisDoc,
        isPaymentClear: !requiresPayment && alreadyPaidOnThisDoc,
        payNow: requiresPayment,
        paymentVerificationStatus: requiresPayment ?
          "PENDING_VERIFICATION" :
          String(booking.paymentVerificationStatus || "VERIFIED"),
        paymentVerificationNote: requiresPayment ?
          needsTopUp ?
            "Additional rooms accepted — complete remaining payment." :
            "Booking accepted — payment required to confirm stay." :
          booking.paymentVerificationNote || "Paid.",
        // Do not carry a stale open Checkout from the pending phase
        ...(requiresPayment ?
          {
            stripeSessionId: null,
            stripeChargeAmount: null,
          } :
          {}),
        pendingReasonCode: null,
        pendingReason: null,
        partialResolved: "ACCEPTED",
        sourcePath:
          booking.sourcePath ||
          (isSameDocPartial ?
            "same_doc_partial_accepted" :
            siblingAutoId ?
              "pending_partial_accepted" :
              "manual"),
        acceptedBy: request.auth?.uid || null,
        acceptedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      {merge: true},
    );

    logger.info(
      `[HotelBooking] manual accept ${bookingId} +${roomsToAccept} rooms → ${totalAcceptedRooms} total amountDue=${amountDue} payNow=${requiresPayment}`,
    );

    return {
      ok: true,
      bookingId,
      inventoryReserved: reservedOk,
      packageId,
      hotelUid,
      roomsAdded: roomsToAccept,
      roomsInstant: totalAcceptedRooms,
      roomsPending: 0,
      acceptedRooms: totalAcceptedRooms,
      amountTHB: amountForAccepted,
      amountDue,
      amountPaid,
      payNow: requiresPayment,
      isPaymentDone: !requiresPayment && alreadyPaidOnThisDoc,
      status: displayStatus,
      bookingStatus: bookingStatusCode,
      siblingAutoBookingId: siblingAutoId || null,
      siblingAlreadyPaid,
      availability,
      nightsReserved: reserve.nights || null,
    };
  },
);

// ---------------------------------------------------------------------------
// Soft hold APIs (booking started → lock / done → book / leave → unlock)
// ---------------------------------------------------------------------------

const buildHoldId = (
  userId: string,
  hotelUid: string,
  checkIn: string,
  checkOut: string,
  packageId: string,
) =>
  `hold_${userId}_${hotelUid}_${checkIn}_${checkOut}_${packageId}`
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 120);

const holdUntilDate = (minutes = HOLD_MINUTES) =>
  new Date(Date.now() + minutes * 60 * 1000);

const isHoldExpired = (data: Record<string, unknown>) => {
  const until = data.holdUntil as admin.firestore.Timestamp | Date | string | undefined;
  if (!until) return true;
  const ms =
    typeof (until as admin.firestore.Timestamp).toMillis === "function" ?
      (until as admin.firestore.Timestamp).toMillis() :
      new Date(until as string | Date).getTime();
  return !Number.isFinite(ms) || ms <= Date.now();
};

/**
 * Internal: free ledger rooms for a hold doc if still reserved.
 * Does NOT mark EXPIRED/RELEASED if ledger release fails (avoids ghost locks).
 */
const unlockHoldIfNeeded = async (
  holdId: string,
  hold: Record<string, unknown>,
  status: "RELEASED" | "EXPIRED",
): Promise<{ok: boolean; alreadyReleased?: boolean}> => {
  const roomsHeld = Math.max(0, parsePositiveInt(hold.roomsHeld, 0));
  if (hold.inventoryReserved === true && roomsHeld > 0 && hold.inventoryReleased !== true) {
    const result = await releaseHoldRoomsInTransaction(db(), {
      hotelUid: stringValue(hold.hotelUid, 120),
      packageId: stringValue(hold.packageId, 120),
      checkIn: hold.checkIn,
      checkOut: hold.checkOut,
      rooms: roomsHeld,
      holdId,
    });
    if (!result.ok) {
      logger.error(
        `[HotelHold] unlockHoldIfNeeded release failed hold=${holdId} — leaving status as HOLD for retry`,
      );
      return {ok: false};
    }
  } else if (hold.inventoryReleased !== true) {
    await db().collection(HOLD_COLLECTION).doc(holdId).set(
      {
        inventoryReleased: true,
        inventoryReserved: false,
        inventoryReleasedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      {merge: true},
    );
  }

  await db().collection(HOLD_COLLECTION).doc(holdId).set(
    {
      status,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      releasedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    {merge: true},
  );
  return {ok: true};
};

/**
 * 1) Booking started → soft-lock free rooms for HOLD_MINUTES.
 * Locks only rooms that can be instantly reserved (auto-book capacity).
 * Remaining requested rooms stay "pending intent" (not locked).
 */
export const startHotelBookingHold = onCall(callableOpts, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Authentication is required.");
  }

  try {
    const body = (request.data || {}) as Data;
    const userId = stringValue(body.userId, 128) || request.auth.uid;
    if (userId !== request.auth.uid) {
      throw new HttpsError("permission-denied", "User mismatch.");
    }

    const hotelUid = stringValue(body.hotelId || body.hotelUid, 120);
    let packageId = stringValue(body.packageId || body.roomId, 120);
    const roomNameHint = stringValue(body.roomName, 150);
    const checkInStr = toDateString(body.checkInDate || body.checkIn);
    const checkOutStr = toDateString(body.checkOutDate || body.checkOut);
    const roomsRequested = Math.max(1, parsePositiveInt(body.rooms, 1));
    // Cap hold length to reduce inventory hoarding (default 10, max 15)
    const holdMinutes = Math.min(
      15,
      Math.max(5, parsePositiveInt(body.holdMinutes, HOLD_MINUTES) || HOLD_MINUTES),
    );

    if (!hotelUid || !checkInStr || !checkOutStr) {
      throw new HttpsError(
        "invalid-argument",
        "hotelId, checkIn, and checkOut are required.",
      );
    }

    packageId = await resolvePackageId(hotelUid, packageId, roomNameHint);
    if (!packageId) {
      throw new HttpsError(
        "invalid-argument",
        "Room type is required (packageId or roomName).",
        {reasonCode: "ROOM_TYPE_MISSING"},
      );
    }

    const nightsCount = computeNightsCount(checkInStr, checkOutStr);
    if (nightsCount < 1) {
      throw new HttpsError(
        "invalid-argument",
        "Check-out must be after check-in.",
      );
    }

    const holdId = buildHoldId(
      userId,
      hotelUid,
      checkInStr,
      checkOutStr,
      packageId,
    );
    const holdRef = db().collection(HOLD_COLLECTION).doc(holdId);
    const existing = await holdRef.get();

    // Reuse active hold
    if (existing.exists) {
      const prev = existing.data() || {};
      if (prev.status === "HOLD" && !isHoldExpired(prev)) {
        const until = holdUntilDate(holdMinutes);
        await holdRef.update({
          holdUntil: admin.firestore.Timestamp.fromDate(until),
          holdMinutes,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return {
          success: true,
          holdId,
          status: "HOLD",
          reused: true,
          locked: prev.inventoryReserved === true,
          roomsHeld: Number(prev.roomsHeld) || 0,
          roomsRequested: Number(prev.roomsRequested) || roomsRequested,
          roomsPendingIntent: Number(prev.roomsPendingIntent) || 0,
          holdUntil: until.toISOString(),
          holdMinutes,
          hotelUid,
          packageId,
          checkIn: checkInStr,
          checkOut: checkOutStr,
          messaging: prev.messaging || null,
        };
      }
      // Expired or leftover — unlock then recreate
      if (prev.status === "HOLD" || prev.inventoryReserved === true) {
        await unlockHoldIfNeeded(holdId, prev, "EXPIRED");
      }
      if (prev.status === "COMPLETED") {
        throw new HttpsError(
          "already-exists",
          "A booking was already completed for this stay. Use the existing booking.",
          {holdId, bookingId: prev.bookingId || null},
        );
      }
    }

    // Cap concurrent active holds per user (different stays)
    try {
      const activeSnap = await db()
        .collection(HOLD_COLLECTION)
        .where("userId", "==", userId)
        .where("status", "==", "HOLD")
        .limit(20)
        .get();
      let activeCount = 0;
      for (const doc of activeSnap.docs) {
        if (doc.id === holdId) continue;
        const d = doc.data() || {};
        if (!isHoldExpired(d)) activeCount += 1;
      }
      if (activeCount >= MAX_ACTIVE_HOLDS_PER_USER) {
        throw new HttpsError(
          "resource-exhausted",
          `You already have ${MAX_ACTIVE_HOLDS_PER_USER} active room holds. Complete or release one first.`,
          {maxActiveHolds: MAX_ACTIVE_HOLDS_PER_USER},
        );
      }
    } catch (e) {
      if (e instanceof HttpsError) throw e;
      logger.warn("[HotelHold] active hold count query failed", e);
    }

    const capacity = await evaluateStayCapacity(db(), {
      hotelUid,
      packageId,
      checkIn: checkInStr,
      checkOut: checkOutStr,
      roomsRequested,
    });
    const messaging = buildAvailabilityMessage(capacity);
    let roomsToHold = messaging.roomsInstant;
    let roomsPendingIntent = messaging.roomsPending;
    const until = holdUntilDate(holdMinutes);

    // Only lock what auto-book can take now
    let locked = false;
    if (roomsToHold > 0) {
      const reserve = await reserveRoomsInTransaction(db(), {
        hotelUid,
        packageId,
        checkIn: checkInStr,
        checkOut: checkOutStr,
        rooms: roomsToHold,
        bookingId: holdId,
        allocationId: holdId,
        reservationKind: "hold",
        owner: {
          collection: HOLD_COLLECTION,
          docId: holdId,
          data: {
            holdId,
            userId,
            authUid: userId,
            hotelUid,
            packageId,
            roomName: roomNameHint || null,
            checkIn: checkInStr,
            checkOut: checkOutStr,
            checkInDate: checkInStr,
            checkOutDate: checkOutStr,
            nights: nightsCount,
            roomsRequested,
            roomsHeld: roomsToHold,
            roomsPendingIntent,
            status: "HOLD",
            inventoryReserved: true,
            inventoryReleased: false,
            holdMinutes,
            holdUntil: admin.firestore.Timestamp.fromDate(until),
            messaging,
            bookingId: null,
            autoBookingId: null,
            pendingBookingId: null,
            source: "WEB_HOLD",
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
        },
      });
      if (!reserve.ok) {
        logger.warn(`[HotelHold] reserve failed ${holdId}: ${reserve.reason}`);
        roomsToHold = 0;
        roomsPendingIntent = roomsRequested;
      } else {
        locked = true;
      }
    }

    await holdRef.set(
      {
        holdId,
        userId,
        authUid: userId,
        hotelUid,
        packageId,
        roomName: roomNameHint || null,
        checkIn: checkInStr,
        checkOut: checkOutStr,
        checkInDate: checkInStr,
        checkOutDate: checkOutStr,
        nights: nightsCount,
        roomsRequested,
        roomsHeld: roomsToHold,
        roomsPendingIntent,
        status: "HOLD",
        inventoryReserved: locked,
        inventoryReleased: !locked,
        holdMinutes,
        holdUntil: admin.firestore.Timestamp.fromDate(until),
        messaging,
        bookingId: null,
        autoBookingId: null,
        pendingBookingId: null,
        source: "WEB_HOLD",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      {merge: true},
    );

    logger.info(
      `[HotelHold] start ${holdId} locked=${roomsToHold} pendingIntent=${roomsPendingIntent}`,
    );

    return {
      success: true,
      holdId,
      status: "HOLD",
      reused: false,
      locked,
      roomsHeld: roomsToHold,
      roomsRequested,
      roomsPendingIntent,
      holdUntil: until.toISOString(),
      holdMinutes,
      hotelUid,
      packageId,
      checkIn: checkInStr,
      checkOut: checkOutStr,
      messaging: {
        ...messaging,
        roomsInstant: roomsToHold,
        roomsPending: roomsPendingIntent,
      },
      message: locked ?
        `${roomsToHold} room(s) locked for ${holdMinutes} minutes while you complete booking.` :
        "No rooms available for instant lock. You can still complete a pending request.",
    };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    logger.error("[HotelHold] start failed", error);
    throw new HttpsError("internal", "Could not start booking hold.");
  }
});

/**
 * Shared complete-hold core (callable + HTTPS createHotelBooking with holdId).
 */
export async function runCompleteHotelBookingHold(
  authUid: string,
  body: Data,
): Promise<Record<string, unknown>> {
  try {
    const holdId = stringValue(body.holdId, 120);
    if (!holdId) {
      throw new HttpsError("invalid-argument", "holdId is required.");
    }

    const holdRef = db().collection(HOLD_COLLECTION).doc(holdId);
    const holdSnap = await holdRef.get();
    if (!holdSnap.exists) {
      throw new HttpsError("not-found", "Hold not found. Start booking again.");
    }
    const hold = holdSnap.data() || {};

    if (hold.userId !== authUid && hold.authUid !== authUid) {
      throw new HttpsError("permission-denied", "This hold belongs to another user.");
    }

    if (hold.status === "COMPLETED") {
      return {
        success: true,
        duplicate: true,
        holdId,
        bookingId: hold.bookingId || hold.autoBookingId || hold.pendingBookingId,
        autoBookingId: hold.autoBookingId || null,
        pendingBookingId: hold.pendingBookingId || null,
        path: hold.path || "auto",
        payNow: hold.payNow === true,
        status: hold.bookingStatus || "ACCEPTED",
      };
    }

    if (hold.status === "RELEASED" || hold.status === "EXPIRED") {
      throw new HttpsError(
        "failed-precondition",
        "This hold was released. Start booking again.",
        {holdId, status: hold.status},
      );
    }

    if (hold.status !== "HOLD" || isHoldExpired(hold)) {
      await unlockHoldIfNeeded(holdId, hold, "EXPIRED");
      throw new HttpsError(
        "deadline-exceeded",
        "Hold expired and rooms were unlocked. Start booking again.",
        {holdId},
      );
    }

    const userId = stringValue(hold.userId, 128) || authUid;
    const hotelUid = stringValue(hold.hotelUid, 120);
    const packageId = stringValue(hold.packageId, 120);
    const checkInStr = toDateString(hold.checkIn || hold.checkInDate) || "";
    const checkOutStr = toDateString(hold.checkOut || hold.checkOutDate) || "";
    if (!hotelUid || !packageId || !checkInStr || !checkOutStr) {
      throw new HttpsError(
        "failed-precondition",
        "Hold is missing hotel, room type, or dates.",
      );
    }
    const roomsRequested = Math.max(1, parsePositiveInt(hold.roomsRequested, 1));
    let roomsInstant = Math.max(0, parsePositiveInt(hold.roomsHeld, 0));
    let roomsPending = Math.max(
      0,
      parsePositiveInt(hold.roomsPendingIntent, roomsRequested - roomsInstant),
    );
    // Allow client to reduce rooms at complete (not increase beyond hold)
    if (body.rooms != null) {
      const want = Math.max(1, parsePositiveInt(body.rooms, roomsRequested));
      if (want > roomsRequested) {
        throw new HttpsError(
          "invalid-argument",
          "Cannot book more rooms than the hold. Start a new hold for more rooms.",
        );
      }
      // Prefer using held (locked) rooms first
      roomsInstant = Math.min(roomsInstant, want);
      roomsPending = Math.max(0, want - roomsInstant);
    }

    const [hotel, pkg] = await Promise.all([
      loadHotel(db(), hotelUid),
      loadPackage(db(), packageId, hotelUid),
    ]);
    if (!hotel) throw new HttpsError("not-found", "Hotel not found.");
    if (!pkg) throw new HttpsError("not-found", "Room type not found.");

    const pricing = getRoomPricing(pkg, hotel);
    if (!pricing.roomPrice || pricing.roomPrice <= 0) {
      throw new HttpsError(
        "failed-precondition",
        "Room pricing is not available. Please contact support.",
      );
    }

    const nightsCount = computeNightsCount(checkInStr, checkOutStr);
    const adults = Math.max(1, parsePositiveInt(body.adults, 1));
    const children = Math.max(0, parsePositiveInt(body.children, 0));
    const extraBedRequested = parseBool(body.extraBed);
    assertGuestCapacity(pkg, adults, children, extraBedRequested);
    const paymentMethodIntent =
      stringValue(body.paymentMethod || body.paymentMethodIntent, 40).toUpperCase() ||
      "STRIPE";
    const paymentMethod = paymentMethodIntent.includes("QR") ?
      "THAI_QR" :
      paymentMethodIntent === "OFFLINE" ?
        "OFFLINE" :
        "STRIPE";
    const modeOfPayment =
      paymentMethod === "THAI_QR" || paymentMethod === "STRIPE" ?
        "ONLINE" :
        "OFFLINE";

    const guestEmail = normalizeEmail(body.guestEmail || body.email);
    const guestPhone = stringValue(body.guestPhone || body.phone, 40);
    const fullName = stringValue(body.fullName, 120);
    const roomNameHint = stringValue(body.roomName || hold.roomName, 150);
    const groupId = `grp_${userId}_${hotelUid}_${checkInStr}_${packageId}`
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .slice(0, 100);

    // If hold locked fewer rooms than expected (0), demote all to pending
    if (roomsInstant > 0 && hold.inventoryReserved !== true) {
      roomsPending += roomsInstant;
      roomsInstant = 0;
    }

    // If guest books fewer locked rooms, free the surplus hold
    const originalHeld = Math.max(0, parsePositiveInt(hold.roomsHeld, 0));
    if (originalHeld > roomsInstant && hold.inventoryReserved === true) {
      const surplus = originalHeld - roomsInstant;
      if (surplus > 0) {
        // Temporarily release full hold then re-reserve only roomsInstant
        await releaseHoldRoomsInTransaction(db(), {
          hotelUid,
          packageId,
          checkIn: checkInStr,
          checkOut: checkOutStr,
          rooms: originalHeld,
          holdId,
        });
        if (roomsInstant > 0) {
          const re = await reserveRoomsInTransaction(db(), {
            hotelUid,
            packageId,
            checkIn: checkInStr,
            checkOut: checkOutStr,
            rooms: roomsInstant,
            bookingId: holdId,
            allocationId: holdId,
            reservationKind: "hold",
            owner: {
              collection: HOLD_COLLECTION,
              docId: holdId,
              data: {
                inventoryReserved: true,
                inventoryReleased: false,
                roomsHeld: roomsInstant,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              },
            },
          });
          if (!re.ok) {
            roomsPending += roomsInstant;
            roomsInstant = 0;
          }
        }
      }
    }

    const buildBase = (roomCount: number): Record<string, unknown> => ({
      fullName,
      guestEmail,
      guestPhone,
      userEmail: guestEmail,
      userPhone: guestPhone,
      nationality: stringValue(body.nationality, 20) || "OTHER",
      specialRequests: stringValue(body.specialRequests, 500),
      estimatedArrivalTime:
        stringValue(body.estimatedArrivalTime, 20) || "UNKNOWN",
      bedPreference: stringValue(body.bedPreference, 20) || "NO_PREF",
      hotelUid,
      hotelId: hotelUid,
      hotelName: pricing.hotelName,
      roomName: pricing.roomName || roomNameHint,
      packageId,
      roomId: packageId,
      checkInDate: checkInStr,
      checkOutDate: checkOutStr,
      checkIn: checkInStr,
      checkOut: checkOutStr,
      nights: nightsCount,
      rooms: roomCount,
      noOfRooms: roomCount,
      adults,
      children,
      amountTHB: amountForRooms(
        pricing.roomPrice,
        nightsCount,
        roomCount,
        extraBedRequested,
        pricing.extraBedPrice,
        pricing.allowExtraBed,
      ),
      subtotal: amountForRooms(
        pricing.roomPrice,
        nightsCount,
        roomCount,
        extraBedRequested,
        pricing.extraBedPrice,
        pricing.allowExtraBed,
      ),
      vat: 0,
      needsAirportPickup: parseBool(body.needsAirportPickup),
      extraBed: extraBedRequested && pricing.allowExtraBed,
      currency: "THB",
      paymentMethod,
      modeOfPayment,
      isPaymentDone: false,
      paymentVerificationStatus: "PENDING_VERIFICATION",
      paymentVerificationNote: "",
      customerQrPaymentConfirmed: false,
      stripeSessionId: null,
      userId,
      authUid: userId,
      source: "WEB",
      holdId,
      bookingGroupId: groupId,
      roomsRequestedTotal: roomsRequested,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const fullId = bookingDocIds(
      userId,
      hotelUid,
      checkInStr,
      checkOutStr,
      packageId,
    ).primary;
    const autoId = bookingDocIds(
      userId,
      hotelUid,
      checkInStr,
      checkOutStr,
      packageId,
      "auto",
    ).primary;
    const pendId = bookingDocIds(
      userId,
      hotelUid,
      checkInStr,
      checkOutStr,
      packageId,
      "pend",
    ).primary;

    let autoBookingId: string | null = null;
    let pendingBookingId: string | null = null;
    let payNow = false;
    let path: "auto" | "pending" | "partial" = "pending";

    // Instant portion: ledger already reserved under holdId — transfer to booking
    if (roomsInstant > 0) {
      const useId = roomsPending > 0 ? autoId : fullId;
      const acceptedBookingData = {
        ...buildBase(roomsInstant),
          bookingStatus: "ACCEPTED",
          status: "Accepted",
          isBookingConfirmed: true,
          autoAccepted: true,
          acceptanceMethod: "AUTO",
          inventoryReserved: true,
          inventoryReservedAt: admin.firestore.FieldValue.serverTimestamp(),
          inventoryReleased: false,
          inventoryFromHoldId: holdId,
          sourcePath: roomsPending > 0 ? "hold_auto_partial" : "hold_auto",
          pendingReasonCode: null,
          pendingReason: null,
          roomsInstant,
          roomsPending,
          acceptanceNotifiedAt: admin.firestore.FieldValue.serverTimestamp(),
          siblingPendingBookingId: roomsPending > 0 ? pendId : null,
      };
      const transfer = await transferHeldRoomsToBookingInTransaction(db(), {
        holdId,
        bookingId: useId,
        hotelUid,
        packageId,
        checkIn: checkInStr,
        checkOut: checkOutStr,
        rooms: roomsInstant,
        bookingData: acceptedBookingData,
      });
      if (!transfer.ok) {
        throw new HttpsError(
          "failed-precondition",
          "Could not convert the room hold into a booking. Please try again.",
        );
      }
      autoBookingId = useId;
      payNow = true;
      path = roomsPending > 0 ? "partial" : "auto";
    } else if (hold.inventoryReserved === true && hold.inventoryReleased !== true) {
      // Nothing instant to book but hold still locked — free it
      await releaseHoldRoomsInTransaction(db(), {
        hotelUid,
        packageId,
        checkIn: checkInStr,
        checkOut: checkOutStr,
        rooms: originalHeld || 1,
        holdId,
      });
    }

    if (roomsPending > 0) {
      const finalPendId = autoBookingId ? pendId : fullId;
      const messaging = (hold.messaging || {}) as {message?: string};
      const pendingReason =
        path === "partial" || autoBookingId ?
          `${roomsPending} room${roomsPending > 1 ? "s" : ""} could not be confirmed instantly. We will confirm with the hotel and come back to you.` :
          messaging.message ||
            "We will confirm with the hotel and come back to you.";

      await db()
        .collection(HOTEL_COLLECTION)
        .doc(finalPendId)
        .set({
          ...buildBase(roomsPending),
          bookingStatus: "PENDING",
          status: "Pending",
          isBookingConfirmed: false,
          autoAccepted: false,
          acceptanceMethod: null,
          inventoryReserved: false,
          sourcePath: autoBookingId ? "hold_pending_partial" : "hold_pending",
          pendingReasonCode: autoBookingId ? "PARTIAL_CAPACITY" : "ROOMS_FULL",
          pendingReason,
          roomsInstant: autoBookingId ? roomsInstant : 0,
          roomsPending,
          siblingAutoBookingId: autoBookingId,
          holdId,
        });
      pendingBookingId = finalPendId;
      if (!autoBookingId) path = "pending";
    }

    const primaryBookingId = autoBookingId || pendingBookingId || fullId;
    const amountTHB = amountForRooms(
      pricing.roomPrice,
      nightsCount,
      roomsInstant > 0 ? roomsInstant : roomsPending,
      extraBedRequested,
      pricing.extraBedPrice,
      pricing.allowExtraBed,
    );

    await holdRef.set(
      {
        status: "COMPLETED",
        bookingId: primaryBookingId,
        autoBookingId,
        pendingBookingId,
        path,
        payNow,
        bookingStatus: autoBookingId ? "ACCEPTED" : "PENDING",
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      {merge: true},
    );

    logger.info(
      `[HotelHold] complete ${holdId} path=${path} auto=${autoBookingId} pend=${pendingBookingId}`,
    );

    return {
      success: true,
      holdId,
      bookingId: primaryBookingId,
      autoBookingId,
      pendingBookingId,
      bookingCollection: HOTEL_COLLECTION,
      path,
      payNow,
      autoAccepted: Boolean(autoBookingId),
      roomsRequested,
      roomsInstant: autoBookingId ? roomsInstant : 0,
      roomsPending: pendingBookingId ? roomsPending : 0,
      amountTHB: autoBookingId ?
        amountForRooms(
          pricing.roomPrice,
          nightsCount,
          roomsInstant,
          extraBedRequested,
          pricing.extraBedPrice,
          pricing.allowExtraBed,
        ) :
        amountTHB,
      status: autoBookingId ? "Accepted" : "Pending",
      bookingStatus: autoBookingId ? "ACCEPTED" : "PENDING",
    };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    logger.error("[HotelHold] complete failed", error);
    throw new HttpsError("internal", "Could not complete booking hold.");
  }
}

/**
 * 2) Booking done → convert hold into real booking(s). Rooms already locked
 * stay reserved (no second reserve). Pending intent creates Pending docs.
 */
export const completeHotelBookingHold = onCall(callableOpts, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Authentication is required.");
  }
  return runCompleteHotelBookingHold(
    request.auth.uid,
    (request.data || {}) as Data,
  );
});

/**
 * 3) Booking not done / user left checkout → unlock rooms immediately.
 */
export const releaseHotelBookingHold = onCall(callableOpts, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Authentication is required.");
  }

  try {
    const body = (request.data || {}) as Data;
    const holdId = stringValue(body.holdId, 120);
    if (!holdId) {
      throw new HttpsError("invalid-argument", "holdId is required.");
    }

    const holdRef = db().collection(HOLD_COLLECTION).doc(holdId);
    const holdSnap = await holdRef.get();
    if (!holdSnap.exists) {
      return {success: true, holdId, status: "NOT_FOUND", alreadyReleased: true};
    }
    const hold = holdSnap.data() || {};

    if (hold.userId !== request.auth.uid && hold.authUid !== request.auth.uid) {
      // Admins may also release
      try {
        await assertAdmin(request.auth as Auth);
      } catch {
        throw new HttpsError("permission-denied", "This hold belongs to another user.");
      }
    }

    if (hold.status === "COMPLETED") {
      throw new HttpsError(
        "failed-precondition",
        "Hold already completed as a booking. Cancel the booking to free rooms.",
        {bookingId: hold.bookingId || null},
      );
    }

    if (
      hold.status === "RELEASED" ||
      hold.status === "EXPIRED" ||
      hold.inventoryReleased === true
    ) {
      await holdRef.set(
        {status: hold.status === "HOLD" ? "RELEASED" : hold.status},
        {merge: true},
      );
      return {
        success: true,
        holdId,
        status: "RELEASED",
        alreadyReleased: true,
      };
    }

    await unlockHoldIfNeeded(holdId, hold, "RELEASED");

    logger.info(`[HotelHold] release ${holdId}`);

    return {
      success: true,
      holdId,
      status: "RELEASED",
      alreadyReleased: false,
      roomsUnlocked: Number(hold.roomsHeld) || 0,
    };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    logger.error("[HotelHold] release failed", error);
    throw new HttpsError("internal", "Could not release booking hold.");
  }
});

/**
 * Auto-unlock expired holds (tab closed without calling release).
 * Runs every 5 minutes.
 */
export const expireHotelBookingHolds = onSchedule(
  {
    region: REGION,
    schedule: "every 5 minutes",
    timeZone: "Asia/Bangkok",
  },
  async () => {
    const now = admin.firestore.Timestamp.now();
    const snap = await db()
      .collection(HOLD_COLLECTION)
      .where("status", "==", "HOLD")
      .where("holdUntil", "<=", now)
      .limit(50)
      .get();

    if (snap.empty) {
      logger.info("[HotelHold] expire: none due");
      return;
    }

    let released = 0;
    let failed = 0;
    for (const doc of snap.docs) {
      try {
        const result = await unlockHoldIfNeeded(
          doc.id,
          doc.data() || {},
          "EXPIRED",
        );
        if (result.ok) released += 1;
        else failed += 1;
      } catch (err) {
        failed += 1;
        logger.error(`[HotelHold] expire failed ${doc.id}`, err);
      }
    }
    logger.info(
      `[HotelHold] expire: released ${released}/${snap.size} failed=${failed}`,
    );
  },
);

export const __test = {
  bookingInventoryFields,
  buildManualDocId,
  buildAvailabilityMessage,
  buildHoldId,
};
