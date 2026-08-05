/**
 * Rebuild hotelRoomInventory night.reserved from real bookings
 * (inventoryReserved && !inventoryReleased && not canceled).
 * Also force-unlock specified booking IDs if --unlock-all-reserved.
 *
 *   node scripts/repairNightReserved.js
 *   node scripts/repairNightReserved.js --unlock-bookings
 */
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const os = require("os");
const https = require("https");

const PROJECT_ID = process.env.GCLOUD_PROJECT || "gothai-ffea1";
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const UNLOCK_BOOKINGS = process.argv.includes("--unlock-bookings");

const FIREBASE_CLI_CLIENT = {
  client_id:
    "563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com",
  client_secret: "jQRWCqNYY7JMqGxD9HI3N9e0",
};

function loadCliTokens() {
  const f = path.join(os.homedir(), ".config", "configstore", "firebase-tools.json");
  return JSON.parse(fs.readFileSync(f, "utf8")).tokens;
}

function httpsJson(method, url, headers, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request(
      {
        method,
        hostname: u.hostname,
        path: u.pathname + u.search,
        headers: {
          ...headers,
          ...(body ?
            {
              "Content-Type": "application/json",
              "Content-Length": Buffer.byteLength(body),
            } :
            {}),
        },
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          let json = null;
          try {
            json = text ? JSON.parse(text) : null;
          } catch {
            json = {raw: text};
          }
          if (res.statusCode >= 400) {
            reject(
              Object.assign(new Error(`${method} ${res.statusCode} ${text.slice(0, 400)}`), {
                status: res.statusCode,
                body: json,
              }),
            );
          } else resolve(json);
        });
      },
    );
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

async function getAccessToken(tokens) {
  if (
    tokens.access_token &&
    tokens.expires_at &&
    Number(tokens.expires_at) > Date.now() + 60_000
  ) {
    return tokens.access_token;
  }
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: tokens.refresh_token,
    client_id: FIREBASE_CLI_CLIENT.client_id,
    client_secret: FIREBASE_CLI_CLIENT.client_secret,
  }).toString();
  const result = await new Promise((resolve, reject) => {
    const req = https.request(
      {
        method: "POST",
        hostname: "oauth2.googleapis.com",
        path: "/token",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve(JSON.parse(Buffer.concat(chunks).toString())));
      },
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
  if (!result.access_token) throw new Error(JSON.stringify(result));
  return result.access_token;
}

const auth = (token) => ({Authorization: `Bearer ${token}`});

function fromFields(fields = {}) {
  const out = {};
  for (const [k, v] of Object.entries(fields || {})) out[k] = decode(v);
  return out;
}
function decode(v) {
  if (!v) return null;
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return Number(v.doubleValue);
  if ("booleanValue" in v) return v.booleanValue;
  if ("timestampValue" in v) return v.timestampValue;
  if ("nullValue" in v) return null;
  if ("mapValue" in v) return fromFields(v.mapValue.fields || {});
  if ("arrayValue" in v) return (v.arrayValue.values || []).map(decode);
  return null;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const toDateString = (value) => {
  if (!value) return null;
  if (typeof value === "string" && DATE_RE.test(value.trim())) return value.trim();
  if (typeof value === "string" && value.includes("T")) {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) {
      return new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Bangkok",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(d);
    }
  }
  return null;
};

const listStayNights = (checkIn, checkOut) => {
  const startStr = toDateString(checkIn);
  const endStr = toDateString(checkOut);
  if (!startStr || !endStr) return [];
  const nights = [];
  let cursor = new Date(`${startStr}T12:00:00+07:00`);
  const end = new Date(`${endStr}T12:00:00+07:00`);
  let guard = 0;
  while (cursor < end && guard < 366) {
    nights.push(
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Bangkok",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(cursor),
    );
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
    guard += 1;
  }
  return nights;
};

const isCanceled = (b) => {
  const s = String(b.bookingStatus || b.status || "").toUpperCase();
  return ["CANCELED", "CANCELLED", "REJECTED", "DENIED"].some((x) => s.includes(x));
};

async function runQuery(token, structuredQuery) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:runQuery`;
  const res = await httpsJson(
    "POST",
    url,
    auth(token),
    JSON.stringify({structuredQuery}),
  );
  return (res || [])
    .filter((x) => x.document)
    .map((x) => ({
      id: x.document.name.split("/").pop(),
      _name: x.document.name,
      ...fromFields(x.document.fields),
    }));
}

async function listNights(token, parentKey) {
  const url = `${BASE}/hotelRoomInventory/${parentKey}/nights?pageSize=300`;
  try {
    const res = await httpsJson("GET", url, auth(token));
    return (res.documents || []).map((d) => ({
      date: d.name.split("/").pop(),
      name: d.name,
      ...fromFields(d.fields),
    }));
  } catch (e) {
    if (e.status === 404) return [];
    throw e;
  }
}

async function patchNight(token, parentKey, date, fields) {
  const paths = Object.keys(fields)
    .map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`)
    .join("&");
  const url = `${BASE}/hotelRoomInventory/${parentKey}/nights/${date}?${paths}`;
  const bodyFields = {};
  for (const [k, v] of Object.entries(fields)) {
    if (typeof v === "number") bodyFields[k] = {integerValue: String(Math.floor(v))};
    else if (typeof v === "string") bodyFields[k] = {stringValue: v};
  }
  return httpsJson("PATCH", url, auth(token), JSON.stringify({fields: bodyFields}));
}

