# How to use the Thaiseva OTP API

Base URL: **https://asia-east2-gothai-ffea1.cloudfunctions.net/**
Firebase project: **gothai-ffea1**. Region: **asia-east2**.

Use this guide to add OTP verification to your separate application. For deployment, secrets, storage and security policy, see [System configuration and operations](EMAIL_OTP_SETUP.md).

Only OTP sending, resending and verification are provided. Your separate system handles signup, accounts, login and roles. Any valid email can request an OTP; no existing Firebase account is required. Zoho keys belong only on the API server.

## Quick start

1. Initialize the selected Firebase client in project gothai-ffea1.
2. Initialize Firebase App Check for that client before calling the OTP API.
3. Call sendEmailOtp with the user's email; save challengeId, expiresAt and resendAt.
4. Show the OTP form and a resend countdown. Keep the email tied to this challenge.
5. Call verifyEmailOtp with the same email, latest challengeId and six-character code.
6. On success, use the verified email and temporary proof in your separate system.
7. If a new code is needed, wait until resendAt, call resendEmailOtp and replace the saved challenge with the new result.

Changing the email starts a new flow. Do not reuse a challenge for another address. Calls use App Check, not the Zoho key; no customer login session is required.

## Endpoint reference

| Endpoint | Input data | Successful result |
| --- | --- | --- |
| sendEmailOtp | {email} | {challengeId, expiresAt, resendAt, message} |
| resendEmailOtp | {email, challengeId} | New challengeId, expiresAt, resendAt, message |
| verifyEmailOtp | {email, challengeId, code} | {verified: true, email, verificationToken, expiresAt} |

Times are Unix milliseconds. Codes must be six-character strings, preserving leading zeros. Use the latest challengeId after resend. The code expires in five minutes; resend cooldown is 60 seconds.

## HTTP request examples

All endpoints require a valid Firebase App Check token from the calling application. Firebase callable APIs use a JSON data envelope:

```http
POST https://asia-east2-gothai-ffea1.cloudfunctions.net/sendEmailOtp
Content-Type: application/json
X-Firebase-AppCheck: <App Check token>

{"data":{"email":"customer@example.com"}}
```

Resend body:

```json
{"data":{"email":"customer@example.com","challengeId":"<latest-challenge-id>"}}
```

Verify body:

```json
{"data":{"email":"customer@example.com","challengeId":"<latest-challenge-id>","code":"012345"}}
```

Successful raw responses use {"result":{...}}. Errors use {"error":{"status":"...","message":"...","details":{...}}}. Invalid/expired codes return UNAUTHENTICATED. Quotas return RESOURCE_EXHAUSTED with details.retryAfterSeconds. Delivery failure returns UNAVAILABLE.

### Response examples

These are illustrative values, not active challenges or codes. HTTP success has a result envelope; the Firebase SDK exposes that object as response.data.

Send/resend:

```json
{
  "result": {
    "challengeId": "1aee7c15-27e0-42ce-8ad2-ac57f7691674",
    "expiresAt": 1791194700000,
    "resendAt": 1791194460000,
    "message": "An email verification code has been sent."
  }
}
```

Verify:

```json
{
  "result": {
    "verified": true,
    "email": "customer@example.com",
    "verificationToken": "<opaque-43-character-token>",
    "expiresAt": 1791195000000
  }
}
```

The verification response's expiresAt belongs to the ten-minute proof, not the original five-minute OTP. Neither response includes a login token.

### Postman or cURL

Obtain an actual App Check token from the configured client. An API key, package name or ordinary Firebase ID token cannot substitute for App Check. Example for Bash:

```bash
curl --request POST \
  'https://asia-east2-gothai-ffea1.cloudfunctions.net/verifyEmailOtp' \
  --header 'Content-Type: application/json' \
  --header 'X-Firebase-AppCheck: <actual-client-App-Check-token>' \
  --data '{"data":{"email":"customer@example.com","challengeId":"<latest-id>","code":"012345"}}'
```

