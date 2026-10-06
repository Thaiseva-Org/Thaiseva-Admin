# Thaiseva OTP system ? configuration and operations

> [!NOTE]
> **Consolidated Specification:** This email OTP architecture and security policy have been unified into **[Third-Party Integrations Guide (Section 3: Zoho ZeptoMail)](../docs/03-api/THIRD_PARTY_INTEGRATIONS.md)**, **[Security & RBAC Architecture](../docs/05-security/SECURITY_AND_RBAC.md)**, and **[Firestore Data Architecture & Schema Dictionary](../docs/04-data/DATA_SCHEMA_DICTIONARY.md)**.

This document describes the deployed email OTP service. For step-by-step usage, see [How to use the OTP API](EMAIL_OTP_API.md).

The service sends, resends and verifies email codes. `verifyEmailOtp` creates no account, changes no Firebase Auth user and assigns no role. The optional `createVerifiedAccount` callable consumes its proof to create an email-verified Firebase Auth account; the consuming application handles login and roles. An existing account is not required.

Configuration status recorded on **5 October 2026**:

| Item | Configuration / status |
| --- | --- |
| Firebase project | gothai-ffea1 (project number 46959975552) |
| Runtime / region | Node.js 22 / asia-east2 |
| Callable endpoints | sendEmailOtp, resendEmailOtp, verifyEmailOtp |
| API base URL | https://asia-east2-gothai-ffea1.cloudfunctions.net/ |
| Sender | no-reply@thaiseva.com |
| Web domains | thaiseva.com, food.thaiseva.com |
| Android apps | com.app.thaiseva, com.thaiseva.partners ? Play Integrity configuration saved |
| iOS app | com.thaiseva.ios ? App Attest configuration saved; Apple Team ID missing |
| Mobile release integration | App Check initialization and physical-device testing required in the separate mobile projects |

## How the system works

1. The calling application supplies a valid Firebase App Check token.
2. Send checks IP, project and email quotas, generates a cryptographic six-digit code, and reserves a hashed challenge in Firestore.
3. Zoho accepts the branded email; the server marks the challenge as sent. Failed delivery clears the code hash while retaining abuse counters.
4. Resend generates a new code and challenge after the cooldown; the old challenge stops working.
5. Verify compares the submitted code against its hash and checks expiry, delivery status and lockout.
6. A Firestore transaction consumes a matching OTP and creates a ten-minute verification proof. Only one concurrent verification can succeed.
7. The separate trusted backend may consume that proof before performing its own account workflow, or the client can call `createVerifiedAccount` for Firebase email/password signup.

On **6 October 2026**, `createVerifiedAccount` was deployed in `gothai-ffea1`, region `asia-east2`. Its live preflight returned HTTP 204 with `Access-Control-Allow-Origin: https://thaiseva.com`; a call without App Check returned HTTP 401 with CORS headers. Unit and emulator tests cover proof binding, expiry, concurrent signup retries and existing-account protection. Live account creation with a production App Check token remains a consuming-app check.

The Admin Portal retains its existing login form. App Check enforcement on these endpoints validates project-issued app tokens; there is no additional per-app allowlist in the OTP handlers. Registering these selected clients does not make them the only Firebase project apps permitted to call the API.

## Security policy

| Protection | Value |
| --- | --- |
| Code | Cryptographically generated six-digit string |
| Code expiry | Five minutes |
| Resend cooldown | 60 seconds |
| Per-email sends | Five per fixed 15-minute window, including failed deliveries |
| Wrong guesses | Five; resend preserves attempts in the window |
| Lockout | 15 minutes after the fifth wrong guess, including sends |
| IP limits | 20 sends and 50 verification calls per 15 minutes |
| Project limits | 500 sends and 2,000 verification calls per 15 minutes |
| Signup proof | Random 256-bit token; ten-minute expiry; bound to the verified email |
| Replay protection | Transactionally consume OTP and create proof; separate backend consumes the proof |
| Storage | HMAC-SHA256 hashes; no plaintext OTP, email or proof token in OTP records |
| Client protection | Firebase App Check required on every endpoint |
| Cleanup | Server-only collections with deleteAfter TTL after 24 hours |

