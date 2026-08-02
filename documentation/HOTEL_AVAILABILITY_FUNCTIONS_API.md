# Hotel Availability — Cloud Functions API

**Last updated:** 2026-08-02  
**Project:** `gothai-ffea1`  
**Region:** `asia-east2`  
**Runtime:** Node.js 20 (2nd gen)

| Protocol | Functions |
|----------|-----------|
| **HTTPS `onRequest` + CORS** (`fetch` POST/GET) | `checkHotelAvailability` only |
| **Callable** (`httpsCallable`) | Hold, create, accept, admin ops |
| **Scheduler** | `expireHotelBookingHolds` |

Related portal doc (UI + Firestore data model):  
[`HOTEL_AVAILABILITY_API.md`](./HOTEL_AVAILABILITY_API.md)

---

## Overview

| Audience | How they use availability |
|----------|---------------------------|
| **Admin portal** | Prefer **Firestore client** (`src/services/HotelAvailability.js`) under `HotelDB/{hotelId}/availability/...`. Admin callables are optional / ops. |
| **Website / app** | **`fetch`** for **check**; **`httpsCallable`** for hold / complete / release / create. Never write inventory from the client. |
| **Scheduler** | `expireHotelBookingHolds` auto-unlocks expired soft holds. |

### Formula (all paths)

```
remaining = max(0, normal + extra − blocked − reserved)
```

| Term | Source |
|------|--------|
| **normal** | `HotelDB/{hotelId}/rooms/{roomId}.totalRooms` (default 5) |
| **extra / blocked** | `HotelDB/{hotelId}/availability/{adjustmentId}` (`type`: `extra` \| `blocked`) |
| **reserved** | Night ledger + accepted bookings + **active soft holds** |
| **Stay nights** | Half-open **`[checkIn, checkOut)`** (checkout day free) |

### Nested data (current writes)

| Path | Purpose |
|------|---------|
| `HotelDB/{hotelId}/availability/config` | Auto-book, window, default inventory, notify flags |
| `HotelDB/{hotelId}/availability/{adjustmentId}` | Extra / blocked ranges |
| `HotelDB/{hotelId}/rooms/{roomId}` | Room types (unchanged) |
| `hotelRoomInventory/{hotel}_{pkg}/nights/{date}` | Night ledger (`reserved`, `remaining`) |
| `hotelBookingData/{id}` | Customer bookings |
| `hotelBookingHolds/{holdId}` | Soft checkout locks (Functions write only) |
| `hotelInventoryAuditLogs` | Audit trail |

Legacy top-level adjustment collections remain **read fallback** only; **new writes** go under `HotelDB/.../availability`.

---

## Client setup

### Check (public HTTPS — use `fetch`)

```js
const CHECK_URL =
  "https://asia-east2-gothai-ffea1.cloudfunctions.net/checkHotelAvailability";

const res = await fetch(CHECK_URL, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    hotelId,
    packageId,
    checkIn: "2026-08-10",
    checkOut: "2026-08-12",
    rooms: 2,
  }),
});
const avail = await res.json();
```

**Do not** use `httpsCallable` for `checkHotelAvailability` (causes CORS failures from the browser).

### Hold / create / accept (callables)

```js
import { getFunctions, httpsCallable } from "firebase/functions";

const functions = getFunctions(app, "asia-east2");
const startHold = httpsCallable(functions, "startHotelBookingHold");
const completeHold = httpsCallable(functions, "completeHotelBookingHold");
const releaseHold = httpsCallable(functions, "releaseHotelBookingHold");
const createBooking = httpsCallable(functions, "createHotelBookingWithAvailability");
const acceptBooking = httpsCallable(functions, "acceptHotelBookingWithAvailability");
```

Helpers in this repo:

| File | Role |
|------|------|
| `src/services/HotelAvailability.js` | Admin UI — **Firestore only** |
| `src/services/HotelBookingHold.js` | Callable hold start / complete / release |
| `src/services/HotelBookingAccept.js` | Callable admin accept |

---

## API index

### A. Website / app (public booking)

