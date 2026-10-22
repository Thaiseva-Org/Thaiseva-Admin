const {test, after} = require("node:test");
const assert = require("node:assert/strict");
const admin = require("firebase-admin");

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error("Integration tests require the Firestore emulator. Never run against production.");
}
admin.initializeApp({projectId: "demo-thaiseva-package-hold"});
const db = admin.firestore();
const {bookPaidPackageHold} = require("../lib/payments/markBookingPaid");
after(async () => { await admin.app().delete(); });

// A hold as the website's createSightseeingBooking writes it.
const hold = (overrides = {}) => ({
  userId: "customer-1", packageId: "pkg-1", arrivalDate: "2026-12-01", totalAmount: 1950,
  paymentMethod: "STRIPE", bookingFlow: "INSTANT", bookingFlowVersion: 1,
  status: "Accepted", bookingStatus: "AWAITING_PAYMENT", isBookingConfirmed: true, isPaymentDone: false,
  instantReservationExpiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + 30 * 60000),
  holdStatus: "HELD", expireAt: admin.firestore.Timestamp.fromMillis(Date.now() + 86400000),
  createdAt: admin.firestore.Timestamp.fromMillis(Date.now() - 60000), stripeSessionId: "cs_test_1",
  ...overrides,
});
const session = (holdId, id = "cs_test_1") => ({
  id, amount_total: 195000, currency: "thb", payment_intent: "pi_1",
  metadata: {bookingId: holdId, holdId, checkoutKind: "packageHold", userId: "customer-1", packageId: "pkg-1", bookingType: "package"},
});
const info = (id = "cs_test_1") => ({
  sessionId: id, paymentIntentId: "pi_1", amountTotal: 195000, currency: "thb",
  presentment: {currency: "USD", amount: 58.07, amountMinor: 5807},
});

test("a paid hold becomes its booking under the same ID, paid and confirmed", async () => {
  await db.collection("sightseeingCheckoutHolds").doc("pkg_a").set(hold());
  assert.equal(await bookPaidPackageHold(session("pkg_a"), info()), "pkg_a");
  const booking = (await db.collection("travelBookingDetails").doc("pkg_a").get()).data();
  assert.equal(booking.isPaymentDone, true);
  assert.equal(booking.paymentVerificationStatus, "VERIFIED");
  assert.equal(booking.status, "Accepted");
  assert.equal(booking.bookingStatus, "CONFIRMED");
  assert.equal(booking.amountPaid, 1950);
  assert.equal(booking.amountDue, 0);
  assert.equal(booking.stripeSessionId, "cs_test_1");
  assert.deepEqual(booking.stripePresentment, {currency: "USD", amount: 58.07, amountMinor: 5807});
  assert.equal(booking.holdStatus, undefined);
  assert.equal(booking.expireAt, undefined);
  assert.ok(booking.checkoutStartedAt);
  assert.equal((await db.collection("sightseeingCheckoutHolds").doc("pkg_a").get()).exists, false);

  // verifySession and the webhook both run: the second call changes nothing.
  assert.equal(await bookPaidPackageHold(session("pkg_a"), info()), "pkg_a");
  const again = (await db.collection("travelBookingDetails").doc("pkg_a").get()).data();
  assert.equal(again.amountPaid, 1950);
  assert.equal(again.possibleDoublePayment, undefined);
});

test("a payment on a released hold is booked for admin review", async () => {
  await db.collection("sightseeingCheckoutHolds").doc("pkg_b").set(hold({holdStatus: "RELEASED"}));
  await bookPaidPackageHold(session("pkg_b"), info());
  const booking = (await db.collection("travelBookingDetails").doc("pkg_b").get()).data();
  assert.equal(booking.isPaymentDone, true);
  assert.equal(booking.bookingStatus, "PAYMENT_REVIEW_REQUIRED");
  assert.equal(booking.isBookingConfirmed, false);
});

test("a missing hold still records the payment from the session", async () => {
  const id = await bookPaidPackageHold(session("pkg_gone", "cs_test_gone"), info("cs_test_gone"));
  assert.equal(id, "cs_test_gone");
  const booking = (await db.collection("travelBookingDetails").doc("cs_test_gone").get()).data();
  assert.equal(booking.isPaymentDone, true);
  assert.equal(booking.packageId, "pkg-1");
});
