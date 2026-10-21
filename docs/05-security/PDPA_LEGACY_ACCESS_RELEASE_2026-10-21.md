# Legacy file access resolution and policy publication

**Follow-up complete:** the remaining 185-file content review is resolved. See [final dispositions and automated expiry](PDPA_LEGACY_FINAL_DISPOSITION_2026-10-21.md). The text below records the earlier containment stage, not the current review backlog.

Completed 21 October 2026 under the owner's instruction to decide legacy-file access and publish a plain-language data policy.

## Delivered

- Website privacy notice version 2.5 explains purposes, lawful bases and retention using account, booking, payment, support and analytics examples.
- [Operational data policy and basis assessment](PDPA_DATA_POLICY_2026-10-21.md) records the adopted baseline, safeguards, existing cleanup thresholds and the separate accounting/tax boundary.
- Reference scan checked 5,593 current records across 98 top-level collections and discovered subcollections, including subcollections beneath missing parent documents.
- All 213 legacy review files have an implemented access decision: 26 referenced catalog/profile images remain public; 187 files are restricted. Private-purpose references override public candidates. Unsupported purposes never authorize publication.
- Public HEAD checks succeed for all 26 retained public images. Anonymous HEAD checks deny all 187 restricted files. All 187 have no permanent download token. Old-token HEAD denials were additionally recorded for 186 files; fresh metadata verifies token absence for every restricted file.
- All 213 objects remain at their original paths with unchanged generation and checksum. No objects were deleted or copied into a new public location.
- Storage metadata restrictions override older public-folder/root rules and prevent ordinary customers from clearing the restriction through overwrite or deletion. All three application rule copies match the canonical policy.
- All 187 restricted files have verified server-only Admin retrieval registrations and dated retention review records. The existing authenticated retrieval function checks current Admin account state; supported image/PDF previews remain subject to its existing size/type limits. Larger or other formats require authorized cloud operations.

## Remaining boundary

Access exposure is contained. This is reference- and content-type-based triage, not visual inspection of every file or proof of every original business purpose. Of the restricted files, 185 have no supported current reference. Their original purpose, ownership, external/mobile hard-coded dependencies and lawful final disposal cannot be established merely from the absence of a database reference.

These 185 files remain restricted for investigation, with review due **20 November 2026**. The other two restricted referenced records are also registered for review. Reviews are assigned to the Admin role through the agreed support@thaiseva.com contact. The review date does not automatically erase held records or authorize indefinite storage. No individual staff appointment or completed review is asserted.

The policy publication does not execute vendor/transfer agreements, decide every tax-record classification, close historical incident assessments or certify overall PDPA compliance.

## Validation and evidence

- Shared Firestore/Storage suite: 26 passed, including quarantine under public root, image, profile, user and restaurant paths; current Admin access; denied customer reads/overwrites/deletes; unchanged public media access.
- Food regression suite: 154 passed.
- Website production build and Hosting deployment passed; isolated production browser verified notice 2.5 and its plain-language explanation, support contact and absence of em dashes.
- Canonical Storage deployment passed. Private metadata, original checksums, Admin registrations and review records were independently re-read after application.

Restricted evidence is kept outside Git: `D:/projects/Thaiseva-Firebase-Security/legacy-file-decisions-2026-10-21.json` and `D:/projects/Thaiseva-Security-Audit/LEGACY_ACCESS_RESOLUTION_2026-10-21.json`. They must not be published with customer records or bearer URLs. The summary above contains no file paths or subject identifiers.

Public policy: https://thaiseva.com/privacy/#data-policy-explained
