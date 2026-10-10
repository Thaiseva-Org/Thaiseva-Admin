# Privacy and PDPA operational status ? 11 October 2026

**Readiness: not yet confirmed.** Current notices and supported account deletion are implemented, but historical-data gaps and operational verification remain. This document records engineering evidence, not a legal certification.

## Controller and public notice

THAI SEVA TRAVEL AND SERVICE CO., LTD., registration 0105567071964.
69/235 Omni Tower Building, Ground Floor, Room No. 69/29, Soi Sukhumvit 4, Sukhumvit Road, Khlong Toei Subdistrict, Khlong Toei District, Bangkok, Thailand.
Privacy/deletion contact: support@thaiseva.com. No separately appointed DPO or additional privacy mailbox has been verified.

The deployed website `/privacy/` describes collection, purposes, sharing, retention and rights. Collection forms link to the notice. Necessary processing must have its appropriate lawful basis; notice acknowledgement is not blanket consent. Optional analytics requires valid consent and supports withdrawal. Cookie choices expire after 180 days; invalid choices fail closed.

## Collection, access and sharing

Profiles and booking/contact forms collect identity, contact and service information. Active Add Hotel collects listing and hotel contact details, not bank/license fields; legacy hotel onboarding was removed. Legacy records remain a separate review task. Firebase Auth manages credentials; application deletion submissions must never persist a password.

Customer support uses individual documents in the same chats collection. The shared support directory is staff-only. Updated backend and Firestore controls accept one staff role, Admin, with ownership and active-account checks. One administrator is reported by the owner. Partner/customer product roles remain distinct. Admin Account Settings supports changing the signed-in administrator's password after current-password verification. Live MFA is disabled; one admin does not establish MFA protection.

Telegram now sends generic activity alerts rather than full booking details. Full booking log payloads were removed from updated code; this does not erase historical provider messages or logs. Downloads and exports remain personal-data copies requiring restricted access and tracked disposal.

## Retention and erasure

Daily `runPrivacyRetention` runs at 03:00 Asia/Bangkok (01:30 India). Configured policies include two-year supported messages, 90-day contact submissions, five-year terminal bookings with usable lifecycle dates and holds respected; these are implemented policy thresholds, not proof of a universally applicable legal retention requirement.

Customer deletion requires a matching pending request and recently authenticated active Admin. It removes Auth, direct profile/support/operational records and supported user-folder files. It sets the request to `Erasure Pending` and the erasure job to `PENDING_RECORD_REVIEW`, with a seven-day business/external-record review deadline. It does not simply mark a profile `accountDeleted`, and does not certify every copy erased. Staff/partner accounts need separate offboarding. The 30-day application delay is a product workflow, not a verified statutory grace period.

[Detailed live verification and severity-ranked historical gaps](RETENTION_DELETION_VERIFICATION.md) records four password-bearing legacy requests, a possibly unfulfilled Completed request, 21 expired legacy messages missed by cleanup, unsupported date formats, 17 contacts awaiting the next-run check and four undated terminal hotel records. Identity must be verified before resolving the legacy email-matched account; do not bulk-delete booking ledgers without a documented retention decision.

Storage soft deletion permits recovery for seven days. Firestore reported one-hour version retention, PITR disabled, no managed backups or backup schedules returned. Cloud Logging retains _Default for 30 days and locked _Required for 400 days. External exports, staff devices, other buckets and provider copies remain unverified.

## Vendors, overseas transfers and incidents

Firestore is in asia-east2; deployed functions span asia-east2 and us-central1. Do not infer Storage or every vendor's data location from the Firestore region. Obtain actual vendor processing terms, subprocessor/location information and applicable overseas-transfer safeguards. ISO certification or foreign BCR claims alone do not establish Thai PDPA compliance.

Assign a privacy-request and incident owner, record verified request identities/actions, and document justified retention exceptions. Establish incident triage, containment, assessment and escalation procedures with counsel reviewing notification duties. Vendor agreements, transfer assessments and these operating procedures have not been verified complete.

Secret Manager runtime migration is blocked by IAM permission `secretmanager.secrets.setIamPolicy`; existing runtime credentials remain. Stripe uses test keys; the asia-east2 webhook signing secret is empty. Complete credential rotation/migration and end-to-end live-payment testing before payment launch. Upload code and live Storage rules were excluded from these changes; owner-reported access checks are not a new independent verification.
