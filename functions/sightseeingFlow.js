"use strict";

const DAY_MS = 86400000;
const PREPARATION_MESSAGE = "We need at least 2 full days to prepare your package. For tomorrow or the day after tomorrow, our team will check availability and confirm your request first. Payment is collected only after confirmation.";
const CAPACITY_MESSAGE = "The daily instant-booking limit has been reached for this date. Our team will check availability and confirm your request first. Payment is collected only after confirmation.";

// Instant card bookings wait here, under the ID of the booking they become,
// until Stripe reports the payment, so an unpaid checkout never reaches
// travelBookingDetails. A live hold takes a slot like a booking. Created by the
// website's createSightseeingBooking; Admin turns paid holds into bookings.
const CHECKOUT_HOLDS = "sightseeingCheckoutHolds";
// Stripe metadata.checkoutKind of a hold's Checkout (metadata.holdId = its ID).
const HOLD_CHECKOUT_KIND = "packageHold";
const HOLD_MS = 35 * 60000;

function thaiDate(now = new Date()) {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

function dateDecision(date, now = new Date()) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "") || Number.isNaN(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) {
        return { valid: false, reasonCode: "INVALID_DATE", message: "Choose a valid booking date." };
    }
    const daysAhead = Math.round((Date.parse(date) - Date.parse(thaiDate(now))) / DAY_MS);
    return { valid: daysAhead >= 1, daysAhead, preparationOk: daysAhead >= 3, reasonCode: daysAhead < 1 ? "INVALID_DATE" : daysAhead < 3 ? "PREPARATION_REQUIRED" : null,
        message: daysAhead < 1 ? "Package bookings start from tomorrow. Please choose tomorrow or a later date." : daysAhead < 3 ? PREPARATION_MESSAGE : null };
}

function countsTowardDailyLimit(data, date, now = new Date()) {
    const raw = data.arrivalDate || data.travelDate || data.pickUpTime;
    const tourDate = typeof raw === "string" ? raw.slice(0, 10) : raw?.toDate ? thaiDate(raw.toDate()) : "";
    if (tourDate !== date || /CANCEL|REJECT|DENIED|EXPIRED/.test(`${data.status || ""} ${data.bookingStatus || ""}`.toUpperCase())) return false;
    if (data.isPaymentDone === true) return true;
    if (data.bookingFlow === "INSTANT" && data.paymentMethod === "STRIPE" && data.instantReservationExpiresAt) {
        const expiry = data.instantReservationExpiresAt.toDate?.() || new Date(data.instantReservationExpiresAt);
        return expiry > now;
    }
    return data.isBookingConfirmed === true || /ACCEPT|CONFIRM|DONE/.test(`${data.status || ""} ${data.bookingStatus || ""}`.toUpperCase());
}

function availability(date, settings, docs, now = new Date(), excludeId = "", packageData = null) {
    const decision = dateDecision(date, now);
    const configured = Number(settings?.globalDailyLimit);
    const globalDailyLimit = Number.isInteger(configured) && configured >= 0 ? configured : 20;
    const pkgDaily = Number(packageData?.dailyLimit);
    const dailyLimit = Number.isInteger(pkgDaily) && pkgDaily >= 0 ? pkgDaily : globalDailyLimit;
    const dailyCount = docs.filter(doc => doc.id !== excludeId && countsTowardDailyLimit(doc.data(), date, now)).length;
    const canInstantBook = decision.valid && decision.preparationOk && dailyCount < dailyLimit;
    return { ...decision, dailyLimit, dailyCount, canInstantBook, bookingFlow: canInstantBook ? "INSTANT" : "REQUEST",
        reasonCode: decision.reasonCode || (canInstantBook ? null : "DAILY_LIMIT_REACHED"),
        message: decision.message || (canInstantBook ? "Instant booking is available for this date within the daily limit." : CAPACITY_MESSAGE) };
}

async function checkAvailability(db, date, now = new Date(), packageId = "") {
    const [settings, bookings, packageDoc] = await Promise.all([
        db.collection("settings").doc("sightseeingConfig").get(),
        db.collection("travelBookingDetails").get(),
        packageId ? db.collection("travelServices").doc(packageId).get() : Promise.resolve(null)
    ]);
    const packageData = packageDoc?.exists ? packageDoc.data() : null;
    return availability(date, settings.data(), bookings.docs, now, "", packageData);
}

