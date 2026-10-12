# Thaiseva Cloud Functions API Specification

> Updated 11 October 2026: [Package booking flows and API contract](../../documentation/PACKAGE_BOOKING_FLOWS.md) supersedes earlier package payment-first behavior. Tomorrow/day 2 require confirmation; instant booking starts day 3 within the daily limit. Request payment opens only after admin confirmation.

**Service Region:** `asia-east2` (Hong Kong)  
**Base URL:** `https://asia-east2-<PROJECT_ID>.cloudfunctions.net/<FunctionName>`  
**Production Host:** `https://asia-east2-gothai-admin.cloudfunctions.net`  
**Authentication Header:** `Authorization: Bearer <Firebase_ID_Token>`  
**Single Integration Reference:** Definitive contract for website, mobile applications, and partner integrations.

---

## 1. Global Integration Standards & Conventions

### 1.1 Transport Protocol & Headers
- All HTTP endpoints use **HTTPS `POST`** with JSON payloads unless specifically marked as `GET`.
- Required headers:
  ```http
  Content-Type: application/json
  Authorization: Bearer <FIREBASE_ID_TOKEN>
  ```
- **Authentication Rule:** Endpoints verify the incoming Firebase ID token via `admin.auth().verifyIdToken()`. The `userId` in the request body must match the token's `auth.uid`. If omitted from the body, the server automatically infers `auth.uid`.

### 1.2 CORS Allowed Origins Whitelist
The Cloud Functions backend enforces CORS with pre-flight `OPTIONS` caching (`max-age: 3600`):
- `https://thaiseva.com`, `https://www.thaiseva.com`, `https://admin.thaiseva.com`
- `https://*.web.app`, `https://*.firebaseapp.com`, `https://*.vercel.app`
- Local development: `http://localhost:3000`, `http://localhost:5173`, `http://127.0.0.1:3000`, `http://127.0.0.1:5173`

### 1.3 Payment Method Matrix
Clients send `paymentMethod` (or `paymentMethodIntent`). Accepted values and business behavior:

| Method Code | Hotel Booking | Sightseeing Tour Package | Transport (Car, Van, Self-Drive) |
|---|---|---|---|
| **`STRIPE`** | Supported (Instant card / PromptPay checkout) | Supported (Instant card checkout) | ðŸš« **Rejected** (`TRANSPORT_NO_STRIPE`) |
| **`THAI_QR`** | Supported (Manual bank transfer slip upload) | Supported (Pending admin bank check) | Preference only (Admin quotes amount first) |
| **`ONSITE`** | ðŸš« **Rejected** (`ONSITE_NOT_SUPPORTED_FOR_HOTEL`) | Supported (Pay cash to tour operator) | Preference only (Pay driver upon arrival) |

> [!IMPORTANT]
> **Transport Payment Model:** Transport rides do **not** support direct online Stripe card charges. Passengers submit travel logistics $\rightarrow$ Platform Admin reviews route and quotes the final price $\rightarrow$ Passenger checks status via `getTransportBooking` $\rightarrow$ Payment is collected offline or settled via custom link.

### 1.4 Standard Error Response Schema
```json
{
  "status": "error",
  "message": "Human-readable explanation of error.",
  "code": "ERROR_CODE_STRING",
  "details": {}
}
```

| Error Code | HTTP Status | Trigger Condition |
|---|:---:|---|
| `UNAUTHENTICATED` | 401 | Missing, malformed, or expired `Authorization: Bearer <token>`. |
| `USER_MISMATCH` | 403 | Payload `userId` does not match the authenticated caller's UID. |
| `FORBIDDEN` | 403 | Caller lacks required role or permission (e.g. non-admin invoking admin callables). |
| `INVALID_ARGUMENT` | 400 | Required fields missing or validation failed (e.g. checkOut $\le$ checkIn). |
| `ROOM_UNAVAILABLE` | 409 | Desired room inventory is fully booked or locked for the requested dates. |
| `LISTING_INACTIVE` | 409 / failed-precondition | Attempted to check stock, lock inventory, or book an inactive hotel, room, or tour package (`isActive: false` or `status: 'Inactive'`). |
| `HOLD_EXPIRED` | 410 | The 15-minute reservation hold token has expired. |
| `TRANSPORT_NO_STRIPE` | 400 | Attempted to submit a car or self-drive booking with `paymentMethod: 'STRIPE'`. |
| `ONSITE_NOT_SUPPORTED_FOR_HOTEL` | 400 | Attempted to book hotel rooms with `paymentMethod: 'ONSITE'`. |
| `NOT_FOUND` | 404 | Target hotel, package, or booking record does not exist. |
| `ALREADY_PAID` | 400 | Payment session requested for an order that is already marked paid. |