| Function | Type | Auth | Locks inventory? |
|----------|------|------|------------------|
| [`checkHotelAvailability`](#1-checkhotelavailability) | **HTTPS + CORS** | No | No |
| [`startHotelBookingHold`](#2-starthotelbookinghold) | Callable | Required | Yes (instant rooms, TTL) |
| [`completeHotelBookingHold`](#3-completehotelbookinghold) | Callable | Required | Converts hold → booking |
| [`releaseHotelBookingHold`](#4-releasehotelbookinghold) | Callable | Owner or admin | Unlocks |
| [`createHotelBookingWithAvailability`](#5-createhotelbookingwithavailability) | Callable | Required | Yes if auto-accept (no soft hold) |

### B. Admin / ops

| Function | Auth | Purpose |
|----------|------|---------|
| [`getHotelAvailability`](#6-gethotelavailability) | Admin | Stay preview |
| [`getHotelAvailabilityCalendar`](#7-gethotelavailabilitycalendar) | Admin | Calendar range |
| [`manageHotelAvailability`](#8-managehotelavailability) | Admin | Config, qty, extra, block |
| [`releaseHotelInventory`](#9-releasehotelinventory) | Admin | Force-release booking inventory |
| [`acceptHotelBookingWithAvailability`](#10-accepthotelbookingwithavailability) | Admin | Accept pending + reserve |

### C. Background

| Function | Type | Purpose |
|----------|------|---------|
| [`expireHotelBookingHolds`](#11-expirehotelbookingholds) | Schedule every 5 min | Expire holds past `holdUntil` |

---

## Recommended website flow (soft hold)

```
1. checkHotelAvailability  (fetch POST)     → show messaging
2. startHotelBookingHold   (httpsCallable)  → lock free rooms (10 min)
3. User fills guest form / pay UI
   ├─ completeHotelBookingHold (callable)   → booking created; rooms stay booked
   └─ releaseHotelBookingHold  (callable)   → user left; unlock
      (or expireHotelBookingHolds if tab closed)
```

Direct path without hold: `createHotelBookingWithAvailability` (callable) only.

---

## 1. `checkHotelAvailability`

**Audience:** Website / app  
**Type:** **HTTPS `onRequest`** (not a callable)  
**URL:** `https://asia-east2-gothai-ffea1.cloudfunctions.net/checkHotelAvailability`  
**Auth:** Not required  
**CORS:** `localhost`, `*.web.app`, `*.firebaseapp.com`, thaiseva.com, etc.  
**Side effects:** None (read-only)

> Do **not** use `httpsCallable` for this function. Use `fetch` POST/GET.

### Website example

```js
const res = await fetch(
  "https://asia-east2-gothai-ffea1.cloudfunctions.net/checkHotelAvailability",
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      hotelId,
      packageId,
      checkIn: "2026-08-10",
      checkOut: "2026-08-12",
      rooms: 2,
    }),
  },
);
const data = await res.json();
```

Also accepts Firebase callable-style body `{ data: { ... } }` if needed.

### Request

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `hotelId` / `hotelUid` | string | Yes | |
| `packageId` / `roomId` | string | One of package/roomName | Room type id |
| `roomName` | string | Alt | Resolve by name if no packageId |
| `checkIn` / `checkInDate` | `YYYY-MM-DD` | Yes | |
| `checkOut` / `checkOutDate` | `YYYY-MM-DD` | Yes | After check-in |
| `rooms` | number | No | Default `1` |

### Response (success)

```json
{
  "success": true,
  "hotelUid": "...",
  "packageId": "...",
  "packageName": "...",
  "checkIn": "2026-08-10",
  "checkOut": "2026-08-12",
  "roomsRequested": 2,
  "physicalRemaining": 3,
  "maxInstantRooms": 2,
  "roomsInstant": 2,
  "roomsPending": 0,
  "autoBookingEnabled": true,
  "bookableWindowOk": true,
  "nights": 2,
  "reasonCode": null,
  "reason": null,
  "messaging": {
    "kind": "full_instant",
    "title": "2 rooms available",
    "message": "...",
    "roomsInstant": 2,
    "roomsPending": 0,
    "canProceed": true
  }
}
```

### `messaging.kind` values

| kind | Meaning |
|------|---------|
| `full_instant` | All requested rooms can auto-confirm |
| `partial` | Some instant, some pending |
| `none_instant` | None free for auto; pending request still OK |
| `manual_only` | Auto-book OFF for hotel |
| `window` | Outside bookable window |

---

## 2. `startHotelBookingHold`

**Audience:** Website / app  
**Auth:** Signed-in user; `userId` must match `auth.uid` if sent  
**Side effects:** Reserves **instant** rooms on night ledger for **TTL**; writes `hotelBookingHolds/{holdId}`

Default hold: **10 minutes** (client may pass `holdMinutes` in range **5–60**).

### Request

| Field | Type | Required |
|-------|------|----------|
| `userId` | string | No (defaults to auth uid) |
| `hotelId` / `hotelUid` | string | Yes |
| `packageId` / `roomId` / `roomName` | string | Room type |
| `checkIn` / `checkInDate` | date | Yes |
| `checkOut` / `checkOutDate` | date | Yes |
| `rooms` | number | Yes (default 1) |
| `holdMinutes` | number | No (default 10) |

### Response (success)

```json
{
  "success": true,
  "holdId": "hold_uid_hotel_2026-08-10_2026-08-12_pkg",
  "status": "HOLD",
  "reused": false,
  "locked": true,
  "roomsHeld": 2,
  "roomsRequested": 2,
  "roomsPendingIntent": 0,
  "holdUntil": "2026-08-02T12:15:00.000Z",
  "holdMinutes": 10,
  "hotelUid": "...",
  "packageId": "...",
  "checkIn": "2026-08-10",
  "checkOut": "2026-08-12",
  "messaging": { },
  "message": "2 room(s) locked for 10 minutes while you complete booking."
}
```

| Field | Meaning |
|-------|---------|
| `locked` | `true` if ledger reserve succeeded |
| `roomsHeld` | Rooms on soft lock (instant capacity only) |
| `roomsPendingIntent` | Remainder that will become Pending on complete |
| `reused` | Existing non-expired hold for same stay was extended |

If auto-book is off or no free rooms: `locked: false`, `roomsHeld: 0` — guest can still **complete** a pending-only request.

---

## 3. `completeHotelBookingHold`

**Audience:** Website / app  
**Auth:** Hold owner  
**Side effects:** Creates `hotelBookingData` doc(s); transfers lock to Accepted booking(s); marks hold `COMPLETED`

### Request

| Field | Type | Required |
|-------|------|----------|
| `holdId` | string | Yes |
| `fullName` | string | Recommended |
| `guestEmail` / `email` | string | Recommended |
| `guestPhone` / `phone` | string | Recommended |
| `adults` | number | No (default 1) |
| `children` | number | No |
| `extraBed` | boolean | No |
| `paymentMethod` / `paymentMethodIntent` | string | No (`STRIPE` / QR / `OFFLINE`) |
| `nationality`, `specialRequests`, `estimatedArrivalTime`, `bedPreference`, `needsAirportPickup` | | Optional |
| `rooms` | number | No — can **reduce** vs hold, not increase |

### Response (success)

```json
{
  "success": true,
  "holdId": "...",
  "bookingId": "...",
  "autoBookingId": "...",
  "pendingBookingId": null,
  "bookingCollection": "hotelBookingData",
  "path": "auto",
  "payNow": true,
  "autoAccepted": true,
  "roomsRequested": 2,
  "roomsInstant": 2,
  "roomsPending": 0,
  "amountTHB": 3000,
  "status": "Accepted",
  "bookingStatus": "ACCEPTED"
}
```

| `path` | Meaning |
|--------|---------|
| `auto` | All held rooms → Accepted + reserved |
| `partial` | Some Accepted + some Pending sibling |
| `pending` | No instant lock → Pending only |

**Errors:** hold expired (`deadline-exceeded`), released, or wrong user.

---

## 4. `releaseHotelBookingHold`

**Audience:** Website / app (and admin)  
**Auth:** Hold owner or Admin  
**Side effects:** Decrements night ledger; hold `status` → `RELEASED`

### Request

```json
{ "holdId": "hold_..." }
```

### Response

```json
{
  "success": true,
  "holdId": "...",
  "status": "RELEASED",
  "alreadyReleased": false,
  "roomsUnlocked": 2
}
```

Call on **page leave / unmount / cancel**. Scheduler is only a safety net.

---

## 5. `createHotelBookingWithAvailability`

**Audience:** Website / app  
**Type:** Callable (`httpsCallable`) — **not** raw `fetch`  
**Auth:** Required  
**Side effects:** Creates booking(s); reserves on auto path **without** prior hold

Same guest fields as complete-hold. Use when you skip soft-hold UX.

### Response shape

Same family as complete-hold: `bookingId`, `autoBookingId`, `pendingBookingId`, `path`, `payNow`, `messaging`, etc.

Idempotent for same user + hotel + checkIn + package (returns existing docs with `duplicate: true`).

---

## 6. `getHotelAvailability`

**Audience:** Admin only  
**Auth:** Admin / Sub Admin

### Request

| Field | Required |
|-------|----------|
| `hotelUid` / `hotelId` | Yes |
| `packageId` / `roomId` | Yes |
| `checkIn` / `checkInDate` | Yes |
| `checkOut` / `checkOutDate` | Yes |
| `rooms` | No (default 1) |

### Response

```json
{ "ok": true, "audience": "admin", "available": true, "nights": [/* breakdown */], "reason": null }
```

---

## 7. `getHotelAvailabilityCalendar`

**Audience:** Admin only

### Request

| Field | Required |
|-------|----------|
| `hotelUid` / `hotelId` | Yes |
| `packageId` | Yes |
| `startDate` | Yes `YYYY-MM-DD` |
| `endDate` | Yes `YYYY-MM-DD` |

Returns night-by-night remaining, adjustments, config for Manage Room Availability UI.

---

## 8. `manageHotelAvailability`

**Audience:** Admin only  
**Auth:** Admin / Sub Admin  

Single entry with `action`:

### `action: "setBookableWindow"`

Writes **`HotelDB/{hotelUid}/availability/config`**.

| Field | Notes |
|-------|--------|
| `hotelUid` | Required |
| `bookingOpenFrom` / `bookingOpenTo` | `YYYY-MM-DD` or empty |
| `autoBookingEnabled` | default true |
| `defaultRoomInventory` | default 5 |
| `notifyOnFull` / `notifyOnFreed` | default true |

### `action: "setTotalRooms"`

Updates room type stock on **`HotelDB/.../rooms/{packageId}`**.

| Field | Notes |
|-------|--------|
| `packageId` | Required |
| `totalRooms` | Required |
| `hotelUid` | Recommended |

### `action: "addExtra"` | `"block"`

Creates adjustment under **`HotelDB/{hotelUid}/availability/{id}`**.

| Field | Notes |
|-------|--------|
| `hotelUid`, `packageId` | Required |
| `delta` / `quantity` | Rooms to add or block |
| `startDate`, `endDate` | Inclusive range |
| `reason`, `note`, `roomTypeName` | Optional |

### `action: "endAdjustment"`

| Field | Notes |
|-------|--------|
| `hotelUid`, `adjustmentId` | Required |

Deactivates adjustment (`active: false`).

> **Note:** Admin portal primary path uses Firestore client (`HotelAvailability.js`) for the same nested paths. This callable is the server-side equivalent for ops / future tools.

---

## 9. `releaseHotelInventory`

**Audience:** Admin ops  
**Auth:** Admin  

```json
{ "bookingId": "hotel_..." }
```

Releases night-ledger reservation if `inventoryReserved` on the booking. Cancel triggers often do this automatically (`onHotelBookingStatusChangeV3`).

---

## 10. `acceptHotelBookingWithAvailability`

**Audience:** Admin portal  
**Auth:** Admin  
**Client:** `src/services/HotelBookingAccept.js`

```json
{ "bookingId": "hotel_..." }
```

- Re-checks full-stay capacity  
- Reserves inventory if not already reserved  
- Sets booking Accepted / confirmed  

Fails if not enough rooms for the whole stay.

---

## 11. `expireHotelBookingHolds`

**Type:** Cloud Scheduler — `every 5 minutes`  
**Timezone:** `Asia/Bangkok`  
**Auth:** Service identity (not client-callable)

Query: `hotelBookingHolds` where `status == "HOLD"` and `holdUntil <= now`  
Action: unlock ledger + set `status: "EXPIRED"`

Requires composite index (deployed via `firestore.indexes.json`):

- Collection: `hotelBookingHolds`  
- Fields: `status` ASC, `holdUntil` ASC  

---

## Hold document shape (`hotelBookingHolds`)

```json
{
  "holdId": "hold_...",
  "userId": "authUid",
  "hotelUid": "...",
  "packageId": "...",
  "checkIn": "YYYY-MM-DD",
  "checkOut": "YYYY-MM-DD",
  "roomsRequested": 2,
  "roomsHeld": 2,
  "roomsPendingIntent": 0,
  "status": "HOLD | COMPLETED | RELEASED | EXPIRED",
  "inventoryReserved": true,
  "inventoryReleased": false,
  "holdUntil": "Timestamp",
  "holdMinutes": 10,
  "bookingId": null,
  "messaging": {},
  "source": "WEB_HOLD"
}
```

**Rules:** Client **read own** hold; **create/update/delete only via Functions** (admin SDK).

---

## Error codes (typical `HttpsError`)

| Code | When |
|------|------|
| `unauthenticated` | Missing Firebase Auth |
| `permission-denied` | Not admin / wrong user for hold |
| `invalid-argument` | Missing hotel, dates, room type, holdId, action |
| `not-found` | Hotel, hold, or booking missing |
| `failed-precondition` | Capacity, pricing, hold already released/completed |
| `deadline-exceeded` | Hold expired |
| `already-exists` | Hold already completed to a booking |
| `internal` | Unexpected server error |

Callable errors surface as `error.code` like `functions/deadline-exceeded`.

---

## Deploy

```bash
cd functions
npm run build
cd ..

# Website booking + soft hold
firebase deploy --only "functions:checkHotelAvailability,functions:createHotelBookingWithAvailability,functions:startHotelBookingHold,functions:completeHotelBookingHold,functions:releaseHotelBookingHold,functions:expireHotelBookingHolds,functions:acceptHotelBookingWithAvailability"

# Admin callables (optional if portal uses Firestore client only)
firebase deploy --only "functions:getHotelAvailability,functions:getHotelAvailabilityCalendar,functions:manageHotelAvailability,functions:releaseHotelInventory"

# Rules + hold expiry index
firebase deploy --only firestore:rules,firestore:indexes
```

**IAM:** Deployer needs Cloud Functions Admin + Cloud Run Admin (invoker policy) for **new** Gen2 functions.

---

## Source map

| Area | Path |
|------|------|
| Admin callables | `functions/src/hotelAvailabilityWorkflow.ts` |
| Website + hold + accept | `functions/src/hotelBookingWithAvailability.ts` |
| Ledger reserve/release | `functions/src/utils/hotelInventoryTx.ts` |
| Exports | `functions/src/index.ts` |
| Admin Firestore service | `src/services/HotelAvailability.js` |
| Hold client | `src/services/HotelBookingHold.js` |
| Accept client | `src/services/HotelBookingAccept.js` |
| Rules | `firestore.rules` → `HotelDB/{hotelId}/availability`, `hotelBookingHolds` |

---

## Quick examples

### Check then hold then complete

```js
import { getFunctions, httpsCallable } from "firebase/functions";

const CHECK_URL =
  "https://asia-east2-gothai-ffea1.cloudfunctions.net/checkHotelAvailability";

const fn = getFunctions(app, "asia-east2");
const start = httpsCallable(fn, "startHotelBookingHold");
const complete = httpsCallable(fn, "completeHotelBookingHold");
const release = httpsCallable(fn, "releaseHotelBookingHold");

const stay = {
  hotelId: "HOTEL_UID",
  packageId: "ROOM_ID",
  checkIn: "2026-08-10",
  checkOut: "2026-08-12",
  rooms: 2,
};

// 1) Public check — fetch only (CORS)
const checkRes = await fetch(CHECK_URL, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(stay),
});
const avail = await checkRes.json();
// avail.messaging — show UI

// 2) Soft lock — callable (user signed in)
const { data: hold } = await start({ ...stay, userId: auth.uid });
try {
  const { data: booking } = await complete({
    holdId: hold.holdId,
    fullName: "Guest Name",
    guestEmail: "guest@example.com",
    guestPhone: "+66...",
    paymentMethod: "STRIPE",
  });
  // booking.payNow → payment step
} catch (e) {
  await release({ holdId: hold.holdId });
  throw e;
}
```

### Admin accept pending

```js
import { acceptHotelBookingWithAvailability } from "../services/HotelBookingAccept";

await acceptHotelBookingWithAvailability(bookingId);
```

---

## CORS notes (check only)

`checkHotelAvailability` sets `Access-Control-Allow-Origin` for:

- `http://localhost:*` / `http://127.0.0.1:*` (e.g. port 3000, 5173)
- `https://thaiseva.com`, `https://www.thaiseva.com`
- `*.web.app`, `*.firebaseapp.com`, `*.vercel.app`

Handles **OPTIONS** preflight. Methods: `GET`, `POST`.

If the browser still reports CORS errors:

1. Confirm you are **not** using `httpsCallable` for check  
2. Confirm URL is the **HTTPS** function URL above  
3. Redeploy after changing CORS:  
   `firebase deploy --only functions:checkHotelAvailability`

---

## Changelog (API surface)

| Date | Change |
|------|--------|
| 2026-08-02 | Nested `HotelDB/.../availability` for config + adjustments |
| 2026-08-02 | Callables: create, accept; soft hold start / complete / release + expire |
| 2026-08-02 | **`checkHotelAvailability` → public HTTPS + CORS** (website `fetch`; not callable) |
| 2026-08-02 | This Functions API doc |
