# Internal dashboard privacy review

Reviewed 10 October 2026. Scope: internal staff use of personal data received from the mobile app and public website, including access, exports, storage, retention and deletion. Collection notices and signup flows in those other products are excluded. This is a technical review, not a legal certification.

## Result

Partial controls are present; full compliance is not established. Internal use does not remove obligations to protect, limit access to, and appropriately retain personal data.

## Confirmed controls

- Hosting deployment succeeded; the live index matches the local production build. Anonymous REST requests to `partners` and `settings/Confidential` returned HTTP 403 after deployment.
- Firestore user profiles require owner or privileged access; clients cannot change their own role through profile updates. Bookings require admin, owner, or verified email ownership under the current rules.
- Admin sessions previously utilized a client-side inactivity sign-out in `src/contextAPIs/AuthProvider.jsx`. This was explicitly disabled on 11 October 2026 to ensure continuous operational uptime during active administrative workflows; session management now relies on standard Firebase Auth token lifecycle.
- `functions/src/privilegedAccounts.ts` requires super-admin access and a recent sign-in for customer export. The export selects fields, neutralizes spreadsheet formula prefixes, limits volume, and logs the action before returning records.
- `functions/src/accountDeletion.ts` deletes direct profiles and user-scoped uploads, records an audit event, and queues remaining business records for review rather than claiming complete erasure.
- Retention code includes legal holds, lifecycle checks, bounded scans, and a daily schedule. Firebase's function inventory lists `createSubAdmin`, `exportCustomerData`, `deleteUserFunction`, `previewPrivacyRetention`, and `runPrivacyRetention` as ACTIVE. Inventory status does not prove deployed source parity, execution success, or completion of pending jobs.

## Outstanding findings

1. **Historical passwords:** signup source previously stored plaintext passwords in operational records. New storage was removed, but this review did not read or clean existing private records. Inventory and remove historical password fields; assess affected credentials and previous access.
2. **Broad staff permissions:** `isAdmin()` in `firestore.rules` includes Sub Admin. It gives broad booking, partner, chat and other operational access. `src/routes/AdminRoute.jsx` also admits sub-admins. Approve a staff access matrix and enforce the required scope on the server. Hiding menu items is insufficient.
3. **Export coverage:** `TodayBookings.jsx:801` builds a workbook containing guest names/contact details in the browser. `LocalRequirements.jsx:535` provides a CSV download. These paths do not use the audited customer export callable. Define authorized export roles, purpose, field limits, audit coverage and handling of downloaded copies.
4. **Personal data logging:** `AddHotelForm.jsx:474` logs submitted data including email and phone number. Remove this log and review logging/monitoring retention. No unauthorized reader or external log transmission was established.
5. **Incomplete retention/erasure scope:** retention code explicitly leaves partner offboarding records, legacy messages/uploads, exports, backups and records with missing lifecycle dates for review. Erasure jobs leave bookings/orders/shared messages for review. Check live scheduler runs and queues and assign completion responsibility.
6. **Documentation needs validation:** `DATA_PRIVACY_PDPA.md` calls a 30-day workflow a statutory grace period and treats BCR/ISO certifications as sufficient cross-border safeguards. Those claims are not established by this review. Document the actual legal basis and transfer arrangements; do not equate certifications with PDPA compliance.
7. **Operational evidence missing:** code does not establish current staff offboarding, MFA configuration, cloud IAM permissions, processor agreements, approved retention periods, incident response ownership, or handling of downloaded files. These need operational verification. MFA absence in frontend code does not establish absence in account configuration.
8. **Internal-only boundary & Partner Onboarding:** the repository maintains the `/partner-onboarding` route (`src/routes/Route.jsx:605`) for external vendor self-registration, while administrative partner creation has also been integrated natively into the authenticated `/dashboard/local-partners` interface as an inline modal. This embedded onboarding executes under an isolated secondary Firebase Auth instance to avoid disrupting the authenticated administrator's session, with direct status assignment (`Verified` vs `Pending`).

## Legal references

- Section 37: appropriate security, retention/deletion systems, and breach notification obligations: https://pdpa.sidata.plus/article-37/
- Section 39: records of processing including purpose, retention, access and security, subject to applicable exceptions: https://pdpa.sidata.plus/article-39/
- Section 28: overseas transfers: https://pdpa.sidata.plus/article-28/

## Review limits

No private customer records were downloaded for this review, no destructive cleanup ran, and no scheduler or erasure operation was invoked. Authenticated staff-role testing, deployed backend source comparison, cloud IAM review and legal validation remain outstanding. No production changes were made during this review.
