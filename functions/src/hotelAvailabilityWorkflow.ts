import {assertActiveAccount} from "./activeAccount";
/**
 * Hotel room availability — ADMIN PORTAL ONLY.
 *
 * App / website will use separate callables later (auto-book, public check).
 * These endpoints require Admin or Sub Admin (same auth as transport admin tools).
 */
import * as admin from "firebase-admin";
import {HttpsError, onCall} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import {
  evaluateAvailability,
  applyAvailabilityAdjustment,
  deactivateAdjustment,
  updatePackageTotalRooms,
  getCalendarRange,
  releaseRoomsInTransaction,
  bookingInventoryFields,
  loadHotel,
  loadPackage,
  loadAvailabilityConfig,
  loadActiveAvailabilityAdjustments,
  unlockAndDeleteHold,
  unlockBookingStayLock,
  forceUnlockStayNights,
} from "./utils/hotelInventoryTx";
import {sendTelegramNotification} from "./utils/telegram";
import {toDateString} from "./utils/hotelAvailability";

const REGION = "asia-east2";
type Data = Record<string, unknown>;
type Auth = {uid: string; token?: Record<string, unknown>};

const db = () => admin.firestore();
const stringValue = (v: unknown) => String(v ?? "").trim();

/** Shared options: admin portal only (Auth still enforced in assertAdmin). */
const adminCallableOpts = {
  region: REGION,
  cors: true as const,
  invoker: "public" as const,
  // Firebase Auth + assertAdmin still required; public invoker only fixes CORS/preflight.
} as const;

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
  throw new HttpsError(
    "permission-denied",
    "Admin access only. App and website must use separate availability APIs.",
  );
};

const notifyAvailability = async (message: string) => {
  try {
    await sendTelegramNotification(message);
  } catch (e) {
    logger.warn("[HotelAvailability] telegram failed", e);
  }
};

/**
 * Admin: check availability for a stay (preview / ops).
 * Not for mobile app or customer website.
 */
export const getHotelAvailability = onCall(
  adminCallableOpts,
  async (request) => {
    await assertAdmin(request.auth as Auth | undefined);

    const input = (request.data || {}) as Data;
    const hotelUid = stringValue(input.hotelUid || input.hotelId);
    const packageId = stringValue(input.packageId || input.roomId);
    const checkIn = input.checkIn || input.checkInDate;
    const checkOut = input.checkOut || input.checkOutDate;
    const rooms = Number(input.rooms || input.noOfRooms || 1);

    if (!hotelUid || !packageId) {
      throw new HttpsError(
        "invalid-argument",
        "hotelUid and packageId are required.",
      );
    }

    const result = await evaluateAvailability(db(), {
      hotelUid,
      packageId,
      checkIn,
      checkOut,
      rooms,
    });

    return {ok: true, audience: "admin", ...result};
  },
);

/**
 * Admin: calendar + adjustments for Manage Room Availability UI.
 */
export const getHotelAvailabilityCalendar = onCall(
  adminCallableOpts,
  async (request) => {
    await assertAdmin(request.auth as Auth | undefined);

    const input = (request.data || {}) as Data;
    const hotelUid = stringValue(input.hotelUid || input.hotelId);
    const packageId = stringValue(input.packageId);
    const startDate = stringValue(input.startDate);
    const endDate = stringValue(input.endDate);

    if (!hotelUid || !packageId || !startDate || !endDate) {
      throw new HttpsError(
        "invalid-argument",
        "hotelUid, packageId, startDate, and endDate are required.",
      );
    }

    const nights = await getCalendarRange(
      db(),
      hotelUid,
      packageId,
      startDate,
      endDate,
    );

    const adjustments = await loadActiveAvailabilityAdjustments(
      db(),
      hotelUid,
      packageId,
    );

    const hotel = await loadHotel(db(), hotelUid);
    const pkg = await loadPackage(db(), packageId, hotelUid);
    const config = await loadAvailabilityConfig(db(), hotelUid, hotel);

    return {
      ok: true,
      audience: "admin",
      nights,
      adjustments,
      availabilityConfig: config,
      package: pkg ?
        {
          id: pkg.id,
          packageName: pkg.roomName || pkg.packageName || pkg.name,
          roomName: pkg.roomName || pkg.packageName || pkg.name,
          totalRooms:
            pkg.totalRooms ?? pkg.quantity ?? pkg.numberOfRooms ?? 0,
          maxAdults: pkg.maxAdults,
          maxChildren: pkg.maxChildren,
          numberOfGuests: pkg.numberOfGuests ?? pkg.maxGuests,
          price: pkg.price ?? pkg.pricing,
          source: pkg.source || "hotel_rooms",
        } :
        null,
    };
  },
);

