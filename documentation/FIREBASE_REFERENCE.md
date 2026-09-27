# Firebase Reference — Thaiseva Admin Portal

Saved for future reference. Last updated: **June 22, 2026**.

> **Source of truth:** live config is always in repo root files (`firebase.json`, `firestore.rules`, `storage.rules`, `.env`). This doc is a snapshot + guide.

---

## Project

| Item | Value |
|------|-------|
| **Project ID** | `gothai-ffea1` |
| **Auth domain** | `gothai-ffea1.firebaseapp.com` |
| **Storage bucket** | `gothai-ffea1.firebasestorage.app` |
| **Hosting site** | `gothai-admin` |
| **Console** | https://console.firebase.google.com/project/gothai-ffea1/overview |

### Client env vars (`.env`)

```
VITE_apiKey=...
VITE_authDomain=gothai-ffea1.firebaseapp.com
VITE_projectId=gothai-ffea1
VITE_storageBucket=gothai-ffea1.firebasestorage.app
VITE_messagingSenderId=46959975552
VITE_appId=1:46959975552:web:5e9c3d90c5ecb4a3dc9a65
VITE_measurementId=G-CG6LQ6F68G
```

Secrets (`VITE_SECRET_KEY`, `VITE_IV_KEY`, API tokens) stay in `.env` only — **do not commit** to docs or git.

### Admin access (Firestore `isAdmin()`)

- Emails: `admin@gmail.com`, `thaiseva_admin@gmail.com`
- User doc role: `Admin`, `admin`, or `Sub Admin`
- Custom claim: `request.auth.token.admin == true`

---

## Repo file map

| File | Purpose |
|------|---------|
| `firebase.json` | Hosting, Firestore, Storage, Functions config |
| `firestore.rules` | Firestore security rules (deployed) |
| `firestore.indexes.json` | Composite indexes |
| `storage.rules` | Storage security rules |
| `functions/` | Cloud Functions (triggers, Telegram, etc.) |
| `src/firebase/firebase.config.js` | Client SDK init + collection refs |
| `src/services/Earning.js` | Revenue stats + `MasterEarnings` writes |

---

## Deploy commands

```bash
# Firestore rules only
firebase deploy --only firestore:rules

# Storage rules only
firebase deploy --only storage

# Hosting (after npm run build)
firebase deploy --only hosting

# Functions
firebase deploy --only functions
```

---

## Earnings / statistics paths

Admin statistics read booking revenue from collections **and** optional `MasterEarnings` fallback.

### MasterEarnings structure

```
MasterEarnings/
  Admin/
    {Cars|SelfDrive|Sightseeing|Hotels|Vans}/
      Earnings/
        dailyEarnings/{YYYY-MM-DD}
        monthlyEarnings/{YYYY-MM}
  {type}/
    {partnerId}/
      Earnings/
        dailyEarnings/{YYYY-MM-DD}
        monthlyEarnings/{YYYY-MM}
```

Written when bookings are **accepted** via `updateHourlyEarnings()` / `updateMonthlyEarnings()` in `src/services/Earning.js`.

### Booking collections (statistics source)

| Service | Collection | Amount fields |
|---------|------------|---------------|
| Hotels | `hotelBookingData` | `amountTHB`, `amount` |
| Sightseeing | `travelBookingDetails` | `totalAmount`, `price`, `amount` |
| Car booking (car / van / taxi / bike) | `car_bookings` | `AmountOffered`, `amount` |
| Self Drive | `self_driving_bookings` | `AmountOffered`, `amount` |

Revenue counts **Accepted / Confirmed / Done** bookings only.

---

## Firestore rules (snapshot)

Full live rules: **`firestore.rules`** at repo root.

### Rule sections summary

1. **Helpers** — `isAuthenticated()`, `isAdmin()`, `isOwner()`, `ownsIncoming()`
2. **Public read** — BlogDB, HotelDB, packages, partners, `Thaiseva_terms`, `food_items`, etc.
3. **Settings** — `settings/{docId}` public read, admin write
4. **Users** — `users/{userId}` and `Users/{userId}`
5. **Notifications** — admin + per-user subpaths
6. **Food app** — `orders`, `cart`, `reviews`, `feedbackandratings`
7. **T2T** — `T2T_world/{docId}/{subPath=**}`
8. **Bookings** — `hotelBookingData`, `travelBookingDetails`, `car_bookings`, `self_driving_bookings`
9. **Partner data** — hotels, restaurants, drivers, packages, requirements
10. **Admin-only** — agents, shops, invoices, statistics, vanCompanies, etc.
11. **MasterEarnings** — admin read/create/update; partner read/create/update on own path; **no delete**
12. **Chat** — `chatRooms`, `chats`, `messages`, `calls`
13. **Other** — `bookings`, `dineInBookings`, `self_drive_conditions_and_documents`, `agents`, `RestAdmin`
14. **Default deny** — everything else blocked

