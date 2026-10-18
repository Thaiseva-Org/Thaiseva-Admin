# Production chat migration — 19 October 2026

Migrated and independently reconciled 60 customer support conversations, 960 messages, and 59 attachments in `gothai-ffea1`, with zero failures. See [verification results](CHAT_MIGRATION_2026-10-19.json).

Original conversations and files were preserved. Private source backups and operator logs are outside Git at `C:/Users/rohan/.codex/private-backups/thaiseva-chat-2026-10-19`. Two conversations from other support namespaces were excluded. The food API already reads its five historical partner conversations containing 13 messages.

Copied attachments have no public ACL or permanent download tokens; anonymous access was denied. Historical files larger than 8 MiB use a one-minute, account-specific authenticated Storage grant issued by the chat API. Production checks confirmed authorized downloads, denial for another account, expiry enforcement, deletion revocation, and browser CORS. The new-upload limit remains 8 MiB.

The chat function, Storage rules, and admin hosting were deployed. The Font Awesome CDN stylesheet and font origins are allowed by the deployed admin CSP. The Maps `ERR_BLOCKED_BY_CLIENT` warning comes from client-side blocking.

This migration copies a snapshot. Existing mobile clients must switch to the documented chat API for future messages; the old and V2 stores remain independent. App integration instructions and the Dart service example are in [the API guide](CUSTOMER_CHAT_APP_API.md). No mobile UI was added.

Validation passed: function and frontend builds, targeted lint, 4 unit tests, 14 customer chat integration tests, and 21 shared security tests.
