# Hotel Room Availability — Change log

## 2026-08-02

### Admin UI
- Added **Hotel Related → Room Availability** sidebar page
- Hub: `/dashboard/hotel-room-availability` with **main statistics**
- Detail: `/dashboard/hotel-room-availability/:hotelId` with calendar + stats
- Room types only from Add/Edit Hotel (no duplicate room management)

### Defaults
- Auto-booking **ON** per hotel
- **5** rooms per type default inventory

### Data path
- Admin uses **Firestore client** (`src/services/HotelAvailability.js`)
- No callables required for admin UI (avoids CORS / invoker IAM)

### Collections
- `HotelDB/{hotelId}/availability` (`config` plus adjustment documents)
- Optional: `hotelRoomInventory`, `hotelInventoryAuditLogs`
- `HotelDB/{hotelId}/availability/config`, room `totalRooms`

### Rules / indexes
- Rules for adjustments + inventory ledger
- Indexes for adjustments and hotelUid+packageId bookings

### Cloud Functions
- Admin-only callables: `functions/src/hotelAvailabilityWorkflow.ts`
- Website booking + hold: `functions/src/hotelBookingWithAvailability.ts`
  - **`checkHotelAvailability`** — public **HTTPS + CORS** (`fetch`); not a callable
  - **`createHotelBookingWithAvailability`** — callable
  - **Soft hold:** `startHotelBookingHold` / `completeHotelBookingHold` / `releaseHotelBookingHold` (callables)
  - **`expireHotelBookingHolds`** — schedule every 5 min
  - **`acceptHotelBookingWithAvailability`** — admin accept + reserve
- Triggers: pending create; cancel release if `inventoryReserved`

### Docs updated
- `documentation/HOTEL_AVAILABILITY_API.md`
- `documentation/HOTEL_AVAILABILITY_FUNCTIONS_API.md` (Functions request/response API)
- `AUTOMATION_LOGIC_REPORT.md`
- `documentation/FIREBASE_REFERENCE.md`
- `COLLECTION_SCHEMA_REFERENCE.md`
- `FIRESTORE_DATA_REFERENCE.md`
- `README.md`
- `frontend_mapping_strategy.md`

---

## 2026-08-02 (later) — check CORS fix

- Website `fetch` from `localhost:3000` failed CORS while `checkHotelAvailability` was a **callable**
- Redeployed as **`onRequest`** + public invoker + explicit CORS origins
- URL: `https://asia-east2-gothai-ffea1.cloudfunctions.net/checkHotelAvailability`
- Docs: do **not** use `httpsCallable` for check

---

## 2026-08-05 — inventory lock repair, partial pay, guest capacity

### Cloud Functions
- **`unlockHotelRoomLock`** (admin callable) — free stuck nights by `holdId`, `bookingId`, or manual stay; optional `force` + delete related holds
- Hotel/admin callables use **`invoker: "public"`** + CORS so browser preflight works; Auth + admin checks still enforced in code
- CORS allowlist includes **`https://admin.thaiseva.com`**
- **Guest capacity** on create/hold complete: `maxAdults` / `maxChildren` (+ extra-bed caps) → `GUEST_CAPACITY`
- Booking doc ids include **`checkOut`** (legacy ids still used for same-stay idempotency)
- **`acceptHotelBookingWithAvailability`**: admin **or hotel partner** (owner uid); partial accept sets `amountDue` / `payNow` for top-up
- **`createCheckoutSession`**: hotel pay allowed for accepted / partial instant rooms; charges **`amountDue`** when set
- **`markBookingPaid`**: hotel clears `amountDue`; sightseeing Stripe pay → **Accepted** (auto)
- Cancel/reject trigger releases inventory for **CANCELED / REJECTED / DENIED**
- Night ledger helpers: `unlockAndDeleteHold`, `unlockBookingStayLock`, `forceUnlockStayNights`

### Admin portal
- `HotelAvailability.js`: **reads** Firestore; **writes** (extra/block/qty/release/unlock) prefer **Cloud Functions** so ledger stays in sync with website
- Calendar merges ledger + date adjustments (Bangkok `YYYY-MM-DD`)
- Room booking UI + booking status helpers for partial / awaiting payment
- Partner hotel accept path + room forms (guest limits)

### Rules / indexes
- Safer `userRole()` lookup (missing `users/{uid}` no longer breaks OR rules)
- Public read on `HotelDB/{hotelId}/availability` without calling `isAdmin()` in the read path
- Index: `hotelBookingHolds` (`status`, `inventoryReserved`)

### Ops scripts (`functions/scripts/`)
- `clearAllHotelHolds.js` — unlock + delete hold docs
- `clearAllHotelBookings.js` — wipe hotel bookings (ops)
- `repairNightReserved.js` — rebuild night `reserved` from live bookings

### Docs updated
- `documentation/HOTEL_AVAILABILITY_API.md`
- `documentation/HOTEL_AVAILABILITY_FUNCTIONS_API.md`
- `documentation/THAISEVA_BOOKING_API.md`
- `documentation/FIREBASE_REFERENCE.md`
