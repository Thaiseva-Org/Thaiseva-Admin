# Hotel Room Availability - Admin Portal

> [!NOTE]
> **Consolidated Specification:** This availability guide has been unified into the authoritative **[Cloud Functions API Specification (Section 2: Hotel Stock & Concurrency)](file:///d:/projects/Thaiseva-Admin-Portal-Web-App/docs/03-api/API_SPECIFICATION.md)** and the **[Firestore Data Architecture & Schema Dictionary](file:///d:/projects/Thaiseva-Admin-Portal-Web-App/docs/04-data/DATA_SCHEMA_DICTIONARY.md)**.

> **New model (recommended):** number-based stock with 3 APIs - see  
> [`HOTEL_STOCK_API.md`](./HOTEL_STOCK_API.md)  
> (`free = total − locked − booked`, check / lock / unlock)

**Cloud Functions request/response API (legacy names, same stock):**  
[`HOTEL_AVAILABILITY_FUNCTIONS_API.md`](./HOTEL_AVAILABILITY_FUNCTIONS_API.md)

## Purpose

Admin staff manage **room inventory by night** so:

- Hotels have a clear calendar (Normal / Extra / Blocked / Booked / Remaining)
- Auto-booking can be turned ON/OFF per hotel (default **ON**)
- Default stock is **5 rooms per type** when not set (editable)
- Temporary extras and blocks work for date ranges

**Room types are created only in Add/Edit Hotel** - not recreated on the availability page.

**Admin UI** - **reads** via Firestore; **writes** (extra / block / qty / release / unlock) go through **admin Cloud Functions** so the night ledger stays aligned with website booking.  
**Website / app** APIs: [`HOTEL_AVAILABILITY_FUNCTIONS_API.md`](./HOTEL_AVAILABILITY_FUNCTIONS_API.md)  
(`check` = HTTPS `fetch`; hold/create/accept = callables).

---

## Admin navigation

| Route | Page |
|-------|------|
| `/dashboard/hotel-room-availability` | Hub: main stats + hotel cards |
| `/dashboard/hotel-room-availability/:hotelId` | Manage one hotel (calendar + settings) |
| Legacy | `/dashboard/hotels/:hotelId/availability` (same detail page) |

**Sidebar:** Hotel Related → **Room Availability**

**Source files**

| Path | Role |
|------|------|
| `src/pages/.../hotels/HotelRoomAvailabilityHub.jsx` | Hub + main statistics |
| `src/pages/.../hotels/HotelRoomAvailabilityPage.jsx` | Hotel calendar + settings |
| `src/services/HotelAvailability.js` | Calendar reads (Firestore) + write callables |
| `src/services/HotelBookingAccept.js` | Accept pending / partial bookings |
| `src/utils/RouteLinks.jsx` | `hotellinks` entry |

---

## Main statistics (UI)

### Hub

- Total hotels  
- Auto-book ON / OFF counts  
- Rooms sold today (accepted stays covering today)  
- Pending hotel bookings  
- Occupancy bar (sold today vs hotel-level capacity)

### Per hotel page

- Room type count + total inventory  
- Selected type stock  
- Open / almost full / full nights in range  
- Average remaining vs peak booked  
- Active temporary adjustments  

---

## Formula

```
reserved = held + booked + untracked
remaining = max(0, normal + extra − blocked − reserved)
```

| Field | Source |
|-------|--------|
| **normal** | Explicit `HotelDB/{hotel}/rooms/{id}.totalRooms` |
| **extra** | Active `HotelDB/{hotelId}/availability/{id}` type `extra` |
| **blocked** | Active adjustments type `blocked` |
| **reserved** | Accepted `hotelBookingData` for that hotel + room type covering the night |

New night ledgers classify reservations as `held` (temporary checkout locks),
`booked` (accepted/confirmed inventory), and `untracked` (legacy aggregate
inventory awaiting reconciliation). `reserved` remains the compatibility total.

Room quantity and availability settings must be explicitly saved before
automatic booking is enabled. An unconfigured legacy hotel remains pending
instead of silently selling fallback inventory.

**Occupied nights:** half-open interval **`[checkIn, checkOut)`**  
Checkout day is free for a new check-in.

---

## Defaults

| Setting | Default | Where set |
|---------|---------|-----------|
| `autoBookingEnabled` | `true` | `HotelDB/{hotelId}/availability/config` |
| `defaultRoomInventory` | `5` | same |
| New room type `totalRooms` | `5` | Add Hotel room modal |
| Hotel `totalRooms` | `5` | Add Hotel form |

---

## Data model

### `HotelDB/{hotelId}`

```json
{
  "hotel": { "hotelName": "...", "totalRooms": 5 }
}
```

### `HotelDB/{hotelId}/rooms/{roomId}`

Room types from Add/Edit Hotel. Inventory fields:

- `totalRooms` / `quantity` - sellable count for this type  
- `roomName` / `packageName`  
- String document IDs preferred (numeric ids break some Firestore paths)

### `HotelDB/{hotelId}/availability/config`

```json
{
  "recordType": "config",
  "hotelUid": "string",
  "bookingOpenFrom": "YYYY-MM-DD | null",
  "bookingOpenTo": "YYYY-MM-DD | null",
  "timezone": "Asia/Bangkok",
  "autoBookingEnabled": true,
  "defaultRoomInventory": 5,
  "notifyOnFull": true,
  "notifyOnFreed": true
}
```

### `HotelDB/{hotelId}/availability/{adjustmentId}`

```json
{
  "hotelUid": "string",
  "packageId": "string",
  "recordType": "adjustment",
  "type": "extra | blocked",
  "delta": 2,
  "startDate": "YYYY-MM-DD",
  "endDate": "YYYY-MM-DD",
  "reason": "string",
  "note": "string",
  "active": true,
  "roomTypeName": "string",
  "createdAt": "Timestamp"
}
```

### `hotelBookingData`

Used for **reserved** counts when status is Accepted/Confirmed (or `isBookingConfirmed`).

Match hotel via `hotelUid` / `hotelId`, room via `packageId` / `roomId`.

### Optional (server / future)

- `hotelRoomInventory/{hotelUid}_{packageId}/nights/{YYYY-MM-DD}` - classified night ledger
- `hotelInventoryAllocations/{allocationId}` - idempotent allocation ownership
- `hotelInventoryAuditLogs` - audit trail  

Admin UI currently **computes remaining live** (does not require the ledger).

---

## Service API (`src/services/HotelAvailability.js`)

| Mode | How |
|------|-----|
| **Reads** (calendar, stay preview) | Firestore client (Admin / partner rules) |
| **Writes** (config, qty, extra, block, release, unlock) | Prefer `httpsCallable` → `manageHotelAvailability` / `releaseHotelInventory` / `unlockHotelRoomLock` so night ledger stays correct |

Dates are normalized as **`YYYY-MM-DD` in `Asia/Bangkok`**. Calendar capacity merges **night ledger** with **active date adjustments** (extras always surface even if ledger is stale).

| Export | Purpose |
|--------|---------|
| `getHotelAvailabilityCalendar` | Nights + adjustments + config (+ ledger merge) |
| `getHotelAvailability` | Stay preview (admin) |
| `setBookableWindow` | Auto-book, default qty, dates, notify |
| `setTotalRooms` | Update room type inventory |
| `addExtraRooms` / `blockRooms` | Date-range adjustments |
| `endAvailabilityAdjustment` | Deactivate adjustment |
| `releaseHotelInventory` | Ops release booking inventory (callable) |
| `unlockHotelRoomLock` | Force-free hold / booking / manual stay |
| `availabilityColour` / `colourClasses` | Calendar colours |

---

## Cloud Functions

Region: **`asia-east2`**.  
Full request/response API: **[`HOTEL_AVAILABILITY_FUNCTIONS_API.md`](./HOTEL_AVAILABILITY_FUNCTIONS_API.md)**

| Export | Type | How to call | Notes |
|--------|------|-------------|-------|
| `checkHotelAvailability` | **HTTPS + CORS** | `fetch` POST/GET | Public pre-check (no lock). **Not** a callable. |
| `createHotelBookingWithAvailability` | Callable | `httpsCallable` | Create without soft-hold |
| `startHotelBookingHold` | Callable | `httpsCallable` | Booking started → lock (10 min) |
| `completeHotelBookingHold` | Callable | `httpsCallable` | Booking done → keep rooms booked |
| `releaseHotelBookingHold` | Callable | `httpsCallable` | Left without booking → unlock |
| `expireHotelBookingHolds` | Scheduler | n/a | Every 5 min; expire holds |
| `acceptHotelBookingWithAvailability` | Callable | `httpsCallable` | Admin **or hotel partner** accept + reserve (partial → `amountDue`) |
| `getHotelAvailability` | Callable | Admin | Optional ops preview |
| `getHotelAvailabilityCalendar` | Callable | Admin | Optional calendar |
| `manageHotelAvailability` | Callable | Admin | Config / extra / block (server path) |
| `releaseHotelInventory` | Callable | Admin | Ops release |
| `unlockHotelRoomLock` | Callable | Admin | Force unlock hold / booking / stay nights |
| `forceHotelBookingPending` | Trigger | n/a | Pending + Telegram |
| `onHotelBookingStatusChangeV3` | Trigger | n/a | Cancel / reject / denied → release if reserved |

### Check URL (website)

```
https://asia-east2-gothai-ffea1.cloudfunctions.net/checkHotelAvailability
```

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
const data = await res.json(); // data.messaging, roomsInstant, roomsPending, ...
```

### Soft hold (callables)

**Collection:** `hotelBookingHolds` (Functions write only; client may read own holds).  
**Client helper:** `src/services/HotelBookingHold.js`

```js
import {
  startHotelBookingHold,
  completeHotelBookingHold,
  releaseHotelBookingHold,
} from "../services/HotelBookingHold";

const hold = await startHotelBookingHold({
  userId: auth.uid,
  hotelId,
  packageId,
  checkIn: "2026-08-10",
  checkOut: "2026-08-12",
  rooms: 2,
});

const booking = await completeHotelBookingHold({
  holdId: hold.holdId,
  fullName,
  guestEmail,
  guestPhone,
});

// Abandon - pagehide / unmount
await releaseHotelBookingHold(hold.holdId);
```

Deploy:

```bash
cd functions && npm run build
firebase deploy --only "functions:checkHotelAvailability,functions:startHotelBookingHold,functions:completeHotelBookingHold,functions:releaseHotelBookingHold,functions:expireHotelBookingHolds,functions:createHotelBookingWithAvailability,functions:acceptHotelBookingWithAvailability"
firebase deploy --only "functions:getHotelAvailability,functions:getHotelAvailabilityCalendar,functions:manageHotelAvailability,functions:releaseHotelInventory,functions:unlockHotelRoomLock"
firebase deploy --only firestore:rules,firestore:indexes
```

**Callable CORS:** browser callables use `cors: true` + Gen2 **`invoker: "public"`** (unauthenticated Cloud Run invoker). Firebase Auth + role checks still run inside the function.

---

## Firestore rules (required for admin UI)

Deploy:

```bash
firebase deploy --only firestore:rules
```

Added collections:

- `hotelRoomInventory` (+ `nights`) - Admin write  
- `HotelDB/{hotelId}/availability` - Admin CRUD  
- `hotelInventoryAuditLogs` - Admin read/create  

`HotelDB`, `HotelDB/.../rooms`, and `HotelDB/.../availability` allow Admin write.

---

## Indexes

If the console asks for indexes:

| Collection | Fields |
|------------|--------|
| `hotelBookingData` | `hotelUid` ASC, `packageId` ASC |
| `hotelBookingHolds` | `status` ASC, `holdUntil` ASC (expire job) |
| `hotelBookingHolds` | `status` ASC, `inventoryReserved` ASC (ops / repair) |

Also listed in `firestore.indexes.json`.

---

## App / website (implemented)

1. **`checkHotelAvailability`** - public HTTPS `fetch` (messaging only)  
2. **Soft hold** - `start` → `complete` / `release` (callables)  
3. **Or** `createHotelBookingWithAvailability` without hold  
4. Instant free rooms → Accepted + reserve; partial free → instant Accepted + remainder Pending  
5. Guest counts enforced when room `maxAdults` / `maxChildren` set (`GUEST_CAPACITY`)  
6. Booking ids include check-out date (idempotent per stay length)  
7. After accept (incl. partial), unpaid balance uses `amountDue` + `createCheckoutSession`  

Admin portal does not implement the customer checkout UI. Ops repair scripts live under `functions/scripts/`.

The ledger reconciliation tool is dry-run by default:

```bash
cd functions
node scripts/repairNightReserved.js
node scripts/repairNightReserved.js --apply
```

---

## Related docs

- **`documentation/HOTEL_AVAILABILITY_FUNCTIONS_API.md`** - full Cloud Functions API  
- **`documentation/THAISEVA_BOOKING_API.md`** - customer booking APIs (hotel / package / transport)  
- `FIRESTORE_DATA_REFERENCE.md` - collection shapes  
- `COLLECTION_SCHEMA_REFERENCE.md` - schema overview  
- `documentation/FIREBASE_REFERENCE.md` - routes and collections  