/**
 * Admin: bookable window, auto-book flag, qty, extra, block, end adjustment.
 */
export const manageHotelAvailability = onCall(
  adminCallableOpts,
  async (request) => {
    await assertAdmin(request.auth as Auth | undefined);

    const input = (request.data || {}) as Data;
    const action = stringValue(input.action);
    const hotelUid = stringValue(input.hotelUid || input.hotelId);
    const actor = request.auth?.uid || "unknown";

    if (!action) {
      throw new HttpsError("invalid-argument", "action is required.");
    }

    if (action === "setBookableWindow") {
      if (!hotelUid) {
        throw new HttpsError("invalid-argument", "hotelUid is required.");
      }
      const bookingOpenFrom = stringValue(input.bookingOpenFrom) || null;
      const bookingOpenTo = stringValue(input.bookingOpenTo) || null;
      const notifyOnFull = input.notifyOnFull !== false;
      const notifyOnFreed = input.notifyOnFreed !== false;
      const autoBookingEnabled = input.autoBookingEnabled !== false;
      const defaultRoomInventory = Math.max(
        1,
        Math.floor(Number(input.defaultRoomInventory) || 5),
      );

      const hotelRef = db().collection("HotelDB").doc(hotelUid);
      const snap = await hotelRef.get();
      if (!snap.exists) {
        throw new HttpsError("not-found", "Hotel not found.");
      }

      const availabilityConfig = {
        bookingOpenFrom,
        bookingOpenTo,
        timezone: "Asia/Bangkok",
        notifyOnFull,
        notifyOnFreed,
        autoBookingEnabled,
        defaultRoomInventory,
      };

      await hotelRef.collection("availability").doc("config").set(
        {
          ...availabilityConfig,
          recordType: "config",
          hotelUid,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        {merge: true},
      );

      return {ok: true, audience: "admin", availabilityConfig};
    }

    if (action === "setTotalRooms") {
      const packageId = stringValue(input.packageId);
      const totalRooms = Number(input.totalRooms);
      if (!packageId) {
        throw new HttpsError("invalid-argument", "packageId is required.");
      }
      const result = await updatePackageTotalRooms(
        db(),
        packageId,
        totalRooms,
        actor,
        {hotelUid},
      );
      if (!result.ok) {
        throw new HttpsError("failed-precondition", result.error || "Failed.");
      }
      return {ok: true, audience: "admin"};
    }

    if (action === "addExtra" || action === "block") {
      const packageId = stringValue(input.packageId);
      if (!hotelUid || !packageId) {
        throw new HttpsError(
          "invalid-argument",
          "hotelUid and packageId are required.",
        );
      }
      const result = await applyAvailabilityAdjustment(db(), {
        hotelUid,
        packageId,
        type: action === "addExtra" ? "extra" : "blocked",
        delta: Number(input.delta || input.quantity || 0),
        startDate: stringValue(input.startDate),
        endDate: stringValue(input.endDate),
        reason: stringValue(input.reason),
        note: stringValue(input.note),
        active: true,
        createdBy: actor,
        roomTypeName: stringValue(input.roomTypeName),
      });

      if (!result.ok) {
        throw new HttpsError(
          "failed-precondition",
          result.error || "Adjustment failed.",
        );
      }

      await notifyAvailability(
        `<b>Hotel availability updated (admin)</b>\n` +
          `Hotel: ${hotelUid}\n` +
          `Room: ${packageId}\n` +
          `Action: ${action}\n` +
          `Qty: ${input.delta || input.quantity}\n` +
          `${stringValue(input.startDate)} → ${stringValue(input.endDate)}`,
      );

      return {ok: true, audience: "admin", adjustmentId: result.adjustmentId};
    }

    if (action === "endAdjustment") {
      const adjustmentId = stringValue(input.adjustmentId);
      if (!hotelUid || !adjustmentId) {
        throw new HttpsError("invalid-argument", "adjustmentId is required.");
      }
      const result = await deactivateAdjustment(
        db(),
        hotelUid,
        adjustmentId,
        actor,
      );
      if (!result.ok) {
        throw new HttpsError(
          "failed-precondition",
          result.error || "Could not end adjustment.",
        );
      }
      return {ok: true, audience: "admin"};
    }

    throw new HttpsError("invalid-argument", `Unknown action: ${action}`);
  },
);

/**
 * Admin: release inventory for a booking (ops tool).
 * Cancel on booking status change still releases automatically via trigger.
 */
export const releaseHotelInventory = onCall(
  adminCallableOpts,
  async (request) => {
    await assertAdmin(request.auth as Auth | undefined);

    const input = (request.data || {}) as Data;
    const bookingId = stringValue(input.bookingId);
    if (!bookingId) {
      throw new HttpsError("invalid-argument", "bookingId is required.");
    }

    const snap = await db().collection("hotelBookingData").doc(bookingId).get();
    if (!snap.exists) {
      throw new HttpsError("not-found", "Booking not found.");
    }
    const booking = snap.data() || {};
    const fields = bookingInventoryFields(booking);

    const result = await releaseRoomsInTransaction(db(), {
      ...fields,
      bookingId,
    });

    if (result.ok && result.freedNights && result.freedNights.length > 0) {
      const hotel = await loadHotel(db(), fields.hotelUid);
      const config = await loadAvailabilityConfig(
        db(),
        fields.hotelUid,
        hotel,
      );
      if (config.notifyOnFreed) {
        await notifyAvailability(
          `<b>Availability restored (admin)</b>\nHotel: ${fields.hotelUid}\n` +
            `Package: ${fields.packageId}\n` +
            `Dates: ${result.freedNights.join(", ")}`,
        );
      }
    }

    return {
      ok: result.ok,
      audience: "admin",
      alreadyReleased: result.alreadyReleased,
      freedNights: result.freedNights,
    };
  },
);

/**
 * Admin: full unlock of locked rooms for a stay (check-in → check-out).
 *
 * Use when rooms are stuck reserved after cancel/hold, or ops need to free stock.
 *
 * Input (one of):
 *   - holdId   → free nights + **delete entire hold lock doc**
 *   - bookingId → free nights for that booking stay + delete related hold docs
 *   - hotelUid + packageId + checkIn + checkOut + rooms → force free nights only
 *
 * Options:
 *   - force: true → re-decrement ledger even if flags say already released
 *   - deleteRelatedHolds: true (default for bookingId)
 */
export const unlockHotelRoomLock = onCall(
  adminCallableOpts,
  async (request) => {
    await assertAdmin(request.auth as Auth | undefined);

    const input = (request.data || {}) as Data;
    const holdId = stringValue(input.holdId);
    const bookingId = stringValue(input.bookingId);
    const force = input.force === true || input.force === "true";
    const deleteRelatedHolds =
      input.deleteRelatedHolds !== false &&
      input.deleteRelatedHolds !== "false";

    // 1) Checkout soft-hold: free stay + remove whole lock document
    if (holdId) {
      const result = await unlockAndDeleteHold(db(), holdId, {force});
      if (!result.ok) {
        throw new HttpsError(
          "failed-precondition",
          result.reason || "Could not unlock hold.",
        );
      }
      logger.info(
        `[HotelUnlock] hold ${holdId} deleted=${result.deleted} force=${force}`,
      );
      await notifyAvailability(
        `<b>Room hold unlocked (admin)</b>\n` +
          `Hold: ${holdId}\n` +
          `Deleted lock doc: ${result.deleted ? "yes" : "no"}\n` +
          `Nights: ${(result.freedNights || []).join(", ") || "—"}`,
      );
      return {
        ok: true,
        audience: "admin",
        kind: "hold",
        holdId,
        deleted: result.deleted,
        freedNights: result.freedNights || [],
        force,
      };
    }

    // 2) Booking: free inventory from book dates + remove related hold locks
    if (bookingId) {
      const result = await unlockBookingStayLock(db(), bookingId, {
        force,
        deleteRelatedHolds,
      });
      if (!result.ok) {
        throw new HttpsError(
          result.reason === "booking_not_found" ? "not-found" : "failed-precondition",
          result.reason || "Could not unlock booking inventory.",
        );
      }
      logger.info(
        `[HotelUnlock] booking ${bookingId} holdsDeleted=${(result.holdsDeleted || []).join(",")}`,
      );
      await notifyAvailability(
        `<b>Booking rooms unlocked (admin)</b>\n` +
          `Booking: ${bookingId}\n` +
          `Holds deleted: ${(result.holdsDeleted || []).join(", ") || "none"}\n` +
          `Nights: ${(result.freedNights || []).join(", ") || "—"}`,
      );
      return {
        ok: true,
        audience: "admin",
        kind: "booking",
        bookingId,
        alreadyReleased: result.alreadyReleased === true,
        freedNights: result.freedNights || [],
        holdsDeleted: result.holdsDeleted || [],
        force,
      };
    }

    // 3) Direct stay unlock (no booking/hold id — ops repair)
    const hotelUid = stringValue(input.hotelUid || input.hotelId);
    const packageId = stringValue(input.packageId || input.roomId);
    const checkIn =
      toDateString(input.checkIn || input.checkInDate) ||
      stringValue(input.checkIn || input.checkInDate);
    const checkOut =
      toDateString(input.checkOut || input.checkOutDate) ||
      stringValue(input.checkOut || input.checkOutDate);
    const rooms = Math.max(
      1,
      Math.floor(Number(input.rooms || input.roomsHeld || 1) || 1),
    );

    if (!hotelUid || !packageId || !checkIn || !checkOut) {
      throw new HttpsError(
        "invalid-argument",
        "Provide holdId, bookingId, or hotelUid + packageId + checkIn + checkOut.",
      );
    }

    const stay = await forceUnlockStayNights(db(), {
      hotelUid,
      packageId,
      checkIn,
      checkOut,
      rooms,
      sourceId: stringValue(input.sourceId) || "manual",
      auditAction: "force_unlock_manual",
    });

    if (!stay.ok) {
      throw new HttpsError(
        "failed-precondition",
        "Could not force-unlock stay nights.",
      );
    }

    logger.info(
      `[HotelUnlock] manual stay hotel=${hotelUid} pkg=${packageId} rooms=${rooms}`,
    );

    return {
      ok: true,
      audience: "admin",
      kind: "stay",
      hotelUid,
      packageId,
      checkIn,
      checkOut,
      rooms,
      nights: stay.nights,
      freedNights: stay.freedNights,
      force: true,
    };
  },
);

// Public website booking + admin accept live in hotelBookingWithAvailability.ts
// (createHotelBookingWithAvailability, acceptHotelBookingWithAvailability).