---

## 2. Hotel Stock & Hold Concurrency Engine

The inventory model guarantees that:
$$\text{Free Rooms} = \text{Total Inventory} - (\text{Locked Rooms} + \text{Booked Rooms})$$

### Catalog Status Gating (12 October 2026)
All hotel stock and booking endpoints strictly validate catalog visibility (`isListingActive` helper):
- Checks root `isActive` boolean, nested `hotel.isActive` boolean, and status string (`!== 'Inactive'`).
- Missing visibility fields and legacy `Verified` / `Pending` / `Approved` records remain active by default.
- If either the hotel or room package is inactive, stock checks throw `failed-precondition` / `LISTING_INACTIVE` ("This hotel or room package is currently unavailable.").

### 2.1 Check Room Stock
**Endpoint:** `POST /checkHotelStock`  
**Compatibility Alias:** `POST /checkHotelAvailability`  
**Auth:** Optional / Public  
**Description:** Checks unreserved room stock across a date range. Rejects inactive hotels or room packages with `failed-precondition`.

**Request Body:**
```json
{
  "hotelId": "htl_phuket_01",
  "roomId": "room_deluxe_ocean",
  "checkInDate": "2026-11-01",
  "checkOutDate": "2026-11-05",
  "requestedRooms": 1
}
```
*Note: Also accepts aliases `packageId` (for package room resolution), `checkIn`, `checkOut`, and `rooms`.*

**Success Response (200 OK):**
```json
{
  "status": "success",
  "available": true,
  "hotelId": "htl_phuket_01",
  "roomId": "room_deluxe_ocean",
  "totalRooms": 5,
  "freeRooms": 4,
  "lockedRooms": 0,
  "bookedRooms": 1,
  "currency": "THB",
  "pricePerNight": 2400,
  "totalNights": 4,
  "totalAmount": 9600
}
```

---

### 2.2 Lock Hotel Stock (Create 15-Minute Hold)
**Endpoint:** `POST /lockHotelStock`  
**Compatibility Alias:** Callable `startHotelBookingHold`  
**Auth:** Optional / Firebase Auth  
**Description:** Creates a temporary 15-minute reservation hold so inventory is protected while the customer enters payment details. Rejects inactive hotel properties or room packages, returning `{ ok: false, error: "This hotel or room package is currently unavailable.", code: "LISTING_INACTIVE" }`.

**Request Body:**
```json
{
  "hotelId": "htl_phuket_01",
  "roomId": "room_deluxe_ocean",
  "checkInDate": "2026-11-01",
  "checkOutDate": "2026-11-05",
  "quantity": 1
}
```

**Success Response (200 OK):**
```json
{
  "status": "success",
  "holdToken": "hold_67890abcdef_123",
  "holdId": "hold_67890abcdef_123",
  "hotelId": "htl_phuket_01",
  "roomId": "room_deluxe_ocean",
  "expiresAt": "2026-11-01T10:15:00.000Z",
  "ttlSeconds": 900
}
```

---

### 2.3 Unlock Hotel Stock (Release Hold)
**Endpoint:** `POST /unlockHotelStock`  
**Compatibility Alias:** Callable `releaseHotelBookingHold`  
**Auth:** Optional / Firebase Auth  
**Description:** Immediately releases a hold if the customer cancels checkout or navigates away.

**Request Body:**
```json
{
  "hotelId": "htl_phuket_01",
  "holdToken": "hold_67890abcdef_123"
}
```

**Success Response (200 OK):**
```json
{
  "status": "success",
  "released": true,
  "message": "Hold successfully released."
}
```

