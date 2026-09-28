import * as admin from "firebase-admin";
import type Stripe from "stripe";
import {lockStock, loadHotel, loadPackage, getRoomPricing} from "../utils/hotelStock";
import {listStayNights} from "../utils/hotelAvailability";
import {hotelStayAmount, requestedExtraBedCount} from "../utils/hotelBedPricing";
import {createCheckoutSessionCore, expireCheckoutSessionSafe} from "./createCheckoutSessionCore";
import {HttpError, stringValue} from "./corsAuth";
import {paidPatch} from "./markBookingPaid";

const db = () => admin.firestore();
const checkoutCollection = "hotelCheckoutSessions";

export const createInstantHotelCheckout = async (
  body: Record<string, unknown>, uid: string, authEmail?: string,
) => {
  const holdId = stringValue(body.holdId || body.lockId, 120);
  const lockSnap = await db().collection("hotelLocks").doc(holdId).get();
  const lock = lockSnap.data() || {};
  const expiresAt = lock.expiresAt as admin.firestore.Timestamp | undefined;
  if (!lockSnap.exists || lock.kind !== "hold" || lock.status !== "active" ||
      !expiresAt || expiresAt.toMillis() <= Date.now()) {
    throw new HttpError(400, "A live hotel hold is required.", "INVALID_HOLD");
  }
  if (stringValue(lock.userId, 128) !== uid) {
    throw new HttpError(403, "This hold belongs to another user.", "FORBIDDEN");
  }
  const rooms = Number(lock.rooms);
  const nights = listStayNights(lock.checkIn, lock.checkOut).length;
  if (!Number.isInteger(rooms) || rooms < 1 || nights < 1) {
    throw new HttpError(400, "Hold has invalid rooms or stay dates.", "INVALID_HOLD");
  }
  const aliases: Record<string, string> = {
    packageId: "roomId", checkIn: "checkInDate", checkOut: "checkOutDate",
  };
  for (const [key, expected] of [
    ["hotelId", lock.hotelId], ["packageId", lock.packageId],
    ["checkIn", lock.checkIn], ["checkOut", lock.checkOut],
  ]) {
    const supplied = body[key] ?? body[aliases[key] || key];
    if (supplied != null && stringValue(supplied) !== stringValue(expected)) {
      throw new HttpError(400, `${key} does not match the hold.`, "HOLD_MISMATCH");
    }
  }
  if (body.rooms != null && Number(body.rooms) !== rooms) {
    throw new HttpError(400, "Room count does not match the hold.", "HOLD_MISMATCH");
  }
  let extraBedCountRequested: number;
  try {
    extraBedCountRequested = requestedExtraBedCount(body, rooms);
  } catch (error) {
    throw new HttpError(400, (error as Error).message, "INVALID_ARGUMENT");
  }
  const [hotel, pkg] = await Promise.all([
    loadHotel(db(), stringValue(lock.hotelId)),
    loadPackage(db(), stringValue(lock.packageId), stringValue(lock.hotelId)),
  ]);
  if (!hotel || !pkg) {
    throw new HttpError(400, "Hotel room is unavailable.", "INVALID_HOTEL");
  }
  const pricing = getRoomPricing(pkg, hotel);
  if (!Number.isFinite(pricing.roomPrice) || pricing.roomPrice <= 0 ||
      !Number.isFinite(pricing.extraBedPrice) || pricing.extraBedPrice < 0 ||
      (extraBedCountRequested > 0 && !pricing.allowExtraBed)) {
    throw new HttpError(400, "Hotel room or extra-bed pricing is unavailable.", "INVALID_AMOUNT");
  }
  const amount = hotelStayAmount(
    pricing.roomPrice, rooms, nights, pricing.extraBedPrice, extraBedCountRequested,
  );
  if (amount < 20 || amount > 500_000) {
    throw new HttpError(400, "Amount is outside the online payment range.", "INVALID_AMOUNT");
  }
  const guestName = stringValue(body.fullName || body.guestName, 120);
  const guestEmail = stringValue(body.guestEmail || body.email || authEmail, 200).toLowerCase();
  const guestPhone = stringValue(body.guestPhone || body.phone, 40);
  const adults = body.adults == null ? 1 : Number(body.adults);
  const children = body.children == null ? 0 : Number(body.children);
  if (!Number.isInteger(adults) || adults < 1 ||
      !Number.isInteger(children) || children < 0) {
    throw new HttpError(400, "Guest counts must be nonnegative integers with at least one adult.", "INVALID_ARGUMENT");
  }
  if (!guestName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail) || !guestPhone) {
    throw new HttpError(400, "Guest name, email and phone are required.", "INVALID_ARGUMENT");
  }
  const session = await createCheckoutSessionCore({
    amount,
    currency: "thb",
    productName: pricing.hotelName,
    customerEmail: guestEmail,
    successUrl: stringValue(body.successUrl || body.success_url, 2000),
    cancelUrl: stringValue(body.cancelUrl || body.cancel_url, 2000),
    metadata: {
      bookingType: "hotel", userId: uid,
      extra: {holdId, checkoutKind: "instantHotel"},
    },
    expiresAt: Math.floor(Date.now() / 1000) + 31 * 60,
    idempotencyKey: `instant_hotel_${holdId}_${uid}`.slice(0, 255),
  });
  try {
    await db().runTransaction(async (tx) => {
      const fresh = (await tx.get(lockSnap.ref)).data() || {};
      const freshExpiry = fresh.expiresAt as admin.firestore.Timestamp | undefined;
      if (fresh.kind !== "hold" || fresh.status !== "active" ||
          fresh.userId !== uid || !freshExpiry || freshExpiry.toMillis() <= Date.now()) {
        throw new Error("Hotel hold expired while starting checkout.");
      }
      tx.update(lockSnap.ref, {
        expiresAt: admin.firestore.Timestamp.fromMillis(
          Math.max(freshExpiry.toMillis(), (session.expiresAt || 0) * 1000),
        ),
        checkoutSessionId: session.id,
      });
    });
  } catch (error) {
    await expireCheckoutSessionSafe(session.id);
    throw new HttpError(400, (error as Error).message, "INVALID_HOLD");
  }
  await db().collection(checkoutCollection).doc(session.id).set({
    sessionId: session.id, holdId, userId: uid,
    hotelId: lock.hotelId, packageId: lock.packageId,
    hotelName: pricing.hotelName, roomName: pricing.roomName,
    checkIn: lock.checkIn, checkOut: lock.checkOut, rooms, nights,
    adults, children,
    fullName: guestName, guestEmail, guestPhone,
    specialRequests: stringValue(body.specialRequests || body.notes, 500),
    roomPrice: pricing.roomPrice, extraBedPrice: pricing.extraBedPrice,
    extraBedCountRequested, extraBedCount: extraBedCountRequested,
    amountTHB: amount, currency: "THB", status: "OPEN",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  }, {merge: true});
  return {holdId, amount, session};
};

