# ThaiSeva manual testing guide

> Status note, 21 October 2026: this is a manual execution template. Older Deferred or Blocked labels are historical setup notes, not the current deployment result. See the [current technical report](https://github.com/Thaiseva-Org/Thaiseva-Admin/blob/main/docs/05-security/THAISEVA_TECHNICAL_DATA_PROTECTION.md) and record new run results separately.

Prepared 17 October 2026. The shared guide covers the customer website, travel admin, hotel/partner dashboard, Food master admin and restaurant partner dashboard: **254 checks**, including **152 route checks**.

The canonical QA pack is maintained in the Website repository:

- [Start and download the pack](https://github.com/Thaiseva-Org/Thaiseva-Website/tree/main/docs/14-testing/manual-qa)
- [Complete manual guide](https://github.com/Thaiseva-Org/Thaiseva-Website/blob/main/docs/14-testing/manual-qa/MANUAL_TESTING_GUIDE.md)
- [Editable results CSV](https://github.com/Thaiseva-Org/Thaiseva-Website/blob/main/docs/14-testing/manual-qa/MANUAL_TEST_RESULTS.csv)
- [Bug template](https://github.com/Thaiseva-Org/Thaiseva-Website/blob/main/docs/14-testing/manual-qa/BUG_REPORT_TEMPLATE.csv)

Create a separate results sheet for each run. No test is pre-marked Pass. Use the actual role matrix, controlled accounts and synthetic data; record expected/actual results and evidence. Stripe cases have unresolved configuration dependencies. The 17 October chat-deferred status is historical; use the current technical report for deployed safeguards, and run these manual scenarios independently.

Use this execution guide alongside [test strategy](TEST_STRATEGY.md); older operational documentation is not evidence that a workflow or privacy control passed.

## Customer-chat category restoration supplement (19 October 2026)

The 17 October pack above predates the chat deployment. Its Deferred chat status is historical; consult [the release record](../07-user-guides/ADMIN_USER_MANUAL.md) and [category restoration evidence](../07-user-guides/ADMIN_USER_MANUAL.md) for the deployed scope. Broader privacy findings remain separate. The following additional checks are not included in the original 254-case count and are not pre-marked Pass.

Use controlled customer/Admin accounts and synthetic conversations. Record actual results and evidence:

| Check | Expected result |
|---|---|
| Select Visa, then Work Permit using the category API | Two centered category entries; header shows Work Permit |
| Select Work Permit again; retry an earlier request with its original ID | No duplicate; retry does not reset the newer header |
| Reuse a category request ID with a different topic | `already-exists`; no additional marker |
| View migrated headings and paginate into older history | Original dates and centered headings remain; latest header stays current |
| Append a legacy heading in a controlled test source and refresh messages twice | Imported once with original date; source unchanged |
| Send ordinary text mentioning Visa | Normal message bubble |
| Try another customer's category request as a customer | Access denied; no changes |
| Edit/delete a category marker or change a held conversation | Rejected; history retained |
| Poll a held legacy source or conversation | No category import; individually held markers remain held when imported from an unheld source |

Automated evidence for this follow-up: 2 frontend category tests and 18 customer-chat emulator integration tests passed; backend and frontend builds passed. Manual results must still be recorded independently.
