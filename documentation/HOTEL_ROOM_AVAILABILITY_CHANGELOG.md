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
