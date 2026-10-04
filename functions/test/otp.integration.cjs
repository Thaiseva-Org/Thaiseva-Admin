const {test, before} = require("node:test");
const assert = require("node:assert/strict");
const {initializeApp} = require("firebase-admin/app");
const {getAuth} = require("firebase-admin/auth");
const {getFirestore} = require("firebase-admin/firestore");
const {digest, POLICY} = require("../lib/otp/core");

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  throw new Error("Integration tests require Auth and Firestore emulators. Never run against production.");
}
const projectId = "demo-thaiseva-otp";
initializeApp({projectId});
process.env.OTP_HASH_KEY = "integration-secret-at-least-32-characters-long";
process.env.ZOHO_MAIL_API_KEY = "mock-token";
process.env.ZOHO_MAIL_API_URL = "https://api.zeptomail.com/v1.1/email";
process.env.OTP_SENDER_NAME = "Thaiseva";
process.env.OTP_REPLY_TO_EMAIL = "";
process.env.OTP_FROM_EMAIL = "no-reply@example.com";
process.env.OTP_BUSINESS_DOMAIN = "example.com";
process.env.OTP_ENFORCE_APP_CHECK = "false";
const sent = [];
let failDelivery = false;
require("../lib/otp/zoho").sendZohoOtp = async (_config, email, code) => {
  if (failDelivery) throw new Error("provider failed");
  sent.push({email, code});
};
const {sendEmailOtp, resendEmailOtp, verifyEmailOtp} = require("../lib/emailOtp");
const call = (fn, data, ip = "127.0.0.1") => fn.run({data, rawRequest: {ip}});
const refFor = (email) => getFirestore().collection("emailOtpChallenges").doc(digest(process.env.OTP_HASH_KEY, "email", email));
async function account(email) {
  const user = await getAuth().createUser({email});
  await getFirestore().collection("users").doc(user.uid).set({role: "Admin", status: "Verified"});
  return user;
}
before(async () => {
  await fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/${projectId}/databases/(default)/documents`, {method: "DELETE"});
  await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/emulator/v1/projects/${projectId}/accounts`, {method: "DELETE"});
});

test("send, concurrent verification, token sign-in, and replay protection", async () => {
  const email = "first@example.com";
  const user = await account(email);
  const result = await call(sendEmailOtp, {email});
  assert.equal(result.expiresAt - result.resendAt, POLICY.expiresMs - POLICY.cooldownMs);
  const persisted = (await refFor(email).get()).data();
  assert.equal(persisted.status, "sent");
  assert.equal(persisted.code, undefined);
  const code = sent.find((mail) => mail.email === email).code;
  assert.notEqual(persisted.hash, code);
  const attempts = await Promise.allSettled(Array.from({length: 4}, () =>
    call(verifyEmailOtp, {email, code, challengeId: result.challengeId})));
  assert.equal(attempts.filter((attempt) => attempt.status === "fulfilled").length, 1);
  const token = attempts.find((attempt) => attempt.status === "fulfilled").value.customToken;
  const response = await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=fake`, {
    method: "POST", headers: {"Content-Type": "application/json"},
    body: JSON.stringify({token, returnSecureToken: true}),
  });
  assert.equal(response.status, 200);
  const session = await response.json();
  assert.equal(typeof session.idToken, "string");
  const claims = JSON.parse(Buffer.from(session.idToken.split(".")[1], "base64url").toString());
  assert.equal(claims.sub, user.uid);
  await assert.rejects(call(verifyEmailOtp, {email, code, challengeId: result.challengeId}), {code: "unauthenticated"});
});
test("concurrent sends enforce cooldown, resend rotates code and preserves attempts", async () => {
  const email = "resend@example.com";
  await account(email);
  const results = await Promise.allSettled([call(sendEmailOtp, {email}), call(sendEmailOtp, {email})]);
  assert.equal(results.filter((item) => item.status === "fulfilled").length, 1);
  const first = results.find((item) => item.status === "fulfilled").value;
  await assert.rejects(call(resendEmailOtp, {email, challengeId: first.challengeId}), {code: "resource-exhausted"});
  await refFor(email).update({sentAt: Date.now() - POLICY.cooldownMs - 1000, attempts: 2});
  const second = await call(resendEmailOtp, {email, challengeId: first.challengeId});
  assert.notEqual(first.challengeId, second.challengeId);
  assert.equal((await refFor(email).get()).data().attempts, 2);
  await assert.rejects(call(verifyEmailOtp, {email, code: "000000", challengeId: first.challengeId}), {code: "unauthenticated"});
});
test("wrong guesses persist and lock sends across endpoint calls", async () => {
  const email = "locked@example.com";
  await account(email);
  const challenge = await call(sendEmailOtp, {email});
  const actual = sent.find((mail) => mail.email === email).code;
  const code = actual === "000000" ? "111111" : "000000";
  for (let i = 0; i < 5; i++) {
    await assert.rejects(call(verifyEmailOtp, {email, code, challengeId: challenge.challengeId}), {code: "unauthenticated"});
  }
  assert.equal((await refFor(email).get()).data().attempts, 5);
  await assert.rejects(call(sendEmailOtp, {email}), {code: "resource-exhausted"});
});
test("unknown and disabled accounts never receive codes or sessions", async () => {
  const unknown = await call(sendEmailOtp, {email: "unknown@example.com"});
  assert.ok(unknown.challengeId);
  assert.equal(sent.some((mail) => mail.email === "unknown@example.com"), false);
  const user = await account("disabled@example.com");
  await getAuth().updateUser(user.uid, {disabled: true});
  await call(sendEmailOtp, {email: user.email});
  assert.equal(sent.some((mail) => mail.email === user.email), false);
});
test("provider failure invalidates code without refunding abuse counters", async () => {
  const email = "failure@example.com";
  await account(email);
  failDelivery = true;
  try {
    await assert.rejects(call(sendEmailOtp, {email}), {code: "unavailable"});
  } finally {
    failDelivery = false;
  }
  const stored = (await refFor(email).get()).data();
  assert.equal(stored.status, "failed");
  assert.equal(stored.hash, "");
  assert.equal(stored.sends, 1);
});
test("expired code and account suspension are rejected", async () => {
  const email = "expiry@example.com";
  const user = await account(email);
  const challenge = await call(sendEmailOtp, {email});
  const code = sent.find((mail) => mail.email === email).code;
  await refFor(email).update({expiresAt: Date.now() - 1});
  await assert.rejects(call(verifyEmailOtp, {email, code, challengeId: challenge.challengeId}), {code: "unauthenticated"});
  await refFor(email).update({expiresAt: Date.now() + POLICY.expiresMs});
  await getFirestore().collection("users").doc(user.uid).update({isSuspended: true});
  await assert.rejects(call(verifyEmailOtp, {email, code, challengeId: challenge.challengeId}), {code: "unauthenticated"});
});
test("IP quotas apply across different emails", async () => {
  const ip = "192.0.2.10";
  for (let i = 0; i < 20; i++) await call(sendEmailOtp, {email: `quota${i}@example.com`}, ip);
  await assert.rejects(call(sendEmailOtp, {email: "overflow@example.com"}, ip), {code: "resource-exhausted"});
});
test("client access to OTP challenge and rate documents is denied", async () => {
  for (const collection of ["emailOtpChallenges", "emailOtpRateLimits"]) {
    const response = await fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/v1/projects/${projectId}/databases/(default)/documents/${collection}/test`);
    assert.equal(response.status, 403);
  }
});
