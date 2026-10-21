# Privacy patch: client migration and verification

> Owner update, 21 October: mobile-side checks confirmed complete. This records the owner's confirmation; the mobile tests were not independently repeated in this workspace.

21 October 2026. Shared production rules now restrict private raw records. This change supersedes the older exception that allowed ordinary customers to read full restaurant and legacy partner records.

## Client replacements

| Previous access | Supported replacement |
| --- | --- |
| Customer reads/listens to raw `restaurants` | GET `https://asia-southeast1-gothai-ffea1.cloudfunctions.net/listOrderableRestaurantsHttp`. Read `data.restaurants` from the `{ok,data}` response. It publishes only approved catalog fields; no customer authentication is required for this catalog. Handle rate limiting and safe empty/error states. |
| Customer reads `T2T_world/{category}/Users` | Signed-in Firestore read of `publicPartnerDirectory/{category}/partners`. Fields are `Registered Business`, `City`, `Country` when present. Identity, alternate contacts, personal names and account data are absent. Owners can still get their own raw record; Admin can manage raw records. |
| Public list of mixed `self_drive_conditions_and_documents` | Read `publicSelfDriveConditions`. It contains only conditions-only sources. The old conditions-only document remains available by direct get, but public collection queries are denied. Private submissions remain available to the actual `userId` owner and Admin. Never fall back to a public read of submissions. |
| Direct Storage upload under `users/{uid}/passports` or `licences` | Callable `uploadIdentityDocument` in `asia-east2`, with `{kind:'passport'|'licence',contentType,contentBase64}`. It returns `{path}`. Use the returned storage path in booking payloads; never generate or store a permanent download URL. JPG, PNG, WebP and PDF are supported, up to 8 MiB, with file signature validation. |
| Direct identity link in a booking | Callable `getIdentityDocument` in `asia-east2`, with `{path}`. The response is `{contentBase64,contentType,expiresInSeconds}` for the owner/current authorized Admin. Render with a temporary local blob URL and revoke it when leaving/expiring. Existing same-project old URLs are parsed as references, not used as bearer links. Driver-specific flows keep `uploadDriverDocument` / `getDriverDocument`. |
| New uploads to old `chat`, `chats`, `chatMedia` folders | Current customer support V2 or partner-chat APIs. Legacy direct writes are denied. Existing protected support copies remain intact and accessible through their participant-checked API. Do not introduce `getDownloadURL` fallbacks. |
| Retained original chat token URLs | Read the corresponding V2 attachment through `customerChat`; privileged archive access uses the existing `getRetainedPrivateFile` registry. Do not restore original tokens. |

Current-role checks mean disabled, suspended, revoked and demoted Food accounts can lose access immediately. Claim changes invalidate sessions; handle reauthentication and refresh claims instead of retrying with old privileges.

The old `finalizePublicUpload` callable now requires authentication and authorized document ownership/master access. Current anonymous onboarding uses `uploadPublicApplicationContent`, stores its returned private path and previews the user's local selected file; it does not use legacy finalization. A leaked application ID/file path must never be used as authorization to issue a new read link.

## Required released-client verification

Use controlled accounts A/B and synthetic files. Confirm restaurant catalog, partner directory, public rental conditions, self-drive upload/submission/document preview, customer support attachments and partner support still work. B and signed-out sessions must be denied A's private records and documents. Remove a role, disable/suspend an account and revoke its sessions; privileged APIs must reject its old session. Re-login with a valid active role must work.

The released mobile source is not in this workspace. These interfaces and server controls are implemented; the owner has confirmed the mobile-side checks complete. Historical versions using blocked raw access or legacy direct uploads need the migrated interfaces above.