---

### 2.4 Expire Stale Stock Holds
**Endpoint:** `POST /expireHotelStockHolds`  
**Auth:** Internal / Admin  
**Description:** Sweeps the inventory collection and releases all holds where `expiresAt < now()`. Can be triggered on a scheduled cron or on-demand.

---

## 3. Multi-Product Booking Gateways

### 3.1 Create Hotel Booking
**Endpoint:** `POST /createHotelBooking`  
**Auth:** Required (`Bearer <token>`)  
**Description:** Validates customer details, verifies the active hold token, writes to `hotelBookingData`, and returns a Stripe checkout session if `paymentMethod === 'STRIPE'`. Both `runCreateHotelBookingWithAvailability` and `runCompleteHotelBookingHold` strictly verify `isListingActive` on both hotel and room; if either is inactive, the checkout is rejected with `HttpsError("failed-precondition", "This hotel or room package is currently unavailable.")`.

**Request Body:**
```json
{
  "hotelId": "htl_phuket_01",
  "roomId": "room_deluxe_ocean",
  "holdId": "hold_67890abcdef_123",
  "fullName": "Somchai Jaidee",
  "guestEmail": "somchai@example.com",
  "phoneNumber": "+66812345678",
  "checkInDate": "2026-11-01",
  "checkOutDate": "2026-11-05",
  "numberOfGuests": 2,
  "paymentMethod": "STRIPE",
  "specialRequests": "Non-smoking room, high floor"
}
```

**Success Response (200 OK) — Stripe:**
```json
{
  "status": "success",
  "bookingId": "bk_hotel_20261101_889",
  "stripeUrl": "https://checkout.stripe.com/c/pay/cs_live_sampleStripeSession123",
  "amount": 9600,
  "currency": "THB",
  "isPaymentDone": false,
  "status": "Pending"
}
```

**Success Response (200 OK) — Thai QR:**
```json
{
  "status": "success",
  "bookingId": "bk_hotel_20261101_889",
  "paymentMethod": "THAI_QR",
  "promptPayNumber": "0812345678",
  "amount": 9600,
  "currency": "THB",
  "isPaymentDone": false,
  "status": "Pending",
  "note": "Please upload bank transfer slip in My Bookings."
}
```

---

