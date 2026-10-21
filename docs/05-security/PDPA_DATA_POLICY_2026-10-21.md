# ThaiSeva data-use and retention policy

Effective 21 October 2026. Controller: THAI SEVA TRAVEL & SERVICES CO., LTD. Contact: support@thaiseva.com.

The owner instructed publication of a plain-language policy and delegated the legacy-file access decisions on this date. This document adopts an operational baseline. It does not record a lawyer's opinion, execute vendor contracts, establish a statutory accounting classification, or certify overall PDPA compliance.

## Plain-language rule

For every activity, record why information is needed, the basis permitting that activity, who needs access and when it will be removed or reviewed. A privacy notice is an explanation, not blanket consent. Optional tracking requires a separate choice. Access and retention must follow the actual purpose, not merely the file's age or folder name.

| Activity | Necessary information and purpose | Basis selected for this activity | Access | Retention or review trigger |
| --- | --- | --- | --- | --- |
| Account and age eligibility | Account/contact identifiers, authentication, signup age check and profile details needed for services | Steps requested before a contract and performance of the account/service contract; proportionate account security under legitimate interests | Account holder and necessary operators | Active account; verified deletion removes supported account records and reviews related records |
| Travel, hotel, transport and food fulfilment | Guest/order details, requested arrangements, service contacts and necessary pickup/delivery information | Requested service contract | Relevant provider, assigned operational roles and customer | Dated terminal service records: existing five-year cleanup from the later creation/outcome date; documented holds override cleanup |
| Payments and settlements | Payment reference, amount, settlement and refund evidence | Contract; specific accounting duties only where they apply | Restricted finance and applicable payment provider | Service records follow service cleanup; accounting/tax evidence requires its applicable period and trigger, plus documented holds |
| Partner verification | Necessary identity, business, licence and payment verification information | Necessary steps requested for a partnership or performance of that partnership; a specific regulatory duty only if identified | Authorized verification/finance roles | Application or partnership end triggers necessity/offboarding review; unresolved obligations and justified holds are recorded separately |
| Enquiries and support | Relevant correspondence, account or booking reference and limited anti-abuse metadata | Requested assistance under contract, or proportionate legitimate interests for general enquiries and abuse prevention | Participants and authorized support | Contact enquiries: 90 days; reliably dated support messages: two years; holds override cleanup |
| Trip locations | Pickup, destination and trip location necessary to fulfil the service | Contract; device permission where needed does not by itself replace a processing basis | Customer, assigned provider and necessary operations | Completed-trip location cleanup after 90 days from reliable completion |
| Optional analytics | Usage events selected by the user | Consent, with withdrawal | Configured analytics provider and authorized analysts | Collection follows consent; provider-specific retention must be verified separately |
| Security | Limited request/session logs and audit events for account protection and incident investigation | Legitimate interests, subject to necessity and safeguards; mandatory audit duties only where identified | Restricted operators | Ordinary cloud logs: 30 days; required audit logs: 400 days; incident evidence under dated review |
| Recovery copies | Restricted database backups and soft-deleted stored objects | Supporting secure operation and recovery, with limited retention | Authorized recovery operators | Configured seven-day backup and soft-delete periods; reapply erasure obligations after restoration |
| Legacy files without a supported public purpose | Restricted preservation while assessing ownership, migration dependencies and historical exposure | Limited security/remediation legitimate interests, subject to the assessment below | Authorized Admin/cloud operators | Review by 20 November 2026; review is not automatic permission to publish, retain indefinitely or erase a legal hold |

The five-year transaction scheduler is not a universal legal retention period. Thai VAT evidence may require a period measured from filing or report preparation, with extensions and special cases. Finance must map actual tax/accounting records and holds before those records are eligible for disposal. No new bulk-erasure job is authorized by this policy publication.

## Legitimate-interest assessment for the operational baseline

Purpose: prevent unauthorized access, fraud and loss; answer requested enquiries; contain uncertain legacy-file exposure and establish an auditable disposition. These are specific service/security interests, not advertising purposes.

Necessity: use limited identifiers, relevant correspondence and technical events. Public disclosure of uncertain files is unnecessary; deletion before checking dependencies or holds can destroy evidence or legitimate records. Use restricted access, finite reviews and limited audit references instead. Avoid copying document contents into public tickets or policy reports.

Balancing: identity documents, location and support uploads can cause material harm if exposed. Restrict them to necessary authorized roles, preserve bytes during containment, revoke permanent private-file links, respect verified rights requests and track holds. Do not repurpose these records for marketing or public imagery. A user can contact support@thaiseva.com to challenge processing or request an applicable restriction or erasure. Escalate a challenge or any new sensitive use to the responsible company decision maker.

This assessment supports the stated baseline only. It is not evidence of consent, a blanket exemption for sensitive data, or a conclusion about every historical incident.

## Legacy-file decision procedure

The initial 185-file uncertainty was closed by content inspection and owner-delegated dispositions on 21 October. See [the final release](PDPA_LEGACY_FINAL_DISPOSITION_2026-10-21.md): 52 removed live objects; 132 restricted catalog/design assets with 12-month expiry; one restricted business-planning note with two-year expiry. Native Cloud Storage lifecycle enforcement is configured and verified. These are operational limits, not statutory minimum periods. The review procedure below remains applicable to newly discovered uncertain files; it is not an open action for the completed 185-file batch.

1. Re-scan current Firestore references, including discovered subcollections, against the original 213-object review set.
2. Treat private references as higher priority than catalog references. A file without a supported public purpose is restricted, not assumed public.
3. Preserve confirmed public listing/profile media for its supported purpose. Preserve every original object and its checksum during this remediation.
4. Label restricted objects, override older public-path rules, remove permanent download tokens and verify anonymous and old-token denial. Customers cannot remove the restriction by changing object metadata.
5. Keep the per-file reference/disposition report restricted. Mark unsupported-purpose files as restricted preservation, not as verified business records. Review them by 20 November 2026 for justified continued retention, authorized migration or safe erasure, preserving legal/incident holds.

## Sources and review boundaries

- [PDPA text hosted by the Ministry of Digital Economy and Society](https://www.mdes.go.th/law/detail/3577-Personal-Data-Protection-Act-B-E--2562--2019-): purpose, basis, notice and disposal principles. The English version is an unofficial translation.
- [Revenue Code Section 87/3](https://www.rd.go.th/5209.html): VAT document retention and special cases.
- Actual category-specific tax applicability, vendor/overseas terms, staffing, DPO applicability and incident notification decisions remain separate company evidence. Publishing this policy does not invent that evidence.
