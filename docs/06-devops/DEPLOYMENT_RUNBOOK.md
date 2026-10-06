# DevOps & Deployment Runbook

This runbook defines the standard operating procedures for local development, emulator testing, environment configuration, phased production deployments, and emergency rollbacks across the Thaiseva ecosystem.

---

## 1. Prerequisites & Environment Setup

### 1.1 Required Tooling & Runtimes
- **Node.js:** Node.js `22.x` (LTS) or `24.8.0`
- **npm:** Version `11.6.2`
- **Firebase CLI:** Version `13.x` or higher (`npm install -g firebase-tools`)
- **Git**

### 1.2 Repository Clone & Dependency Installation
```bash
# 1. Clone repository
git clone https://github.com/Thaiseva-Org/Thaiseva-Admin.git
cd Thaiseva-Admin

# 2. Install root frontend dependencies
npm install

# 3. Install backend Cloud Functions dependencies
cd functions
npm install
cd ..
```

---

## 2. Environment Variables & Secret Configuration

Thaiseva strictly segregates client-side build variables from backend cryptographic secrets.

### 2.1 Frontend Build Environment (`.env`)
Create a `.env` file in the project root:
```dotenv
# Firebase Client SDK Configuration
VITE_apiKey=AIzaSyC7fCcIT4XE4BYGQCjlQ7DpToF4J5DpOqk
VITE_authDomain=gothai-admin.firebaseapp.com
VITE_projectId=gothai-admin
VITE_storageBucket=gothai-admin.appspot.com
VITE_messagingSenderId=1234567890
VITE_appId=1:1234567890:web:abcdef123456
VITE_measurementId=G-XXXXXXXXXX

# Optional Firebase App Check (reCAPTCHA Enterprise)
VITE_APP_CHECK_SITE_KEY=6Le...

# Google Maps Platform Key (HTTP Referrer Restricted)
VITE_GOOGLE_MAPS_API_KEY=AIzaSy...
```

> [!TIP]
> The client initialization in `src/firebase/firebase.config.js` checks both camelCase (`VITE_apiKey`) and uppercase (`VITE_FIREBASE_API_KEY`) formats.

### 2.2 Backend Cloud Functions Secrets (Google Secret Manager)
Never place production payment or mail keys in `.env` files committed to source control. Configure secrets via the Firebase CLI:
```bash
# Stripe Payment Credentials
firebase functions:secrets:set STRIPE_SECRET_KEY --project <project-id>
firebase functions:secrets:set STRIPE_WEBHOOK_SECRET --project <project-id>

# Zoho ZeptoMail OTP Credentials
firebase functions:secrets:set ZOHO_MAIL_API_KEY --project <project-id>
firebase functions:secrets:set OTP_HASH_KEY --project <project-id>
```

Non-secret runtime settings reside in `functions/.env`:
```dotenv
ZOHO_MAIL_API_URL=https://api.zeptomail.com/v1.1/email
OTP_BUSINESS_DOMAIN=thaiseva.com
OTP_FROM_EMAIL=no-reply@thaiseva.com
OTP_SENDER_NAME=Thaiseva
OTP_ENFORCE_APP_CHECK=true
STRIPE_SUCCESS_URL=https://thaiseva.com/booking/success?session_id={CHECKOUT_SESSION_ID}
STRIPE_CANCEL_URL=https://thaiseva.com/booking/cancel
```

---

## 3. Local Development with Firebase Emulators

The repository supports offline local development using the **Firebase Local Emulator Suite**, preventing accidental writes to production databases.

```mermaid
flowchart LR
    Dev["Developer Browser<br/>http://localhost:5173"] --> Vite["Vite Dev Server"]
    Vite --> ClientSDK["Firebase Client SDK"]
    ClientSDK --> AuthEmu["Auth Emulator<br/>:9198 / :9099"]
    ClientSDK --> DBMu["Firestore Emulator<br/>:8188 / :8080"]
    ClientSDK --> FnEmu["Functions Emulator<br/>:5001"]
    FnEmu --> DBMu
    EmuUI["Emulator GUI<br/>http://localhost:4000"] -.-> DBMu
```

### 3.1 Launching the Dev Stack
```bash
# Terminal 1: Launch Firebase Emulators
firebase emulators:start --only auth,firestore,functions

# Terminal 2: Launch Vite Frontend Dev Server
npm run dev
```
- Frontend application runs at: `http://localhost:5173`
- Firebase Emulator interactive GUI runs at: `http://localhost:4000`

### 3.2 Running Automated Emulator Integration Tests
To execute backend integration tests against dedicated emulator configs (e.g. OTP verification flow):
```bash
cd functions
npm run test:otp:integration
cd ..
```
*Executes `node --test test/otp.integration.cjs` using `firebase.otp-test.json` under isolated project `demo-thaiseva-otp`.*

