# Retention and deletion verification - 11 October 2026

**Result: current supported deletion flow passes emulator checks; historical retention and deletion do not yet pass.**

Production inspection was read-only. No customer account, message, submission or uploaded file was deleted, and no production retention run was manually invoked. Reports omit customer names, emails, account IDs, message contents and password values.

## Verified scope and working controls

- Paginated inventory of 27 relevant Firestore collections: 601 documents, plus 28 collection-group message documents and 1,435 object metadata entries in the app Storage bucket. No read-permission failures in the Firestore inventory.
- Live runPrivacyRetention and deleteUserFunction source retrieved from their deployed source archives matches the tested local retentionMaintenance.ts, retentionPolicy.ts and accountDeletion.ts.
- Scheduler is enabled for daily 03:00 Asia/Bangkok. Most recent run: 11 October 2026, 03:00 Bangkok / 01:30 India. It scanned 237 records, recorded four reviews and zero failures; it reported no deletions. That run preceded the latest backend deployment, so it does not prove the newly added contact/nested-message coverage has run successfully yet.
- Four emulator tests completed successfully. The current erasure helper removed a synthetic Firebase Auth account, both profile variants, cart and nested records, scoped support messages, device/notification records, the support-directory entry and files in supported user folders. Another customer's synthetic file and a legal-held booking were preserved. An erasure job correctly remained PENDING_RECORD_REVIEW rather than claiming total deletion.
- Scheduler test erased an eligible synthetic customer request while preserving cancelled, held and administrator accounts.
- Retention test verified that preview preserves expired contact data, actual cleanup deletes a dated expired contact, and holds/undated records are preserved and queued for review.
- A separate passing test explicitly REPRODUCED the legacy coverage defect. It is evidence of a gap, not evidence that legacy cleanup works.

## Confirmed findings

| Severity | Finding and evidence | Recommended fix |
|---|---|---|
| High | All four historical DeletionRequests lack a UID and retain a non-empty password field. Three are Cancelled; one is Completed. Password values were not output or saved in the report. Current website submissions do not store passwords. | Remove unnecessary stored password values through a reviewed cleanup; assess exposure and affected credential rotation. Never ask users to submit passwords in deletion records. Preserve only the necessary request/audit metadata. |
| High | The request marked Completed matches an existing non-staff Auth account by email. That Auth account was created before the completion date, so it is not simply a newly recreated account after completion. A matching profile and support chat remain, and 31 booking records reference the matched current UID. No privacyErasureJob exists. | Verify the historical request's identity and outcome, then process it through the current verified deletion/review workflow. Do not automatically delete the matched account based only on a legacy email match. Retained booking records require individual lawful-retention review, not blanket deletion. |
| High | T2TWorldChatRoom contains 27 nested messages; 21 have dates older than two years. That collection is absent from the retention scheduler. Emulator testing reproduced an old T2T message remaining after cleanup. | Add explicit bounded/cursor-based legacy-message coverage, apply parent/message legal holds, test it and review the old messages before cleanup. |
| Medium | 912 messages in chats use a Firestore `date` timestamp; the helper recognizes only createdAt/timestamp/sentAt. They are wrongly treated as undated. None of these 912 are currently over two years old, but they will not age out correctly. Another 755 messages in foodCustomerChats use ISO `date` strings; that collection is also absent from the scheduler. | Recognize and validate the actual legacy date schemas and include foodCustomerChats with proper hold/cursor handling. Avoid inventing dates for genuinely undated messages. Reference: functions/src/retentionPolicy.ts:22; retentionMaintenance.ts:9, :66 and :105. |
| Medium / pending next-run verification | 17 of 20 ContactMessages are older than 90 days and have valid dates, with no holds found. The newly deployed code covers them, but it has not yet had its next scheduled run. | Confirm actual removal and run counts after the next scheduled execution. Do not claim the 90-day cleanup is operationally proven yet. |
| Medium | Four terminal hotelBookingData records lack usable lifecycle dates. They cannot be safely selected for age-based erasure. | Review the business evidence and backfill only reliable lifecycle dates; otherwise document the reason and retention decision. |

References: functions/src/accountDeletion.ts:33 (direct erasure and remaining review); :98 (request status); functions/src/retentionMaintenance.ts:9 (coverage), :27 (pending requests), :66 (nested messages), :105 (embedded arrays); functions/src/retentionPolicy.ts:22 (message dates) and :28 (booking lifecycle). Current website deletion submissions: website repository `src/lib/firebase/deletion.js:21`.

## Backups, files and logs

- App bucket soft deletion retains removed objects recoverably for seven days. The emulator proves active-file removal, not immediate permanent destruction in live Storage. Storage policy/rules were not changed.
- Firestore point-in-time recovery is disabled; reported version retention is one hour. No backup schedules or managed Firestore backups were returned by the checked APIs.
- Cloud Logging _Default retention is 30 days. The locked _Required bucket retains audit logs for 400 days. Account deletion does not individually erase these logs.
- No blanket orphan/file cleanup was attempted: listing images and other business assets must not be deleted simply because they are old. Most bucket objects are outside the deletion helper's supported user prefixes.
- Export files on staff computers, external backup buckets, provider copies, analytics exports and historic notification-provider messages are not established as erased by this verification. No access to staff devices or those external copies was assumed.

## Reproduce locally

In the admin repository, run `npm --prefix functions run test:retention:integration`. This requires Firebase CLI and Java. The configuration is emulator-only; all fixtures use a demo project and synthetic identities. Four tests pass, including one explicitly documenting the unresolved legacy cleanup defect. Passing this suite does not mean all historical retention works.

This report is a read-only snapshot from 11 October 2026. No historical data was removed. Recheck the next scheduled run before closing the contact-cleanup finding.