Expiry is checked by the API and does not rely on TTL deletion timing. Shared IPs share quotas. Global counters use shared transactional documents; replace them with a distributed limiter if traffic requires substantially higher limits.

## Server-only records

| Collection | Document identifier | Stored data |
| --- | --- | --- |
| emailOtpChallenges | HMAC of the normalized email and purpose | Code hash, challenge ID, send/attempt counters, expiry, delivery state, lockout |
| emailOtpRateLimits | HMAC of action and runtime IP; shared global action keys | Fixed-window counts and timestamps |
| emailOtpVerificationProofs | HMAC of the returned random proof token | Email hash, ten-minute expiry, consumedBy initially null |

Each record carries deleteAfter for TTL cleanup. Client reads and writes are denied, including for admins. Only trusted server code using Firebase Admin accesses these records. Email normalization trims whitespace and lowercases the address. OTP and proof hashes are bound to distinct purpose strings to prevent reuse across flows.

## Provider and secrets

The configured sender is **no-reply@thaiseva.com**, through **https://cpaas.zoho.com/v1.1/email**, using agent alias **3779082508d3a456**. The agent is derived from the API key; the alias is not sent in the payload. [Zoho API contract](https://www.zoho.com/cpaas/help/api/email-sending.html).

Non-secret configuration in functions/.env:

```dotenv
ZOHO_MAIL_API_URL=https://cpaas.zoho.com/v1.1/email
OTP_BUSINESS_DOMAIN=thaiseva.com
OTP_FROM_EMAIL=no-reply@thaiseva.com
OTP_SENDER_NAME=Thaiseva
OTP_REPLY_TO_EMAIL=
OTP_ENFORCE_APP_CHECK=true
```

Secret Manager holds ZOHO_MAIL_API_KEY and OTP_HASH_KEY. The latter must be random and at least 32 characters. All three functions bind both secrets. Runtime service account 46959975552-compute@developer.gserviceaccount.com has Secret Accessor directly on the two secrets. Secrets must never go into frontend variables or source control. Rotating OTP_HASH_KEY invalidates outstanding challenges and proofs; redeploy functions after rotating secrets.