export const upsertInstantHotelFromPaidSession = async (
  session: Stripe.Checkout.Session,
): Promise<string> => {
  if (session.payment_status !== "paid") {
    throw new Error("Hotel Checkout session is not paid.");
  }
  const meta = session.metadata || {};
  const checkoutRef = db().collection(checkoutCollection).doc(session.id);
  const checkoutSnap = await checkoutRef.get();
  if (!checkoutSnap.exists) throw new Error("Hotel checkout details not found.");
  const checkout = checkoutSnap.data() || {};
  if (checkout.holdId !== meta.holdId || checkout.userId !== meta.userId ||
      session.currency?.toLowerCase() !== "thb" ||
      session.amount_total !== Math.round(Number(checkout.amountTHB) * 100)) {
    throw new Error("Paid session does not match hotel checkout details.");
  }
  const bookingRef = db().collection("hotelBookingData").doc(session.id);
  const existing = await bookingRef.get();
  if (existing.exists) return bookingRef.id;
  const holdRef = db().collection("hotelLocks").doc(String(checkout.holdId));
  const holdSnap = await holdRef.get();
  const hold = holdSnap.data() || {};
  if (!holdSnap.exists || hold.userId !== checkout.userId ||
      (hold.status === "converted" && hold.bookingId !== bookingRef.id)) {
    throw new Error("Hotel hold was used by another booking.");
  }
  if (hold.status === "active") {
    const converted = await lockStock(db(), {
      action: "convert", lockId: String(checkout.holdId),
      bookingId: bookingRef.id, userId: String(checkout.userId),
    });
    if (!converted.ok) throw new Error(`Could not consume paid hotel hold: ${converted.error}`);
  } else if (hold.status !== "converted") {
    throw new Error("Paid hotel hold is no longer active.");
  }
  const confirmedHold = (await holdRef.get()).data() || {};
  if (confirmedHold.bookingId !== bookingRef.id) {
    throw new Error("Hotel hold was used by another booking.");
  }
  const paymentIntentId = typeof session.payment_intent === "string" ?
    session.payment_intent : session.payment_intent?.id;
  await db().runTransaction(async (tx) => {
    if ((await tx.get(bookingRef)).exists) return;
    tx.create(bookingRef, {
      userId: checkout.userId, authUid: checkout.userId,
      hotelId: checkout.hotelId, hotelUid: checkout.hotelId,
      packageId: checkout.packageId, roomId: checkout.packageId,
      hotelName: checkout.hotelName, roomName: checkout.roomName,
      checkIn: checkout.checkIn, checkOut: checkout.checkOut,
      checkInDate: checkout.checkIn, checkOutDate: checkout.checkOut,
      rooms: checkout.rooms, noOfRooms: checkout.rooms,
      roomsInstant: checkout.rooms, roomsPending: 0,
      acceptedRooms: checkout.rooms, nights: checkout.nights,
      adults: checkout.adults, children: checkout.children,
      fullName: checkout.fullName, guestName: checkout.fullName,
      guestEmail: checkout.guestEmail, email: checkout.guestEmail,
      guestPhone: checkout.guestPhone, phone: checkout.guestPhone,
      specialRequests: checkout.specialRequests,
      extraBed: Number(checkout.extraBedCount) > 0,
      extraBedRequested: Number(checkout.extraBedCountRequested) > 0,
      extraBedCountRequested: checkout.extraBedCountRequested,
      extraBedCount: checkout.extraBedCount,
      roomPrice: checkout.roomPrice, extraBedPrice: checkout.extraBedPrice,
      amountTHB: checkout.amountTHB, amount: checkout.amountTHB,
      totalAmount: checkout.amountTHB, subtotal: checkout.amountTHB,
      amountPaid: checkout.amountTHB, amountDue: 0, currency: "THB",
      bookingStatus: "ACCEPTED", status: "Accepted",
      isBookingConfirmed: true, autoAccepted: true,
      acceptanceMethod: "AUTO_STOCK", inventoryReserved: true,
      inventoryReleased: false, stockLockId: checkout.holdId,
      holdId: checkout.holdId, stockModel: "v2_numbers",
      sourcePath: "stock_auto", payNow: false,
      ...paidPatch({
        sessionId: session.id, paymentIntentId,
        amountTotal: session.amount_total, currency: session.currency,
        customerEmail: session.customer_email,
      }),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    tx.set(checkoutRef, {
      status: "COMPLETED", bookingId: bookingRef.id,
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, {merge: true});
  });
  return bookingRef.id;
};
