# Website Implementation - Hotel Stock (Check / Lock / Unlock)

> [!NOTE]
> **Consolidated Specification:** This website implementation guide has been unified into the authoritative **[Cloud Functions API Specification (Section 2: Hotel Stock & Concurrency)](file:///d:/projects/Thaiseva-Admin-Portal-Web-App/docs/03-api/API_SPECIFICATION.md)** and **[System Architecture](file:///d:/projects/Thaiseva-Admin-Portal-Web-App/docs/02-architecture/SYSTEM_ARCHITECTURE.md)**.

**Region:** `asia-east2`  
**Project:** `gothai-ffea1`  
**Formula:** `free = total − locked − booked`  
**Lock rule:** all-or-nothing (every night must have enough free rooms)

---

## 1. What the website must do

| Step | API | When |
|------|-----|------|
| 1 | **check** | Search / room detail / before checkout |
| 2 | **lock (hold)** | User starts booking form (signed in) |
| 3a | **complete** | User submits guest details → booking created |
| 3b | **unlock** | User leaves / closes tab / changes dates |

Do **not** write `hotelStock` or `hotelLocks` from the browser. Only Cloud Functions write inventory.

---

## 2. Endpoints

### Check (public - use `fetch`, NOT callable)

```
POST https://asia-east2-gothai-ffea1.cloudfunctions.net/checkHotelStock
```

Legacy alias (same backend):

```
POST https://asia-east2-gothai-ffea1.cloudfunctions.net/checkHotelAvailability
```

### Callables (Firebase Auth required)

| Function name | Purpose |
|---------------|---------|
| `lockHotelStock` | Hold / book / convert |
| `unlockHotelStock` | Free hold |
| `completeHotelBookingHold` | Convert hold + create booking |
| `createHotelBookingWithAvailability` | Create booking without hold (lock book inside) |

Legacy names still work: `startHotelBookingHold`, `releaseHotelBookingHold`.

### Firebase setup

```js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFunctions, httpsCallable } from "firebase/functions";

const app = initializeApp({ /* your config */ });
const auth = getAuth(app);
const functions = getFunctions(app, "asia-east2"); // MUST be asia-east2
```

---

## 3. Dates & IDs

| Field | Format / rule |
|-------|----------------|
| `checkIn`, `checkOut` | `YYYY-MM-DD` (Asia/Bangkok calendar day) |
| Stay nights | `[checkIn, checkOut)` - checkout day is free |
| `hotelId` | `HotelDB` document id |
| `packageId` | Room type id under `HotelDB/{hotelId}/rooms/{packageId}` |
| `rooms` | Integer ≥ 1 |

Example: check-in `2026-08-10`, check-out `2026-08-12` → nights `10`, `11`.

---

## 4. Copy-paste client module

Save as `services/hotelStock.js` (or `.ts`) on the website:

```js
import { getAuth } from "firebase/auth";
import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "./firebase"; // your firebase app export

const REGION = "asia-east2";
const CHECK_URL =
  "https://asia-east2-gothai-ffea1.cloudfunctions.net/checkHotelStock";

const functions = getFunctions(app, REGION);

const lockFn = httpsCallable(functions, "lockHotelStock");
const unlockFn = httpsCallable(functions, "unlockHotelStock");
const completeFn = httpsCallable(functions, "completeHotelBookingHold");
const createFn = httpsCallable(functions, "createHotelBookingWithAvailability");

function requireAuth() {
  const user = getAuth(app).currentUser;
  if (!user) throw new Error("Please sign in to continue booking.");
  return user;
}

/**
 * 1) CHECK - no auth, no side effects
 */
export async function checkHotelStock({
  hotelId,
  packageId,
  roomName, // optional if packageId known
  checkIn,
  checkOut,
  rooms = 1,
}) {
  const res = await fetch(CHECK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      hotelId,
      packageId,
      roomName,
      checkIn,
      checkOut,
      rooms,
    }),
  });
  const data = await res.json();
  if (!res.ok || data.success === false) {
    throw new Error(data.error || "Availability check failed");
  }
  return data;
}

/**
 * 2) LOCK hold - soft lock while guest fills form (default 10 min)
 * Returns lockId (also as holdId for old UI)
 */
export async function lockRoomsHold(payload) {
  requireAuth();
  const { data } = await lockFn({
    hotelId: payload.hotelId,
    packageId: payload.packageId || payload.roomId,
    roomName: payload.roomName,
    checkIn: payload.checkIn || payload.checkInDate,
    checkOut: payload.checkOut || payload.checkOutDate,
    rooms: payload.rooms || 1,
    action: "hold",
    kind: "hold",
    holdMinutes: payload.holdMinutes || 10,
  });
  return {
    ...data,
    lockId: data.lockId || data.holdId,
    holdId: data.lockId || data.holdId,
  };
}

/**
 * 3a) COMPLETE - convert hold → booked + create Accepted booking
 */
export async function completeBookingFromHold({
  lockId,
  holdId,
  fullName,
  guestEmail,
  guestPhone,
  adults = 1,
  children = 0,
  extraBed = false,
  notes = "",
}) {
  requireAuth();
  const id = lockId || holdId;
  const { data } = await completeFn({
    lockId: id,
    holdId: id,
    fullName,
    guestEmail,
    guestPhone,
    adults,
    children,
    extraBed,
    notes,
  });
  return data;
}

/**
 * 3b) UNLOCK - user left / changed dates / cancelled checkout
 */
export async function unlockRooms(lockIdOrHoldId) {
  if (!lockIdOrHoldId) return { ok: true, alreadyDone: true };
  requireAuth();
  const { data } = await unlockFn({
    lockId: lockIdOrHoldId,
    holdId: lockIdOrHoldId,
  });
  return data;
}

/**
 * Direct create (no soft hold) - locks book inside if free, else pending
 */
export async function createHotelBookingDirect(payload) {
  requireAuth();
  const { data } = await createFn({
    hotelId: payload.hotelId,
    packageId: payload.packageId || payload.roomId,
    roomName: payload.roomName,
    checkIn: payload.checkIn || payload.checkInDate,
    checkOut: payload.checkOut || payload.checkOutDate,
    rooms: payload.rooms || 1,
    fullName: payload.fullName || payload.guestName,
    guestEmail: payload.guestEmail || payload.email,
    guestPhone: payload.guestPhone || payload.phone,
    adults: payload.adults || 1,
    children: payload.children || 0,
    extraBed: payload.extraBed || false,
    notes: payload.notes || "",
  });
  return data;
}

/**
 * Optional: convert hold only (without creating booking via complete)
 * Prefer completeBookingFromHold for normal website flow.
 */
export async function convertHoldToBooked(lockId) {
  requireAuth();
  const { data } = await lockFn({ lockId, action: "convert" });
  return data;
}
```

---

## 5. Recommended UI flow (soft hold)

```
┌─────────────────┐
│ Search results  │  checkHotelStock → show "X free" / messaging
└────────┬────────┘
         ▼
┌─────────────────┐
│ User signed in  │  lockRoomsHold → save lockId in state/sessionStorage
│ opens form      │  show countdown from expiresAt (~10 min)
└────────┬────────┘
         ▼
    ┌────┴────┐
    │ Submit  │──── completeBookingFromHold → bookingId, payNow
    │ Leave   │──── unlockRooms(lockId) on pagehide / unmount / date change
    └─────────┘
```

### React-style example

```jsx
import { useEffect, useRef, useState } from "react";
import {
  checkHotelStock,
  lockRoomsHold,
  completeBookingFromHold,
  unlockRooms,
} from "./services/hotelStock";

export function HotelCheckout({ hotelId, packageId, checkIn, checkOut, rooms }) {
  const [avail, setAvail] = useState(null);
  const [lockId, setLockId] = useState(null);
  const [expiresAt, setExpiresAt] = useState(null);
  const [guest, setGuest] = useState({ fullName: "", guestEmail: "", guestPhone: "" });
  const lockIdRef = useRef(null);

  // Keep ref for unload handler
  useEffect(() => {
    lockIdRef.current = lockId;
  }, [lockId]);

  // 1) Check when dates/room change
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Unlock previous hold if dates changed
      if (lockIdRef.current) {
        await unlockRooms(lockIdRef.current).catch(() => {});
        setLockId(null);
      }
      const data = await checkHotelStock({
        hotelId, packageId, checkIn, checkOut, rooms,
      });
      if (!cancelled) setAvail(data);
    })();
    return () => { cancelled = true; };
  }, [hotelId, packageId, checkIn, checkOut, rooms]);

  // Unlock on tab close / navigate away
  useEffect(() => {
    const onLeave = () => {
      const id = lockIdRef.current;
      if (!id) return;
      // keepalive best-effort: callables need auth; prefer beacon to your proxy
      // or fire unlock and hope - better: releaseHold on pagehide with sendBeacon
      // to a small HTTPS endpoint if you add one. For callables:
      unlockRooms(id).catch(() => {});
    };
    window.addEventListener("pagehide", onLeave);
    return () => {
      window.removeEventListener("pagehide", onLeave);
      // React unmount
      if (lockIdRef.current) unlockRooms(lockIdRef.current).catch(() => {});
    };
  }, []);

  async function startCheckout() {
    if (!avail?.canLock) {
      // Still allow pending request path via createHotelBookingDirect if you want
      alert(avail?.messaging?.message || "Not enough free rooms for instant lock.");
      return;
    }
    const hold = await lockRoomsHold({
      hotelId, packageId, checkIn, checkOut, rooms,
    });
    setLockId(hold.lockId);
    setExpiresAt(hold.expiresAt || hold.holdUntil);
  }

  async function submit() {
    if (!lockId) {
      alert("Start checkout first to lock rooms.");
      return;
    }
    const booking = await completeBookingFromHold({
      lockId,
      ...guest,
    });
    setLockId(null); // no longer a hold
    // booking.bookingId, booking.payNow, booking.amountTHB
    if (booking.payNow) {
      // redirect to your Stripe / THAI_QR checkout with booking.bookingId
    } else {
      // show "request pending"
    }
  }

  return (
    <div>
      {avail && (
        <p>
          {avail.messaging?.title}: {avail.messaging?.message}
          {" "}(free: {avail.free})
        </p>
      )}
      {expiresAt && <p>Rooms held until {new Date(expiresAt).toLocaleTimeString()}</p>}

      {!lockId ? (
        <button onClick={startCheckout} disabled={!avail?.canLock}>
          Reserve rooms (10 min)
        </button>
      ) : (
        <>
          <input
            placeholder="Full name"
            value={guest.fullName}
            onChange={(e) => setGuest({ ...guest, fullName: e.target.value })}
          />
          <input
            placeholder="Email"
            value={guest.guestEmail}
            onChange={(e) => setGuest({ ...guest, guestEmail: e.target.value })}
          />
          <input
            placeholder="Phone"
            value={guest.guestPhone}
            onChange={(e) => setGuest({ ...guest, guestPhone: e.target.value })}
          />
          <button onClick={submit}>Confirm booking</button>
          <button onClick={async () => {
            await unlockRooms(lockId);
            setLockId(null);
          }}>
            Cancel hold
          </button>
        </>
      )}
    </div>
  );
}
```

---

## 6. API request / response reference

### 6.1 checkHotelStock

**Request**

```json
{
  "hotelId": "abcHotelId",
  "packageId": "roomTypeId",
  "checkIn": "2026-08-10",
  "checkOut": "2026-08-12",
  "rooms": 2
}
```

Optional: `roomName` instead of `packageId` (server resolves by name).

**Success response**

```json
{
  "success": true,
  "ok": true,
  "hotelId": "…",
  "packageId": "…",
  "packageName": "Deluxe",
  "checkIn": "2026-08-10",
  "checkOut": "2026-08-12",
  "roomsRequested": 2,
  "free": 3,
  "canLock": true,
  "autoBookingEnabled": true,
  "bookableWindowOk": true,
  "bottleneckDate": "2026-08-10",
  "reasonCode": null,
  "reason": null,
  "nights": [
    { "date": "2026-08-10", "total": 5, "locked": 0, "booked": 2, "free": 3 },
    { "date": "2026-08-11", "total": 5, "locked": 1, "booked": 1, "free": 3 }
  ],
  "physicalRemaining": 3,
  "roomsInstant": 2,
  "roomsPending": 0,
  "messaging": {
    "kind": "full_instant",
    "title": "2 room(s) available",
    "message": "3 free for your dates. You can lock 2 now.",
    "roomsInstant": 2,
    "roomsPending": 0,
    "canProceed": true
  }
}
```

**`messaging.kind`**

| kind | UI |
|------|-----|
| `full_instant` | Green - can lock all requested |
| `none_instant` | Not enough free - pending only / change dates |
| `manual_only` | Auto-book off - request only |
| `window` | Outside bookable window |

**UI rules**

- Show `messaging.title` + `messaging.message`
- Enable “Book now / Reserve” only if `canLock === true` (for instant path)
- Optional pending path: still call `createHotelBookingDirect` when `canLock === false` (creates Pending, no stock lock)

---

### 6.2 lockHotelStock - hold

**Request (callable data)**

```json
{
  "hotelId": "…",
  "packageId": "…",
  "checkIn": "2026-08-10",
  "checkOut": "2026-08-12",
  "rooms": 2,
  "action": "hold",
  "holdMinutes": 10
}
```

**Success**

```json
{
  "ok": true,
  "lockId": "xyz",
  "holdId": "xyz",
  "kind": "hold",
  "rooms": 2,
  "roomsHeld": 2,
  "locked": true,
  "expiresAt": "2026-08-09T12:10:00.000Z",
  "holdUntil": "2026-08-09T12:10:00.000Z",
  "nights": ["2026-08-10", "2026-08-11"],
  "message": "2 room(s) locked for 10 minutes."
}
```

**Errors (Firebase HttpsError)**

| code | meaning |
|------|---------|
| `unauthenticated` | User not signed in |
| `resource-exhausted` | `INSUFFICIENT_STOCK` - not enough free |
| `failed-precondition` | Window / auto-book off / other |
| `invalid-argument` | Missing fields |

Store `lockId` in React state + `sessionStorage` key e.g. `hotelLockId`.

---

### 6.3 completeHotelBookingHold

**Request**

```json
{
  "lockId": "xyz",
  "holdId": "xyz",
  "fullName": "John Doe",
  "guestEmail": "john@example.com",
  "guestPhone": "+66…",
  "adults": 2,
  "children": 0,
  "extraBed": false,
  "notes": ""
}
```

**Success**

```json
{
  "success": true,
  "ok": true,
  "lockId": "xyz",
  "holdId": "xyz",
  "bookingId": "bookingDocId",
  "path": "auto",
  "autoAccepted": true,
  "inventoryReserved": true,
  "payNow": true,
  "roomsInstant": 2,
  "roomsPending": 0,
  "amountTHB": 12000,
  "bookingStatus": "ACCEPTED"
}
```

Then open payment with `bookingId` (your existing Stripe / THAI_QR flow).

**Expired hold**

- Error `deadline-exceeded` - rooms unlocked; run **check** + **lock** again.

---

### 6.4 unlockHotelStock

**Request**

```json
{ "lockId": "xyz" }
```

**Success**

```json
{
  "ok": true,
  "lockId": "xyz",
  "roomsUnlocked": 2,
  "status": "released",
  "alreadyDone": false
}
```

Idempotent: calling twice is safe (`alreadyDone: true`).

---

### 6.5 createHotelBookingWithAvailability (no hold)

Use when you skip soft hold (single-page book).

**Request**

```json
{
  "hotelId": "…",
  "packageId": "…",
  "checkIn": "2026-08-10",
  "checkOut": "2026-08-12",
  "rooms": 2,
  "fullName": "…",
  "guestEmail": "…",
  "guestPhone": "…",
  "adults": 2,
  "children": 0
}
```

**Response highlights**

| Field | Meaning |
|-------|---------|
| `path: "auto"` | Instant accept + stock booked |
| `path: "pending"` | No lock; hotel must accept later |
| `payNow` | true only for auto |
| `bookingId` | `hotelBookingData` id |
| `amountTHB` | Amount to charge |

---

## 7. Mapping from old website code

| Old | New |
|-----|-----|
| `checkHotelAvailability` fetch | `checkHotelStock` (or keep old URL - alias) |
| `startHotelBookingHold` | `lockHotelStock` `{ action: "hold" }` |
| `completeHotelBookingHold` | same name (stock convert + booking) |
| `releaseHotelBookingHold(holdId)` | `unlockHotelStock({ lockId })` |
| `holdId` | `lockId` (both returned) |
| `roomsInstant` / partial | **gone** - all-or-nothing; either full lock or pending |
| Write inventory from client | **never** |

If you already call old function names, after deploy they hit the **same stock**. Prefer new names for clarity.

---

## 8. sessionStorage helpers

```js
const KEY = "thaiseva_hotel_lock";

export function saveLock(lock) {
  sessionStorage.setItem(
    KEY,
    JSON.stringify({
      lockId: lock.lockId || lock.holdId,
      expiresAt: lock.expiresAt || lock.holdUntil,
      hotelId: lock.hotelId,
      packageId: lock.packageId,
      checkIn: lock.checkIn,
      checkOut: lock.checkOut,
      rooms: lock.rooms,
    }),
  );
}

export function loadLock() {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) || "null");
  } catch {
    return null;
  }
}

export function clearLock() {
  sessionStorage.removeItem(KEY);
}

export function isLockExpired(lock) {
  if (!lock?.expiresAt) return false;
  return new Date(lock.expiresAt).getTime() < Date.now();
}
```

On page load: if lock exists and not expired, reuse UI; if expired, `clearLock()` and re-check.

---

## 9. Payment after booking

After `complete` or direct create with `payNow: true`:

1. Use `bookingId` + `amountTHB`
2. Call your existing payment APIs:
   - `createCheckoutSession` (Stripe), or
   - THAI_QR flow on `hotelBookingData`
3. Do **not** lock stock again for payment - already booked on stock

If user abandons **before** complete: only unlock the hold.  
If user abandons **after** booking created: cancel booking (admin/status) unlocks via trigger.

---

## 10. CORS / common errors

| Symptom | Fix |
|---------|-----|
| CORS on check | Use **fetch** to HTTPS URL, not `httpsCallable` for check |
| CORS on lock | Callables need region `asia-east2` + user signed in |
| `unauthenticated` | `signIn` before lock/complete/unlock |
| `resource-exhausted` | Re-run check; show “sold out” |
| Hold expired | Unlock already done; start new hold |
| Wrong free count | Deploy functions + run `rebuildHotelStock.js` once |

Allowed origins include `localhost`, `*.web.app`, `*.firebaseapp.com`, `thaiseva.com`, etc.

---

## 11. Minimal smoke test (browser console)

With user signed in on website origin:

```js
// 1 Check
const c = await fetch(
  "https://asia-east2-gothai-ffea1.cloudfunctions.net/checkHotelStock",
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      hotelId: "YOUR_HOTEL_ID",
      packageId: "YOUR_ROOM_ID",
      checkIn: "2026-08-20",
      checkOut: "2026-08-22",
      rooms: 1,
    }),
  },
).then((r) => r.json());
console.log("check", c.free, c.canLock, c.messaging);

// 2–3 use your firebase httpsCallable wrappers for lock / unlock
```

---

## 12. Checklist for website PR

- [ ] Region always `asia-east2`
- [ ] Check via `fetch` only
- [ ] Lock/unlock/complete require Firebase Auth
- [ ] Save `lockId`; unlock on leave / date change
- [ ] Show hold countdown from `expiresAt`
- [ ] Complete creates booking → payment with `bookingId`
- [ ] No client writes to `hotelStock` / `hotelLocks`
- [ ] Handle `canLock: false` (pending or block UI)
- [ ] All-or-nothing: no partial “2 of 5 free” split UI

---

## 13. Related docs

- Full stock model: [`HOTEL_STOCK_API.md`](./HOTEL_STOCK_API.md)
- Admin portal: [`HOTEL_AVAILABILITY_API.md`](./HOTEL_AVAILABILITY_API.md)
