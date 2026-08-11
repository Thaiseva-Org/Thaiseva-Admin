# Sightseeing booking — Website & App integration

How to implement **package / sightseeing** booking on the **website** and **mobile app**.

| | |
|--|--|
| **Endpoint** | `POST createSightseeingBooking` |
| **Region** | `asia-east2` |
| **Auth** | `Authorization: Bearer <Firebase ID token>` |
| **Collection** | `travelBookingDetails` (server-written only) |
| **Updated** | 2026-08-12 |

**Full API reference:** [THAISEVA_BOOKING_API.md](./THAISEVA_BOOKING_API.md)

**Base URL**

```text
https://asia-east2-<PROJECT_ID>.cloudfunctions.net/createSightseeingBooking
```

Example: `https://asia-east2-gothai-ffea1.cloudfunctions.net/createSightseeingBooking`

---

## Rules that never change

1. User must be signed in with **Firebase Auth**.
2. Send on every call:

```http
POST /createSightseeingBooking
Authorization: Bearer <idToken>
Content-Type: application/json
```

3. `userId` in body must match the token UID (or omit it — server uses the token).
4. **Never trust client price.** Server computes:

```text
amount = round(adultPrice × adults + childPrice × children)
```

(If child price missing → 50% of adult.) Minimum card amount: **20 THB**.

5. **Do not** write to `travelBookingDetails` from the client.
6. Paid Stripe documents follow the [canonical shape](#canonical-paid-document).

---

## Payment methods

| Method | Website | App | What server does |
|--------|---------|-----|------------------|
| **STRIPE** | Checkout redirect (`stripeUrl`) | PaymentSheet + `paymentIntentId` (preferred) | Pay first, then booking |
| **THAI_QR** | Yes | Yes | Booking now, unpaid, admin verifies |
| **ONSITE** | Yes | Yes | Booking now, pay offline later |

Aliases: `CARD` → STRIPE · `PROMPTPAY` / `QR` → THAI_QR · `CASH` / `PAY LATER` → ONSITE.

---

## Common request body

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
  "pickUpLocation": "",
  "specialRequests": "",
  "paymentMethod": "STRIPE",
  "userId": "<firebaseAuthUid>"
}
```

| Field | Required | Notes |
|-------|----------|--------|
| `packageId` | Yes | From `sightseeingPackagesDetails` |
| `fullName` | Yes | Guest name |
| `arrivalDate` | Yes | `YYYY-MM-DD` |
| `adults` | No | Default 1 |
| `children` | No | Default 0 |
| `guestEmail` / `guestPhone` | Recommended | |
| `paymentMethod` | No | Default `STRIPE` |
| `successUrl` / `cancelUrl` | Website Stripe | Checkout return URLs |
| `paymentIntentId` | App Stripe | After PaymentSheet succeeds |
| `customerQrPaymentConfirmed` | Thai QR | `true` if user says they paid |

---

## Website implementation

### Flow

```text
User picks package + dates + guests
        ↓
User fills name / email / phone
        ↓
User chooses payment
        ↓
POST createSightseeingBooking
        ↓
┌─────────────────┬──────────────────┬─────────────────┐
│ STRIPE          │ THAI_QR          │ ONSITE          │
│ open stripeUrl  │ success + await  │ confirmed,      │
│                 │ verification     │ pay later       │
└────────┬────────┴──────────────────┴─────────────────┘
         ↓
  Stripe success page
         ↓
  POST verifySession { sessionId }
         ↓
  Show “Booking confirmed”
```

### Example call

```js
const user = firebase.auth().currentUser;
const idToken = await user.getIdToken();

const res = await fetch(
  "https://asia-east2-gothai-ffea1.cloudfunctions.net/createSightseeingBooking",
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      packageId,
      fullName,
      guestEmail,
      guestPhone,
      adults,
      children,
      arrivalDate,
      departureDate,
      pickUpLocation,
      specialRequests,
      paymentMethod, // "STRIPE" | "THAI_QR" | "ONSITE"
      userId: user.uid,
      // STRIPE website only:
      successUrl:
        "https://thaiseva.com/booking/success?session_id={CHECKOUT_SESSION_ID}",
      cancelUrl: "https://thaiseva.com/booking/cancel",
    }),
  },
);
const data = await res.json();
```

### Handle responses

**STRIPE (Checkout)** — booking may not exist yet (`bookingId` can be `null`):

```js
if (data.success && data.stripeUrl) {
  window.location.href = data.stripeUrl;
}
```

**Success page**

```js
const sessionId = new URLSearchParams(location.search).get("session_id");
const verify = await fetch(
  "https://asia-east2-gothai-ffea1.cloudfunctions.net/verifySession",
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ sessionId }),
  },
);
// Show confirmed booking from verify response
```

**THAI_QR** — booking saved, unpaid, pending admin verification.  
**ONSITE** — booking confirmed; pay later offline.

---

## App implementation (PaymentSheet preferred)

### Flow

```text
User fills booking form
        ↓
Create Stripe PaymentIntent
  (amount = package price × 100 satang, currency thb)
        ↓
Present Stripe PaymentSheet
        ↓
Payment succeeds → paymentIntentId (pi_...)
        ↓
POST createSightseeingBooking
  paymentMethod: "STRIPE"
  paymentIntentId: "pi_..."
        ↓
