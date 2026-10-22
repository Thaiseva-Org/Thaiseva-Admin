# Sightseeing Tour Package Booking API & Integration Guide

> **Production Endpoint:** `https://asia-east2-gothai-admin.cloudfunctions.net` (also deployed to `https://asia-east2-gothai-ffea1.cloudfunctions.net`)  
> **Region:** `asia-east2` (Hong Kong)  
> **Target Collection:** `travelBookingDetails`  
> **Catalog Collection:** `sightseeingPackagesDetails`  
> **Protocol:** HTTPS POST + JSON  
> **Authentication:** `Authorization: Bearer <Firebase_ID_Token>`  
> **Last Verified & Synchronized:** 12 October 2026  

---

## 1. Architecture Overview & Dual-Flow Model

The Package Booking API handles end-to-end booking, server-side dynamic pricing, inventory/capacity controls, and payment routing for tour and sightseeing packages.

Unlike static booking systems, Thaiseva enforces a **dual-flow lifecycle** governed by tour dates and daily capacity:

```
                                  [ Tour Date Selection ]
                                             │
                   ┌─────────────────────────┴─────────────────────────┐
                   ▼                                                   ▼
         Tomorrow or Day 2 (+1 to +2 days)                   Day 3 Onward (≥ +3 days)
                   │                                                   │
                   ▼                                                   ▼
           [ REQUEST FLOW ]                                   [ Capacity Check ]
                   │                                          (Daily limit in settings)
                   │                                                   │
                   │                             ┌─────────────────────┴─────────────────────┐
                   │                             ▼                                           ▼
                   │                  Under Daily Capacity                       Daily Capacity Reached
                   │                             │                                           │
                   ▼                             ▼                                           ▼
        [ PENDING_REVIEW ]               [ INSTANT FLOW ]                            [ REQUEST FLOW ]
     Admin must review & confirm                 │                                  Admin must review & confirm
                   │                    Awaiting Payment                                     │
                   │                             │                                           │
                   ▼                             ▼                                           ▼
          Admin Confirms                Choose Payment Method                       Admin Confirms
      (Status: AWAITING_PAYMENT)                 │                              (Status: AWAITING_PAYMENT)
                   │              ┌──────────────┼──────────────┐                            │
                   └─────────────►│    STRIPE    │   THAI_QR    │   ONSITE                   │
                                  │ (Card/Apple) │ (PromptPay)  │  (Cash)                    │
                                  └──────┬───────┴──────┬───────┴─────┬──────────────────────┘
                                         ▼              ▼             ▼
                                     Stripe Pay     Admin Verifies  Confirmed
                                     Confirmed       Bank Slip     Offline Pay
```

### Key Business & Security Rules
1. **Thailand Calendar (`Asia/Bangkok` / UTC+7):** Date boundaries evaluate against Thai midnight. Same-day or past dates are rejected immediately with `400 INVALID_DATE`.
2. **Two Full Preparation Days Required:** Tours starting tomorrow or the day after tomorrow require manual operator coordination (`REQUEST` flow). Online payment is locked until an administrator reviews and confirms the slot.
3. **Daily Booking Capacity Limit:** Controlled by `settings/sightseeingConfig.globalDailyLimit` (default `20`). If full on day 3+, booking degrades smoothly to `REQUEST` flow instead of failing.
4. **Server-Side Pricing Authority:** Clients **never** dictate price. Prices are calculated server-side from `sightseeingPackagesDetails` using adult, child, and extra-passenger formulas with early-bird discounts.
5. **Atomic Firestore Serialized Locks:** Concurrent instant reservations for the same tour date are serialized via `_sightseeingBookingDays/{YYYY-MM-DD}` transaction locks.
6. **Stripe 35-Minute Reservation Expiry:** Instant Stripe reservations are checkout holds (`sightseeingCheckoutHolds`), not bookings: `travelBookingDetails` gets the booking only once Stripe reports the payment. Unpaid holds expire after 35 minutes, or at once through `releaseSightseeingCheckoutHold` when the guest leaves Stripe, releasing daily capacity for other travelers.

---

## 2. Source Code & Function File Registry (From Project Root)

Every stage of the sightseeing package flow is implemented in clean, modular TypeScript and JavaScript files. The following table provides direct file locations relative to the workspace root:

| Function / Component | Root File Location | Description & Responsibility |
|---|---|---|
| **API Entry Point** | [`functions/src/index.ts`](file:///d:/projects/Thaiseva-Admin-Portal-Web-App/functions/src/index.ts) | Cloud Functions index exporting `createSightseeingBooking`, `createCheckoutSession`, `verifySession`, `stripeWebhook`, and background triggers. |
| **Booking Creation Endpoint** | [`functions/src/bookingCheckout/sightseeingBooking.ts`](file:///d:/projects/Thaiseva-Admin-Portal-Web-App/functions/src/bookingCheckout/sightseeingBooking.ts) | Public HTTPS POST endpoint handling request validation, identity assertion, atomic capacity reservation, Stripe Checkout creation, and PaymentSheet completion. |
| **Availability & Flow Engine** | [`functions/sightseeingFlow.js`](file:///d:/projects/Thaiseva-Admin-Portal-Web-App/functions/sightseeingFlow.js) | Date decision logic (`dateDecision`), capacity evaluator (`availability`), atomic transaction reserver (`reserveBooking`), and payment guard (`approvedForPayment`). |
| **Server Pricing Engine** | [`functions/src/payments/packagePricing.ts`](file:///d:/projects/Thaiseva-Admin-Portal-Web-App/functions/src/payments/packagePricing.ts) | Authoritative pricing formulas (`computePackageAmount`, `trustedSightseeingAmount`, `adultPriceOf`, `childPriceOf`). |
| **Post-Acceptance Checkout** | [`functions/src/bookingCheckout/payExisting.ts`](file:///d:/projects/Thaiseva-Admin-Portal-Web-App/functions/src/bookingCheckout/payExisting.ts) | Handles `createCheckoutSession` for previously pending/accepted requests in "My Bookings" with catalog repricing and previous session invalidation. |
| **Stripe Verification** | [`functions/src/payments/verifySession.ts`](file:///d:/projects/Thaiseva-Admin-Portal-Web-App/functions/src/payments/verifySession.ts) | Verifies user ownership of completed Stripe sessions post-redirect and invokes `markExistingBookingPaid`. |
| **Stripe Webhook Handler** | [`functions/src/payments/stripeWebhook.ts`](file:///d:/projects/Thaiseva-Admin-Portal-Web-App/functions/src/payments/stripeWebhook.ts) | Asynchronous webhook receiver verifying `Stripe-Signature` and processing `checkout.session.completed` events. |
| **Paid State Applier** | [`functions/src/payments/markBookingPaid.ts`](file:///d:/projects/Thaiseva-Admin-Portal-Web-App/functions/src/payments/markBookingPaid.ts) | Applies canonical paid patches (`paidPatch`, `statusAfterPaid`), prevents double payments, and handles `upsertSightseeingFromPaidSession`. |
| **Auth & CORS Middleware** | [`functions/src/payments/corsAuth.ts`](file:///d:/projects/Thaiseva-Admin-Portal-Web-App/functions/src/payments/corsAuth.ts) | Firebase ID Token decoding (`requireAuth`), origin whitelisting (`applyWebsiteCors`), user ID matching (`assertUserMatch`), and IP rate limiting. |
| **Auto-Accept Trigger** | [`functions/src/triggers/sightseeingTriggers.ts`](file:///d:/projects/Thaiseva-Admin-Portal-Web-App/functions/src/triggers/sightseeingTriggers.ts) | Firestore `onCreate` trigger `autoAcceptSightseeingBookings` notifying Telegram and auto-accepting unversioned legacy bookings. |
| **Status Change Trigger** | [`functions/src/triggers/sightseeingTriggers.ts`](file:///d:/projects/Thaiseva-Admin-Portal-Web-App/functions/src/triggers/sightseeingTriggers.ts) | Firestore `onUpdate` trigger `onSightseeingBookingStatusChange` synchronizing customer notifications and Telegram alerts. |
| **Capacity Utilities** | [`functions/src/utils/sightseeingBooking.ts`](file:///d:/projects/Thaiseva-Admin-Portal-Web-App/functions/src/utils/sightseeingBooking.ts) | Tour date extraction (`getSightseeingTourDate`) and multi-partner weekly/daily quota calculations (`evaluateSightseeingCapacity`). |
| **Payment Utilities** | [`functions/src/utils/sightseeingPayment.ts`](file:///d:/projects/Thaiseva-Admin-Portal-Web-App/functions/src/utils/sightseeingPayment.ts) | Payment method normalization, auto-acceptance eligibility (`canAutoAcceptSightseeingPayment`), and audit note builder. |
| **Admin Portal Order Console** | [`src/pages/dashboard/adminDashboard/clientOrders/travelBookings/TravelBookings.jsx`](file:///d:/projects/Thaiseva-Admin-Portal-Web-App/src/pages/dashboard/adminDashboard/clientOrders/travelBookings/TravelBookings.jsx) | React UI for booking review, single/bulk approval, Thai QR payment verification, and daily limit adjustment. |
| **Package Catalog Form** | [`src/pages/dashboard/adminDashboard/ourServices/travelServices/AddSightseeingPackage.jsx`](file:///d:/projects/Thaiseva-Admin-Portal-Web-App/src/pages/dashboard/adminDashboard/ourServices/travelServices/AddSightseeingPackage.jsx) | Management form configuring package duration, base adult/child rates, pickup times, and itineraries. |
| **Status Helpers** | [`src/utils/bookingStatus.js`](file:///d:/projects/Thaiseva-Admin-Portal-Web-App/src/utils/bookingStatus.js) | Shared helper functions classifying pending, onsite, Thai QR, revenue-eligible, and accepted sightseeing bookings. |

---

## 3. Database Collections & Schema Models

### 3.1 Primary Collections
- **`travelBookingDetails/{bookingId}`**: Destination collection for package bookings. Treat the returned ID as opaque. The website-owned create endpoint uses `pkg_{sha256}` derived from authenticated UID and `bookingRequestId`; a PaymentIntent ID is the fallback retry identity, or a new Firestore ID is allocated when neither is supplied. Separate checkouts can reserve the same package and dates. Reuse a request ID only for retries of one checkout. Existing legacy IDs remain valid, including the historical IDs illustrated below. See [current contract](../../documentation/PACKAGE_BOOKING_FLOWS.md#booking-updates-13-october-2026).
- **`sightseeingPackagesDetails/{packageId}`**: Catalog of available tours, containing rates, durations, itineraries, and inclusions.
- **`settings/sightseeingConfig`**: Global platform controls:
  - `globalDailyLimit`: Integer limit of instant bookings per day (default `20`).
  - `globalWeeklyLimit`: Integer weekly ceiling (default `200`).
- **`_sightseeingBookingDays/{YYYY-MM-DD}`**: Internal system lock collection. Never modified by client applications. Serializes concurrent bookings.
- **`notifications/users/{uid}/{notificationId}`**: Customer notification document inbox for real-time order updates.

### 3.2 Canonical `travelBookingDetails` Document Schema

```typescript
interface SightseeingBookingDocument {
  // Document Identity
  id: string;                                   // e.g., "pkg_usr123_pkgPhuket456_2026-11-05_2026-11-05"
  userId: string;                               // Firebase Auth UID of the customer
  authUid: string;                              // Alias for userId
  uId: string;                                  // Legacy alias
  source: "WEB" | "APP";                        // Origin of the booking request

  // Tour Package Details
  packageId: string;                            // Document ID in sightseeingPackagesDetails
  packageName: string;                          // Title of the package
  title: string;                                // Display title
  arrivalDate: string;                          // Tour start date (YYYY-MM-DD)
  departureDate: string;                        // Tour end date (YYYY-MM-DD)
  pickUpTime: string;                           // Requested pickup time or date
  pickUpLocation: string;                       // Hotel or meeting point address
  specialRequests?: string;                     // Dietary or accessibility requests

  // Guests & Party Size
  adults: number;                               // Number of adults (1 - 50)
  children: number;                             // Number of children (0 - 50)
  fullName: string;                             // Primary traveler's full name
  guestEmail: string;                           // Customer contact email
  guestPhone: string;                           // Customer contact phone number
  guestDetails: {
    name: string;
    email: string;
    phoneNumber: string;
  };

  // Pricing & Currency (All Server-Calculated)
  totalAmount: number;                          // Total payable amount in THB major units
  amount: number;                               // Synonymous with totalAmount
  price: number;                                // Synonymous with totalAmount
  currency: "THB";                              // Currency code

  // Lifecycle & Flow State
  bookingFlow: "INSTANT" | "REQUEST";           // Assigned by server date/capacity engine
  bookingFlowVersion: 1;                        // Engine version
  bookingFlowReason?: string | null;            // e.g. "PREPARATION_REQUIRED", "DAILY_LIMIT_REACHED"
  bookingFlowMessage?: string | null;           // User-friendly reason string
  status: "Pending" | "Accepted" | "In Progress" | "Canceled";
  bookingStatus: "PENDING_REVIEW" | "AWAITING_PAYMENT" | "PAYMENT_PENDING_VERIFICATION" | "CONFIRMED";
  isBookingConfirmed: boolean;                  // True once accepted by staff or auto-accepted
  autoAccepted?: boolean;                       // True if accepted automatically
  payNow: boolean;                              // True if immediate online payment is active
  amountDue?: number;                           // Outstanding balance to be paid

  // Payment Tracking
  paymentMethod: "STRIPE" | "THAI_QR" | "ONSITE";
  modeOfPayment: "ONLINE" | "BANK_TRANSFER" | "OFFLINE";
  isPaymentDone: boolean;                       // True when funds are verified
  isPaymentClear?: boolean;                     // True when settled
  paymentVerificationStatus: "NOT_PAID" | "UNVERIFIED" | "PENDING_VERIFICATION" | "VERIFIED";
  paymentVerificationNote?: string;             // Audit log note
  customerQrPaymentConfirmed?: boolean;         // True if user reported bank transfer completed
  instantReservationExpiresAt?: Timestamp;      // 35-minute reservation hold for Stripe

  // Stripe Session / Payment Intent Metadata
  stripeSessionId?: string | null;              // Stripe Checkout Session ID ("cs_...")
  paymentIntentId?: string | null;              // Stripe PaymentIntent ID ("pi_...")
  stripePaymentIntentId?: string | null;
  paymentConfirmation?: {
    status: "paid";
    provider: "STRIPE";
    sessionId?: string | null;
    paymentIntentId?: string | null;
  };

  // Timestamps
  createdAt: FieldValue | Timestamp;
  orderedAt: FieldValue | Timestamp;
  updatedAt: FieldValue | Timestamp;
  acceptedAt?: FieldValue | Timestamp;
  paidAt?: FieldValue | Timestamp;
}
```

---

## 4. API Specification & Endpoints

### 4.1 Endpoint 1: Create Package Booking
**Path:** `POST /createSightseeingBooking`  
**Authentication:** Required (`Authorization: Bearer <token>`)  
**File:** [`functions/src/bookingCheckout/sightseeingBooking.ts`](file:///d:/projects/Thaiseva-Admin-Portal-Web-App/functions/src/bookingCheckout/sightseeingBooking.ts)

#### Request Headers
```http
POST /createSightseeingBooking HTTP/1.1
Host: asia-east2-gothai-admin.cloudfunctions.net
Content-Type: application/json
Authorization: Bearer <FIREBASE_ID_TOKEN>
```

#### Request Payload Parameters
| Field Name | Type | Required | Description |
|---|---|:---:|---|
| `packageId` | `string` | **Yes** | Catalog document ID in `sightseeingPackagesDetails`. Also accepts aliases `serviceId`, `id`. |
| `arrivalDate` | `string` | **Yes** | Tour start date in `YYYY-MM-DD` format. Must be tomorrow or later. Also accepts `travelDate`, `date`. |
| `departureDate` | `string` | No | Tour finish date (`YYYY-MM-DD`). Defaults to arrival date + package duration. |
| `adults` | `number` | No | Number of adult passengers. Integer between 1 and 50. Default: `1`. |
| `children` | `number` | No | Number of child passengers. Integer between 0 and 50. Default: `0`. |
| `fullName` | `string` | **Yes** | Full name of primary traveler. Also accepts `name`, `guestName`. |
| `guestEmail` | `string` | No | Contact email. If omitted, defaults to the authenticated user's email. |
| `guestPhone` | `string` | No | Contact phone number (international format recommended, e.g. `+66812345678`). |
| `paymentMethod` | `string` | No | Preferred payment method: `"STRIPE"`, `"THAI_QR"`, or `"ONSITE"`. Default: `"STRIPE"`. |
| `pickUpLocation` | `string` | No | Hotel name or address where operator should pick up the guest. |
| `pickUpTime` | `string` | No | Preferred time of morning pickup (e.g., `"08:30"`). |
| `specialRequests` | `string` | No | Dietary, language, or accessibility notes. |
| `source` | `string` | No | Client source identifier: `"WEB"` (default) or `"APP"`. |
| `successUrl` | `string` | For Web Stripe | Return URL after successful Stripe payment. Must be on an authorized host. |
| `cancelUrl` | `string` | For Web Stripe | Return URL if customer abandons Stripe Checkout. |
| `paymentIntentId` | `string` | For App Stripe | Pre-authorized Stripe PaymentIntent ID (`pi_...`) from mobile PaymentSheet. |
| `customerQrPaymentConfirmed` | `boolean` | For Thai QR | Mandatory `true` when submitting Thai QR to declare bank transfer was sent. |
| `userId` | `string` | No | Must match the authenticated caller's UID (`auth.uid`) if supplied. |

---

### 4.2 Responses by Booking Flow

#### Scenario A: Day 3+ Within Capacity & Payment Method = STRIPE (Website Checkout)
The server recognizes that instant booking is permitted, locks the capacity for 35 minutes in a checkout hold (no booking yet), creates a Stripe Checkout Session, and returns the hosted Stripe URL. The booking (same `bookingId`) is written when `verifySession` or the Stripe webhook confirms the payment. If the guest leaves Stripe unpaid, call `POST releaseSightseeingCheckoutHold` with `{ bookingId }`: it expires the Checkout and frees the slot (`released: true`), or returns `paid: true` if the Checkout was already paid (then call `verifySession`).

```json
{
  "success": true,
  "bookingId": "pkg_usr987_pkgPhuket456_2026-11-05_2026-11-05",
  "bookingCollection": "travelBookingDetails",
  "amount": 4800,
  "currency": "thb",
  "paymentMethod": "STRIPE",
  "bookingFlow": "INSTANT",
  "status": "Accepted",
  "bookingStatus": "AWAITING_PAYMENT",
  "isPaymentDone": false,
  "isBookingConfirmed": true,
  "duplicate": false,
  "payNow": true,
  "message": "Instant booking is available for this date within the daily limit.",
  "stripeUrl": "https://checkout.stripe.com/c/pay/cs_live_a1b2c3d4e5f6g7",
  "url": "https://checkout.stripe.com/c/pay/cs_live_a1b2c3d4e5f6g7",
  "stripeSessionId": "cs_live_a1b2c3d4e5f6g7"
}
```

#### Scenario B: Day 3+ Within Capacity & Payment Method = STRIPE (Mobile PaymentSheet)
The mobile app already executed Stripe's PaymentSheet with a client secret created via custom backend or Cloud Function, and delivers `paymentIntentId: "pi_..."`. The server verifies that the status is `succeeded`, amount matches `amount * 100`, and currency is `thb`.

```json
{
  "success": true,
  "bookingId": "pkg_usr987_pkgPhuket456_2026-11-05_2026-11-05",
  "bookingCollection": "travelBookingDetails",
  "amount": 4800,
  "currency": "thb",
  "paymentMethod": "STRIPE",
  "bookingFlow": "INSTANT",
  "status": "Confirmed",
  "bookingStatus": "CONFIRMED",
  "isPaymentDone": true,
  "isBookingConfirmed": true,
  "duplicate": false,
  "payNow": false,
  "message": "Payment verified and booking confirmed."
}
```

#### Scenario C: Tomorrow / Day 2 (Preparation Period Required) or Daily Capacity Full
The booking is saved with status `Pending` and `bookingFlow: "REQUEST"`. No payment link is issued. Staff will review availability and confirm.

```json
{
  "success": true,
  "bookingId": "pkg_usr987_pkgPhuket456_2026-10-13_2026-10-13",
  "bookingCollection": "travelBookingDetails",
  "amount": 4800,
  "currency": "thb",
  "paymentMethod": "STRIPE",
  "bookingFlow": "REQUEST",
  "status": "Pending",
  "bookingStatus": "PENDING_REVIEW",
  "isPaymentDone": false,
  "isBookingConfirmed": false,
  "duplicate": false,
  "payNow": false,
  "message": "We need at least 2 full days to prepare your package. For tomorrow or the day after tomorrow, our team will check availability and confirm your request first. Payment is collected only after confirmation."
}
```

#### Scenario D: Payment Method = THAI_QR
Requires `customerQrPaymentConfirmed: true`. Saved with `PENDING_VERIFICATION` status for administrative review.

```json
{
  "success": true,
  "bookingId": "pkg_usr987_pkgPhuket456_2026-11-05_2026-11-05",
  "bookingCollection": "travelBookingDetails",
  "amount": 4800,
  "currency": "thb",
  "paymentMethod": "THAI_QR",
  "bookingFlow": "INSTANT",
  "status": "Pending Verification",
  "bookingStatus": "PAYMENT_PENDING_VERIFICATION",
  "isPaymentDone": false,
  "isBookingConfirmed": true,
  "duplicate": false,
  "payNow": false,
  "customerQrPaymentConfirmed": true,
  "paymentVerificationStatus": "PENDING_VERIFICATION",
  "message": "Instant booking is available for this date within the daily limit."
}
```

---

### 4.3 Endpoint 2: Pay Existing / Confirmed Booking Later
**Path:** `POST /createCheckoutSession`  
**Authentication:** Required (`Authorization: Bearer <token>`)  
**File:** [`functions/src/bookingCheckout/payExisting.ts`](file:///d:/projects/Thaiseva-Admin-Portal-Web-App/functions/src/bookingCheckout/payExisting.ts)

When a previously pending booking (`bookingFlow: "REQUEST"`) is approved by staff, or when a traveler revisits "My Bookings" to complete payment, this endpoint generates a fresh Stripe Checkout Session.

#### Security & Integrity Safeguards:
1. **Ownership Assertion:** Caller must own the booking (`userId === auth.uid`).
2. **Acceptance Gate:** Calls `sightseeingFlow.approvedForPayment(data)`. If still pending review, returns `409 NOT_ACCEPTED`.
3. **Catalog Repricing:** Re-reads `sightseeingPackagesDetails` via `trustedSightseeingAmount()` to ensure the customer cannot underpay. If the price in Firestore was altered, it is automatically corrected.
4. **Stale Session Cancellation:** Automatically calls `stripe.checkout.sessions.expire()` on any previous pending session for this booking to prevent accidental double charges.

#### Request Body
```json
{
  "bookingId": "pkg_usr987_pkgPhuket456_2026-10-13_2026-10-13",
  "bookingCollection": "travelBookingDetails",
  "successUrl": "https://thaiseva.com/booking/success?session_id={CHECKOUT_SESSION_ID}",
  "cancelUrl": "https://thaiseva.com/my-bookings"
}
```

#### Response
```json
{
  "success": true,
  "bookingId": "pkg_usr987_pkgPhuket456_2026-10-13_2026-10-13",
  "bookingCollection": "travelBookingDetails",
  "amount": 4800,
  "currency": "thb",
  "status": "Accepted",
  "bookingStatus": "AWAITING_PAYMENT",
  "payNow": true,
  "stripeUrl": "https://checkout.stripe.com/c/pay/cs_live_newSession789",
  "url": "https://checkout.stripe.com/c/pay/cs_live_newSession789",
  "stripeSessionId": "cs_live_newSession789"
}
```

---

### 4.4 Endpoint 3: Post-Stripe Redirect Verification
**Path:** `POST /verifySession`  
**Authentication:** Required (`Authorization: Bearer <token>`)  
**File:** [`functions/src/payments/verifySession.ts`](file:///d:/projects/Thaiseva-Admin-Portal-Web-App/functions/src/payments/verifySession.ts)

When Stripe redirects the customer back to `successUrl?session_id=cs_...`, the frontend invokes this endpoint to verify settlement and trigger paid status updates.

#### Request Body
```json
{
  "sessionId": "cs_live_a1b2c3d4e5f6g7"
}
```

#### Response
```json
{
  "success": true,
  "paid": true,
  "sessionId": "cs_live_a1b2c3d4e5f6g7",
  "bookingId": "pkg_usr987_pkgPhuket456_2026-11-05_2026-11-05",
  "bookingCollection": "travelBookingDetails",
  "path": "travelBookingDetails/pkg_usr987_pkgPhuket456_2026-11-05_2026-11-05",
  "amount": 4800,
  "currency": "thb",
  "message": "Payment verified."
}
```

---

## 5. Pricing Engine Calculations

The pricing algorithm is defined in [`functions/src/payments/packagePricing.ts`](file:///d:/projects/Thaiseva-Admin-Portal-Web-App/functions/src/payments/packagePricing.ts).

### Pricing Math
$$\text{Adult Price } (A) = \text{parse}(\text{package.price} \lor \text{package.startingPrice} \lor \text{package.pricingStructure.pricePerAdult})$$

$$\text{Child Price } (C) = \begin{cases} 
\text{package.childPrice} & \text{if configured} > 0 \\
A \times 0.5 & \text{fallback (50\% of adult rate)}
\end{cases}$$

$$\text{Subtotal} = \text{round}(A \times \text{adults}) + \text{round}(C \times \text{children}) + \text{round}(A \times 0.8 \times \text{extraAdults})$$

$$\text{Final Amount} = \max(0, \text{Subtotal} - \text{round}(\text{Subtotal} \times \frac{\text{Discount \%}}{100}))$$

- **Minimum Charge:** Stripe card charges require at least **20 THB**.
- **Maximum Charge:** 500,000 THB ceiling for single online transactions.

---

## 6. Administrative Operations (Admin Dashboard)

Administrative operations are handled in [`src/pages/dashboard/adminDashboard/clientOrders/travelBookings/TravelBookings.jsx`](file:///d:/projects/Thaiseva-Admin-Portal-Web-App/src/pages/dashboard/adminDashboard/clientOrders/travelBookings/TravelBookings.jsx).

### 6.1 Confirming a Request Booking
When a customer submits a booking for tomorrow/day 2 or during full capacity:
1. Staff navigate to **Client Orders $\rightarrow$ Travel Bookings $\rightarrow$ Pending Tab**.
2. Staff inspect party size, package availability, and partner assignment.
3. Clicking **Confirm Booking** triggers:
   ```javascript
   await updateDoc(doc(travelBookingCollection, id), {
     status: "Accepted",
     bookingStatus: "AWAITING_PAYMENT",
     isBookingConfirmed: true,
     payNow: true,
     amountDue: booking.totalAmount
   });
   ```
4. A notification is automatically dispatched to the customer's phone/dashboard stating their booking is confirmed and payment is now open.

### 6.2 Verifying Thai QR Bank Transfer
When a customer pays via Thai QR code:
1. The booking sits in the **Thai QR / Onsite Tab** with `paymentVerificationStatus: "PENDING_VERIFICATION"`.
2. Staff verify the incoming funds on the corporate bank terminal.
3. Clicking **Verify Payment** triggers `handleVerifyPayment()`:
   ```javascript
   await updateDoc(doc(travelBookingCollection, id), {
     status: "Accepted",
     bookingStatus: "CONFIRMED",
     paymentVerificationStatus: "VERIFIED",
     paymentVerificationNote: "Thai QR transfer verified by admin",
     isPaymentDone: true,
     paymentVerifiedAt: new Date(),
     updatedAt: new Date()
   });
   ```
4. Earnings are immediately credited to financial accounting records via `recordSightseeingEarnings()`.

### 6.3 Configuring Daily Capacity Limits
1. Staff click **Adjust Capacity** in the Travel Bookings header.
2. The modal updates `settings/sightseeingConfig.globalDailyLimit`.
3. Changes apply instantly to all subsequent incoming availability and reservation requests without requiring function redeployment.

---

## 7. Client Integration Code Examples

### 7.1 Web Client: Full React / JavaScript Booking Integration

```javascript
import { getAuth } from "firebase/auth";

const API_BASE = "https://asia-east2-gothai-admin.cloudfunctions.net";

/**
 * Creates a sightseeing package booking.
 * Correctly branches on payNow and stripeUrl.
 */
export async function bookSightseeingTour(bookingPayload) {
  const auth = getAuth();
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error("User must be signed in.");

  const idToken = await currentUser.getIdToken();

  const response = await fetch(`${API_BASE}/createSightseeingBooking`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${idToken}`
    },
    body: JSON.stringify({
      packageId: bookingPayload.packageId,
      arrivalDate: bookingPayload.arrivalDate,       // "YYYY-MM-DD"
      departureDate: bookingPayload.departureDate,   // optional "YYYY-MM-DD"
      adults: Number(bookingPayload.adults || 1),
      children: Number(bookingPayload.children || 0),
      fullName: bookingPayload.fullName,
      guestEmail: bookingPayload.email || currentUser.email,
      guestPhone: bookingPayload.phone,
      pickUpLocation: bookingPayload.pickUpLocation,
      specialRequests: bookingPayload.notes,
      paymentMethod: bookingPayload.paymentMethod || "STRIPE",
      successUrl: `${window.location.origin}/booking/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${window.location.origin}/booking/cancel`,
      source: "WEB"
    })
  });

  const result = await response.json();
  if (!response.ok || !result.success) {
    const error = new Error(result.error || "Booking request failed.");
    error.reasonCode = result.reasonCode;
    throw error;
  }

  // Branch 1: Instant Card Checkout -> Redirect to Stripe
  if (result.payNow && result.stripeUrl) {
    window.location.href = result.stripeUrl;
    return result;
  }

  // Branch 2: Request Flow (Tomorrow, Day 2, or Capacity Full)
  if (result.bookingFlow === "REQUEST") {
    alert(result.message || "Request received! Our team will confirm your booking before payment opens.");
    window.location.href = "/my-bookings";
    return result;
  }

  // Branch 3: Offline / QR flow
  if (result.paymentMethod === "THAI_QR") {
    alert("Please complete your PromptPay transfer and keep your slip ready.");
    window.location.href = "/my-bookings";
    return result;
  }

  return result;
}
```

### 7.2 Mobile Client: PaymentSheet (App) Integration

```javascript
import { getAuth } from "firebase/auth";
import { initPaymentSheet, presentPaymentSheet } from "@stripe/stripe-react-native";

export async function bookTourOnMobile(packageId, tourDate, party, stripePaymentIntentId) {
  const auth = getAuth();
  const idToken = await auth.currentUser?.getIdToken();

  const response = await fetch(`${API_BASE}/createSightseeingBooking`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${idToken}`
    },
    body: JSON.stringify({
      packageId,
      arrivalDate: tourDate,
      adults: party.adults,
      children: party.children,
      fullName: party.name,
      guestPhone: party.phone,
      paymentMethod: "STRIPE",
      paymentIntentId: stripePaymentIntentId, // Succeeded PaymentIntent ID ("pi_...")
      source: "APP"
    })
  });

  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.error || "Failed to confirm mobile tour booking.");
  }

  return data; // Booking is confirmed and marked paid immediately
}
```

### 7.3 My Bookings: Pay After Admin Confirmation

```javascript
export async function payConfirmedBooking(bookingId) {
  const auth = getAuth();
  const idToken = await auth.currentUser?.getIdToken();

  const response = await fetch(`${API_BASE}/createCheckoutSession`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${idToken}`
    },
    body: JSON.stringify({
      bookingId,
      bookingCollection: "travelBookingDetails",
      successUrl: `${window.location.origin}/booking/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${window.location.origin}/my-bookings`
    })
  });

  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.error || "Unable to open payment session.");
  }

  // Redirect traveler to newly created Stripe session
  window.location.href = data.stripeUrl;
}
```

### 7.4 Post-Stripe Redirect Verification (Success Page)

```javascript
export async function verifyStripePaymentOnSuccess() {
  const params = new URLSearchParams(window.location.search);
  const sessionId = params.get("session_id");
  if (!sessionId) return;

  const auth = getAuth();
  const idToken = await auth.currentUser?.getIdToken();

  const response = await fetch(`${API_BASE}/verifySession`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${idToken}`
    },
    body: JSON.stringify({ sessionId })
  });

  const result = await response.json();
  if (result.success && result.paid) {
    console.log("Booking successfully paid:", result.bookingId);
  }
}
```

---

## 8. Error Codes & Troubleshooting Reference

| Error Code | HTTP Status | Description | Solution / Client Action |
|---|:---:|---|---|
| `UNAUTHENTICATED` | 401 | Missing or expired Firebase ID token. | Re-authenticate user via `getIdToken(true)` and retry. |
| `USER_MISMATCH` | 403 | Payload `userId` does not match the token's UID. | Omit `userId` or ensure it matches `auth.currentUser.uid`. |
| `PACKAGE_NOT_FOUND` | 404 | Package ID does not exist in `sightseeingPackagesDetails`. | Verify package ID from catalog query. |
| `INVALID_DATE` | 400 | Date is today, past, or invalid format. | Ensure `YYYY-MM-DD` is tomorrow or later. |
| `PREPARATION_REQUIRED` | 400 (Internal) | Selected date is within 2-day prep window. | Handled automatically; server routes to `REQUEST` flow. |
| `DAILY_LIMIT_REACHED` | 400 (Internal) | Daily capacity limit reached. | Handled automatically; server routes to `REQUEST` flow. |
| `INVALID_PRICE` | 400 | Catalog has no valid price or price is $\le 0$. | Configure rates in Admin Portal `sightseeingPackagesDetails`. |
| `INVALID_PAYMENT` | 400 | App PaymentIntent status is not `succeeded` or satang mismatch. | Check currency is `thb` and amount equals `serverAmount * 100`. |
| `PAYMENT_ALREADY_USED` | 409 | Attempted to reuse an already attached PaymentIntent. | Create a fresh PaymentIntent for each order. |
| `NOT_ACCEPTED` | 409 | Attempted to pay an unconfirmed booking via `createCheckoutSession`. | Wait until staff sets status to `Accepted` (`AWAITING_PAYMENT`). |
| `RATE_LIMITED` | 429 | More than 30 requests per minute from the same IP. | Back off and retry after 60 seconds. |
| `STRIPE_ERROR` | 502 | Stripe API communication or secret error. | Verify `STRIPE_SECRET_KEY` in Firebase Secret Manager. |

---

## 9. Testing & Quality Assurance Verification Checklist

- [ ] **Date Validation:** Test selecting today's date $\rightarrow$ Expect `400 INVALID_DATE`.
- [ ] **Preparation Window (Tomorrow / Day 2):** Test booking for tomorrow $\rightarrow$ Expect `success: true`, `bookingFlow: "REQUEST"`, `status: "Pending"`, `payNow: false`, `stripeUrl: null`.
- [ ] **Instant Booking (Day 3+):** Test booking for 5 days ahead $\rightarrow$ Expect `success: true`, `bookingFlow: "INSTANT"`, `status: "Accepted"`, `payNow: true`, valid `stripeUrl`.
- [ ] **Capacity Saturation:** Set `globalDailyLimit` to `0` or saturate date $\rightarrow$ Expect Day 3+ to fall back to `REQUEST` flow with `DAILY_LIMIT_REACHED`.
- [ ] **Stripe Checkout Webhook:** Complete checkout on Stripe test card `4242...` $\rightarrow$ Verify webhook updates `travelBookingDetails` to `isPaymentDone: true`, `status: "Accepted"`.
- [ ] **Post-Confirmation Pay Later:** Confirm pending booking in Admin Portal $\rightarrow$ Call `/createCheckoutSession` $\rightarrow$ Verify Stripe URL returned.
- [ ] **Unconfirmed Payment Guard:** Call `/createCheckoutSession` on a `Pending` booking $\rightarrow$ Expect `409 NOT_ACCEPTED`.
- [ ] **Pricing Verification:** Submit booking with 2 adults and 1 child $\rightarrow$ Verify total matches `adultPrice * 2 + childPrice`.
- [ ] **Thai QR Flow:** Submit with `paymentMethod: "THAI_QR"` $\rightarrow$ Verify status is `Pending Verification`, and verify payment in Admin Portal.