In Postman, select POST, set the same headers, and use Body ? raw ? JSON. Use an App Check debug provider and registered debug token for local development; keep debug credentials out of production. [Callable wire protocol](https://firebase.google.com/docs/functions/callable-reference).

## Web integration

In the consuming web project, install the Firebase SDK if it is not already present:

```sh
npm install firebase
```

Initialize your existing Firebase app once in this project, then initialize App Check:

```javascript
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";
import { getFunctions, httpsCallable } from "firebase/functions";

initializeAppCheck(app, {
  provider: new ReCaptchaEnterpriseProvider("6LcWPHotAAAAACfAvmhyrUMFTkgKXgfnyIKtSI2y"),
  isTokenAutoRefreshEnabled: true,
});
const functions = getFunctions(app, "asia-east2");
const sendOtp = httpsCallable(functions, "sendEmailOtp");
const resendOtp = httpsCallable(functions, "resendEmailOtp");
const verifyOtp = httpsCallable(functions, "verifyEmailOtp");

const { data: challenge } = await sendOtp({ email });
// Obtain code from the user.
const { data: result } = await verifyOtp({
  email, challengeId: challenge.challengeId, code,
});
// result.verified and result.email confirm the OTP check.
// Your separate application handles its next step.
```

Resend after the server-provided cooldown:

```javascript
if (Date.now() >= challenge.resendAt) {
  const { data: replacement } = await resendOtp({
    email, challengeId: challenge.challengeId,
  });
  // Save replacement.challengeId, expiresAt and resendAt in your form state.
}
```

The SDK attaches App Check automatically. Supported web domains: **thaiseva.com** and **food.thaiseva.com**. Public site key: **6LcWPHotAAAAACfAvmhyrUMFTkgKXgfnyIKtSI2y**.

| Existing web app | Firebase app ID |
| --- | --- |
| thai-go | 1:46959975552:web:5e9c3d90c5ecb4a3dc9a65 |
| thaigo | 1:46959975552:web:fd6de57bdf0dc2f5dc9a65 |
| gothai-foodporatal | 1:46959975552:web:e596237265563a74dc9a65 |

[Firebase App Check initialization](https://firebase.google.com/docs/app-check/web/recaptcha-enterprise-provider). Selected mobile app configurations and integration steps are below.

## Mobile apps

| Platform | Package / bundle ID | Firebase app ID | Provider |
| --- | --- | --- | --- |
| Android customer | com.app.thaiseva | 1:46959975552:android:5df084209b3a3eabdc9a65 | Play Integrity |
| Android partner | com.thaiseva.partners | 1:46959975552:android:ca885237ab5a06d4dc9a65 | Play Integrity |
| iOS customer | com.thaiseva.ios | 1:46959975552:ios:34c5a2f32c2138fadc9a65 | App Attest |

The three provider configurations have a one-hour App Check token TTL. Both selected Android apps have SHA-256 fingerprints registered. Confirm each registered fingerprint matches the certificate signing the distributed release; for Google Play builds use the Play App Signing certificate, which may differ from the upload certificate. Link gothai-ffea1 in each app's Google Play Console Play Integrity settings. [Android provider setup](https://firebase.google.com/docs/app-check/android/play-integrity-provider).

**iOS remaining prerequisite:** Firebase has no Apple Developer Team ID for com.thaiseva.ios. Register the app owner's actual Team ID before production attestation. App Attest configuration alone does not establish working device attestation. [Team ID requirement](https://firebase.google.com/docs/reference/appcheck/rest/v1/projects.apps.appAttestConfig).

In the iOS project, enable the App Attest capability and set the App Attest environment entitlement to production. Use a supported physical device for production testing. App Attest requires iOS 14+; older-device fallback requires separately configuring DeviceCheck, which has not been configured here. [Apple provider setup](https://firebase.google.com/docs/app-check/ios/app-attest-provider).

### Flutter consuming app example

This repository is the API/admin web project and contains no mobile source. Add these dependencies in each actual mobile project:

```sh
flutter pub add firebase_core firebase_app_check cloud_functions
```

Use the selected app's existing google-services.json / GoogleService-Info.plist or corresponding generated FirebaseOptions. Confirm the project is gothai-ffea1 and the app ID matches the table above.

After Firebase.initializeApp() and before making Functions requests:

```dart
import 'package:firebase_app_check/firebase_app_check.dart';
import 'mobile_email_otp.dart'; // Copy the wrapper into your mobile project.

// Run inside your existing async initialization after Firebase.initializeApp().
await FirebaseAppCheck.instance.activate(
  androidProvider: AndroidProvider.playIntegrity,
  appleProvider: AppleProvider.appAttest,
);
final otp = EmailOtpApi();
final challenge = await otp.send(email);
final verified = await otp.verify(
  email: email,
  challengeId: challenge['challengeId'] as String,
  code: enteredCode, // Six characters; preserve leading zeros.
);
// Your separate application handles the next step.
```

The reusable API wrapper is [mobile_email_otp.dart](mobile_email_otp.dart). Initialize Firebase once, using your app's existing initialization flow. For Android emulators/iOS simulators use the debug App Check provider in development and register its debug token in Firebase; do not ship a debug provider or token in production. [Flutter initialization](https://firebase.google.com/docs/app-check/flutter/default-providers).

The Firebase Functions SDK attaches App Check tokens automatically. The region is asia-east2. All three mobile apps use the same sendEmailOtp, resendEmailOtp and verifyEmailOtp endpoints. Client deployment and real-device attestation testing remain in the separate mobile projects.

## Proof for your separate backend

Verification also returns a random 256-bit verificationToken expiring in ten minutes. Store it in memory and never log it. OTP verification itself consumes the code exactly once; it does not create or change any Firebase account.

If your separate trusted backend needs evidence before signup, do not trust a frontend verified boolean. Using Firebase Admin and server-only OTP_HASH_KEY access, compute HMAC-SHA256 over JSON.stringify(["signup-proof", verificationToken]) to find emailOtpVerificationProofs/{hash}. In a Firestore transaction, require the record to exist, expiresAt > current server time, consumedBy === null, and emailHash to equal HMAC-SHA256 over JSON.stringify(["signup-email", normalizedEmail]). Atomically set consumedBy to your operation ID to claim the proof. The separate backend owns signup and retry behavior. Never expose this secret or grant client access to the proof collection.

See [security and deployment setup](EMAIL_OTP_SETUP.md).

## Errors and UI behavior

| HTTP / callable status | Typical cause | Client behavior |
| --- | --- | --- |
| 400 / INVALID_ARGUMENT | Invalid email, numeric code or malformed challenge input | Fix the input; preserve the OTP as a string |
| 401 / UNAUTHENTICATED | Missing/invalid App Check, wrong code, expired/consumed code or stale challenge | Check App Check first; for code errors ask for the latest code or request a new one |
| 429 / RESOURCE_EXHAUSTED | Cooldown, email/IP/project quota or lockout | Wait for details.retryAfterSeconds; disable repeated attempts |
| 503 / UNAVAILABLE | Zoho delivery did not confirm acceptance | Show delivery failure; respect cooldown before requesting again |
| 400 / FAILED_PRECONDITION | Server mail/security configuration incomplete | Contact the API operator |
| 500 / INTERNAL | Unexpected server failure | Show a retry message; investigate logs if repeated |

SDK error codes are lower-case, such as functions/resource-exhausted on web and resource-exhausted in Flutter.

Web error example:

```javascript
try {
  await verifyOtp({ email, challengeId, code });
} catch (error) {
  if (error.code === "functions/resource-exhausted") {
    const seconds = error.details?.retryAfterSeconds;
    // Show the returned wait time when present.
  }
  // Show error.message without logging codes or tokens.
}
```

Flutter error example:

```dart
try {
  await otp.verify(email: email, challengeId: challengeId, code: enteredCode);
} on FirebaseFunctionsException catch (error) {
  // error.code, error.message, and error.details describe the failure.
  // For resource-exhausted, respect details['retryAfterSeconds'] when present.
}
```

Disable buttons while requests are pending. Display resendAt as a countdown, but treat server enforcement as authoritative. Keep the latest challenge and proof in memory. Five wrong code guesses lock the email for 15 minutes; requesting another code does not bypass that lock. Resending within the rate window preserves the attempt count.

A successful OTP verification consumes the code. If the success response is lost, retrying that code will fail; obtain a new code after the cooldown. Do not automatically loop verification or email requests.

## Integration checks

- Confirm a real email arrives with the Thaiseva logo and a six-digit code.
- Verify the code using the returned challengeId.
- Attempt verification again and confirm replay rejection.
- Request a resend before the cooldown and confirm it is rejected.
- After the cooldown, resend; the previous challenge fails and the new one succeeds.
- Leave an unused code for five minutes and confirm expiry.
- Verify mobile calls on physical devices with the production App Check provider.
- Complete iOS setup by registering the actual Apple Developer Team ID before expecting App Attest to work.

Use the isolated emulator tests for repeated lockout, failure and concurrency checks; do not generate unnecessary production email. The deployed API has automated and synthetic live verification checks; mobile real-device attestation still needs validation in the consuming apps.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| All calls fail with unauthenticated before requesting a code | App Check initialization, correct Firebase app/project, token validity and provider setup |
| Android works locally but not from Google Play | Release SHA-256 versus Play App Signing certificate, plus Play Integrity Cloud project linkage |
| iOS production App Check fails | Apple Team ID, App Attest capability, production entitlement and supported physical device |
| Calls return not-found | Project gothai-ffea1, region asia-east2 and exact function names |
| OTP email is missing | Spam folder, Zoho delivery/bounce status, sender/domain approval |
| Latest visible code fails | Most recent challengeId, unchanged email, five-minute expiry and retry lockout |

No signup endpoint is part of this API. [System configuration](EMAIL_OTP_SETUP.md) contains the operator setup and deployment commands.
