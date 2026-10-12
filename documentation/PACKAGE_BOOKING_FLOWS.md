# Package booking flows — 11 October 2026

> **Comprehensive Integration Guide:** See [`docs/03-api/PACKAGE_BOOKING_INTEGRATION_GUIDE.md`](file:///d:/projects/Thaiseva-Admin-Portal-Web-App/docs/03-api/PACKAGE_BOOKING_INTEGRATION_GUIDE.md) for full function file locations from workspace root, schema types, request/response models, and client code integration snippets.

This contract supersedes earlier package payment-first and always-confirmed behavior.

## Dates and routing

Dates use the Thailand calendar (`Asia/Bangkok`). The website defaults to tomorrow and rejects today/past dates.

| Selected start date | Flow | Payment |
| --- | --- | --- |
| Tomorrow or the day after tomorrow | REQUEST | After staff confirmation |
| Day 3 onward, within daily capacity | INSTANT | Card checkout now; existing QR/onsite options supported |
| Day 3 onward, daily capacity full | REQUEST | After staff confirmation |

The daily limit is `settings/sightseeingConfig.globalDailyLimit` (default 20; 0 disables instant booking). It applies across packages to the selected start date and counts bookings, not passengers. Paid/accepted bookings and live card reservations consume capacity. Pending requests and canceled/expired reservations do not. Existing historic paid bookings are preserved.

Preparation message:

> We need at least 2 full days to prepare your package. For tomorrow or the day after tomorrow, our team will check availability and confirm your request first. Payment is collected only after confirmation.

## Lifecycle and admin

Requests save `travelBookingDetails` with `status: Pending`, `bookingStatus: PENDING_REVIEW`, `bookingFlow: REQUEST`, `isBookingConfirmed: false`, `isPaymentDone: false`, `payNow: false`. No card link or QR transfer is presented.

Admin uses **Confirm & Open Payment**. Acceptance sets `bookingStatus: AWAITING_PAYMENT`, `isBookingConfirmed: true`, and `amountDue` to the booking price. It does not mark payment as done. Customers choose payment in **My Bookings** after confirmation. Unconfirmed package card/manual payment calls return `NOT_ACCEPTED`.

Instant card checkout reserves capacity atomically before redirect. Stripe checkout lasts 30 minutes; the reservation lasts 35 minutes for reconciliation. Expired unpaid reservations free capacity. Resubmission of an expired booking becomes a request. Late payment is recorded for staff review without silently confirming a released slot.

Added fields: `bookingFlow` (`INSTANT`/`REQUEST`), `bookingFlowVersion: 1`, `bookingFlowReason`, `bookingFlowMessage`, and `instantReservationExpiresAt` for instant card reservations. Private `_sightseeingBookingDays/{YYYY-MM-DD}` documents serialize capacity checks. Clients cannot write them. The auto-accept trigger does not reroute versioned requests.

## API

Base URL: `https://asia-east2-gothai-ffea1.cloudfunctions.net`.

### POST /checkSightseeingAvailability

Public, rate-limited pre-check. It does not reserve capacity.

```json
{"arrivalDate":"2026-10-14"}
```

Response fields: `success`, `valid`, `daysAhead`, `preparationOk`, `dailyCount`, `dailyLimit`, `canInstantBook`, `bookingFlow`, `reasonCode`, `message`. Reasons: `INVALID_DATE`, `PREPARATION_REQUIRED`, `DAILY_LIMIT_REACHED`. Invalid dates return HTTP 400.

### POST /createSightseeingBooking

Requires `Authorization: Bearer <Firebase ID token>` and the existing package/guest/date fields. Prices come from the catalog. Creation rechecks dates and capacity atomically. Clients branch on `stripeUrl`/`payNow`, not the requested payment method.

Request response example:

```json
{"success":true,"bookingId":"pkg_...","bookingCollection":"travelBookingDetails","bookingFlow":"REQUEST","bookingStatus":"PENDING_REVIEW","isBookingConfirmed":false,"isPaymentDone":false,"payNow":false,"stripeUrl":null,"reasonCode":"PREPARATION_REQUIRED"}
```

Instant card response includes the reserved `bookingId`, `bookingFlow: INSTANT`, `payNow: true`, `stripeUrl`, and `stripeSessionId`. Verification updates the same document. Repeated submissions return the existing booking. Later payment uses `createCheckoutSession` or `createManualBooking` with an existing confirmed booking. Legacy new-package checkout/manual calls must use `createSightseeingBooking` to avoid bypassing policy.

The app must pre-check before opening PaymentSheet. An already-paid PaymentIntent does not make a pending request eligible.

## Validation and deployment

Validation covers Thailand midnight/date boundaries, full and zero limits, pending/canceled exclusion, payment guards, checkout expiry, and Firestore-emulator simultaneous reservations, duplicates and all near-date payment methods.

Deploy affected functions before both hosting sites. The website owns sightseeing creation/pre-check; the admin source owns asia-east2 checkout/payment handlers and sightseeing triggers. Legacy us-central1 payment endpoints must enforce the same confirmation rule. Both sites use project `gothai-ffea1`: `thaigo` (website), `gothai-admin` (admin). Use the fresh website build and its generated CSP hashes. Deploy no unrelated rules/functions.
