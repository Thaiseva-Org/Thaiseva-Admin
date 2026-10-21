# Privacy source remediation - 13–14 October 2026

Released on 14 October with compatibility permissions; strict access cutover remains pending. See [actual release status](PDPA_RELEASE_2026-10-14.md). Historical findings remain open until production verification. See the [shared app impact/release guide](PDPA_APP_IMPACT_AND_RELEASE.md) and [operating procedures](PDPA_OPERATING_PROCEDURES.md).

- Retention supports T2TWorldChatRoom, foodCustomerChats and legacy message `date` values. Parent/child/embedded message holds are respected; unknown dates are preserved for review.
- Legacy deletion-request credential fields are sanitized. Unidentified old Pending/Completed requests are queued for identity/outcome review, never matched-and-deleted by email automatically.
- Customer erasure includes current uploads/order-photo folders and the exact profile JPEG. Held profiles stop erasure; held order/support evidence preserves attachments and accurately records incomplete scope.
- Expired source orders and derived partner views are deleted in the same retention transaction. The Food-owned projection trigger also removes derived records when the source is removed.
- `getFoodOrderPhoto` authorizes current customer/restaurant/rider/admin access, validates same-bucket customer-owned references and returns a five-minute signed link or bounded content. No permanent download token is issued.
- Add Hotel no longer logs full submitted form data. The review queue explains historical identity and retention-hold review reasons.

Verification:

```powershell
npm --prefix functions test
firebase emulators:exec --config firebase.pdpa-test.json --project demo-thaiseva-otp --only 'firestore,auth,storage' 'node --test functions/test/retentionErasure.integration.cjs'
npm run build
```

A deletion request remains `Erasure Pending` while related business/external records need review. No production accounts or files were erased and no tokens were revoked. Four legacy request password fields were removed and derived order views were backfilled during release.
