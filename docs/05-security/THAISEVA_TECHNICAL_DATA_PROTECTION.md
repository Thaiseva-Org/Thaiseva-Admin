# Thaiseva - Technical Data Protection Report

THAI SEVA TRAVEL & SERVICES CO., LTD.

Reference: TS-PDPA-TECH-2026-10-21 | Version 1.0 | 21 October 2026

## Data use and flow

Thaiseva uses personal information to provide requested accounts, travel bookings, food orders, payments and support. The reviewed systems use authenticated access, restricted private files, encrypted cloud connections, server-side permission checks and dated cleanup controls. This report explains those technical safeguards and the evidence checked.

Scope: customer website, travel/Admin and partner panels, food/restaurant panels, shared Firebase rules and deployed backend. Mobile checks were confirmed by the owner; no independent mobile source audit is represented here.

### What information is used and why

| Information | Examples | Purpose |
| --- | --- | --- |
| Account and profile | Name, email, phone, account ID, nationality, birth date and optional photo | Account setup, email verification, age eligibility and service contact |
| Travel and hotel bookings | Guest contacts, dates, party size, booking requests and necessary pickup/destination | Arrange the requested service and coordinate the assigned provider |
| Food orders and delivery | Order items, customer contact, delivery address/location and optional delivery photo | Restaurant fulfilment, assigned-rider delivery and order support |
| Partner verification | Business/licence details, required identity documents and settlement/bank details | Review applications, manage the partnership and settle payments |
| Payments | Booking/order reference, amount, transaction reference and payment status | Confirm payment, settlement and manual refund review; Stripe processes card entry |
| Support and security | Messages, attachments, account/booking references, IP/request metadata and device tokens | Answer requests, send service notifications and investigate misuse |
| Optional analytics | Consented page-use and browser/device events | Understand website usage; collection stays off without valid consent |

### How information moves

- 1. A customer submits information through the website or connected service.
- 2. Firebase Authentication establishes identity. Direct database/file access is checked by Firebase rules; trusted backend actions perform their own authorization checks.
- 3. Permitted records are stored in Firestore or Cloud Storage. Relevant staff and the assigned provider receive the service details their workflow needs.
- 4. Specific fields go to a payment, email, map or notification provider only when that feature is used. Cleanup and review rules apply after the service or request.

## Processing locations and recipients

### Where information is processed

Actual production settings are shown below. A chosen database region does not locate every integrated provider in that region.

| Data / function | Service | Verified location or boundary |
| --- | --- | --- |
| Accounts / sign-in | Firebase Authentication | United States, according to Firebase service documentation |
| Operational database and scheduled backups | Cloud Firestore | asia-east2 (Hong Kong); daily backups retain seven days |
| Uploaded documents and images | Cloud Storage | us-central1 (Iowa, United States); seven-day soft-delete recovery |
| Backend processing | Cloud Functions, 131 active functions | 77 in Hong Kong, 45 in Singapore (asia-southeast1), 9 in Iowa |
| Website delivery and platform logs | Firebase Hosting and Cloud Logging | Global hosting/edge services; logging buckets use the global location |
| Other integrated providers | Stripe; Zoho email; Gmail SMTP; Google Maps/FCM/Analytics; WhatsApp where invoked | Provider-managed processing. Exact countries, terms and transfer evidence require the company vendor register |

### Who receives information

- Hotels, travel partners, restaurants and assigned riders: booking/order details needed to fulfil their assigned work; unrelated private records are restricted.
- Stripe: payment amount, currency, order/booking reference and checkout contact where required. The reviewed checkout flow uses Stripe for card entry; its application payment records use transaction references and status.
- Zoho/Gmail: recipient address and verification/service-message content. Google Maps: the address/place or coordinates submitted for a map feature. FCM: device token and service-notification payload. WhatsApp: the destination phone/message when that integration is used.
- Google Analytics: optional usage information only after valid website consent. Public catalog/banner images are intentionally public; identity, bank and support documents are not catalog data.

Overseas processing is part of the current design. The company must retain the applicable vendor and transfer evidence; this technical report does not replace it.

## Protection, retention and requests

### How access and files are protected

