const {test} = require("node:test");
const assert = require("node:assert/strict");
const {
  ownsBooking,
  validatedFile,
  searchTerms,
  extractLinks,
  id,
} = require("../lib/customerChatCore");

test("booking access uses customer identity, never provider ownership or conflicting legacy IDs", () => {
  assert.equal(ownsBooking({authUid: "alice", userId: "bob"}, "bob"), false);
  assert.equal(ownsBooking({hotelUid: "alice"}, "alice"), false);
  assert.equal(ownsBooking({uId: "alice"}, "alice"), true);
  assert.equal(ownsBooking({userId: "alice"}, "alice"), true);
});
test("file validation rejects forged MIME, SVG, oversized and malformed data", () => {
  assert.throws(() =>
    validatedFile(Buffer.from("<script>bad</script>").toString("base64"), "image/png"),
  );
  assert.throws(() => validatedFile(Buffer.from("<svg/>").toString("base64"), "image/svg+xml"));
  assert.throws(() => validatedFile("not base64", "application/pdf"));
  assert.throws(() =>
    validatedFile(Buffer.alloc(8 * 1024 * 1024 + 1).toString("base64"), "application/pdf"),
  );
  assert.equal(
    validatedFile(Buffer.from("%PDF-1.7\nfixture").toString("base64"), "application/pdf").category,
    "documents",
  );
});
test("search covers references, filenames, URL domains and Unicode with bounded indexes", () => {
  const result = searchTerms("Booking TS1234 invoice.pdf https://thaiseva.com กรุงเทพ");
  for (const value of ["book", "ts123", "invoice", "thaiseva", "กรุง"])
    assert.ok(result.includes(value), value);
  assert.ok(searchTerms("abcdefghij ".repeat(10000)).length <= 1200);
});
test("link extraction only emits bounded HTTP(S) links without credentials", () => {
  assert.deepEqual(
    extractLinks("See https://thaiseva.com/booking. javascript:alert(1) https://u:p@example.com"),
    ["https://thaiseva.com/booking"],
  );
  assert.throws(() => id("../other"));
});