---

## 4. Production Phased Deployment Workflow

Deployments must always follow a phased sequence to prevent downtime or database permission race conditions.

```mermaid
sequenceDiagram
    autonumber
    actor DevOps as Release Engineer
    participant Git as Git Repository
    participant Rules as Firestore & Storage Rules
    participant Functions as Cloud Functions (asia-east2)
    participant Hosting as Firebase Hosting CDN

    DevOps->>Git: Run Linters & TypeScript Compilation Gate
    DevOps->>Rules: Deploy firestore.rules, storage.rules & indexes
    Note over Rules: Security rules active before code changes arrive
    DevOps->>Functions: Deploy serverless Cloud Functions
    Note over Functions: New API endpoints available to callers
    DevOps->>Hosting: Build frontend (npm run build) & deploy hosting
    Note over Hosting: Global CDN cache purged; new SPA bundle live
```

### Phase 1: Pre-Flight Verification Gate
Ensure zero syntax errors, linting warnings, or compilation breaks:
```bash
# 1. Lint frontend code
npm run lint

# 2. Build and verify Cloud Functions
cd functions
npm run lint
npm run build
cd ..
```

### Phase 2: Deploy Firestore Rules & Composite Indexes
Deploy database firewall rules and indexes first so that any new queries in the incoming frontend build are immediately supported:
```bash
firebase deploy --only firestore:rules,firestore:indexes
```

### Phase 3: Deploy Cloud Storage Security Rules
```bash
firebase deploy --only storage:rules
```

### Phase 4: Deploy Serverless Cloud Functions
Deploys all event triggers and REST endpoints to region `asia-east2`:
```bash
firebase deploy --only functions
```
For the verified signup callable only, build and test from the repository root before deploying:
```bash
npm --prefix functions test
npm --prefix functions run test:otp:integration
firebase deploy --only functions:createVerifiedAccount --project gothai-ffea1
```
The callable runs in `asia-east2`, requires App Check, and shares `OTP_HASH_KEY` with the OTP verification functions. Redeploy both the OTP functions and signup callable when rotating that secret. See [OTP configuration and operations](../../documentation/EMAIL_OTP_SETUP.md) for the proof contract and CORS troubleshooting.

*Immediately monitor execution logs post-deploy:*
```bash
firebase functions:log --only hotelStockApi,stripeWebhook --limit 30
```

### Phase 5: Build & Deploy Frontend Application
```bash
# 1. Compile production bundle into /dist
npm run build

# 2. Deploy static bundle to Firebase Hosting
firebase deploy --only hosting
```
Production portal will be live at: [https://hotel-booking-admin.web.app](https://hotel-booking-admin.web.app).

---

## 5. Emergency Rollback Procedures

### 5.1 Instant Frontend Rollback (< 10 Seconds)
If a critical UI regression, styling break, or routing failure is detected in production:
1. Open the [Firebase Hosting Console](https://console.firebase.google.com/project/gothai-admin/hosting/sites).
2. Locate the **Release History** table.
3. Click the three dots next to the previous known good deployment and select **Rollback**.
4. The Firebase CDN instantly reverts worldwide traffic to the previous deployment without rebuilding code.

### 5.2 Cloud Functions Rollback
If a newly deployed function causes unhandled 500 errors or fails payment webhooks:
1. Identify the previous stable Git commit or release tag:
   ```bash
   git log --oneline -n 5
   git checkout tags/vX.Y.Z (or commit hash)
   ```
2. Rebuild and re-deploy functions:
   ```bash
   cd functions
   npm install
   npm run build
   firebase deploy --only functions
   cd ..
   ```
3. Return git workspace to main branch:
   ```bash
   git checkout main
   ```

---

## 6. Pre-Flight Release Checklist

Prior to triggering production deployments, the release engineer must verify each item:

- [ ] **No Hardcoded Admin Bypasses:** Verified `firestore.rules` and `storage.rules` contain no unauthorized email addresses.
- [ ] **No Plaintext Secrets in Git:** Confirmed `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `ZOHO_MAIL_API_KEY` are stored exclusively in Google Secret Manager.
- [ ] **Clean Frontend Build:** `npm run build` compiles with zero module resolution or chunking errors.
- [ ] **Clean TypeScript Compilation:** `npm run build` inside `functions/` exits with status 0.
- [ ] **Indexes Synchronized:** All compound queries used in new pages have matching entries in `firestore.indexes.json`.
- [ ] **CORS Verification:** Verified that staging or production client domains are present in `allowedWebsiteOrigins` in `hotelStockApi.ts`.
- [ ] **Stripe Webhook Health:** Verified active webhook endpoints in Stripe Dashboard match current live URL.
