const {test} = require("node:test");
const assert = require("node:assert/strict");
const {POLICY, OtpError, normalizeEmail, generateOtp, digest, reserveOtp, checkOtp, takeRate} = require("../lib/otp/core");
const {sendZohoOtp, otpTemplate, validateMailConfig} = require("../lib/otp/zoho");
const key = "a-test-secret-with-at-least-32-characters";
const now = 1_000_000;
const challenge = "challenge-1";
const hash = digest(key, "login", "test@example.com", challenge, "000123");
const state = () => ({...reserveOtp(undefined, {challengeId: challenge, hash, uid: "uid-1"}, now), status: "sent"});
const mail = {apiKey: "test-token", apiUrl: "https://api.zeptomail.in/v1.1/email",
  from: "no-reply@example.com", senderName: "Thaiseva", businessDomain: "example.com"};

test("email normalization rejects malformed and injected inputs", () => {
  assert.equal(normalizeEmail(" User@Example.com "), "user@example.com");
  for (const value of [null, {}, "bad", "x@example.com\nBcc: other@example.com", "<x>@example.com"]) {
    assert.throws(() => normalizeEmail(value), OtpError);
  }
});
test("generated codes preserve six digits including leading zeros", () => {
  for (let i = 0; i < 1000; i++) assert.match(generateOtp(), /^\d{6}$/);
});
test("hashes are bound to email, purpose and challenge", () => {
  assert.notEqual(hash, digest(key, "reset", "test@example.com", challenge, "000123"));
  assert.notEqual(hash, digest(key, "login", "other@example.com", challenge, "000123"));
  assert.notEqual(hash, digest(key, "login", "test@example.com", "new", "000123"));
});
test("valid codes are consumed and cannot be replayed", () => {
  const result = checkOtp(state(), challenge, hash, now + 1);
  assert.equal(result.uid, "uid-1");
  assert.equal(result.state.hash, "");
  assert.equal(checkOtp(result.state, challenge, hash, now + 2).error.code, "unauthenticated");
});
test("expiry is enforced at the exact boundary", () => {
  assert.equal(checkOtp(state(), challenge, hash, now + POLICY.expiresMs).error.code, "unauthenticated");
});
test("pending or failed deliveries cannot be verified", () => {
  for (const status of ["pending", "failed"]) {
    assert.equal(checkOtp({...state(), status}, challenge, hash, now + 1).error.code, "unauthenticated");
  }
});
test("five wrong guesses lock verification and subsequent sends", () => {
  let current = state();
  for (let i = 0; i < POLICY.maxAttempts; i++) {
    const result = checkOtp(current, challenge, digest(key, "wrong"), now + 1);
    assert.equal(result.error.code, "unauthenticated");
    current = result.state;
  }
  assert.equal(current.attempts, 5);
  assert.ok(current.lockedUntil > now);
  assert.equal(checkOtp(current, challenge, hash, now + 2).error.code, "unauthenticated");
  assert.throws(() => reserveOtp(current, {challengeId: "new", hash, uid: "uid-1"}, now + 60_000), OtpError);
});
test("resend preserves attempts and invalidates previous challenge", () => {
  const previous = {...state(), attempts: 3};
  const next = {...reserveOtp(previous, {challengeId: "new", hash, uid: "uid-1"}, now + POLICY.cooldownMs), status: "sent"};
  assert.equal(next.attempts, 3);
  assert.equal(checkOtp(next, challenge, hash, now + POLICY.cooldownMs + 1).error.code, "unauthenticated");
});
test("cooldown and email quotas reset only at their boundaries", () => {
  assert.throws(() => reserveOtp(state(), {challengeId: "new", hash, uid: "uid-1"}, now + 59_999), OtpError);
  const capped = {...state(), sends: POLICY.maxSends};
  assert.throws(() => reserveOtp(capped, {challengeId: "new", hash, uid: "uid-1"}, now + 60_000), OtpError);
  assert.equal(reserveOtp(capped, {challengeId: "new", hash, uid: "uid-1"}, now + POLICY.windowMs).sends, 1);
});
test("unknown accounts cannot verify even a matching hash", () => {
  assert.equal(checkOtp({...state(), uid: null}, challenge, hash, now + 1).error.code, "unauthenticated");
});
test("rate quota rejects overflow and resets at boundary", () => {
  const capped = {windowStart: now, count: 20};
  assert.throws(() => takeRate(capped, now + 1, 20), OtpError);
  assert.equal(takeRate(capped, now + POLICY.windowMs, 20).count, 1);
});
test("template escapes brand and includes safety, expiry and plain text", () => {
  const template = otpTemplate("000123", "Thaiseva <test>");
  assert.ok(template.html.includes("&lt;test&gt;"));
  assert.ok(template.text.includes("000123"));
  assert.ok(template.text.includes("5 minutes"));
  assert.throws(() => otpTemplate("invalid", "Thaiseva"));
});
test("configuration rejects foreign hosts, redirects, and sender domain mismatch", () => {
  validateMailConfig(mail);
  for (const apiUrl of ["http://api.zeptomail.in/v1.1/email", "https://attacker.com/v1.1/email", "https://api.zeptomail.in/v1.1/email?x=1"]) {
    assert.throws(() => validateMailConfig({...mail, apiUrl}));
  }
  assert.throws(() => validateMailConfig({...mail, from: "x@other.com"}));
});
test("Zoho payload and authorization follow transactional mail API", async () => {
  await sendZohoOtp(mail, "test@example.com", "000123", "reference", async (url, options) => {
    assert.equal(url, mail.apiUrl);
    assert.equal(options.headers.Authorization, "Zoho-enczapikey test-token");
    assert.equal(options.redirect, "error");
    const body = JSON.parse(options.body);
    assert.equal(body.from.address, mail.from);
    assert.equal(body.to[0].email_address.address, "test@example.com");
    assert.equal(body.track_clicks, false);
    assert.ok(body.htmlbody.includes("000123"));
    return {ok: true, json: async () => ({data: [{code: "EM_101", message: "Email request received"}]})};
  });
});
test("Zoho errors and ambiguous responses fail closed without provider data exposure", async () => {
  await assert.rejects(sendZohoOtp(mail, "test@example.com", "000123", "reference",
    async () => ({ok: false, status: 401})), /HTTP 401/);
  await assert.rejects(sendZohoOtp(mail, "test@example.com", "000123", "reference",
    async () => ({ok: true, json: async () => ({error: {message: "private"}})})), /did not confirm/);
});
