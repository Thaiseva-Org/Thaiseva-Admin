# Technical privacy closeout, 21 October 2026

Scope: the available website, Admin, food portal, shared Firebase rules and deployed backend controls. Mobile verification is owner-confirmed. This is an engineering review, not regulatory approval or legal certification.

## Additional safeguards

- Consent withdrawal disables analytics and removes GA identifier cookies for host and parent domains. Necessary cookies remain. Missing or expired consent also removes leftover GA cookies. A live isolated-browser check verified removal and preservation.
- Retained private-file previews reject expired or malformed retention deadlines before downloading bytes. This closes the interval before asynchronous storage lifecycle deletion. Native storage holds preserve access for authorized evidence review; authentication and current Admin authorization still apply.
- Booking cleanup respects explicit retention deadlines and routes recognized invoice/accounting-linked records with missing or invalid deadlines to restricted review. Reliable completed-trip locations still expire independently. Finance must establish applicable accounting periods and triggers.
- Blog HTML is sanitized before loading into the editor and before creation/update, in addition to existing sanitized previews. The Quill 2.0.3 advisory has no published patched release; sanitization is a compensating control, and the low-severity dependency advisory remains tracked. Do not claim a completely clean dependency audit.
- Food redirect handling and website backend dependencies were updated within the existing supported version ranges. Backend releases preserve deployed application source, runtime configuration and secret bindings.

## Validation

Admin backend: 51 tests passed, including retained-file expiry/hold checks and accounting-retention safeguards. Website consent: eight tests passed. Website backend: 46 tests passed. Admin access/banner/support helpers: six tests passed. Food deployment checks: lint, 154 tests, backend syntax checks and production build passed. All three hosting builds and releases succeeded.

The browser sanitizer check preserved formatting while removing scripts, event handlers and executable links. Production lockfile audits across all six frontend/backend packages reported zero high/critical findings; five packages had no findings, and Admin frontend retained the low-severity Quill advisory described above. Development tooling and GitHub's separately updated advisory dashboard are not represented as cleared by this production dependency result.

Production access verification matched live Firestore and Storage rules to canonical source; anonymous private-file/API checks denied access; public partner/catalog projections omitted private fields. The initial runtime recheck found all 131 functions ACTIVE and no nonempty credential-named runtime environment fields. Restricted deployment/readback evidence is held outside Git.

## Remaining company evidence and boundaries

The owner excluded vendor/overseas-transfer evidence, demonstrated staffed rights-request handling, historical incident assessment, staff governance and DPO applicability. These remain outside this technical closeout. Finance retention mapping and external export/provider disposal evidence also cannot be inferred from application code. Configured recovery copies of the 52 deleted objects remain restricted until their seven-day recovery periods end on 28 October 2026.

The 185-file content review is resolved: 52 live objects removed, 132 private catalog/design objects expire on 21 October 2027 and one private planning object expires on 21 October 2028. No additional production erasure or fabricated privacy-request evidence was created by this closeout.

The final queue check also identified two referenced files outside that batch. Both originals were visually inspected and their current database references verified: one food-promotion artwork and one dated support attachment. Both remain private, token-free and anonymously inaccessible. Their approved expiry dates are 21 October 2027 and 17 October 2028 respectively. The native lifecycle rule now covers 135 exact retained objects with no unrelated matches; all original bytes were preserved and both temporary inspection copies were removed after hash verification. All 187 legacy review cases are resolved, and the current retention-review queue contains no pending cases. This describes the queue at verification time, not a guarantee that future records never need review.

The release updated three Admin privacy functions and the 15 website backend functions using the older dependency family. Every updated function returned ACTIVE with its runtime environment and secret bindings preserved. The previously active 131-function inventory remains the production verification boundary.

Sources: [Quill advisory](https://github.com/advisories/GHSA-v3m3-f69x-jf25), [Cloud Storage lifecycle](https://docs.cloud.google.com/storage/docs/lifecycle), [Revenue Code Section 87/3](https://www.rd.go.th/5209.html), [PDPA text hosted by MDES](https://www.mdes.go.th/law/detail/3577-Personal-Data-Protection-Act-B-E--2562--2019-).
