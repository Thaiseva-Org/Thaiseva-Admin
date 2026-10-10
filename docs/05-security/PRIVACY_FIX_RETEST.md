# Privacy fixes, deployment and retest ? 11 October 2026

Both hosting sites, shared Firestore rules and 47 selected functions were deployed. Admin-owned functions run in asia-east2; five website functions also remain in us-central1. No function deletion or live Storage-rule change was made. The removed legacy hotel onboarding is not the active Add Hotel flow.

Implemented: customer-isolated chats and staff-only directory, single Admin staff role, active-account/revoked-token checks, recent authentication for privileged actions, generic Telegram alerts, removal of full booking logs/browser secret management/password persistence in current forms, retention/review queues, scoped customer erasure, public privacy notice and optional analytics consent controls, and admin self-service password settings.

Prior checks: admin unit tests 27, website function tests 44, privacy emulator integration tests 6 and cookie-consent boundary tests 5 passed. Builds and password-change Auth emulator checks passed. Production smoke checks confirmed notices/settings and rejection of unauthenticated checkout requests. These checks do not constitute full live-payment or PDPA certification.

Four additional retention/erasure emulator tests pass, including one that reproduces known legacy coverage defects. Run `npm --prefix functions run test:retention:integration`.

[Historical-data verification](RETENTION_DELETION_VERIFICATION.md) is the current findings record. No customer records were deleted during verification. Next scheduled contact cleanup, historical request resolution, legacy message coverage and lifecycle review remain open. Secrets migration is IAM-blocked, MFA is disabled, payments use test credentials, and vendor/transfer/privacy-request/incident procedures need evidence. [Current privacy guide](DATA_PRIVACY_PDPA.md) separates implemented controls from these outstanding tasks.
