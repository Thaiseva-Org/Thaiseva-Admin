# Package booking rollout verification - 11 October 2026

Deployment completed to Firebase project `gothai-ffea1`.

- Website: https://thaiseva.com (`thaigo` hosting site).
- Admin: https://admin.thaiseva.com (`gothai-admin` hosting site).
- New/updated asia-east2 functions: `checkSightseeingAvailability`, `createSightseeingBooking`, `createCheckoutSession`, `verifySession`, `stripeWebhook`, `autoAcceptSightseeingBookingsV2`, `onSightseeingBookingStatusChange`.
- Updated us-central1 compatibility functions: `createCheckoutSession`, `createManualBooking`, `verifySession`, `stripeWebhook`. Existing endpoints in both regions were retained.

## Verification

| Check | Result |
| --- | --- |
| New date/capacity/payment policy unit tests | 5 passed |
| Firestore emulator concurrency, near-date methods, expiry/acceptance tests | 3 passed |
| Website Functions regression suite | 44 passed |
| Admin Functions regression suite | 27 passed |
| Admin Functions TypeScript build | Passed |
| Website and admin production builds | Passed |
| Browser fixture using the actual package booking component | Tomorrow defaults correctly; request submission stays unpaid; day 3 shows payment; full capacity hides payment |
| Live public API from the actual website origin | Today HTTP 400; tomorrow/day 2 REQUEST; day 3 INSTANT within capacity |
| Live hosting assets | Website contains updated flows/labels; admin bundle hashes match the built files |
| Both regional checkout/verification endpoints | Reachable and reject unauthenticated calls with HTTP 401 |

Browser interaction used isolated package/auth/API fixtures. Capacity and persistence tests used the local Firestore emulator. No live customer booking or payment was created for verification.

The changed website files pass lint with the existing `react-hooks/set-state-in-effect` findings excluded. Full lint remains affected by existing synchronous-effect findings in the website and unused-variable/dependency findings in the admin booking component; both production builds pass.

See [API contract and lifecycle](PACKAGE_BOOKING_FLOWS.md).
