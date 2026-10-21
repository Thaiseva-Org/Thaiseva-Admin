const test = require("node:test");
const assert = require("node:assert/strict");
const {
  paidPatch,
  presentmentFrom,
  sessionPresentment,
} = require("../lib/payments/markBookingPaid");

test("Adaptive Pricing: the customer's own currency is read from Stripe", () => {
  assert.deepEqual(
    presentmentFrom({presentment_details: {presentment_amount: 5807, presentment_currency: "usd"}}),
    {currency: "USD", amount: 58.07, amountMinor: 5807},
  );
  // Zero-decimal currencies have no minor unit.
  assert.deepEqual(
    presentmentFrom({presentment_details: {presentment_amount: 9170, presentment_currency: "jpy"}}),
    {currency: "JPY", amount: 9170, amountMinor: 9170},
  );
});

test("paying in THB or without details records nothing", () => {
  assert.equal(presentmentFrom({presentment_details: {presentment_amount: 195000, presentment_currency: "thb"}}), null);
  assert.equal(presentmentFrom({}, null, undefined), null);
  assert.equal(presentmentFrom({presentment_details: {presentment_amount: 1.5, presentment_currency: "usd"}}), null);
});

test("session details win, else the expanded PaymentIntent's", () => {
  const intent = {presentment_details: {presentment_amount: 551900, presentment_currency: "inr"}};
  assert.equal(sessionPresentment({payment_intent: intent}).currency, "INR");
  assert.equal(sessionPresentment({payment_intent: "pi_1"}), null);
  assert.equal(sessionPresentment({
    presentment_details: {presentment_amount: 5807, presentment_currency: "usd"},
    payment_intent: intent,
  }).currency, "USD");
});

test("paid bookings keep THB amounts and add stripePresentment", () => {
  const presentment = {currency: "USD", amount: 58.07, amountMinor: 5807};
  const patch = paidPatch({sessionId: "cs_1", amountTotal: 195000, currency: "thb", presentment});
  assert.equal(patch.stripeAmountMajor, 1950);
  assert.equal(patch.stripeCurrency, "thb");
  assert.deepEqual(patch.stripePresentment, presentment);
  assert.equal("stripePresentment" in paidPatch({sessionId: "cs_2", amountTotal: 195000}), false);
});
