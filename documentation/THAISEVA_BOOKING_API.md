# Thaiseva Booking API — Single Integration Guide

**Share this file only** with website and mobile developers.

| | |
|--|--|
| **Region** | `asia-east2` |
| **Protocol** | HTTPS `POST` + JSON (unless noted) |
| **Auth** | Firebase ID token: `Authorization: Bearer <token>` |
| **Updated** | 2026-08-12 |

**Also see:** [Sightseeing website & app integration](./SIGHTSEEING_CLIENT_INTEGRATION.md) (step-by-step for Checkout vs PaymentSheet).

---

## Table of contents

1. [What this API does](#1-what-this-api-does)
2. [Base URL](#2-base-url)
3. [Authentication](#3-authentication)
4. [Payment methods](#4-payment-methods)
5. [All endpoints](#5-all-endpoints)
6. [Common request / response](#6-common-request--response)
7. [Hotel booking](#7-hotel-booking)
8. [Sightseeing / package booking](#8-sightseeing--package-booking)
9. [Transport (car / van / self-drive)](#9-transport-car--van--self-drive)
10. [Pay later (My Bookings)](#10-pay-later-my-bookings)
11. [Stripe return & webhook](#11-stripe-return--webhook)
12. [Customer notifications (app + website)](#12-customer-notifications-app--website)
13. [Error codes](#13-error-codes)
14. [Client code examples](#14-client-code-examples)
15. [Testing checklist](#15-testing-checklist)
16. [Quick rules for developers](#16-quick-rules-for-developers)

---

## 1. What this API does

The **server** creates bookings, calculates prices (hotel & tours), creates Stripe payment links where allowed, and notifies the user when something changes.

| Service | Who sets price | Online card (Stripe) |
|---------|----------------|----------------------|
| **Hotel** | Server (room × nights) | Yes + Thai QR |
| **Sightseeing package** | Server (package rates) | Yes + Thai QR + Onsite |
| **Car / van / self-drive** | **Admin** (later) | **No Stripe** |

**Transport:** user submits a request → admin sets amount in admin portal → app/website fetches booking or receives a notification.

---

## 2. Base URL

```text
https://asia-east2-<FIREBASE_PROJECT_ID>.cloudfunctions.net/<FunctionName>
```

Example:

```text
https://asia-east2-gothai-ffea1.cloudfunctions.net/createHotelBooking
```

Replace `gothai-ffea1` with your Firebase project ID if different.

---

## 3. Authentication

1. User signs in with **Firebase Auth**.
2. Get token:

```js
const idToken = await firebase.auth().currentUser.getIdToken();
```

3. Send on every customer API call:

```http
POST /createHotelBooking
Authorization: Bearer <idToken>
Content-Type: application/json
```

| Rule | Detail |
|------|--------|
| Required | Yes (except public `checkHotelAvailability` and Stripe `stripeWebhook`) |
| `userId` in body | Must equal token UID, or **omit** it (server uses UID) |
| Missing/invalid token | `401` `UNAUTHENTICATED` |
| Wrong userId | `403` `USER_MISMATCH` |

---

## 4. Payment methods

Send as `paymentMethod` (aliases like `CARD`, `PROMPTPAY`, `OFFLINE` are accepted).

| Value | Hotel | Package | Transport |
|-------|-------|---------|-----------|
| `STRIPE` | Checkout URL if payment is due | Checkout first; booking after pay | **Rejected** (`TRANSPORT_NO_STRIPE`) |
| `THAI_QR` | Save unpaid; admin verifies | Save unpaid; admin verifies | Preference only (no charge) |
| `ONSITE` | **Rejected** | Confirmed; pay later offline | Preference only (no charge) |

Default for hotel/package if omitted: **`STRIPE`**.

---

## 5. All endpoints

### Customer HTTPS (fetch)

| Function | Purpose |
|----------|---------|
| `checkHotelAvailability` | Public pre-check: free rooms / messages |
| `createHotelBooking` | Create hotel booking + optional `stripeUrl` |
| `createSightseeingBooking` | Package booking (Stripe / QR / onsite) |
| `createCarBooking` | Car/taxi request (no Stripe) |
| `createVanBooking` | Van request (no Stripe) |
| `createSelfDriveBooking` | Self-drive request (no Stripe) |
| `getTransportBooking` | Get transport status + admin amount |
| `createCheckoutSession` | Stripe pay for **existing** hotel/package booking |
| `verifySession` | After Stripe success redirect |
| `stripeWebhook` | Stripe → server (do not call from app) |

### Hotel holds (Firebase Callable — optional)

| Function | Purpose |
|----------|---------|
| `startHotelBookingHold` | Soft-lock rooms while user fills the form |
| `completeHotelBookingHold` | Finish hold → booking (or use `createHotelBooking` + `holdId`) |
| `releaseHotelBookingHold` | Unlock if user leaves |

Callable example:

```js
const startHold = httpsCallable(functions, "startHotelBookingHold");
await startHold({ hotelId, packageId, checkIn, checkOut, rooms: 1 });
```

---

## 6. Common request / response

### Success

```json
{
  "success": true,
  "paymentMethod": "STRIPE",
  "bookingId": "abc123",
  "bookingCollection": "hotelBookingData",
  "amount": 3000,
  "currency": "thb",
  "stripeUrl": "https://checkout.stripe.com/c/pay/cs_...",
  "stripeSessionId": "cs_test_...",
  "status": "Accepted",
  "bookingStatus": "ACCEPTED",
  "payNow": true,
  "message": "Redirect the guest to stripeUrl to complete payment."
}
```

### Error

```json
{
  "success": false,
  "error": "Human-readable message",
  "reasonCode": "INVALID_ARGUMENT"
}
```

### What the client should do

| Situation | Action |
|-----------|--------|
| `success` + `stripeUrl` | Redirect: `location.href = stripeUrl` |
| `success` + no `stripeUrl` | Show success / pending / QR UI using `message` |
| Transport `amount: null` | Show “Waiting for price from admin” |
| `success: false` | Show `error`; use `reasonCode` for logic |

---

## 7. Hotel booking

### Flow

```text
1. (Optional) checkHotelAvailability
2. (Optional) startHotelBookingHold when room/dates chosen
3. User enters guest details + payment method
4. POST createHotelBooking  { holdId?, paymentMethod, ... }
5. If stripeUrl → open Stripe
6. Success page → POST verifySession
7. Listen for notifications (section 12)
```

### `POST createHotelBooking`

**Body**

| Field | Required | Notes |
|-------|----------|--------|
| `hotelId` or `hotelUid` | Yes | Hotel document id |
| `packageId` / `roomId` / `roomName` | Yes | Room type |
| `checkIn` / `checkInDate` | Yes | `YYYY-MM-DD` |
| `checkOut` / `checkOutDate` | Yes | After check-in |
| `rooms` | No | Default 1 |
| `adults`, `children` | No | |
| `extraBed` | No | boolean |
| `fullName`, `guestEmail`, `guestPhone` | Recommended | |
| `paymentMethod` | No | `STRIPE` or `THAI_QR` (not ONSITE) |
| `holdId` | No | From soft hold |
| `successUrl`, `cancelUrl` | For Stripe | Allowed hosts only |
| `customerQrPaymentConfirmed` | For QR | boolean |

**Example**

```json
{
  "hotelId": "HOTEL_ID",
  "packageId": "ROOM_TYPE_ID",
  "checkIn": "2026-09-10",
  "checkOut": "2026-09-12",
  "rooms": 1,
  "adults": 2,
  "children": 0,
  "fullName": "John Doe",
  "guestEmail": "john@example.com",
  "guestPhone": "+66812345678",
  "paymentMethod": "STRIPE",
  "holdId": "optional_hold_id",
  "successUrl": "https://thaiseva.com/booking/success?session_id={CHECKOUT_SESSION_ID}",
  "cancelUrl": "https://thaiseva.com/booking/cancel"
}
```

**Behaviour**

- Price is calculated on the **server** (do not send total to charge).
- Instant rooms may be accepted; remainder may stay **pending** (`path`: `auto` | `pending` | `partial`).
- `payNow: true` + `stripeUrl` → charge the payable (instant) amount.
- Pending-only stay → booking saved, often no Stripe URL yet; Stripe opens after **accept**.
- **Guest capacity:** if the room type has `maxAdults` / `maxChildren`, over-capacity fails with reason `GUEST_CAPACITY` (extra-bed caps apply when extra bed is requested and allowed).
- Stable booking ids include **check-out** so different stay lengths do not collide.
- After partial accept, remaining balance is on **`amountDue`** (pay via `createCheckoutSession`).
- Collection: `hotelBookingData`.

---

## 8. Sightseeing / package booking

### `POST createSightseeingBooking`

Collection written by the server: **`travelBookingDetails`**.  
Clients must **not** write this collection directly.

**Body**

| Field | Required | Notes |
|-------|----------|--------|
| `packageId` | Yes | From `sightseeingPackagesDetails` |
| `arrivalDate` / `travelDate` | Yes | `YYYY-MM-DD` |
| `fullName` | Yes | Guest name |
| `adults` | No | Default 1 (max 50) |
| `children` | No | Default 0 |
| `guestEmail`, `guestPhone` | Recommended | Also accepted as `email` / `phone` |
| `departureDate` | No | Defaults to arrival |
| `pickUpTime` | No | Defaults to arrival date |
| `pickUpLocation`, `specialRequests` | No | |
| `paymentMethod` | No | STRIPE / THAI_QR / ONSITE (default STRIPE) |
| `customerQrPaymentConfirmed` | QR | boolean — user declared transfer done |
| `successUrl`, `cancelUrl` | Website Stripe | Checkout return URLs |
| `paymentIntentId` | App Stripe | After PaymentSheet succeeds (`pi_...`) |
| `userId` | Optional | Must match token UID if sent |

**Pricing (server only):**  
`round(adultPrice × adults + childPrice × children)`  
(If child price missing → 50% of adult price.)  
Minimum card charge: **20 THB**.

### Two Stripe modes

| Client | How | Booking created when |
|--------|-----|----------------------|
| **Website** | No `paymentIntentId` → server returns `stripeUrl` (Checkout Session) | **After** pay (`verifySession` or `stripeWebhook`) |
| **App (PaymentSheet)** | Pay first, then send `paymentIntentId` | **Immediately** after server verifies PI |

#### Website Stripe (Checkout)

```json
{
  "packageId": "PACKAGE_ID",
  "adults": 2,
  "children": 1,
  "arrivalDate": "2026-09-15",
  "fullName": "Jane Doe",
  "guestEmail": "jane@example.com",
  "guestPhone": "+66812345678",
  "paymentMethod": "STRIPE",
  "successUrl": "https://thaiseva.com/booking/success?session_id={CHECKOUT_SESSION_ID}",
  "cancelUrl": "https://thaiseva.com/booking/cancel"
}
```

Response (typical):

```json
{
  "success": true,
  "paymentMethod": "STRIPE",
  "bookingId": null,
  "bookingCollection": "travelBookingDetails",
  "amount": 49000,
  "currency": "thb",
  "stripeUrl": "https://checkout.stripe.com/...",
  "stripeSessionId": "cs_...",
  "payNow": true,
  "isPaymentDone": false,
  "message": "Redirect the guest to stripeUrl to complete payment."
}
```

Client: `window.location.href = data.stripeUrl` → on success page call `verifySession`.

#### App Stripe (PaymentSheet + PaymentIntent)

1. Create/confirm a Stripe PaymentIntent for **server price × 100** (satang), currency **`thb`**.
2. Present PaymentSheet; wait until status is **succeeded**.
3. Call `createSightseeingBooking` with the same booking fields + `paymentIntentId`.

```json
{
  "packageId": "921f7fa3-5e80-4eaa-88dd-c84e0ff84ff3",
  "fullName": "abc",
  "guestEmail": "user@gmail.com",
  "guestPhone": "+66676646464",
  "adults": 2,
  "children": 1,
  "arrivalDate": "2026-08-11",
  "departureDate": "2026-08-12",
  "pickUpTime": "2026-08-11",
  "paymentMethod": "STRIPE",
  "paymentIntentId": "pi_3U3KI6B2v6ObPUpc1FGkwnvT",
  "userId": "GZVysd1ylQRfKZTaXN3GcS1xxTL2"
}
```

Server verifies the PaymentIntent:

| Check | Rule |
|-------|------|
| Status | Must be `succeeded` |
| Amount | Must equal server `amount * 100` (THB satang) |
| Currency | Must be `thb` |
| Reuse | Same `paymentIntentId` cannot create two bookings |

Success response (typical):

```json
{
  "success": true,
  "paymentMethod": "STRIPE",
  "bookingId": "pkg_...",
  "bookingCollection": "travelBookingDetails",
  "amount": 49000,
  "currency": "thb",
  "status": "Confirmed",
  "bookingStatus": "CONFIRMED",
  "isPaymentDone": true,
  "isBookingConfirmed": true,
  "paymentIntentId": "pi_...",
  "duplicate": false,
  "message": "Payment verified and booking confirmed."
}
```

A create trigger then auto-accepts paid bookings (`status: "Accepted"`, `autoAccepted: true`, `acceptedAt`).

### THAI_QR / ONSITE

| Method | What happens |
|--------|----------------|
| **THAI_QR** | Booking created immediately, unpaid, `PENDING_VERIFICATION` until admin verifies |
| **ONSITE** | Booking created; pay later offline; often confirmed |

Optional for QR: `"customerQrPaymentConfirmed": true` when the user declares transfer done.

### Canonical paid Stripe document (target shape)

After a successful PaymentSheet booking (and after Checkout webhook/verify), readers should treat this as the standard `travelBookingDetails` paid shape:

```json
{
  "fullName": "abc",
  "guestEmail": "user@gmail.com",
  "guestPhone": "+66676646464",
  "email": "user@gmail.com",
  "phone": "+66676646464",
  "guestDetails": {
    "name": "abc",
    "email": "user@gmail.com",
    "phoneNumber": "+66676646464"
  },
  "title": "Grand Thailand Highlands Escape Trip",
  "packageName": "Grand Thailand Highlands Escape Trip",
  "packageId": "921f7fa3-5e80-4eaa-88dd-c84e0ff84ff3",
  "userId": "GZVysd1ylQRfKZTaXN3GcS1xxTL2",
  "authUid": "GZVysd1ylQRfKZTaXN3GcS1xxTL2",
  "uId": "GZVysd1ylQRfKZTaXN3GcS1xxTL2",
  "arrivalDate": "2026-08-11",
  "departureDate": "2026-08-12",
  "pickUpTime": "2026-08-11",
  "pickUpLocation": "",
  "specialRequests": "",
  "adults": 2,
  "children": 1,
  "totalAmount": 49000,
  "price": 49000,
  "amount": 49000,
  "currency": "THB",
  "paymentMethod": "STRIPE",
  "modeOfPayment": "ONLINE",
  "isPaymentDone": true,
  "isPaymentClear": true,
  "isBookingConfirmed": true,
  "paymentVerificationStatus": "VERIFIED",
  "paymentVerificationNote": "Stripe PaymentIntent verified successfully.",
  "paymentIntentId": "pi_3U3KI6B2v6ObPUpc1FGkwnvT",
  "stripePaymentIntentId": "pi_3U3KI6B2v6ObPUpc1FGkwnvT",
  "stripeSessionId": null,
  "paymentConfirmation": {
    "provider": "STRIPE",
    "status": "paid",
    "paymentIntentId": "pi_3U3KI6B2v6ObPUpc1FGkwnvT",
    "sessionId": null
  },
  "stripeAmountTotal": 4900000,
  "stripeAmountMajor": 49000,
  "stripeCurrency": "thb",
  "bookingStatus": "CONFIRMED",
  "status": "Accepted",
  "autoAccepted": true,
  "source": "APP"
}
```

**Reader fallbacks (admin + clients):**

| Display | Prefer | Fallback |
|---------|--------|----------|
| Guest name | `guestDetails.name` | `fullName` |
| Phone | `guestDetails.phoneNumber` | `phone` / `guestPhone` |
| Email | `guestDetails.email` | `email` / `guestEmail` |
| Amount | `totalAmount` | `price` / `amount` |
| Paid? | `isPaymentDone` | `paymentVerificationStatus === "VERIFIED"` or `paymentConfirmation.status === "paid"` |

`source`: PaymentSheet path uses `"APP"`; website Checkout/QR/Onsite typically `"WEB"`.

Full step-by-step for both clients: [SIGHTSEEING_CLIENT_INTEGRATION.md](./SIGHTSEEING_CLIENT_INTEGRATION.md).

---

## 9. Transport (car / van / self-drive)

**No Stripe.** Admin sets the price; the client only creates a request and later fetches the quote.

### Create

| Endpoint | Collection |
|----------|------------|
| `POST createCarBooking` | `car_bookings` |
| `POST createVanBooking` | `vanBookings` |
| `POST createSelfDriveBooking` | `self_driving_bookings` |

**Body (all three)**

| Field | Required |
|-------|----------|
| `customerName` | Yes |
| `customerPhone` | Yes |
| `pickup` | Yes |
| `destination` | Yes |
| `customerEmail` | Recommended |
| `travelAt` | Recommended (ISO date/time) |
| `notes` | No |
| `requestedAmount` | No — **hint only**, not the bill |

**Example**

```json
{
  "customerName": "John Doe",
  "customerPhone": "+66812345678",
  "customerEmail": "john@example.com",
  "pickup": "Suvarnabhumi Airport",
  "destination": "Pattaya",
  "travelAt": "2026-09-20T10:00:00+07:00",
  "notes": "Flight TG123"
}
```

**Create response**

```json
{
  "success": true,
  "bookingId": "...",
  "bookingCollection": "car_bookings",
  "status": "Pending",
  "amount": null,
  "amountStatus": "AWAITING_ADMIN_QUOTE",
  "stripeUrl": null,
  "payNow": false,
  "message": "Transport request saved. Admin will set the price..."
}
```

If client sends `paymentMethod: "STRIPE"` → **400** `TRANSPORT_NO_STRIPE`.

### Fetch after admin sets price

```http
POST /getTransportBooking
```

```json
{
  "bookingId": "BOOKING_ID",
  "bookingKind": "car"
}
```

`bookingKind`: `car` | `van` | `selfDrive` (optional if the id is unique).

**After admin quoted**

```json
{
  "success": true,
  "bookingId": "...",
  "amount": 1800,
  "AmountOffered": 1800,
  "amountStatus": "QUOTED",
  "status": "Accepted",
  "message": "Admin has set the amount for this booking."
}
```

### Transport timeline

```text
User → createCarBooking
     → amount null, Pending

Admin → sets AmountOffered / accepts in admin portal

Server → writes notification to notifications/users/{uid}

User → notification and/or getTransportBooking → show amount
```

---

## 10. Pay later (My Bookings)

Only **hotel** and **sightseeing**. Transport cannot use this.

```http
POST /createCheckoutSession
```

```json
{
  "bookingId": "...",
  "bookingCollection": "hotelBookingData",
  "successUrl": "https://thaiseva.com/booking/success?session_id={CHECKOUT_SESSION_ID}",
  "cancelUrl": "https://thaiseva.com/booking/cancel"
}
```

| `bookingCollection` / `bookingType` | Meaning |
|-------------------------------------|---------|
| `hotel` / `hotelBookingData` | Hotel |
| `sightseeing` / `package` / `travelBookingDetails` | Package |
| car / van / selfDrive | **Rejected** |

**Hotel pay rules**

- Pure **pending** (not accepted, no inventory reserved, no instant rooms) → **rejected** until accept.
- **Partial** (instant rooms accepted + pending remainder) → pay allowed for the accepted portion.
- Charge amount prefers **`amountDue`** when set (top-up after partial accept); otherwise full unpaid total.
- After successful pay: `amountDue` cleared, hotel stays **Accepted**.

Package amount is **recalculated from catalog** (cannot underpay with a fake stored amount). Stripe-paid packages become **Accepted** automatically.

---

## 11. Stripe return & webhook

### After redirect from Stripe

```http
POST /verifySession
Authorization: Bearer <idToken>
```

```json
{ "sessionId": "cs_..." }
```

Use the `session_id` query param from `successUrl`.

### Webhook (server only)

- URL: `.../stripeWebhook`
- Not called by website/app.
- Marks booking paid / creates package booking if the user never returns to the success page.

### Success / cancel URLs

Must be on an **allowed host** (e.g. `thaiseva.com`, project `*.web.app`, localhost).  
Use Stripe placeholder when needed:

```text
https://yoursite.com/booking/success?session_id={CHECKOUT_SESSION_ID}
```

---

## 12. Customer notifications (app + website)

When a booking is updated (status, payment, or transport price), the backend writes:

```text
notifications/users/{userId}/{notificationId}
```

### Fields

| Field | Description |
|-------|-------------|
| `title` | Short title |
| `message` / `desc` | Body (both set — use either) |
| `type` | `hotel-booking` \| `sightseeing-booking` \| `transport-booking` |
| `bookingId` | Related booking |
| `bookingCollection` | e.g. `car_bookings` |
| `read` / `isRead` | Unread flags |
| `timestamp` | Sort order |
| `finalAmount` / `AmountOffered` | Often set when transport price is ready |

### When they fire

| Service | Events |
|---------|--------|
| Transport | Created, status change, **admin sets price**, payment recorded |
| Hotel | Accepted / confirmed / canceled, payment verified |
| Sightseeing | Accepted / confirmed / canceled, payment verified |

### Listen in app/website

```js
import { collection, onSnapshot, orderBy, query, limit } from "firebase/firestore";

function watchNotifications(db, uid, onItems) {
  const q = query(
    collection(db, "notifications", "users", uid),
    orderBy("timestamp", "desc"),
    limit(50),
  );
  return onSnapshot(q, (snap) => {
    onItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}
```

On transport “price ready”, call `getTransportBooking` or refresh My Bookings.

---

## 13. Error codes

| reasonCode | Meaning |
|------------|---------|
| `UNAUTHENTICATED` | Missing or invalid token |
| `USER_MISMATCH` | Body `userId` ≠ token uid |
| `INVALID_ARGUMENT` | Missing/invalid fields |
| `NOT_FOUND` | Hotel / package / booking missing |
| `PACKAGE_NOT_FOUND` | Invalid packageId |
| `ONSITE_NOT_SUPPORTED_FOR_HOTEL` | Hotel cannot use onsite |
| `TRANSPORT_NO_STRIPE` | Transport cannot use Stripe |
| `NOT_ACCEPTED` | Hotel not ready for payment |
| `ALREADY_PAID` | Already paid |
| `CANCELED` | Booking canceled |
| `INVALID_AMOUNT` / `INVALID_PRICE` | Amount/price problem (e.g. card &lt; 20 THB) |
| `PAYMENT_NOT_COMPLETED` | PaymentIntent status is not `succeeded` |
| `PAYMENT_AMOUNT_MISMATCH` | PaymentIntent amount ≠ server price × 100 |
| `PAYMENT_CURRENCY_MISMATCH` | PaymentIntent currency is not `thb` |
| `STRIPE_VERIFICATION_ERROR` | Could not retrieve/verify PaymentIntent |
| `STRIPE_ERROR` | Could not create Checkout |
| `RATE_LIMITED` | Too many requests |
| `FORBIDDEN` | Not owner of booking/session |

---

## 14. Client code examples

### Generic POST helper

```js
async function bookingApi(functionName, body, idToken) {
  const base = "https://asia-east2-gothai-ffea1.cloudfunctions.net";
  const res = await fetch(`${base}/${functionName}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok || data.success === false) {
    const err = new Error(data.error || res.statusText);
    err.reasonCode = data.reasonCode;
    throw err;
  }
  return data;
}
```

### Hotel + Stripe

```js
const data = await bookingApi(
  "createHotelBooking",
  {
    hotelId,
    packageId,
    checkIn,
    checkOut,
    rooms: 1,
    fullName,
    guestEmail,
    guestPhone,
    paymentMethod: "STRIPE",
    holdId, // optional
    successUrl: "https://thaiseva.com/booking/success?session_id={CHECKOUT_SESSION_ID}",
    cancelUrl: "https://thaiseva.com/booking/cancel",
  },
  idToken,
);

if (data.stripeUrl) {
  window.location.href = data.stripeUrl;
} else {
  // pending / QR / no charge yet
  showMessage(data.message);
}
```

### Package + Stripe (website Checkout)

```js
const data = await bookingApi(
  "createSightseeingBooking",
  {
    packageId,
    adults: 2,
    children: 0,
    arrivalDate: "2026-09-15",
    fullName,
    guestEmail,
    guestPhone,
    paymentMethod: "STRIPE",
    successUrl: "https://thaiseva.com/booking/success?session_id={CHECKOUT_SESSION_ID}",
    cancelUrl: "https://thaiseva.com/booking/cancel",
  },
  idToken,
);
if (data.stripeUrl) window.location.href = data.stripeUrl;
```

### Package + Stripe (app PaymentSheet)

```js
// 1) Create PaymentIntent for amountTHB * 100, currency "thb" (your Stripe backend)
// 2) presentPaymentSheet() until succeeded
// 3) Confirm booking with the PI id:

const data = await bookingApi(
  "createSightseeingBooking",
  {
    packageId,
    adults: 2,
    children: 1,
    arrivalDate: "2026-08-11",
    departureDate: "2026-08-12",
    fullName,
    guestEmail,
    guestPhone,
    paymentMethod: "STRIPE",
    paymentIntentId: "pi_...", // from PaymentSheet
    userId: currentUser.uid,
  },
  idToken,
);

if (data.success && data.isPaymentDone) {
  // data.bookingId — already paid & written to travelBookingDetails
  showPaidConfirmed(data.bookingId);
}
```

### Success page (website Checkout only)

```js
const params = new URLSearchParams(window.location.search);
const sessionId = params.get("session_id");
if (sessionId) {
  const result = await bookingApi("verifySession", { sessionId }, idToken);
  // result.paid, result.bookingId
}
```

### Transport

```js
const created = await bookingApi(
  "createCarBooking",
  {
    customerName: "John",
    customerPhone: "+66...",
    pickup: "Airport",
    destination: "City",
    travelAt: "2026-09-20T10:00:00+07:00",
  },
  idToken,
);
// created.bookingId, amount is null

// Later (or after notification):
const quote = await bookingApi(
  "getTransportBooking",
  { bookingId: created.bookingId, bookingKind: "car" },
  idToken,
);
// quote.amount, quote.amountStatus
```

---

## 15. Testing checklist

- [ ] Hotel STRIPE: create → redirect → test card `4242 4242 4242 4242` → `verifySession` → paid  
- [ ] Hotel THAI_QR: create → no `stripeUrl` → pending verification  
- [ ] Package STRIPE **website**: Checkout → booking after pay (`verifySession` / webhook)  
- [ ] Package STRIPE **app**: PaymentSheet → `paymentIntentId` → booking paid immediately  
- [ ] Package PaymentIntent wrong amount → `PAYMENT_AMOUNT_MISMATCH`  
- [ ] Package PaymentIntent not succeeded → `PAYMENT_NOT_COMPLETED`  
- [ ] Package ONSITE: booking created, unpaid/confirmed  
- [ ] Package THAI_QR: pending verification  
- [ ] Transport: create → `amount: null` → admin quotes → `getTransportBooking` shows amount  
- [ ] Transport + STRIPE body → `TRANSPORT_NO_STRIPE`  
- [ ] My Bookings: `createCheckoutSession` for unpaid hotel/package only  
- [ ] Notification appears under `notifications/users/{uid}` after admin update  
- [ ] Missing token → 401  

---

## 16. Quick rules for developers

1. **Always** send Firebase Bearer token (except public availability check).  
2. **Never** set `isPaymentDone` / write `travelBookingDetails` from the client.  
3. **Never** trust client-calculated totals for hotel/package charges.  
4. **Website package card** → follow `stripeUrl`, then `verifySession`.  
5. **App package card** → PaymentSheet first, then `createSightseeingBooking` + `paymentIntentId`.  
6. **Transport** → no Stripe; wait for admin amount + notifications / `getTransportBooking`.  
7. **Listen** to `notifications/users/{uid}` for live updates.  
8. Success/cancel URLs must use **allowed** production or localhost hosts.  
9. Paid package docs: prefer the [canonical shape](#canonical-paid-stripe-document-target-shape); read with guest/amount fallbacks.

---

## End-to-end diagrams

### Hotel + Stripe

```text
App → createHotelBooking(STRIPE)
API → booking + stripeUrl
App → Stripe Checkout
User pays
Stripe webhook / verifySession → paid
API → notification to user
```

### Package + Stripe

```text
App → createSightseeingBooking(STRIPE)
API → stripeUrl only (no booking yet)
App → Stripe
Pay → webhook or verifySession creates travelBookingDetails
API → notification
```

### Transport

```text
App → createCarBooking
API → Pending, amount null
Admin → sets price
API → notification "Price ready"
App → getTransportBooking → show amount
```

---

## Who does what

| Layer | Responsibility |
|-------|----------------|
| **Website / app** | UI, Firebase login, call APIs, Stripe redirect, listen notifications |
| **These Cloud Functions** | Validate, price, save booking, Stripe session, webhook, user inbox |
| **Admin portal** | Accept bookings, set transport price, verify Thai QR |
| **Stripe** | Card payment page |

---

*This is the single integration document for Thaiseva booking APIs. No other file is required for day-to-day website/app integration.*