### MasterEarnings rules (important for admin statistics)

```
match /MasterEarnings/Admin/{type}/Earnings/{earningsType}/{docId} {
  allow read: if isAdmin();
  allow create, update: if isAdmin();
}

match /MasterEarnings/{type}/{partnerId}/Earnings/{earningsType}/{docId} {
  allow read: if isAdmin() || (isAuthenticated() && request.auth.uid == partnerId);
  allow create, update: if isAdmin() || (isAuthenticated() && request.auth.uid == partnerId);
}
```

---

## Storage rules (snapshot)

File: **`storage.rules`**

- Public read on all paths
- Write requires authentication

---

## Customer booking APIs (website / app)

**Share this one file only with website/app developers:**

| Doc | Audience |
|-----|----------|
| [`THAISEVA_BOOKING_API.md`](./THAISEVA_BOOKING_API.md) | Full booking API (hotel, sightseeing, car booking, self-drive) |

Cloud Functions HTTPS (`asia-east2`): create/pay, transport quote fetch, notifications inbox `notifications/users/{userId}`.

Transport APIs: **`createCarBooking`** (`transportType`: car \| van \| taxi \| bike) and **`createSelfDriveBooking`**. No separate van booking API.

## Related app routes

| Route | Firebase usage |
|-------|----------------|
| `/dashboard/admin-statistics` | Bookings + `MasterEarnings` via `Earning.js` |
| `/dashboard/room-bookings` | `hotelBookingData` |
| `/dashboard/hotel-room-availability` | `HotelDB`, `availability`, rooms, `hotelBookingData` (stats + calendar) |
| `/dashboard/hotel-room-availability/:hotelId` | Same + per-type inventory (`totalRooms`), `availability/config` |
| `/dashboard/travel-bookings` | `travelBookingDetails` |
| `/dashboard/car-bookings` | `car_bookings` (non-van: car / taxi / bike) |
| `/dashboard/van-bookings` | `car_bookings` where `transportType` is van |
| `/dashboard/self-drive-bookings` | `self_driving_bookings` |

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Statistics show `0` | No accepted bookings in date range, or pending only | Accept bookings; widen date filter (default 60 days) |
| `permission-denied` on statistics | Rules not deployed or user not admin | `firebase deploy --only firestore:rules`; verify role/email |
| Earnings never increase | Writes failed before rules fix | Re-accept or backfill; check browser console |
| Sub Admin empty stats | Was `isAdmin`-only in provider | Fixed: `StatisticsProvider` uses `isAdmin \|\| isSubAdmin` |

---

## Change log (permissions)

- **2026-08-12** — Transport simplified to 2 APIs only: `createCarBooking` (transportType car|van|taxi|bike) + `createSelfDriveBooking`. Removed van booking product/API/admin page. Single client doc: `THAISEVA_BOOKING_API.md`.
- **2026-08-05** — Hotel inventory unlock (`unlockHotelRoomLock`), partial-accept `amountDue` pay path, guest capacity, safer `userRole()` rules, admin callables for availability writes. See `HOTEL_AVAILABILITY_*` docs + `THAISEVA_BOOKING_API.md`.
- **2026-08-02** — Hotel Room Availability: admin UI + rules for `HotelDB/{hotelId}/availability`, `hotelRoomInventory`, `hotelInventoryAuditLogs`; hub stats. Website: `checkHotelAvailability` public HTTPS + CORS; soft hold + create callables. See `documentation/HOTEL_AVAILABILITY_API.md` and `documentation/HOTEL_AVAILABILITY_FUNCTIONS_API.md`.
- **2026-06-22** — Merged app-wide rules (orders, cart, T2T, chat, etc.) with admin portal rules; added `MasterEarnings` read/create/update; deployed to `gothai-ffea1`.
- **2026-06-22** — Statistics switched to aggregate from booking collections with `MasterEarnings` fallback.
