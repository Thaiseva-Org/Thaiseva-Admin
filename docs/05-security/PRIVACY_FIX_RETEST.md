# Privacy fixes and local retest ? 10 October 2026

The active Add Hotel form writes listing and contact fields, not bank or license details. Legacy onboarding code and old HotelDB records require live review.

## Implemented
- Shared CustomerSupport directory is staff-only. Customers use individual documents in the same chats collection.
- One staff role: Admin. Legacy Sub Admin is no longer accepted by updated Firestore/backend controls; customer and partner identities retain their product roles.
- Telegram sends only a generic activity alert and dashboard link. Booking-object log payloads removed.
- ContactMessages, top-level messages, chat arrays and nested chat messages included in retention; missing lifecycle dates go into the administrator review queue. Legal holds preserved.
- Customer deletion removes direct support conversations and shared-directory entries, with a seven-day review deadline for remaining business/external records.
- HTTP auth checks revocation and disabled users; staff callable helpers check active account status. Suspended profiles denied by updated Firestore rules.
- Browser calling-secret management removed; Confidential settings inaccessible to browsers; obsolete browser encryption keys removed locally. Payment secret bindings added; matching local credential log patterns redacted.
- Legacy restaurant form no longer persists passwords.
- Upload implementation and Storage rules intentionally unchanged.

## Before deployment
No deployment, account migration, provider rotation or production deletion performed.

1. Review each existing Sub Admin account and deliberately migrate approved staff to Admin or disable/offboard them. Unchanged Storage rules still recognize legacy Sub Admin, so offboarding/migration is necessary.
2. Provision STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in Firebase Secret Manager for the selected codebase. Do not upload secret values in tickets or logs. Resolve overlapping function names between the two projects before deployment.
3. Rotate Stripe test secrets found in historical logs and calling/WhatsApp credentials if exposure is confirmed. Do not assume log redaction invalidates a key.
4. Review legacy HotelDB, restaurant password fields, historical logs and exports. Existing calling secrets need server-side migration and revocation; this change disables browser management rather than implementing a provider-specific token service.
5. Review retention in dry-run mode, lifecycle dates, legal holds and backlog. Retention is paginated; completion depends on dataset size and successful scheduled runs.
6. External analytics, Telegram history, exports, backups and partner offboarding remain operational work. Customer erasure remains pending until those copies and legally retained records are reviewed. Do not promise full deletion based only on profile removal.

## Retest
Admin backend TypeScript compilation and dashboard production build pass. Admin unit tests: 27 pass. Website function tests: 44 pass. Five emulator privacy integration tests pass. Emulator results are recorded in functions/privacy-emulator-retest.log; uses demo-thaiseva-otp only.
