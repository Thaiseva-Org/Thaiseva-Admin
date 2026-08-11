/**
 * Rebuild hotelStock from accepted bookings (migration to number model).
 *
 * free = total - locked - booked  (locked starts at 0)
 *
 * Usage (from functions/):
 *   node scripts/rebuildHotelStock.js [--dry-run] [--days=90]
 *
 * Requires GOOGLE_APPLICATION_CREDENTIALS or firebase use default project.
 */
/* eslint-disable no-console */
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const daysArg = args.find((a) => a.startsWith("--days="));
const SEED_DAYS = daysArg ? Number(daysArg.split("=")[1]) : 90;
const DEFAULT_TOTAL = 5;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const toYmd = (value) => {
  if (!value) return null;
  if (typeof value === "string" && DATE_RE.test(value.trim())) return value.trim();
  let d;
  if (value.toDate) d = value.toDate();
  else if (value.seconds != null) d = new Date(value.seconds * 1000);
  else d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
};

const listStayNights = (checkIn, checkOut) => {
  const start = toYmd(checkIn);
  const end = toYmd(checkOut);
  if (!start || !end) return [];
  const nights = [];
  let cur = new Date(`${start}T12:00:00+07:00`);
  const endD = new Date(`${end}T12:00:00+07:00`);
  let guard = 0;
  while (cur < endD && guard < 366) {
    nights.push(toYmd(cur));
    cur = new Date(cur.getTime() + 86400000);
    guard += 1;
  }
  return nights;
};

const isAccepted = (b) => {
  const s = String(b.bookingStatus || b.status || "").toUpperCase();
  if (["ACCEPTED", "CONFIRMED"].includes(s)) return true;
  return b.isBookingConfirmed === true && b.inventoryReserved === true;
};

const isTerminal = (b) => {
  const s = String(b.bookingStatus || b.status || "").toUpperCase();
  return ["CANCELED", "CANCELLED", "REJECTED", "DENIED"].includes(s);
};

async function main() {
  console.log(`rebuildHotelStock dryRun=${dryRun} seedDays=${SEED_DAYS}`);

  // Map: stockKey -> date -> booked count, total
  const stock = new Map(); // key = hotelId_packageId

  const bump = (hotelId, packageId, date, rooms, totalHint) => {
    const key = `${hotelId}_${packageId}`;
    if (!stock.has(key)) {
      stock.set(key, {hotelId, packageId, nights: new Map(), total: totalHint || DEFAULT_TOTAL});
    }
    const entry = stock.get(key);
    if (totalHint && totalHint > entry.total) entry.total = totalHint;
    const prev = entry.nights.get(date) || 0;
    entry.nights.set(date, prev + rooms);
  };

  // Room defaults
  const hotelsSnap = await db.collection("HotelDB").get();
  for (const hotelDoc of hotelsSnap.docs) {
    const hotelId = hotelDoc.id;
    const roomsSnap = await hotelDoc.ref.collection("rooms").get();
    for (const room of roomsSnap.docs) {
      const d = room.data() || {};
      const total =
        Math.floor(Number(d.totalRooms ?? d.quantity ?? DEFAULT_TOTAL)) ||
        DEFAULT_TOTAL;
      const key = `${hotelId}_${room.id}`;
      if (!stock.has(key)) {
        stock.set(key, {
          hotelId,
          packageId: room.id,
          nights: new Map(),
          total,
        });
      } else {
        stock.get(key).total = total;
      }
    }
  }

  // Accepted bookings with inventory
  const bookingsSnap = await db.collection("hotelBookingData").get();
  let bookedCount = 0;
  for (const doc of bookingsSnap.docs) {
    const b = doc.data() || {};
    if (isTerminal(b)) continue;
    if (!isAccepted(b) && b.inventoryReserved !== true) continue;

    const hotelId = String(b.hotelUid || b.hotelId || "").trim();
    const packageId = String(b.packageId || b.roomId || "").trim();
    if (!hotelId || !packageId) continue;

    const nights = listStayNights(b.checkInDate || b.checkIn, b.checkOutDate || b.checkOut);
    const rooms = Math.max(1, Math.floor(Number(b.rooms || b.noOfRooms || 1)));
    for (const date of nights) {
      bump(hotelId, packageId, date, rooms);
      bookedCount += 1;
    }
  }

  console.log(
    `Hotels/packages: ${stock.size}, night-book increments: ${bookedCount}`,
  );

  // Seed empty nights for next SEED_DAYS for every room
  const today = toYmd(new Date());
  const endSeed = new Date();
  endSeed.setDate(endSeed.getDate() + SEED_DAYS);
  const endYmd = toYmd(endSeed);

  let writes = 0;
  const batchSize = 400;
  let batch = db.batch();
  let inBatch = 0;

  const flush = async () => {
    if (inBatch === 0) return;
    if (!dryRun) await batch.commit();
    batch = db.batch();
    inBatch = 0;
  };

  for (const [, entry] of stock) {
    const {hotelId, packageId, total, nights} = entry;
    // Union of seeded dates + booked dates
    const dates = new Set([...nights.keys()]);
    let cur = new Date(`${today}T12:00:00+07:00`);
    const endD = new Date(`${endYmd}T12:00:00+07:00`);
    while (cur <= endD) {
      dates.add(toYmd(cur));
      cur = new Date(cur.getTime() + 86400000);
    }

    for (const date of dates) {
      if (!date) continue;
      const booked = nights.get(date) || 0;
      const free = Math.max(0, total - booked);
      const ref = db
        .collection("hotelStock")
        .doc(`${hotelId}_${packageId}`)
        .collection("nights")
        .doc(date);
      batch.set(
        ref,
        {
          hotelId,
          packageId,
          date,
          total,
          locked: 0,
          booked,
          free,
          rebuiltAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        {merge: true},
      );
      writes += 1;
      inBatch += 1;
      if (inBatch >= batchSize) await flush();
    }
  }

  await flush();
  console.log(`Done. Night docs written: ${writes}${dryRun ? " (dry-run)" : ""}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
