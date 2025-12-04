# Implementation Plan: Add Hotel Management Enhancements

## Goal
Modify the admin dashboard so that **hotel creation** is an admin‑only operation and **remove all partner‑account related UI** (password, payment information, license). Ensure no new partner account can be opened from the dashboard and hide the partnership board.

## Scope
- Navigation updates (remove partner onboarding links)
- UI changes in `AddHotelForm.jsx`
- Disable any API endpoints that create partner accounts from the admin panel
- Update route guards to block partner onboarding routes for admins
- Adjust Firestore security rules to restrict `partners` collection writes to admins only
- Update documentation (README, admin overview) to reflect new flow

## Code Changes
| File | Change Type | Description |
|------|-------------|-------------|
| `src/routes/Route.jsx` | Delete/Comment | Remove `/partner-onboarding` and any partner‑related routes from the admin router.
| `src/layouts/Dashboard.jsx` | UI Update | Hide navigation items that point to partner onboarding or partnership board.
| `src/pages/dashboard/adminDashboard/ourPartners/hotels/AddHotelForm.jsx` | UI Refactor | Remove fields: `accountPassword`, `paymentInfo`, `licenseNumber` (if present). Adjust form validation and submission payload accordingly.
| `src/contextAPIs/PartnerProvider.jsx` | Logic Update | Ensure no functions expose partner account creation. Remove any `createPartner` helper.
| `src/firebase/firebase.config.js` | Security Rules | Update Firestore rules: only `isAdmin` can write to `partners` collection. Remove any `allow create` for unauthenticated users.
| `src/pages/dashboard/adminDashboard/ourPartners/hotels/HotelRoomsManager.jsx` (if referencing partner fields) | Minor Adjust | Remove any UI that expects partner account data.
| Documentation (`.agent/README.md`, `ADMIN_DASHBOARD_OVERVIEW.md`) | Update | Reflect that partner onboarding is no longer available from admin panel.

## Verification Plan
1. **Unit Tests** – Search existing tests for `AddHotelForm` and partner creation.
   - Run `npm test -- src/pages/dashboard/adminDashboard/ourPartners/hotels/AddHotelForm.test.js` (if exists) to ensure form validation passes without the removed fields.
   - If no test exists, add a new test `AddHotelForm.noPartnerFields.test.js` that renders the form and asserts the removed inputs are not present and submission payload excludes them.
2. **Integration Test** – Use existing e2e test suite (if any) to navigate to `/dashboard/hotels` and open the Add Hotel modal.
   - Verify the navigation link for "Partner Onboarding" is absent.
   - Verify the Add Hotel form does not contain password/payment/license fields.
   - Submit a new hotel and confirm the Firestore `hotels` collection receives a document with only allowed fields.
3. **Manual Test** (User verification)
   - Open the admin dashboard as an admin.
   - Confirm the sidebar no longer shows "Partner Onboarding" or partnership board links.
   - Click "Add Hotel" → ensure the form only asks for hotel name, location, images, etc.
   - Submit a hotel and verify it appears in the Hotels list.
   - Attempt to access `/partner-onboarding` directly – should redirect to 404 or show unauthorized.
4. **Security Rule Test** – Use Firebase emulator to attempt a write to `partners` collection as a non‑admin user.
   - Expect permission denied error.
   - Perform the same write as an admin – expect success.
5. **Documentation Review** – Verify updated README and overview reflect the new flow.

## Test Execution Commands
- Unit tests: `npm run test -- src/pages/dashboard/adminDashboard/ourPartners/hotels/`
- Integration/E2E (if using Cypress): `npm run cypress:run --spec "cypress/integration/admin/**"`
- Firebase emulator security rules test: `firebase emulators:exec "npm run test:rules"`

## Acceptance Criteria
- No partner onboarding links appear in the UI.
- Add Hotel form does not contain password, payment, or license fields.
- Admin can successfully create a hotel.
- Non‑admin users cannot create or modify partner accounts.
- All tests pass.
- Documentation updated.