// A per-date document serializes all new instant reservations. Pending requests
// do not consume capacity; paid/accepted bookings and live checkout holds do.
async function reserveBooking(db, admin, ref, data) {
    return db.runTransaction(async tx => {
        const now = new Date();
        const date = data.arrivalDate;
        const lock = db.collection("_sightseeingBookingDays").doc(date);
        const existing = await tx.get(ref);
        if (existing.exists) {
            const previous = existing.data();
            if (previous.bookingFlow === "INSTANT" && !previous.isPaymentDone && previous.instantReservationExpiresAt?.toDate() <= now && !/CANCEL|REJECT|DENIED/.test(`${previous.status || ""} ${previous.bookingStatus || ""}`.toUpperCase())) {
                const expired = { ...previous, bookingFlow: "REQUEST", bookingFlowReason: "RESERVATION_EXPIRED", bookingFlowMessage: "Your checkout reservation has expired. Our team will confirm availability first, then payment will reopen.", status: "Pending", bookingStatus: "PENDING_REVIEW", isBookingConfirmed: false, payNow: false, amountDue: 0 };
                tx.set(ref, expired);
                return { data: expired, duplicate: true };
            }
            return { data: previous, duplicate: true };
        }
        const packageDoc = data.packageId ? await tx.get(db.collection("travelServices").doc(data.packageId)) : null;
        const packageData = packageDoc?.exists ? packageDoc.data() : null;
        const [settings, bookings] = await Promise.all([tx.get(db.collection("settings").doc("sightseeingConfig")), tx.get(db.collection("travelBookingDetails")), tx.get(lock)]);
        const result = availability(date, settings.data(), bookings.docs, now, ref.id, packageData);
        if (!result.valid) {
            const error = new Error(result.message);
            Object.assign(error, { statusCode: 400, reasonCode: result.reasonCode });
            throw error;
        }
        const booking = { ...data, bookingFlow: result.bookingFlow, bookingFlowVersion: 1, bookingFlowReason: result.reasonCode, bookingFlowMessage: result.message };
        if (!result.canInstantBook) Object.assign(booking, { status: "Pending", bookingStatus: "PENDING_REVIEW", isBookingConfirmed: false, isPaymentDone: false, paymentVerificationStatus: "NOT_PAID", customerQrPaymentConfirmed: false, payNow: false, amountDue: 0 });
        else {
            Object.assign(booking, { status: "Accepted", bookingStatus: "AWAITING_PAYMENT", isBookingConfirmed: true, autoAccepted: true, payNow: true });
            if (booking.paymentMethod === "STRIPE") booking.instantReservationExpiresAt = admin.firestore.Timestamp.fromMillis(now.getTime() + 35 * 60000);
            tx.set(lock, { updatedAt: admin.firestore.FieldValue.serverTimestamp() });
        }
        tx.create(ref, booking);
        return { data: booking, duplicate: false };
    });
}

function liveHold(data, now = new Date()) {
    const expiry = data?.instantReservationExpiresAt?.toDate?.();
    return Boolean(expiry) && expiry > now && data.holdStatus !== "RELEASED";
}

// Status of a booking paid from a hold. A hold outlives its Checkout and is
// released only after the Checkout is expired, so a payment always fell inside
// it: confirmed. Paid although released (a race): the admin must review it.
function paidHoldStatus(hold) {
    if (hold.holdStatus !== "RELEASED") return { status: "Accepted", bookingStatus: "CONFIRMED", isBookingConfirmed: true, autoAccepted: true };
    return { status: "Payment received - review required", bookingStatus: "PAYMENT_REVIEW_REQUIRED", isBookingConfirmed: false, autoAccepted: false, bookingFlow: "REQUEST", bookingFlowReason: "RESERVATION_EXPIRED" };
}

// Writes a paid checkout hold as its booking (same ID) and deletes the hold.
// `paidFields(hold)` adds the payment and status fields (see paidHoldStatus).
// Result: "created", "exists" (already a booking; mark that paid instead) or
// "missing".
async function bookPaidHold(db, admin, holdId, paidFields) {
    const bookingRef = db.collection("travelBookingDetails").doc(holdId);
    const holdRef = db.collection(CHECKOUT_HOLDS).doc(holdId);
    return db.runTransaction(async tx => {
        const booking = await tx.get(bookingRef);
        const hold = await tx.get(holdRef);
        if (booking.exists) return { result: "exists", data: booking.data() };
        if (!hold.exists) return { result: "missing" };
        // eslint-disable-next-line no-unused-vars
        const { holdStatus, holdReleasedAt, expireAt, ...held } = hold.data();
        const now = admin.firestore.FieldValue.serverTimestamp();
        const data = { ...held, checkoutStartedAt: held.createdAt || null, orderedAt: now, createdAt: now, ...paidFields(hold.data()) };
        tx.create(bookingRef, data);
        tx.delete(holdRef);
        return { result: "created", data };
    });
}

function approvedForPayment(data, now = new Date()) {
    if (/CANCEL|REJECT|DENIED|EXPIRED/.test(`${data.status || ""} ${data.bookingStatus || ""}`.toUpperCase())) return false;
    if (data.isBookingConfirmed !== true && !/^(ACCEPTED|CONFIRMED|AWAITING_PAYMENT)$/.test(String(data.status || "").toUpperCase())) return false;
    if (data.bookingFlow === "INSTANT" && !data.isPaymentDone && data.instantReservationExpiresAt) return data.instantReservationExpiresAt.toDate() > now;
    return true;
}

module.exports = { thaiDate, dateDecision, countsTowardDailyLimit, availability, checkAvailability, reserveBooking, approvedForPayment, PREPARATION_MESSAGE, CAPACITY_MESSAGE, liveHold, paidHoldStatus, bookPaidHold, CHECKOUT_HOLDS, HOLD_CHECKOUT_KIND, HOLD_MS };