async function patchBookingUnlock(token, bookingName) {
  const url =
    `https://firestore.googleapis.com/v1/${bookingName}?` +
    [
      "updateMask.fieldPaths=inventoryReserved",
      "updateMask.fieldPaths=inventoryReleased",
      "updateMask.fieldPaths=bookingStatus",
      "updateMask.fieldPaths=status",
      "updateMask.fieldPaths=isBookingConfirmed",
    ].join("&");
  return httpsJson(
    "PATCH",
    url,
    auth(token),
    JSON.stringify({
      fields: {
        inventoryReserved: {booleanValue: false},
        inventoryReleased: {booleanValue: true},
        bookingStatus: {stringValue: "CANCELED"},
        status: {stringValue: "Canceled"},
        isBookingConfirmed: {booleanValue: false},
      },
    }),
  );
}

async function main() {
  const tokens = loadCliTokens();
  const token = await getAccessToken(tokens);
  console.log(`[repair] project=${PROJECT_ID} unlockBookings=${UNLOCK_BOOKINGS}`);

  // All currently reserved bookings
  let reservedBookings = await runQuery(token, {
    from: [{collectionId: "hotelBookingData"}],
    where: {
      fieldFilter: {
        field: {fieldPath: "inventoryReserved"},
        op: "EQUAL",
        value: {booleanValue: true},
      },
    },
    limit: 500,
  });

  reservedBookings = reservedBookings.filter(
    (b) => !isCanceled(b) && b.inventoryReleased !== true,
  );

  console.log(`[repair] active inventoryReserved bookings: ${reservedBookings.length}`);
  for (const b of reservedBookings) {
    console.log(
      `  ${b.id} hotel=${b.hotelUid || b.hotelId} pkg=${b.packageId || b.roomId} ` +
        `rooms=${b.rooms || b.noOfRooms} ${b.checkInDate || b.checkIn}→${b.checkOutDate || b.checkOut} ` +
        `${b.bookingStatus || b.status}`,
    );
  }

  if (UNLOCK_BOOKINGS) {
    console.log("[repair] Unlocking/canceling all reserved bookings...");
    for (const b of reservedBookings) {
      try {
        await patchBookingUnlock(token, b._name);
        console.log(`  unlocked+canceled ${b.id}`);
      } catch (e) {
        console.warn(`  fail unlock ${b.id}`, e.message);
      }
    }
    reservedBookings = [];
  }

  // Group by hotel_package
  const byParent = new Map();
  for (const b of reservedBookings) {
    const hotelUid = String(b.hotelUid || b.hotelId || "").trim();
    const packageId = String(b.packageId || b.roomId || "").trim();
    if (!hotelUid || !packageId) continue;
    const key = `${hotelUid}_${packageId}`;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key).push(b);
  }

  // Also scan known inventory parents from bookings + hardcode from audit UI
  // Rebuild every parent that has night docs mentioned by bookings
  const parentsToFix = new Set(byParent.keys());

  // Also scan any parent keys we know from previous session
  // Find parents by listing is hard; use bookings only + if unlock, still need to zero nights
  // After unlock all, we need to zero reserved on nights that still have reserved>0
  // Strategy: for each parent in byParent (or empty after unlock), list nights and set reserved

  // If unlocked all, still need parents from previous bookings list
  if (UNLOCK_BOOKINGS) {
    // Re-read list we logged - use original keys from before clear
    // re-fetch canceled still have hotelUid
    const all = await runQuery(token, {
      from: [{collectionId: "hotelBookingData"}],
      where: {
        fieldFilter: {
          field: {fieldPath: "inventoryReleased"},
          op: "EQUAL",
          value: {booleanValue: true},
        },
      },
      limit: 200,
    });
    for (const b of all) {
      const hotelUid = String(b.hotelUid || b.hotelId || "").trim();
      const packageId = String(b.packageId || b.roomId || "").trim();
      if (hotelUid && packageId) parentsToFix.add(`${hotelUid}_${packageId}`);
    }
  }

  // Always include parents from reserved bookings before unlock was applied
  // (already in parentsToFix)

  // Also query inventoryReserved false recently - skip

  // Known problem hotel from user report
  parentsToFix.add("ajA7wviIAeDzIyyiYRCu_1774262764415");

  console.log(`[repair] parents to fix: ${[...parentsToFix].join(", ")}`);

  for (const parentKey of parentsToFix) {
    const bookings = byParent.get(parentKey) || [];
    const roomsByDate = {};
    for (const b of bookings) {
      const rooms = Math.max(
        1,
        Math.floor(Number(b.rooms ?? b.noOfRooms ?? 1) || 1),
      );
      const nights = listStayNights(
        b.checkInDate || b.checkIn,
        b.checkOutDate || b.checkOut,
      );
      for (const d of nights) {
        roomsByDate[d] = (roomsByDate[d] || 0) + rooms;
      }
    }

    const nights = await listNights(token, parentKey);
    console.log(`[repair] ${parentKey}: ${nights.length} night docs, true bookings rooms by date:`, roomsByDate);

    for (const night of nights) {
      const date = night.date;
      const trueReserved = roomsByDate[date] || 0;
      const base = Number(night.base) || 0;
      const extra = Number(night.extra) || 0;
      const blocked = Number(night.blocked) || 0;
      const prev = Number(night.reserved) || 0;
      // If night has no base fields (empty placeholder), skip or set reserved 0
      if (night.base == null && night.extra == null && prev === 0 && trueReserved === 0) {
        continue;
      }
      const remaining = Math.max(0, base + extra - blocked - trueReserved);
      if (prev === trueReserved && Number(night.remaining) === remaining) continue;
      console.log(
        `  ${date}: reserved ${prev} → ${trueReserved} remaining → ${remaining}`,
      );
      await patchNight(token, parentKey, date, {
        reserved: trueReserved,
        remaining,
        base: base || Number(night.base) || 0,
        extra: extra || 0,
        blocked: blocked || 0,
      });
    }
  }

  console.log("[repair] DONE");
}

main().catch((e) => {
  console.error("[repair] FAILED", e);
  process.exit(1);
});
