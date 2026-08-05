/**
 * Free still-locked hold inventory, then delete ALL hotelBookingHolds docs.
 * Uses Firebase CLI OAuth access token + Firestore REST API (no service account).
 *
 *   node scripts/clearAllHotelHolds.js
 */
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const os = require("os");
const https = require("https");

const PROJECT_ID = process.env.GCLOUD_PROJECT || "gothai-ffea1";
const HOLD_COLLECTION = "hotelBookingHolds";
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

// Public OAuth client used by Firebase CLI
const FIREBASE_CLI_CLIENT = {
  client_id:
    "563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com",
  client_secret: "jQRWCqNYY7JMqGxD9HI3N9e0",
};

function loadCliTokens() {
  const candidates = [
    path.join(os.homedir(), ".config", "configstore", "firebase-tools.json"),
    path.join(process.env.APPDATA || "", "configstore", "firebase-tools.json"),
  ];
  for (const file of candidates) {
    if (!file || !fs.existsSync(file)) continue;
    const raw = JSON.parse(fs.readFileSync(file, "utf8"));
    if (raw?.tokens?.refresh_token || raw?.tokens?.access_token) {
      return raw.tokens;
    }
  }
  throw new Error("No Firebase CLI tokens. Run: firebase login");
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
            const err = new Error(
              `${method} ${u.pathname} → ${res.statusCode}: ${text.slice(0, 500)}`,
            );
            err.status = res.statusCode;
            err.body = json;
            reject(err);
          } else {
            resolve(json);
          }
        });
      },
    );
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

async function getAccessToken(tokens) {
  // Refresh if missing/expired (expires_at is ms)
  const now = Date.now();
  if (
    tokens.access_token &&
    tokens.expires_at &&
    Number(tokens.expires_at) > now + 60_000
  ) {
    return tokens.access_token;
  }
  if (!tokens.refresh_token) {
    if (tokens.access_token) return tokens.access_token;
    throw new Error("No refresh/access token");
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
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          try {
            resolve(JSON.parse(text));
          } catch (e) {
            reject(e);
          }
        });
      },
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });

  if (!result.access_token) {
    throw new Error(`Token refresh failed: ${JSON.stringify(result)}`);
  }
  return result.access_token;
}

const authHeaders = (token) => ({Authorization: `Bearer ${token}`});

/** Convert Firestore REST fields map → plain JS */
function fromFields(fields = {}) {
  const out = {};
  for (const [k, v] of Object.entries(fields)) {
    out[k] = decodeValue(v);
  }
  return out;
}

function decodeValue(v) {
  if (v == null) return null;
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return Number(v.doubleValue);
  if ("booleanValue" in v) return v.booleanValue;
  if ("timestampValue" in v) return v.timestampValue;
  if ("nullValue" in v) return null;
  if ("mapValue" in v) return fromFields(v.mapValue.fields || {});
  if ("arrayValue" in v) {
    return (v.arrayValue.values || []).map(decodeValue);
  }
  return null;
}

