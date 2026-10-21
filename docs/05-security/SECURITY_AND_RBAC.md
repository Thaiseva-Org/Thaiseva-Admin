# Access control and technical privacy safeguards

The current plain-language evidence summary is [Technical Data Protection](THAISEVA_TECHNICAL_DATA_PROTECTION.md). The [21 October closeout](PDPA_TECHNICAL_CLOSEOUT_2026-10-21.md) records engineering validation and remaining boundaries. These documents do not establish regulatory approval.

Firebase Authentication identifies callers. Direct client access to Firestore and Storage is governed by shared canonical security rules. Backend Admin SDK access bypasses those client rules, so privileged handlers must enforce authorization and Google Cloud IAM must restrict runtime/operator access. Browser route guards are convenience controls, not a security boundary.

Reviewed Admin export, provisioning and private-file handlers validate the current account/role, suspension and token revocation. Food handlers also enforce tenant and assignment checks. Public catalog projections use allowed display fields instead of verification or bank records.

Sensitive upload/preview paths use format and size checks, restricted storage and authorized previews. Reviewed permanent private-file tokens were removed. Retained-file deadlines are checked before preview; native storage holds preserve necessary evidence. Preserve Secret Manager bindings during deployments and verify them afterward.

See [data policy](PDPA_DATA_POLICY_2026-10-21.md) for purposes and retention, [operating procedures](PDPA_OPERATING_PROCEDURES.md) for rights requests/holds/incidents and the canonical shared-security workspace for rules deployment. Staff IAM/MFA governance, vendor transfer evidence and incident decisions are separate company requirements.
