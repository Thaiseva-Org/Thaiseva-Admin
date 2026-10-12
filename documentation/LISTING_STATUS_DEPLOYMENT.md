# Listing status rollout — 12 October 2026

Deployed successfully to Firebase project `gothai-ffea1`.

| Surface | Result |
| --- | --- |
| Admin hosting | Published to `gothai-admin`; https://admin.thaiseva.com responds HTTP 200 |
| Website hosting | Published to `thaigo`; https://thaiseva.com, `/stays` and `/tours` respond HTTP 200 |
| Admin backend, asia-east2 | Updated `checkHotelStock`, `checkHotelAvailability`, `lockHotelStock`, `startHotelBookingHold`, `completeHotelBookingHold`, `createHotelBookingWithAvailability`, `createHotelBooking`, `createSightseeingBooking` |
| Website compatibility backend, us-central1 | Updated `createCheckoutSession`, `createManualBooking`, `checkHotelAvailability` |

Firebase proposed deleting functions with identical names in the other region. Those deletions were explicitly declined; the existing regional endpoints were retained. No Firestore/Storage rules were deployed and no production customer booking or catalog visibility was changed for testing.

## Verification evidence

- Both production frontend builds and the admin Functions TypeScript build pass.
- Backend regression suites: 44 website tests and 28 admin tests pass. Two additional website backend visibility tests and three public mapper tests pass.
- Local Firestore/browser checks confirm immediate optimistic changes, disabled pending controls, root/nested hotel updates, atomic tour/room writes, rollback on a denied mirror write, accurate filter counts and reactivation.
- A nested-only room toggle creates its missing legacy package document with the room data preserved. A subsequent external snapshot change updates the control, confirming optimistic overrides do not hide later updates.
- Published admin hotel/tour/room/status assets and public catalog chunks match the local production build hashes.
- Live booking endpoints in both regions reject unauthenticated requests with HTTP 401.
- Public Stays and Tours render successfully in the browser without console errors.

See [feature behavior and data contract](LISTING_STATUS.md). Static HTML and sitemaps reflect the most recent build; Firestore listeners update visible listings after load. Legacy records remain active until an admin explicitly deactivates them.
