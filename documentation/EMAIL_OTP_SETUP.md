# Thaiseva email OTP sign-in

> [!NOTE]
> **Consolidated Specification:** This email OTP architecture and security policy have been unified into **[Third-Party Integrations Guide (Section 3: Zoho ZeptoMail)](file:///d:/projects/Thaiseva-Admin-Portal-Web-App/docs/03-api/THIRD_PARTY_INTEGRATIONS.md)**, **[Security & RBAC Architecture](file:///d:/projects/Thaiseva-Admin-Portal-Web-App/docs/05-security/SECURITY_AND_RBAC.md)**, and **[Firestore Data Architecture & Schema Dictionary](file:///d:/projects/Thaiseva-Admin-Portal-Web-App/docs/04-data/DATA_SCHEMA_DICTIONARY.md)**.

The login page has **Password** and **Email code** options. OTP sign-in uses existing Firebase Auth accounts and the existing `users/{uid}` profile. It does not create accounts or grant roles. This is passwordless sign-in, not mandatory two-factor authentication. Password sign-in remains available.

## Implemented policy

| Protection | Value |
| --- | --- |
| Code | Six digits, generated with Node's cryptographic RNG; leading zeros allowed |
| Expiry | Five minutes, checked by the server |
| Resend cooldown | 60 seconds |
| Sends per email | Five per fixed 15-minute window, including failed deliveries |
| Wrong verification attempts | Five; attempts survive resends within the window |
| Lockout | 15 minutes after the fifth wrong attempt; blocks new codes too |
| IP requests | 20 sends and 50 verifications per 15-minute window |
| Project requests | 500 sends and 2,000 verifications per 15-minute window |
| Replay | Firestore transactions consume a successful code exactly once |
| Storage | HMAC-SHA256 hashes; codes and recipient email are never stored in OTP records |
| Abuse protection | Firebase App Check required by default |
| Cleanup | Firestore TTL on `deleteAfter`, scheduled 24 hours after activity |

The project-wide counters are intentionally conservative for this portal. Increase them in `functions/src/emailOtp.ts` if expected traffic requires it. They use shared transactional documents; at substantially higher volume replace them with an appropriate distributed rate limiter. Shared office IPs share the IP quota. Expiry and quotas do not depend on TTL deletion timing.

OTP sign-in requires an enabled Auth account, an existing `users/{uid}` record with role `Admin`, `Sub Admin`, or `Partner`, `isSuspended` not set to `true`, and status outside `Suspended`, `Blocked`, `Deleted`, or `Rejected`. Existing partner approval gates still apply. Accounts lacking a supported profile receive the same send response as eligible accounts, but no email. Create missing staff profiles through the existing trusted administration workflow.

## Zoho provider and domain

Use a **Zoho transactional email send API key** for ZeptoMail / Zoho CPaaS. A Zoho Mail mailbox OAuth client ID or client secret is a different credential and cannot be substituted. The payload and `Zoho-enczapikey` header follow [Zoho's send-email API](https://www.zoho.com/cpaas/help/api/email-sending.html).

1. Create or select a transactional mail agent in your Zoho account and complete its account approval requirements.
2. Add your business domain (for example, `thaiseva.com`) to that agent.
3. Publish the exact DKIM and return-path CNAME records Zoho supplies, then verify them in Zoho. Existing Zoho Mail mailbox verification does not replace transactional-agent verification. See [Zoho's domain guide](https://www.zoho.com/zeptomail/help/domains.html).
4. Configure the sender, for example `no-reply@thaiseva.com`. This implementation requires the sender's domain to match `OTP_BUSINESS_DOMAIN` exactly. For a sender on a subdomain, configure that full subdomain instead.
5. Keep the current domain SPF policy intact and follow the records shown by your Zoho account. Do not create a second SPF TXT policy. Review DMARC alignment using a received test message before tightening enforcement.
6. Copy the **Send API key** and the email endpoint from your account's API settings. The integration accepts regional `api.zeptomail.*` and `cpaas.zoho.*` HTTPS `/v1.1/email` endpoints; no redirects are followed.

The example sender and reply-to address are placeholders until your verified domain and mailbox are confirmed. DNS records and live provider configuration remain pending until account access is available.

## Server configuration and secrets

Set these non-secret values in `functions/.env` (or `functions/.env.<project-id>` for project-specific deployment):

```dotenv
ZOHO_MAIL_API_URL=https://api.zeptomail.com/v1.1/email
OTP_BUSINESS_DOMAIN=thaiseva.com
OTP_FROM_EMAIL=no-reply@thaiseva.com
OTP_SENDER_NAME=Thaiseva
OTP_REPLY_TO_EMAIL=support@thaiseva.com
OTP_ENFORCE_APP_CHECK=true
```

Choose your own verified sender/domain and the endpoint for your Zoho account region. Reply-to is optional; use an empty value if no monitored support mailbox exists.

Store secrets using Firebase Secret Manager. The CLI prompts for each value, so keys need not appear in shell commands or chat:

```powershell
firebase functions:secrets:set ZOHO_MAIL_API_KEY --project <project-id>
firebase functions:secrets:set OTP_HASH_KEY --project <project-id>
```

For `OTP_HASH_KEY`, generate a random 32-byte or longer secret with a password manager. The server rejects values shorter than 32 characters. Secret Manager bindings are declared on all three OTP functions. See [Firebase secret configuration](https://firebase.google.com/docs/functions/config-env).

Never place these secrets in `VITE_` variables. Changing `OTP_HASH_KEY` invalidates pending challenges and resets the email/IP hash namespace; rotate only as a coordinated deployment. Redeploy the OTP functions after rotating either secret.

## Firebase App Check

1. Register the web app in Firebase App Check with reCAPTCHA Enterprise and allow the portal's production hostname.
2. Put the public Enterprise site key in the frontend `.env`:

   ```dotenv
   VITE_APP_CHECK_SITE_KEY=<public-enterprise-site-key>
   VITE_OTP_USE_EMULATOR=false
   ```

3. Rebuild the frontend. App Check initializes before Functions requests and refreshes tokens automatically.
4. Keep `OTP_ENFORCE_APP_CHECK=true` on deployed functions. Do not disable it to work around missing production configuration. See [Firebase Functions App Check enforcement](https://firebase.google.com/docs/app-check/cloud-functions).

No code is sent when production App Check fails. Functions use `asia-east2`, matching the app's existing Functions region.

## Automated testing

From the repository root:

```powershell
npm --prefix functions test
npm --prefix functions run test:otp:integration
npm run build
npx eslint src/components/EmailOtpLogin.jsx src/services/EmailOtp.js src/firebase/firebase.config.js src/pages/login/Login.jsx --max-warnings 0
```

Integration tests require Java and Firebase CLI. They use the isolated `demo-thaiseva-otp` project with Firestore on port 8188 and Auth on port 9198, and mock Zoho delivery. They refuse to run without emulator environment variables. Tests cover actual transactional races, code replay, Firebase custom-token sign-in, resend invalidation, attempt persistence, account eligibility, expiry, provider failures, IP quotas and Firestore access denial. Integration tests invoke callable handlers directly; they do not validate production reCAPTCHA tokens or real Zoho delivery.

For manual Functions-emulator testing, copy `functions/.secret.local.example` to `functions/.secret.local` and enter real development secrets. Use the Firebase CLI's Functions emulator with local `OTP_ENFORCE_APP_CHECK=false` and frontend `VITE_OTP_USE_EMULATOR=true`. The development UI still uses the app's configured Firebase Auth account unless an Auth emulator is explicitly connected. Do not use a production project for manual tests that you intend to keep isolated.

## Deployment

Live deployment is pending the Zoho key, verified DNS/sender, and production App Check setup. The project currently defaults to `gothai-ffea1`, and Hosting targets the `gothai-admin` site. Check that these are the intended destinations before the commands below.

The backend is configured for Node.js 22 because Node.js 20 has passed its runtime deprecation date. See [Google's runtime support schedule](https://docs.cloud.google.com/functions/docs/runtime-support). The CLI must be signed in, and the Firebase project must have billing and the services required by Functions and Secret Manager enabled.

After configuration and the above tests pass:

```powershell
npm --prefix functions run build
npm run build
firebase deploy --project <project-id> --only functions:sendEmailOtp,functions:resendEmailOtp,functions:verifyEmailOtp
firebase deploy --project <project-id> --only firestore:rules,firestore:indexes
firebase deploy --project <project-id> --only hosting
```

Review the existing Firestore rules and indexes before deploying them: this working tree contains other changes. Only the named OTP functions are deployed by the first command. TTL policy changes are included in `firestore.indexes.json`; if the CLI cannot apply them, enable TTL on `deleteAfter` for `emailOtpChallenges` and `emailOtpRateLimits` in the Firestore console. Default-deny rules already protect the OTP collections; the explicit collection rules document that requirement.

Firebase custom tokens require the Functions runtime service account to be able to sign tokens (`iam.serviceAccounts.signBlob`). If the production verification function reports a signing permission error, configure that permission for the runtime identity on the signing service account, then retry with a new OTP. Emulator token signing does not prove production IAM is configured.

## Live smoke test after keys arrive

1. Sign in to an eligible test account through **Email code** and confirm Zoho delivered the HTML/plain-text email. Check sender, reply-to, DKIM and DMARC in the received message headers.
2. Confirm resend is unavailable for 60 seconds. Resend, then confirm the previous code/challenge fails and the newest code signs into the same UID and existing role.
3. Wait five minutes and confirm an unused code expires.
4. Submit five wrong codes and confirm verification and new send requests are blocked for 15 minutes.
5. Request an OTP for an unknown address and confirm the response stays generic with no account created.
6. Call a production endpoint without valid App Check and confirm rejection.
7. Check Functions logs for delivery errors and Zoho's delivery dashboard for acceptance, bounces and spam placement. Provider acceptance alone does not prove inbox delivery.

## Callable API

Use Firebase's client `httpsCallable` SDK so App Check tokens and callable error handling are attached automatically. Web adapters are in `src/services/EmailOtp.js`; all three calls are also reusable by other Firebase clients.

| Function | Input | Success |
| --- | --- | --- |
| `sendEmailOtp` | `{email}` | `{challengeId, expiresAt, resendAt, message}` |
| `resendEmailOtp` | `{email, challengeId}` | A new challenge with expiry/cooldown timestamps |
| `verifyEmailOtp` | `{email, challengeId, code}` | `{customToken}`; pass to Firebase `signInWithCustomToken` |

Times are Unix milliseconds. Rate-limit errors include `details.retryAfterSeconds`. Codes must be six-character strings, not numbers, to preserve leading zeros. The web client keeps OTPs and returned custom tokens in memory and relies on Firebase Auth for session persistence.

Source email template: `functions/src/otp/zoho.ts`. A static example with a dummy code is at `documentation/otp-email-preview.html`.
