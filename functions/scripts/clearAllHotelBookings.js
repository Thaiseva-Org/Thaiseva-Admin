/**
 * Delete ALL hotelBookingData docs and zero night-ledger reserved for affected rooms.
 *
 *   node scripts/clearAllHotelBookings.js
 */
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const os = require("os");
const https = require("https");

const PROJECT_ID = process.env.GCLOUD_PROJECT || "gothai-ffea1";
const COLLECTION = "hotelBookingData";
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

const FIREBASE_CLI_CLIENT = {
  client_id:
    "563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com",
  // Must match current firebase-tools lib/api.js clientSecret
  client_secret: "j9iVZfS8kkCEFUPaAeJV0sAi",
};

function loadCliTokens() {
  const f = path.join(
    os.homedir(),
    ".config",
    "configstore",
    "firebase-tools.json",
  );
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
              Object.assign(
                new Error(`${method} ${res.statusCode} ${text.slice(0, 400)}`),
                {status: res.statusCode, body: json},
              ),
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
        res.on("end", () =>
          resolve(JSON.parse(Buffer.concat(chunks).toString())),
        );
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

async function listPage(token, pageToken) {
  let url = `${BASE}/${COLLECTION}?pageSize=100`;
  if (pageToken) url += `&pageToken=${encodeURIComponent(pageToken)}`;
  return httpsJson("GET", url, auth(token));
}

async function deleteDoc(token, name) {
  return httpsJson(
    "DELETE",
    `https://firestore.googleapis.com/v1/${name}`,
    auth(token),
  );
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

async function patchNightZeroReserved(token, parentKey, date, night) {
  const base = Number(night.base) || 0;
  const extra = Number(night.extra) || 0;
  const blocked = Number(night.blocked) || 0;
  const remaining = Math.max(0, base + extra - blocked);
  const paths = [
    "reserved",
    "remaining",
    "base",
    "extra",
    "blocked",
  ]
    .map((k) => `updateMask.fieldPaths=${k}`)
    .join("&");
  const url = `${BASE}/hotelRoomInventory/${parentKey}/nights/${date}?${paths}`;
  return httpsJson(
    "PATCH",
    url,
    auth(token),
    JSON.stringify({
      fields: {
        reserved: {integerValue: "0"},
        remaining: {integerValue: String(remaining)},
        base: {integerValue: String(base)},
        extra: {integerValue: String(extra)},
        blocked: {integerValue: String(blocked)},
      },
    }),
  );
}

async function main() {
  console.log(`[clearBookings] project=${PROJECT_ID}`);
  const tokens = loadCliTokens();
  const token = await getAccessToken(tokens);
  console.log("[clearBookings] auth ok");

  const parents = new Set();
  let total = 0;
  let deleted = 0;
  let pageToken = null;

  do {
    const page = await listPage(token, pageToken);
    const docs = page.documents || [];
    if (docs.length === 0 && !page.nextPageToken) break;

    for (const doc of docs) {
      total += 1;
      const data = fromFields(doc.fields || {});
      const hotelUid = String(data.hotelUid || data.hotelId || "").trim();
      const packageId = String(data.packageId || data.roomId || "").trim();
      if (hotelUid && packageId) parents.add(`${hotelUid}_${packageId}`);

      const id = doc.name.split("/").pop();
      try {
        await deleteDoc(token, doc.name);
        deleted += 1;
        if (deleted % 20 === 0 || deleted <= 5) {
          console.log(`  deleted ${id} (${deleted})`);
        }
      } catch (e) {
        console.warn(`  delete failed ${id}:`, e.message || e);
      }
    }

    pageToken = page.nextPageToken || null;
    console.log(`  progress seen=${total} deleted=${deleted}`);
  } while (pageToken);

  console.log(
    `[clearBookings] bookings deleted=${deleted}/${total}; zeroing reserved on ${parents.size} room inventories...`,
  );

  let nightsFixed = 0;
  for (const parentKey of parents) {
    try {
      const nights = await listNights(token, parentKey);
      for (const night of nights) {
        const prev = Number(night.reserved) || 0;
        if (prev === 0 && night.base == null) continue;
        if (prev === 0 && Number(night.remaining) === Math.max(0, (Number(night.base) || 0) + (Number(night.extra) || 0) - (Number(night.blocked) || 0))) {
          continue;
        }
        await patchNightZeroReserved(token, parentKey, night.date, night);
        nightsFixed += 1;
        console.log(
          `  ${parentKey} ${night.date}: reserved ${prev} → 0`,
        );
      }
    } catch (e) {
      console.warn(`  inventory fix failed ${parentKey}:`, e.message || e);
    }
  }

  // Also zero any leftover holds if present
  let holdsDeleted = 0;
  try {
    let hToken = null;
    do {
      let url = `${BASE}/hotelBookingHolds?pageSize=100`;
      if (hToken) url += `&pageToken=${encodeURIComponent(hToken)}`;
      const page = await httpsJson("GET", url, auth(token));
      for (const doc of page.documents || []) {
        await deleteDoc(token, doc.name);
        holdsDeleted += 1;
      }
      hToken = page.nextPageToken || null;
    } while (hToken);
  } catch (e) {
    console.warn("holds cleanup:", e.message || e);
  }

  console.log(
    `[clearBookings] DONE bookingsDeleted=${deleted} nightsFixed=${nightsFixed} holdsDeleted=${holdsDeleted}`,
  );
}

main().catch((e) => {
  console.error("[clearBookings] FAILED", e);
  process.exit(1);
});
