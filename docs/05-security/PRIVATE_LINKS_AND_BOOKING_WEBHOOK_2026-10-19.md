# Private links and booking webhook - 19 October 2026

## Retained private files

**Final production verification passed:** all 267 retained objects remain present. All 69 classified private/chat objects deny anonymous HEAD and GET requests and have zero permanent tokens. All 198 other retained token links still return 200; all 146 previously public anonymous reads outside the private set still return 200. No request errors were recorded. Detailed final evidence: `D:/projects/Thaiseva-Firebase-Security/retained-final-verification-2026-10-19.json`.

The 65 remaining reviewed objects have permanent Firebase download tokens revoked and operator-controlled private-file metadata. The earlier four driver licence objects remain protected separately. All files were preserved; no customer, order, booking, message or account was erased.

- 52 original chat attachments have verified protected copies in the existing support V2 system. The check matched the original message identity and the migrated attachment/message relationship, then compared object size and CRC32C. Migrated copies have no permanent tokens. The existing authorized chat download remains the reader, including its existing short-lived authenticated download mechanism for large historical files.
- 11 legacy T2T identity objects and two historical chat-directory images are retained without bearer access. No active reader for the T2T records was found in the checked local applications. The historical directory is not the current V2 chat reader.
- An operator-created `retainedPrivateFiles` registry supports the Admin-only `getRetainedPrivateFile` API for supported bounded previews. The client supplies an opaque registry ID, never a file path. Current protected Admin privilege, account revocation/disabled state, suspension, registry state and matching server-set object metadata are checked. Non-Admin callers cannot read these archived originals through this API. Other support users continue through their existing conversation-scoped V2 API.
- Shared Storage rules block direct reads, token lookup and client changes/deletion for the marked upload originals. Legacy T2T/file paths already lack public client read grants. Public media outside this reviewed set was not changed.
- The four immutable legacy root licence filenames are explicitly excluded from the public root-media rule. A production check caught that metadata-based root conditions denied unmarked public objects despite passing emulator tests; the explicit exclusions restore those existing public reads while denying all four licences. New driver documents use the protected owner-scoped upload API rather than root files.
- Anonymous Firebase requests, old-token requests and anonymous GCS requests for every one of the 65 originals were denied after protection. Old direct URLs intentionally stop working. Mobile source and external downloaded copies were unavailable; compatibility of older mobile releases using those URLs is not established.

Validation: 23 shared security tests and 15 erasure/retention integration tests passed, with a successful TypeScript build. Tests cover Admin privilege removal, suspension, forged registry/object relationships, unauthorized direct reads, client mutation, and preservation of public root images. The deployed archive-preview API returned HTTP 401 / UNAUTHENTICATED to an anonymous call. Emulator shutdown warnings occurred after tests passed.

Restricted local evidence: `D:/projects/Thaiseva-Firebase-Security/private-link-plan-2026-10-19.json`, `retained-link-protection-2026-10-19.json`, `retained-file-security-tests.log`, and Admin functions `retained-file-integration-tests.log`. The protection record stores denied-response statuses without token values. Registry records and audit evidence contain operational/personal identifiers and must not be published.

## Booking webhook

The existing booking signing secret was found in the historical public-functions deployment environment. It matched the existing vault secret when tested against the deployed handler, and a real Stripe replay subsequently verified that it belongs to the existing Asia-east2 booking endpoint. No new endpoint, signing secret, provider key or secret version was created.

The booking function now has `STRIPE_WEBHOOK_SECRET` bound to version 1 of `THAISEVA_VAULT_20261015_STRIPE_WEBHOOK_SECRET_1`. Existing Stripe/WhatsApp bindings were preserved, and the empty plaintext signing-secret environment entry was removed. The function is ACTIVE. Preserve this pinned alias binding during future function deployments; the restricted repair script can reconcile the binding without retrieving vault payloads.

Stripe showed the existing **test-mode** booking endpoint as disabled. It was re-enabled after configuration checks. Unsigned requests return 400; a signed harmless unsupported event returns 200. An existing sandbox `checkout.session.expired` event was replayed using Stripe's event-resend API; the exact session's expiry-handler log confirmed provider signature verification and handling. The verification allows one minute of operator/provider clock skew. No new checkout, charge, refund, paid-booking update or customer notification was generated. The Food endpoint remains enabled and its binding was unchanged. This verifies the checked sandbox account, not live-mode payments.

Restricted evidence: `D:/projects/Thaiseva-Firebase-Security/booking-webhook-repair-2026-10-19.json` and `stripe-booking-endpoints-2026-10-19.json`. Secret values were not written to these reports or printed. Existing historical environment copies remain a separate exposure/retention concern.

Provider references: [Stripe webhook endpoint configuration](https://docs.stripe.com/api/webhook_endpoints/update), [official Stripe CLI event-resend implementation](https://github.com/stripe/stripe-cli/blob/master/pkg/cmd/resource/events_resend.go).