Server verifies PI with Stripe:
  - status === "succeeded"
  - amount === serverPrice * 100
  - currency === "thb"
  - PI not already used
        ↓
Server writes paid booking to travelBookingDetails
        ↓
Response: bookingId, isPaymentDone: true
        ↓
Trigger auto-accepts → status "Accepted"
```

### Request after PaymentSheet succeeds

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

### Success response

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
  "paymentIntentId": "pi_3U3KI6B2v6ObPUpc1FGkwnvT",
  "duplicate": false,
  "message": "Payment verified and booking confirmed."
}
```

App UI: show paid success → open My Bookings / detail. **Do not** open browser Checkout.

### App THAI_QR / ONSITE

Same body as website — **no** `paymentIntentId`, **no** `successUrl`.

| Method | UI after API |
|--------|----------------|
| THAI_QR | QR instructions + pending verification |
| ONSITE | Confirmed, pay later |

### Optional: App Checkout

If you call **without** `paymentIntentId`, server returns `stripeUrl` (website-style). Prefer PaymentSheet for native UX.

---

## Website vs App

| Topic | Website | App |
|-------|---------|-----|
| Auth | Firebase web token | Firebase mobile token |
| Stripe | Checkout → `stripeUrl` | PaymentSheet → `paymentIntentId` |
| After Stripe | `verifySession` on success page | Booking created in same API call |
| `successUrl` / `cancelUrl` | Required for Checkout | Not needed for PaymentSheet |
| `paymentIntentId` | Not used | Required after PaymentSheet |
| THAI_QR / ONSITE | Same | Same |
| Price | Server only | Server only |
| Collection | `travelBookingDetails` | same |

---

## Canonical paid document

Target shape for paid Stripe packages in `travelBookingDetails`:

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

**Reader fallbacks**

| Display | Prefer | Fallback |
|---------|--------|----------|
| Name | `guestDetails.name` | `fullName` |
| Phone | `guestDetails.phoneNumber` | `phone` / `guestPhone` |
| Email | `guestDetails.email` | `email` / `guestEmail` |
| Amount | `totalAmount` | `price` / `amount` |
| Paid? | `isPaymentDone` | `VERIFIED` or `paymentConfirmation.status === "paid"` |

`source`: PaymentSheet → `"APP"`; website flows often `"WEB"`.

Some Stripe amount fields (`stripeAmountTotal`, `isPaymentClear`, `paidAt`) are always present after Checkout webhook / `markBookingPaid`; PaymentSheet create path always sets payment verification + `paymentIntentId` and may be completed by the auto-accept trigger for `status: Accepted`.

---

## Pseudo-code

### Website

```text
onSubmit():
  token = await auth.currentUser.getIdToken()
  body = { packageId, fullName, guestEmail, guestPhone, adults, children,
           arrivalDate, paymentMethod, userId, successUrl, cancelUrl }
  data = POST createSightseeingBooking(body, token)

  if !data.success → show data.error; return
  if paymentMethod == STRIPE and data.stripeUrl → redirect(data.stripeUrl)
  else if paymentMethod == THAI_QR → showPendingVerification(data.bookingId)
  else → showConfirmedPayLater(data.bookingId)

onSuccessPage(session_id):
  data = POST verifySession({ sessionId }, token)
  showBookingConfirmed(data)
```

### App

```text
onSubmit():
  token = await auth.currentUser.getIdToken()

  if paymentMethod == STRIPE:
    // Create PI for amount*100 THB → PaymentSheet → on success:
    body = { ..., paymentMethod: "STRIPE", paymentIntentId: pi.id }
    data = POST createSightseeingBooking(body, token)
    if data.success and data.isPaymentDone:
      showPaidConfirmed(data.bookingId)
    else:
      showError(data.error)
  else:
    data = POST createSightseeingBooking({ ..., paymentMethod }, token)
    showResultFromMessage(data)
```

---

## Errors to handle

| Code | Meaning | UI |
|------|---------|-----|
| `401` / `UNAUTHENTICATED` | Bad/missing token | Login again |
| `403` / `USER_MISMATCH` | `userId` ≠ token | Use `auth.uid` only |
| `INVALID_ARGUMENT` | Missing package/date/name | Fix form |
| `PACKAGE_NOT_FOUND` | Bad `packageId` | Refresh catalog |
| `INVALID_AMOUNT` | Card &lt; 20 THB | Block submit |
| `PAYMENT_NOT_COMPLETED` | PI not succeeded | Retry PaymentSheet |
| `PAYMENT_AMOUNT_MISMATCH` | PI amount ≠ server price | Recreate PI with correct amount |
| `PAYMENT_CURRENCY_MISMATCH` | Not `thb` | Fix Stripe currency |
| `STRIPE_VERIFICATION_ERROR` | Could not verify PI | Retry / support |
| Duplicate success | Same booking/PI already used | Treat as success |

---

## Quick rules

1. Always send **Bearer Firebase ID token**.
2. Always send real **`packageId`** + **`arrivalDate`** + **`fullName`**.
3. **Website Stripe** = Checkout URL; booking after pay + `verifySession`.
4. **App Stripe** = PaymentSheet first; then API with **`paymentIntentId`**.
5. Do **not** invent billing totals on the client.
6. Do **not** write `travelBookingDetails` from the client.
7. Paid UI / admin: `isPaymentDone` / `VERIFIED` / `Accepted`.
8. Idempotent: `duplicate: true` → open existing booking, don’t error.
