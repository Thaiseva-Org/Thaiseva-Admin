# Thaiseva chat release - 19 October 2026

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

The customer V2 chat and legacy customer store remain independent. After the initial release, production history was migrated and independently verified; see [the migration report](CHAT_MIGRATION_2026-10-19.md). The admin keeps an explicit previous-system link during app cutover.

Food partner legacy message arrays remain available through the API, with new messages written to individual child records. The new API does not dual-write to the old array. Old food builds that write directly to Firestore need a refresh after the rules release.

Both chat screens use visible-screen polling. Food partner chat covers text messaging and read state; media/search enhancements in the general customer channel are not implicitly added to food chat.

## Category restoration follow-up

Admin hosting and `customerChat` were updated on 19 October to restore centered **Chatting in Visa**-style history entries and the latest category in the conversation header. Category changes append history through the authenticated API; repeated selections do not duplicate it. Legacy category headings also synchronize during normal message polling. This limited compatibility does not synchronize ordinary messages or files.

Validation for this follow-up: 2 frontend category tests and 18 customer-chat emulator integration tests passed, along with backend and frontend builds. Read-only production reconciliation found 275 original headings and 275 migrated headings. Live hosting served the expected bundle and anonymous category calls returned HTTP 401. See [the detailed restoration record](05-security/CHAT_CATEGORY_RESTORATION_2026-10-19.md) and [API contract](CUSTOMER_CHAT_APP_API.md#chat-topic-categories-restored-19-october-2026). These checks do not close the remaining broader privacy findings.

## Rollback

Restore the preceding hosting release if necessary, but retain the new message records. A rollback to direct-write food builds requires a separately reviewed compatibility decision; do not restore broad writes as a routine rollback. Do not remove indexes or purge V2 data when rolling back UI code.
