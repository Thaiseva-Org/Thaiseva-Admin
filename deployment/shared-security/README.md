# Shared privacy release configuration

Project: gothai-ffea1. These rules affect Website, Food, Admin and mobile together.

The 14 October 2026 release deploys `firestore.compat.rules`: the previous live rules plus read-only `partnerOrderViews`. Legacy restaurant reads of raw orders remain pending mobile migration. `storage.deployed.rules` records the unchanged 12 October live bucket policy. These snapshots contain rules only, no credentials or customer data.

`firestore.rules` and `storage.rules` are the prepared stricter policy. Do not activate them until mobile/legacy attachment readers and old public catalog references are verified. Deploy configuration explicitly; never deploy every product blindly from a default Firebase file.

Six partner-order indexes were created additively via the Firestore Admin API. Existing indexes and TTL configuration were preserved. Check ready state before publishing projected readers.

See ../../docs/05-security/PDPA_RELEASE_2026-10-14.md for actual deployment results and pending work.
