# Customer support category headings — 19 October 2026

The current support inbox again displays centred `Chatting in Visa` / `Chatting in Work Permit` entries, matching the previous chat renderer. It recognizes both migrated `legacyType: "heading"` records and new `type: "heading"` events. Ordinary text containing a category name remains an ordinary message. The conversation header displays the latest category, independently of which history page is loaded. Other customers' global-search results cannot supply that header label.

The existing `customerChat` API now supports:

```json
{"action":"category","category":"Visa","requestId":"unique-client-request-id"}
```

`setCategory` is an alias. Existing clients can also submit `{"action":"send","type":"heading","text":"Visa","requestId":"unique-client-request-id"}`. Opening a chat can supply an optional `category`; regular message/media filters continue using their existing `media`, `documents` and `links` categories independently.

Category transitions are server-created, retain historical entries, update the current category and create one new entry for an actual change. Repeated requests for an already-recorded change do not reset a newer category, and selecting the current category does not add another heading. Reusing a recorded request ID for a different category is rejected. Existing customer/Admin authorization and retention holds apply. Category labels do not grant permissions or change retention. Heading history cannot be edited/deleted through the normal message mutation API.

Compatibility: the inbox opens the selected conversation to restore its previous category where needed. Reading the main message timeline also reconciles valid legacy heading entries from that customer's `chats/{uid}_CustomerSupport` record. It uses the migration's stable message IDs, preserves original dates and does not alter or remove the source array. This allows category changes still appended by the previous mobile chat format to appear in the new inbox on its normal polling cycle. It syncs category headings only; it is not a general replacement for mobile integration with the support V2 API. Existing migrated message records are not rewritten.

A read-only production count found 275 original category entries and 275 migrated heading entries. Parent holds prevent compatibility imports, and newly imported headings preserve individual message holds. Live hosting verification matched the current build and an anonymous category change returned HTTP 401; no real customer's category was changed as a production test. The final callable deployment, including the hold checks, is recorded in `category-restore-final-deploy.log`.

Validation: two frontend category-selection tests and all 18 customer support integration tests passed. Integration tests include category retries, changed-content conflicts, repeated category suppression, legacy append reconciliation, current-category restoration, foreign-customer denial and hold/history protection, alongside the existing booking, attachment, retention and erasure scenarios. Frontend and backend builds passed; the frontend retains its existing large-bundle warning. No production customer category was changed merely as a test.

Deploy scope: the Admin hosting site and the `customerChat` callable only. Deployment evidence: `category-restore-deploy.log` in the Admin workspace; test/build evidence uses `category-*` log names. The earlier privacy findings are outside this presentation/history restoration.