Zoho accepted live delivery tests to harish@thaiseva.com and the requested saurabhp0402@gmail.com with HTTP 201. Provider acceptance does not establish inbox placement. Check received DKIM/DMARC headers and Zoho delivery status. Publish exact domain records supplied by Zoho; do not add duplicate SPF policies. [Zoho domain setup](https://www.zoho.com/zeptomail/help/domains.html).

## Web and mobile clients

Production web domains: **thaiseva.com** and **food.thaiseva.com**. Existing thai-go, thaigo and gothai-foodporatal Firebase web apps use Enterprise site key **6LcWPHotAAAAACfAvmhyrUMFTkgKXgfnyIKtSI2y**. Initialize App Check in the consuming website, as shown in the API guide. These public identifiers are not API secrets.

Selected mobile clients are Android com.app.thaiseva and com.thaiseva.partners, plus iOS com.thaiseva.ios. Play Integrity and App Attest configurations use one-hour tokens. Android SHA-256 fingerprints are present; verify release signing matches them. The iOS Apple Developer Team ID is missing and must be supplied before App Attest validation can succeed. The separate mobile projects must initialize App Check and be tested on real devices; see the API guide. Do not disable backend App Check. [Firebase web App Check](https://firebase.google.com/docs/app-check/web/recaptcha-enterprise-provider).

## Testing and deployment

```powershell
npm --prefix functions test
npm --prefix functions run test:otp:integration
npm --prefix functions run build
firebase deploy --project gothai-ffea1 --only "functions:sendEmailOtp,functions:resendEmailOtp,functions:verifyEmailOtp"
firebase deploy --project gothai-ffea1 --only "firestore:rules"
```

Integration tests require Java and Firebase CLI and run only in the isolated demo-thaiseva-otp Auth/Firestore emulators, with mocked Zoho. They cover signup without an existing account, concurrent verification, proof storage, code expiry, resend, lockout, delivery failure and denied client collection access. They do not establish live email delivery or production attestation.

Node.js 22 functions run in asia-east2. Explicit rules deny all client access to emailOtpChallenges, emailOtpRateLimits and emailOtpVerificationProofs. The deleteAfter TTL policies are also declared in firestore.indexes.json; review unrelated indexes before deploying the whole index file. No hosting deployment is needed to integrate the API elsewhere.

Verification returns the verified email and a ten-minute proof. It creates or changes no account, profile, role or login session. Your separate trusted backend can consume the proof as described in the API guide.

## Email template and logo

- [Template source](../functions/src/otp/zoho.ts): table-based HTML with inline styles and a plain-text alternative.
- [HTML preview](otp-email-preview.html): contains an illustrative code, not a valid OTP.
- [Official logo asset](../public/email/thaiseva-logo.jpg): publicly hosted at https://gothai-admin.web.app/email/thaiseva-logo.jpg.
- Brand colors: navy and orange; content includes expiry, latest-code guidance and a privacy reminder.

Email clients may block remote images until the recipient allows them; the logo has a brand-name alt fallback and the OTP remains readable. Updating the template requires rebuilding and deploying the OTP functions. Updating the hosted logo requires a frontend build and Hosting deployment. Hosting is otherwise independent of OTP API integration.

Live production checks passed for all three endpoints requiring App Check, send/resend cooldowns, incorrect-code rejection, concurrent one-use verification, hashed proof storage and code replay rejection. Temporary smoke-test records and debug tokens were removed. Live verification used a synthetic challenge; Zoho delivery was tested separately.

## Maintenance

Use the authenticated Firebase CLI from this repository root. Store credentials via Secret Manager prompts:

```powershell
firebase functions:secrets:set ZOHO_MAIL_API_KEY --project gothai-ffea1
firebase functions:secrets:set OTP_HASH_KEY --project gothai-ffea1
```

After rotating `OTP_HASH_KEY`, redeploy all three OTP functions and `createVerifiedAccount` together so they use the same secret version. After rotating `ZOHO_MAIL_API_KEY`, redeploy the three OTP functions. Preserve the runtime's Secret Accessor binding on the required secrets. The OTP service does not need Firebase custom-token signing permissions.

To build, test and deploy only the signup endpoint from this repository root:

```powershell
npm --prefix functions test
npm --prefix functions run test:otp:integration
firebase deploy --only functions:createVerifiedAccount --project gothai-ffea1
```

`npm test` builds the TypeScript entry point before testing; rebuild before deploying source changes because Firebase uses `functions/lib/index.js`. The signup endpoint binds the existing `OTP_HASH_KEY`, explicitly allows browser CORS preflight and public invocation, and always enforces App Check. Public invocation lets preflight reach the callable middleware; it does not bypass proof validation or App Check.

Keep deleteAfter TTL enabled for all three OTP collections. TTL cleanup is asynchronous, so documents can remain after expiry; server checks still reject expired codes and proofs. Changes to mail endpoint, sender, reply-to or brand are server configuration changes. Use a real verified sender and a monitored reply-to if enabling replies.

Review delivery failures in Cloud Logging and Zoho's delivery dashboard. Do not log plaintext OTPs, proof tokens, Zoho keys or App Check tokens. Provider acceptance is separate from inbox delivery.

## Source map

| File | Responsibility |
| --- | --- |
| [emailOtp.ts](../functions/src/emailOtp.ts) | Callable endpoints, App Check, rate limiting and Firestore transactions |
| [verifiedSignup.ts](../functions/src/verifiedSignup.ts) | Verified account creation, transactional proof claims and retry protection |
| [core.ts](../functions/src/otp/core.ts) | OTP generation, hashes, expiry, resend and retry policies |
| [zoho.ts](../functions/src/otp/zoho.ts) | Provider validation, HTML/plain-text template and Zoho delivery |
| [firestore.rules](../firestore.rules) | Denies client access to OTP collections |
| [firestore.indexes.json](../firestore.indexes.json) | TTL field policies |
| [mobile_email_otp.dart](mobile_email_otp.dart) | Example wrapper for the separate Flutter app |

See [the usage guide](EMAIL_OTP_API.md) for examples, errors, UI behavior and the separate backend proof contract.