function toIntField(n) {
  return {integerValue: String(Math.floor(n))};
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const toDateString = (value) => {
  if (!value) return null;
  if (typeof value === "string" && DATE_RE.test(value.trim())) {
    return value.trim();
  }
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

async function listHoldsPage(token, pageToken) {
  // Use runQuery for collection (list documents)
  let url = `${BASE}/${HOLD_COLLECTION}?pageSize=100`;
  if (pageToken) url += `&pageToken=${encodeURIComponent(pageToken)}`;
  return httpsJson("GET", url, authHeaders(token));
}

async function deleteDoc(token, name) {
  // name is full resource path projects/.../documents/hotelBookingHolds/id
  const url = `https://firestore.googleapis.com/v1/${name}`;
  return httpsJson("DELETE", url, authHeaders(token));
}

async function getNight(token, hotelUid, packageId, date) {
  const docPath = `hotelRoomInventory/${hotelUid}_${packageId}/nights/${date}`;
  const url = `${BASE}/${docPath}`;
  try {
    return await httpsJson("GET", url, authHeaders(token));
  } catch (e) {
    if (e.status === 404) return null;
    throw e;
  }
}

async function patchNightReserved(token, hotelUid, packageId, date, reserved, remaining) {
  const docPath = `hotelRoomInventory/${hotelUid}_${packageId}/nights/${date}`;
  const url =
    `${BASE}/${docPath}?updateMask.fieldPaths=reserved&updateMask.fieldPaths=remaining`;
  const body = JSON.stringify({
    fields: {
      reserved: toIntField(reserved),
      remaining: toIntField(remaining),
    },
  });
  return httpsJson("PATCH", url, authHeaders(token), body);
}

async function freeHoldLedger(token, hold) {
  const hotelUid = String(hold.hotelUid || "").trim();
  const packageId = String(hold.packageId || "").trim();
  const rooms = Math.max(
    0,
    Math.floor(Number(hold.roomsHeld ?? hold.rooms ?? 0) || 0),
  );
  const nights = listStayNights(
    hold.checkIn || hold.checkInDate,
    hold.checkOut || hold.checkOutDate,
  );
  const status = String(hold.status || "").toUpperCase();
  const stillLocked =
    hold.inventoryReserved === true && hold.inventoryReleased !== true;
  const shouldFree =
    stillLocked ||
    (status === "HOLD" && rooms > 0 && hold.inventoryReleased !== true);

  if (!shouldFree || !hotelUid || !packageId || rooms <= 0 || nights.length === 0) {
    return {freed: false, nights, rooms};
  }

  let writes = 0;
  for (const date of nights) {
    const night = await getNight(token, hotelUid, packageId, date);
    if (!night?.fields) continue;
    const d = fromFields(night.fields);
    const prev = Math.max(0, Number(d.reserved) || 0);
    if (prev <= 0) continue;
    const reserved = Math.max(0, prev - rooms);
    const base = Number(d.base) || 0;
    const extra = Number(d.extra) || 0;
    const blocked = Number(d.blocked) || 0;
    const remaining = Math.max(0, base + extra - blocked - reserved);
    await patchNightReserved(token, hotelUid, packageId, date, reserved, remaining);
    writes += 1;
  }
  return {freed: writes > 0, nights, rooms};
}

async function main() {
  console.log(`[clearAllHotelHolds] project=${PROJECT_ID}`);
  const tokens = loadCliTokens();
  const token = await getAccessToken(tokens);
  console.log("[clearAllHotelHolds] auth ok, scanning holds...");

  let total = 0;
  let freed = 0;
  let deleted = 0;
  let pageToken = null;

  do {
    const page = await listHoldsPage(token, pageToken);
    const docs = page.documents || [];
    if (docs.length === 0 && !page.nextPageToken) break;

    for (const doc of docs) {
      total += 1;
      const hold = fromFields(doc.fields || {});
      const id = doc.name.split("/").pop();
      try {
        const result = await freeHoldLedger(token, hold);
        if (result.freed) {
          freed += 1;
          console.log(
            `  freed hold=${id} rooms=${result.rooms} nights=${(result.nights || []).join(",")}`,
          );
        }
      } catch (e) {
        console.warn(`  free failed hold=${id}:`, e.message || e);
      }

      try {
        await deleteDoc(token, doc.name);
        deleted += 1;
        console.log(`  deleted hold=${id}`);
      } catch (e) {
        console.warn(`  delete failed hold=${id}:`, e.message || e);
      }
    }

    pageToken = page.nextPageToken || null;
    console.log(`  progress seen=${total} deleted=${deleted}`);
  } while (pageToken);

  console.log(
    `[clearAllHotelHolds] DONE total=${total} ledgerFreed=${freed} deleted=${deleted}`,
  );
}

main().catch((err) => {
  console.error("[clearAllHotelHolds] FAILED", err);
  process.exit(1);
});
