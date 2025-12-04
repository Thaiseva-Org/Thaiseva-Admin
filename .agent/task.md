# Task Checklist for Adding Hotel Management Enhancements

## Overview
Implement admin‑only hotel creation flow and remove any partner‑account related UI (password, payment, license). Ensure no new partner account can be opened from the dashboard and hide the partnership board.

## Checklist
- [x] **Implement Admin-Only Hotel Creation Flow** <!-- id: 0 -->
    - [x] Modify `AddHotelForm.jsx` to remove partner-account related fields (password, payment, license). <!-- id: 1 -->
    - [x] Update `AddHotelForm.jsx` logic to use default password and skip payment info. <!-- id: 2 -->
    - [x] Hide partnership board/onboarding links in `Dashboard.jsx`. <!-- id: 3 -->
    - [x] Remove/Disable partner onboarding routes in `Route.jsx`. <!-- id: 4 -->
    - [x] Update `firestore.rules` to restrict `partners` collection write access. <!-- id: 5 -->
    - [x] Verify changes (syntax check, code review). <!-- id: 6 -->
    - [x] Refine `AddHotelForm.jsx` (remove warning, restore location fields). <!-- id: 8 -->
    - [x] Fix Admin logout issue (Secondary App). <!-- id: 9 -->
    - [x] Auto-fetch Country from Google Maps. <!-- id: 10 -->
    - [ ] Update documentation (`ADMIN_DASHBOARD_OVERVIEW.md` etc.). <!-- id: 7 -->

**Estimated effort**: ~5‑7 developer days.
