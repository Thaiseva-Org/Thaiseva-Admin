# Hotel Stock API — Simple Numbers Model

**Last updated:** 2026-08-09  
**Project:** `gothai-ffea1` · **Region:** `asia-east2`

Replaces the multi-document availability merge (adjustments + night ledger + allocations + holds) with **one formula and three APIs**.

---

## Formula

```
free = max(0, total − locked − booked)
```

| Field | Meaning |
|-------|---------|
| `total` | Sellable capacity for that night (admin sets) |
| `locked` | Soft-hold rooms (checkout in progress) |
| `booked` | Confirmed inventory |
| `free` | Computed — never the write authority |

**Stay nights:** half-open `[checkIn, checkOut)` (checkout day is free).

**Lock policy:** all-or-nothing — every night must have `free >= rooms` or lock fails.

---

## Data model

### Night stock

```
hotelStock/{hotelId}_{packageId}/nights/{YYYY-MM-DD}
```

```json
{
  "hotelId": "…",
  "packageId": "…",
  "date": "2026-08-10",
  "total": 5,
  "locked": 0,
  "booked": 2,
  "free": 3,
  "updatedAt": "Timestamp"
}
```

### Locks (ownership only — not capacity)

```
hotelLocks/{lockId}
```

```json
{
  "lockId": "…",
  "hotelId": "…",
  "packageId": "…",
  "checkIn": "YYYY-MM-DD",
  "checkOut": "YYYY-MM-DD",
  "rooms": 2,
  "kind": "hold | book",
  "status": "active | released | converted | expired",
  "userId": "…",
  "bookingId": null,
  "expiresAt": "Timestamp | null",
  "nights": ["2026-08-10", "2026-08-11"]
}
```

### Config (optional)

```
HotelDB/{hotelId}/availability/config
```

- `autoBookingEnabled`, `defaultTotal` / `defaultRoomInventory`
- `bookingOpenFrom`, `bookingOpenTo`, `timezone`

**Extra rooms** = raise `total` for a date range.  
**Block** = lower `total` for a date range.  
No separate adjustment documents for capacity.

---

## The 3 APIs

| API | Type | Auth | Side effect |
|-----|------|------|-------------|
| **`checkHotelStock`** | HTTPS + CORS | No | None |
| **`lockHotelStock`** | Callable | Yes | `locked++` or `booked++` or convert |
| **`unlockHotelStock`** | Callable | Yes | free numbers; expire holds |

Also: `expireHotelStockHolds` (every 5 min), `manageHotelStock` (admin totals/config).

Compatibility names still work and hit the **same stock**:

| Old name | Maps to |
|----------|---------|
| `checkHotelAvailability` | `checkHotelStock` |
| `startHotelBookingHold` | lock hold |
| `completeHotelBookingHold` | convert + create booking |
| `releaseHotelBookingHold` | unlock |
| `manageHotelAvailability` | `manageHotelStock` |

---

### 1. Check

```
POST https://asia-east2-gothai-ffea1.cloudfunctions.net/checkHotelStock
```

```js
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
const data = await res.json();
// data.free, data.canLock, data.nights[]
```

Missing night docs count as full `defaultTotal` free (no write).

---

### 2. Lock

```js
import { getFunctions, httpsCallable } from "firebase/functions";
const functions = getFunctions(app, "asia-east2");
const lock = httpsCallable(functions, "lockHotelStock");

// Soft hold (10 min)
await lock({
  hotelId, packageId, checkIn, checkOut, rooms: 2,
  action: "hold", // or kind: "hold"
});

// Confirm hold → booked (free unchanged)
await lock({ lockId, action: "convert" });

// Direct book (no hold)
await lock({
  hotelId, packageId, checkIn, checkOut, rooms: 2,
  action: "book",
});
```

---

### 3. Unlock

```js
const unlock = httpsCallable(functions, "unlockHotelStock");
await unlock({ lockId });

// Admin force stay
await unlock({
  force: true,
  hotelId, packageId, checkIn, checkOut, rooms: 2,
  target: "locked" | "booked" | "both",
});
```

---

## Website flow

```
1. checkHotelStock          → show free rooms
2. lockHotelStock (hold)    → lock while guest fills form
3a. completeHotelBookingHold → convert + booking Accepted
3b. unlockHotelStock        → guest left
    (or expireHotelStockHolds)
```

---

## Pending accept → auto-expand capacity

When website create cannot lock (free short or auto-book off), booking is **Pending** with no stock lock.

`acceptHotelBookingWithAvailability` (admin or hotel owner):

1. For each stay night, if `free < rooms`, raises `total` so `free >= rooms`  
   (`total = max(total, locked + booked + rooms)`)
2. Books those rooms (`booked += rooms`) in the **same transaction**
3. Sets booking Accepted + `inventoryReserved`

Response includes `stockExpanded` and `expandedTotals[]` (`date`, `totalBefore`, `totalAfter`, `added`).  
Calendar / Room Availability hub then shows the higher `total` for those dates.

---

## Admin

| Action | How |
|--------|-----|
| Calendar | Read `hotelStock/.../nights` (portal) or `manageHotelStock` `getCalendar` |
| Set room default qty | `manageHotelStock` / `manageHotelAvailability` `setTotalRooms` |
| Extra for dates | `addExtra` → `total += delta` |
| Block for dates | `block` → `total -= delta` |
| Accept pending (auto +total) | `acceptHotelBookingWithAvailability` |
| Config / auto-book | `setBookableWindow` |
| Force free | `unlockHotelStock` / `unlockHotelRoomLock` |

Portal service: `src/services/HotelAvailability.js`  
Hold client: `src/services/HotelBookingHold.js`

---

## Migration

```bash
cd functions
node scripts/rebuildHotelStock.js --dry-run
node scripts/rebuildHotelStock.js --days=90
```

Seeds `hotelStock` nights from room `totalRooms` + accepted bookings (`booked`), `locked = 0`.

Deploy:

```bash
cd functions && npm run build
firebase deploy --only "functions:checkHotelStock,functions:lockHotelStock,functions:unlockHotelStock,functions:expireHotelStockHolds,functions:manageHotelStock,functions:checkHotelAvailability,functions:startHotelBookingHold,functions:completeHotelBookingHold,functions:releaseHotelBookingHold,functions:expireHotelBookingHolds,functions:createHotelBookingWithAvailability,functions:acceptHotelBookingWithAvailability,functions:getHotelAvailability,functions:getHotelAvailabilityCalendar,functions:manageHotelAvailability,functions:releaseHotelInventory,functions:unlockHotelRoomLock,functions:onHotelBookingStatusChangeV3"
firebase deploy --only firestore:rules
```

---

## Source files

| File | Role |
|------|------|
| `functions/src/utils/hotelStock.ts` | Number engine |
| `functions/src/hotelStockApi.ts` | check / lock / unlock / expire / manage |
| `functions/src/hotelBookingStock.ts` | create / accept / complete booking |
| `functions/scripts/rebuildHotelStock.js` | Rebuild stock |

Legacy modules (`hotelInventoryTx.ts`, old `hotelBookingWithAvailability.ts`) are no longer exported from `index.ts`.
