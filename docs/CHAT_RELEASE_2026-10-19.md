# Thaiseva chat release — 19 October 2026

Project: `gothai-ffea1`.

## Released components

- Admin portal: https://gothai-admin.web.app/dashboard/customer-chat
- Customer app API: `customerChat` in `asia-east2`.
- Hourly `cleanupCustomerChatAttachments` and updated `deleteUserFunction` in `asia-east2`.
- Food partner/master web screens: https://gothai-food.web.app
- Food callable: `foodPartnerChat` in `asia-southeast1` (food-portal codebase).
- Nine customer-chat indexes added; the previous 37 production indexes and three TTL field configurations are preserved.
- Shared rules restrict food partner conversation mutations to the backend API. Other deployed rule blocks are preserved from the pre-release production snapshot.

The canonical shared policy remains in `D:/projects/Thaiseva-Firebase-Security`. Reviewed snapshots are stored in `deployment/shared-security`. App hosting configurations cannot deploy independent shared policies.

## Validation

- Customer-chat validation: 4 unit, 12 emulator integration and 36 existing regression tests passed.
- Food portal: all 148 tests, lint, production build and backend syntax checks passed.
- Food partner chat: 6 emulator integration tests passed, including current-role checks, tenant isolation, retries, legacy pagination, read races, revoked access and direct-client rule enforcement.
- Shared security: all 21 emulator checks passed, including API-only food partner chat mutations.
- Admin: production build, targeted lint, TypeScript checks and an isolated admin-inbox interaction check passed.
- Live release verification is recorded in `CHAT_RELEASE_2026-10-19.json`; it contains deployment metadata and anonymous access checks only, without credentials or customer messages.

## App integration and compatibility

See [customer API guide](CUSTOMER_CHAT_APP_API.md) and `docs/PARTNER_CHAT_API.md` in the food repository. No mobile UI was created.

The customer V2 chat and legacy customer store remain independent. No production customer-history migration was run. The admin keeps an explicit previous-system link during app cutover.

Food partner legacy message arrays remain available through the API, with new messages written to individual child records. The new API does not dual-write to the old array. Old food builds that write directly to Firestore need a refresh after the rules release.

Both chat screens use visible-screen polling. Food partner chat covers text messaging and read state; media/search enhancements in the general customer channel are not implicitly added to food chat.

## Rollback

Restore the preceding hosting release if necessary, but retain the new message records. A rollback to direct-write food builds requires a separately reviewed compatibility decision; do not restore broad writes as a routine rollback. Do not remove indexes or purge V2 data when rolling back UI code.
