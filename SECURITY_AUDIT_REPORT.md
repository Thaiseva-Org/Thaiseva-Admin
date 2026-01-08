# Security Audit Report

## 1. Critical Vulnerabilities

### 1.1 Insecure Firestore Rules & Privilege Escalation
**File:** `firestore.rules`

**Issue:** 
The current rules rely on a "catch-all" rule that allows read/write access based securely on a timestamp:
```javascript
match /{collection}/{document=**} {
  allow read, write: if request.time < timestamp.date(2025, 12, 31) && collection != 'partners';
}
```
**Risks:**
1.  **Privilege Escalation:** Before the date expired, **anyone** (including unauthenticated users) could write to the `users` collection. An attacker could simply create a user document with their own UID and set `role: "Admin"`. Since the `isAdmin()` function checks this exact document, they would instantly gain full Admin access.
2.  **Service Disruption:** The allowed date `2025-12-31` has passed. This means **all** database operations for non-partner collections are currently being rejected by Firestore, likely breaking the application's core functionality (login, fetching data, etc.).
3.  **Data Leakage:** Before expiration, anyone could read all data in the database (except `partners`).

**Recommendation:**
*   Implementing strict Role-Based Access Control (RBAC).
*   Protecting the `users` collection so only Admins can assign roles.
*   Preventing users from modifying their own roles.

### 1.2 Hardcoded Encryption Keys (Client-Side)
**File:** `src/services/DataEncrypter.js`

**Issue:** 
AES-256 Secret Key and IV are hardcoded in the file:
```javascript
const secretKey = CryptoJS.enc.Hex.parse("a3b62319ba6e4b2fe1edccc65d62c743ed95b1a08332be9e8fcce7c3b6cbd4b9");
```

**Risks:**
*   **Zero Security:** Any "encrypted" data sent or stored by the client can be instantly decrypted by anyone who views the website's source code (since React code is shipped to the browser).
*   **False Sense of Security:** It may appear data is safe, but it is not.

**Recommendation:**
*   Key management should be handled on the backend (e.g., Firebase Cloud Functions) if sensitive data processing is needed.
*   Client-side encryption is generally discouraged unless using user-derived keys (which these are not).

## 2. High Priority Issues

### 2.1 Exposed Environment Variables & Git Config
**File:** `.gitignore`, `.env`

**Issue:**
The `.env` file exists but is **NOT** included in `.gitignore` (only `*.local` is).
The `.env` file contains `VITE_Google_Api_Key`.

**Risks:**
*   If this project is pushed to a public repository (GitHub/GitLab), the Google API Key will be publicly exposed.
*   Attackers can steal this key and abuse your Google Cloud quota, potentially costing you money.

**Recommendation:**
*   Add `.env` to `.gitignore`.
*   Regenerate the exposed Google API Key in Google Cloud Console.

## 3. Medium Priority Issues

### 3.1 Hardcoded Configuration
**File:** `src/firebase/firebase.config.js`

**Issue:**
Firebase configuration (API Key, Project ID, etc.) is hardcoded in the JS file, despite commented-out code suggesting an intent to use `import.meta.env`.

**Risks:**
*   Makes environment switching (Dev/Staging/Prod) difficult and error-prone.
*   Accidental exposure of production config in development environments.

**Recommendation:**
*   Revert to using `import.meta.env.VITE_...` variables.
*   Store values in `.env` (and ensuring `.env` is ignored!).

## 4. Low Priority Issues

### 4.1 Missing Security Headers
**File:** `firebase.json`

**Issue:**
No HTTP security headers (CSP, X-Frame-Options, HSTS) are configured for hosting.

**Risks:**
*   Increased susceptibility to Clickjacking and XSS attacks.

**Recommendation:**
*   Add `headers` configuration to `firebase.json`.