### 3.2 Create Sightseeing Tour Package Booking
**Endpoint:** `POST /createSightseeingBooking`  
**Auth:** Required (`Bearer <token>`)  
**Implementation Files:**
- Endpoint Handler: [`functions/src/bookingCheckout/sightseeingBooking.ts`](file:///d:/projects/Thaiseva-Admin-Portal-Web-App/functions/src/bookingCheckout/sightseeingBooking.ts)
- Flow & Capacity Engine: [`functions/sightseeingFlow.js`](file:///d:/projects/Thaiseva-Admin-Portal-Web-App/functions/sightseeingFlow.js)
- Server-Side Pricing: [`functions/src/payments/packagePricing.ts`](file:///d:/projects/Thaiseva-Admin-Portal-Web-App/functions/src/payments/packagePricing.ts)
**Integration Guide:** See the comprehensive [Sightseeing Package Booking API & Integration Guide](PACKAGE_BOOKING_INTEGRATION_GUIDE.md).

**Description:** Creates an atomic tour package reservation in `travelBookingDetails`. Validates catalog status (`isListingActive`); inactive packages throw HTTP 409 `LISTING_INACTIVE` ("This package is currently unavailable."). Evaluates Thailand calendar dates and daily capacity (`settings/sightseeingConfig.globalDailyLimit`). Tours starting tomorrow/day 2 or during full capacity enter the `REQUEST` flow (`PENDING_REVIEW`) with payment opening after admin confirmation. Tours starting on Day 3+ within capacity enter the `INSTANT` flow, reserving inventory and issuing a Stripe Checkout session (`payNow: true`).

**Request Body:**
```json
{
  "packageId": "pkg_phi_phi_islands",
  "arrivalDate": "2026-11-05",
  "departureDate": "2026-11-05",
  "adults": 2,
  "children": 1,
  "fullName": "Somchai Jaidee",
  "guestEmail": "somchai@example.com",
  "guestPhone": "+66812345678",
  "pickUpLocation": "Marriott Resort Phuket, Patong",
  "pickUpTime": "08:30",
  "specialRequests": "Vegetarian lunch option",
  "paymentMethod": "STRIPE",
  "successUrl": "https://thaiseva.com/booking/success?session_id={CHECKOUT_SESSION_ID}",
  "cancelUrl": "https://thaiseva.com/booking/cancel",
  "source": "WEB"
}
```
*Note: Also accepts aliases `travelDate`, `date` for arrivalDate, and `paymentIntentId` for mobile PaymentSheet.*

**Success Response (200 OK) — Instant Booking (Day 3+ Within Capacity):**
```json
{
  "success": true,
  "bookingId": "pkg_usr123_pkg_phi_phi_islands_2026-11-05_2026-11-05",
  "bookingCollection": "travelBookingDetails",
  "amount": 4800,
  "currency": "thb",
  "paymentMethod": "STRIPE",
  "bookingFlow": "INSTANT",
  "status": "Accepted",
  "bookingStatus": "AWAITING_PAYMENT",
  "isPaymentDone": false,
  "isBookingConfirmed": true,
  "payNow": true,
  "stripeUrl": "https://checkout.stripe.com/c/pay/cs_live_sampleTourSession456",
  "stripeSessionId": "cs_live_sampleTourSession456",
  "message": "Instant booking is available for this date within the daily limit."
}
```

**Success Response (200 OK) — Request Booking (Tomorrow, Day 2, or Capacity Reached):**
```json
{
  "success": true,
  "bookingId": "pkg_usr123_pkg_phi_phi_islands_2026-10-13_2026-10-13",
  "bookingCollection": "travelBookingDetails",
  "amount": 4800,
  "currency": "thb",
  "paymentMethod": "STRIPE",
  "bookingFlow": "REQUEST",
  "status": "Pending",
  "bookingStatus": "PENDING_REVIEW",
  "isPaymentDone": false,
  "isBookingConfirmed": false,
  "payNow": false,
  "message": "We need at least 2 full days to prepare your package. For tomorrow or the day after tomorrow, our team will check availability and confirm your request first. Payment is collected only after confirmation."
}
```
*Note: For `REQUEST` bookings, once approved in the Admin Portal, clients initiate Stripe Checkout via `POST /createCheckoutSession`.*

---

### 3.3 Create Car Booking (All Chauffeur-Driven Rides)
**Endpoint:** `POST /createCarBooking`  
**Compatibility Alias:** `POST /createTaxiBooking`  
**Auth:** Required (`Bearer <token>`)  
**Target Collection:** `car_bookings`  
**Description:** Unifies all car, van, airport taxi, and bike rides into a single API.

**Request Body:**
```json
{
  "transportType": "van",
  "name": "Somchai Jaidee",
  "contact": "+66812345678",
  "email": "somchai@example.com",
  "pickup": "Phuket International Airport (HKT)",
  "drop": "Kata Beach Resort",
  "date": "2026-11-01",
  "time": "14:30",
  "seats": 6,
  "flightNumber": "TG204",
  "bookingType": "scheduled",
  "isImmediateRequest": false,
  "paymentMethod": "ONSITE"
}
```
*Note: `transportType` accepts: `car`, `van`, `taxi`, `bike` (aliases `sedan`, `cab`, `minivan`, `scooter` are automatically normalized).*

**Success Response (200 OK):**
```json
{
  "status": "success",
  "bookingId": "bk_car_20261101_772",
  "product": "carBooking",
  "transportType": "van",
  "status": "Pending",
  "message": "Trip request received. Admin will review and quote price."
}
```

---

### 3.4 Create Self-Drive Rental Booking
**Endpoint:** `POST /createSelfDriveBooking`  
**Auth:** Required (`Bearer <token>`)  
**Target Collection:** `self_driving_bookings`  
**Description:** Submits a rental fleet reservation request.

**Request Body:**
```json
{
  "name": "Somchai Jaidee",
  "contact": "+66812345678",
  "email": "somchai@example.com",
  "vehicleCategory": "SUV",
  "pickupLocation": "Phuket Airport Desk",
  "pickupDate": "2026-11-01",
  "pickupTime": "10:00",
  "dropoffLocation": "Phuket Airport Desk",
  "dropoffDate": "2026-11-05",
  "dropoffTime": "10:00",
  "driverLicenseNumber": "TH-98765432"
}
```

---

### 3.5 Query Transport Booking Status & Price Quote
**Endpoint:** `POST /getTransportBooking` (or `GET`)  
**Auth:** Required (`Bearer <token>`)  
**Description:** Allows mobile and web clients to poll the status of car and self-drive bookings to inspect the admin's quoted price.

**Request Body:**
```json
{
  "bookingId": "bk_car_20261101_772",
  "product": "carBooking"
}
```

**Success Response (200 OK):**
```json
{
  "status": "success",
  "bookingId": "bk_car_20261101_772",
  "bookingStatus": "Accepted",
  "quotedAmount": 1800,
  "currency": "THB",
  "driverAssigned": {
    "name": "Kittisak",
    "phone": "+66891112233",
    "vehiclePlate": "1Kor-4567"
  }
}
```

---

## 4. Payment Sessions & Webhook Infrastructure

### 4.1 Create Checkout Session (Pay Later / Retry)
**Endpoint:** `POST /createCheckoutSession`  
**Auth:** Required (`Bearer <token>`)  
**Description:** Generates a new Stripe Checkout Session for an existing pending hotel or tour reservation.

**Request Body:**
```json
{
  "bookingId": "bk_hotel_20261101_889",
  "bookingType": "hotel",
  "successUrl": "https://thaiseva.com/booking-success?session_id={CHECKOUT_SESSION_ID}",
  "cancelUrl": "https://thaiseva.com/my-bookings"
}
```

**Success Response (200 OK):**
```json
{
  "status": "success",
  "sessionId": "cs_live_sampleSession123",
  "url": "https://checkout.stripe.com/c/pay/cs_live_sampleSession123"
}
```

---

### 4.2 Verify Session (Post-Stripe Redirect)
**Endpoint:** `POST /verifySession` (or `GET /verifySession?sessionId=cs_...`)  
**Auth:** Required (`Bearer <token>`)  
**Description:** Validates that the payment session belongs to the signed-in user, checks payment settlement, and ensures paid state is recorded in Firestore.

**Request Body:**
```json
{
  "sessionId": "cs_live_sampleSession123"
}
```

**Success Response (200 OK):**
```json
{
  "status": "success",
  "paymentStatus": "paid",
  "bookingId": "bk_hotel_20261101_889",
  "amountPaid": 9600,
  "currency": "THB"
}
```

---

### 4.3 Stripe Webhook Receiver
**Endpoint:** `POST /stripeWebhook`  
**Auth:** Cryptographic Stripe Signature (`Stripe-Signature` Header)  
**Description:** Handles asynchronous Stripe events (`checkout.session.completed`). Validates signature against `STRIPE_WEBHOOK_SECRET`, executes idempotency check, updates booking to `isPaymentDone: true`, and converts temporary room holds into confirmed deductions.

---

## 5. Email OTP Verification Service

### 5.1 Send / Resend Email OTP
**Endpoints:** `POST /sendEmailOtp` and `POST /resendEmailOtp`
**Auth:** Firebase App Check; no login session required.
Payload examples in this section are Firebase SDK data objects; raw HTTP requests wrap them in `{ "data": ... }` and successful responses in `{ "result": ... }`.
**Request Body:**
```json
{
  "email": "partner@hotelphuket.com"
}
```
**Success Response:** `{ "challengeId": "<challenge-id>", "expiresAt": 1791194700000, "resendAt": 1791194460000, "message": "An email verification code has been sent." }`

Resend also requires the previous `challengeId` and returns a replacement challenge. Codes expire in five minutes; resend cooldown is 60 seconds. Times are Unix milliseconds.

### 5.2 Verify Email OTP
**Endpoint:** `POST /verifyEmailOtp`  
**Auth:** Firebase App Check; no login session required.
**Request Body:**
```json
{
  "email": "partner@hotelphuket.com",
  "challengeId": "<latest-challenge-id>",
  "code": "654321"
}
```
**Success Response:** `{ "verified": true, "email": "partner@hotelphuket.com", "verificationToken": "<opaque-43-character-token>", "expiresAt": 1791195000000 }`

Verification consumes the code and creates a ten-minute proof; it does not create an account or issue a login token.

### 5.3 Create Verified Firebase Account
**Endpoint:** `POST /createVerifiedAccount`
**Auth:** Firebase App Check and an unexpired email-bound verification proof.
**Request Body:**
```json
{
  "email": "partner@hotelphuket.com",
  "password": "<user-selected-password>",
  "verificationToken": "<token-from-verifyEmailOtp>"
}
```
**Success Response:** `{ "created": true }`

Creates a Firebase Auth user with `emailVerified: true`. Transactional proof claims bind retries to the same UID until proof expiry. Existing accounts from another signup return `already-exists`; expired or mismatched proofs return `unauthenticated`. The client signs in with its password after creation. The callable allows browser CORS preflight and runs in `asia-east2` in project `gothai-ffea1`. See [the OTP API guide](../../documentation/EMAIL_OTP_API.md) for SDK examples.

---

## 6. Administrative & Compliance Callables (`onCall`)

Invoked via the Firebase Client SDK: `httpsCallable(functions, "functionName")`.

### 6.1 Delete User Identity (PDPA Right to Erasure)
**Callable Name:** `deleteUserFunction`  
**Auth:** Active Admin (claim or approved role), recent authentication, matching pending customer request; self-deletion and staff/partner targets are rejected.
**Payload:**
```json
{
  "uid": "usr_delete_target_789",
  "requestId": "del_req_00123"
}
```
**Outcome:** Login/scoped records removed; request remains `Erasure Pending` while retained business/external copies await review. See `functions/src/accountDeletion.ts` for response fields and errors.

### 6.2 Manage Transport Booking & Resource Allocation
**Callable Names:** `manageTransportBooking`, `manageTransportResource`  
**Auth:** Admin / Operational Staff  
**Capabilities:** Sets quoted ride prices, updates statuses to `Accepted` or `Completed`, assigns drivers, and manages vehicle fleet capacity.

---

## 7. Event-Driven Background Database Triggers

These functions execute automatically upon Firestore database mutations:

| Trigger Name | Source Collection | Trigger Event | Architectural Effect |
|---|---|:---:|---|
| `onHotelBookingStatusChangeV3` | `hotelBookingData/{id}` | `onUpdate` | When status changes to `Accepted`, decrements date availability; when `Canceled`, restores capacity. |
| `autoAcceptSightseeingBookingsV2` | `travelBookingDetails/{id}` | `onCreate` | Automatically marks prepaid tour bookings as `Accepted` and dispatches partner notification. |
| `onSightseeingBookingStatusChange` | `travelBookingDetails/{id}` | `onUpdate` | Synchronizes tour operator manifest and dispatches customer notification. |
| `onCarBookingCreated` | `car_bookings/{id}` | `onCreate` | Alerts transport fleet managers of incoming ride requests. |
| `onCarBookingStatusChange` | `car_bookings/{id}` | `onUpdate` | Notifies assigned driver upon dispatch; updates driver status. |
| `onSelfDriveBookingCreated` | `self_driving_bookings/{id}` | `onCreate` | Notifies rental desk operators to inspect fleet vehicle allocation. |

---

## 8. Client Code Example (Frontend / Mobile Fetch)

```typescript
import { getAuth } from "firebase/auth";

async function bookHotelRoom(payload: HotelBookingPayload) {
  const auth = getAuth();
  const token = await auth.currentUser?.getIdToken();

  const response = await fetch("https://asia-east2-gothai-admin.cloudfunctions.net/createHotelBooking", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { "Authorization": `Bearer ${token}` } : {})
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`[${data.code || "ERROR"}] ${data.message}`);
  }

  if (data.stripeUrl) {
    // Redirect customer to Stripe Checkout
    window.location.href = data.stripeUrl;
  }
  return data;
}
```