| Safeguard | How it works |
| --- | --- |
| Encrypted transport and storage | Website and Firebase service connections use HTTPS. Firestore, Authentication and Cloud Storage use provider-managed encryption at rest. This is not a claim of end-to-end encryption or that authorized operators cannot read records. |
| Identity and permissions | Firebase sign-in identifies callers. Reviewed privileged handlers check current account/role, suspension and token revocation. Food permissions also check tenant/assignment boundaries. |
| Direct access and backend access | Firestore and Storage rules restrict direct client access. Trusted Admin SDK code bypasses client rules, so backend authorization and Google Cloud IAM remain separate required controls. |
| Private uploads | Reviewed sensitive upload APIs validate file type/signature and size. Private-file previews require authorization; reviewed permanent private download tokens were removed. Dated retained-file previews stop at expiry, subject to verified native storage holds. |
| Public data minimization | Public listing projections expose allowed display fields. Reviewed public catalog responses omit private verification and bank fields. |
| Secrets, payments and abuse controls | Provider credentials use Secret Manager bindings rather than nonempty credential-named runtime variables in the verified inventory. Payment webhooks verify signatures. Reviewed endpoints apply rate limits and App Check where configured. |
| Consent and browser protection | Optional website analytics waits for a valid choice. Withdrawal disables collection and removes GA cookies. Hosting security headers and HTML sanitization reduce browser injection risks. |
| Review and accountability | Privileged exports/erasure are restricted and review states are recorded. Ordinary cloud logs retain 30 days and required platform audit logs 400 days; staff assignment and incident decisions remain company duties. |

### How long information is kept

| Category | Current schedule or review rule |
| --- | --- |
| Account/profile | Active account; verified deletion removes supported login/profile/upload records and records related business-data review. It is not immediate erasure of every provider copy. |
| Contact enquiries / support | Supported, reliably dated enquiries: 90 days. Supported dated support messages: two years. Missing dates or holds require review. |
| Trip locations / service records | Completed-trip location: 90 days. Dated terminal service records: five years after both creation and current outcome. Explicit later deadlines and documented holds are respected. |
| Accounting / partner documents | Recognized invoice-linked records without a valid mapped deadline are protected from automatic disposal. Finance must map accounting duties. Ended partnerships trigger document-necessity review. |
| Restricted legacy files | All 187 review cases resolved: 52 files removed from live storage and 135 retained privately with finite, purpose-based expiry. The 52 restricted recovery copies expire on 28 October 2026. |
| Recovery / logs | Daily database backups: seven days. Storage soft deletion: seven days. Standard logs: 30 days; required audit logs: 400 days. PITR and object versioning are not enabled. |
| Provider / downloaded copies | Provider retention and downloaded exports are separate. Firebase states Authentication deletion can take up to 180 days across its live/backup systems. Restore procedures must reapply applicable deletion decisions. |

### Privacy requests

Privacy requests go to support@thaiseva.com or the website account-deletion route. The company must verify identity proportionately, use restricted export/erasure tools, explain retained records and track the outcome. Technical support exists; this report does not claim that a staffed request-handling exercise has been completed.

## Verification and company review

### Evidence checked

| Check | Recorded result |
| --- | --- |
| Production access checks | Live database/file rules matched canonical source. Checked anonymous private submissions and sensitive APIs returned denial; all 17 originally protected private-file links remained protected. |
| Public data / operations | 13 public partner projections and one conditions projection passed field checks. Reviewed restaurant catalog omitted private fields. All 131 backend functions were ACTIVE at readback. |
| Regression and browser checks | 51 Admin backend tests, 46 website backend tests, 154 food tests and eight consent tests passed. Live consent withdrawal removed analytics cookies and kept a necessary test cookie. |
| Retention / configuration | No pending retention-review cases at closeout; 187 legacy cases resolved. Scoped lifecycle covered 135 retained objects without unrelated matches. All 18 updated backend functions preserved runtime configuration/secret bindings. |
| Dependency result | Six production lockfile audits: no high/critical findings; five had no findings. One low-severity editor advisory remains mitigated by sanitization. Development-tool advisories remain separate open work. |

### What this report establishes

This is a point-in-time technical evidence summary, not PDPC approval, an independent certification, a guarantee of absolute security or a complete legal PDPA assessment. Production metadata was rechecked on 21 October 2026 at 17:20 UTC. Technical checks do not prove the absence of every historical incident or every undiscovered defect.

### Company follow-up

- Complete vendor/overseas-transfer terms and country evidence; data is not hosted only in Thailand.
- Demonstrate staffed privacy-request handling; assess historical incidents; document staff governance and DPO applicability.
- Confirm finance-specific retention triggers/deadlines and evidence of disposal of external exports/provider copies.
- Track the unpatched editor advisory, development-tool updates and controlled restore/deletion procedures.

### Supporting provider references

- [Firebase privacy, service locations and provider retention](https://firebase.google.com/support/privacy)
- [Google Cloud default encryption](https://docs.cloud.google.com/docs/security/encryption/default-encryption)
- [Cloud Storage lifecycle and holds](https://docs.cloud.google.com/storage/docs/lifecycle)
- [Firestore scheduled backups](https://docs.cloud.google.com/firestore/native/docs/backups)
- [Quill advisory with no published patch](https://github.com/advisories/GHSA-v3m3-f69x-jf25)

Company representative: ____________________

Role / signature / date: ____________________

Signature fields are blank; no approval is recorded.
