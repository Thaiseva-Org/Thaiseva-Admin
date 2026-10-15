import test from "node:test";
import assert from "node:assert/strict";
import { hasAdminAccess } from "../src/utils/adminAccessPolicy.js";

test("only protected roles or explicit admin claims grant access", () => {
  for (const role of [undefined, "Customer", "Partner", "Sub Admin", "master"]) {
    assert.equal(hasAdminAccess({}, { role, email: "admin@gmail.com" }), false);
  }
  assert.equal(hasAdminAccess({}, {}), false);
  assert.equal(hasAdminAccess({ admin: "true" }, {}), false);
  assert.equal(hasAdminAccess({}, { role: "Admin" }), true);
  assert.equal(hasAdminAccess({}, { role: "admin" }), true);
  assert.equal(hasAdminAccess({ admin: true }, {}), true);
});

test("suspension overrides roles and claims", () => {
  assert.equal(hasAdminAccess({ admin: true }, { role: "Admin", isSuspended: true }), false);
});
