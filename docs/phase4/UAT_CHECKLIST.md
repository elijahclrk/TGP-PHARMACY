# Owner UAT acceptance preparation

## Batch 11 current review — all actual business acceptance pending

Use [BATCH11_UAT_WALKTHROUGH.md](BATCH11_UAT_WALKTHROUGH.md) for the current guarded local walkthrough, including Senior/PWD, unknown metadata, stale quotes, lost acknowledgement recovery, returns/quarantine and exact export reconciliation. [BATCH11_RESULTS.md](BATCH11_RESULTS.md) records fresh 122 frontend / 209 backend reported entries and separate 17-group and 9-group Chrome runs. Earlier counts and statements that local discounted posting does not exist are historical below.

Product exchange is now explicitly assessed as a **required missing workflow**, not an excluded refund feature. The owner must review that gap and approve its settlement/benefit rules before implementation. Current accepted returns do not deliver replacement products or create exchange payments. Statutory production activation, fiscal invoice acceptance and actual owner/pharmacist/accountant signatures remain blocked/pending. No real identities, new qualification grants or production actions are needed for this synthetic review.

## Batch 8 current handoff — 2026-11-22

Use [BATCH8_DEMO_HANDOFF.md](BATCH8_DEMO_HANDOFF.md) for guarded verify/start/reset
and clean stop, and [BATCH8_CLIENT_WALKTHROUGH.md](BATCH8_CLIENT_WALKTHROUGH.md)
for the nontechnical review and unsigned acceptance record. The compiled frontend
passed 17 Chrome groups/38 screenshots; backend passed 189 reported entries.
Frontend's completed Batch 8 run passed 120 tests. This supersedes historical
launcher/counts below, without completing any human acceptance checkbox.

## Batch 7 current walkthrough — human acceptance still pending

Use [BATCH7_UAT_WALKTHROUGH.md](BATCH7_UAT_WALKTHROUGH.md) for the guarded
local --review launcher and step-by-step owner/pharmacist review. Current results:
120 frontend tests, 183 backend entries, 17 Chrome groups and 38 screenshots.
Review mode start/loopback HTTP/stop was smoke-tested; no human acceptance occurred.
Category rankings, batch picker, browser-local reminder preferences and recorded
versus within-date quantities are now implemented. Durable preferences, fiscal
invoices and statutory posting remain unavailable. Prior partial statements below
are historical where [Batch 7 results](BATCH7_RESULTS.md) supersede them.

## Batch 6 current review scope — 2026-11-21

**All human acceptance remains pending.** Current automated evidence is
[BATCH6_QA_RESULTS.md](BATCH6_QA_RESULTS.md): 113 frontend tests, 178 backend
reported entries and 15 actual Chrome journey groups with 32 screenshots.
Use [FINAL_REQUIREMENTS_MATRIX.md](FINAL_REQUIREMENTS_MATRIX.md) and
[RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md) for partial requirements/release gates.
Older counts below are historical.

| Additional owner/pharmacist review | Expected observation / required decision | Actual human result |
|---|---|---|
| Admin transaction reports | Original cash amount, cashier, tender/change and return counts match receipt; some wireframe columns absent | Pending |
| Category/slow-moving | Current category totals and max-units filter; full within-category product rankings still partial | Pending scope/definition |
| Excel/PDF | Both formats match applied filters/all rows/totals/coverage; unavailable costs and Unicode correct; beneficiary omitted; exact decimal text in Excel | Pending |
| Global audit/accounts | Admin can inspect synthetic actions/public account fields; Manager denied; no credential disclosure | Pending |
| Logout/stale session | Logout redirects; copied cookie rejected; original cashier re-login can view original receipt | Pending |
| Employee adjustment requests | Accept request-only access despite SRF Employee exclusion, or authorize restriction | Pending policy |
| Reviewer availability | Distinct management reviewers for each initiator; current PO/Stock-In permissions retained | Pending staffing |
| Quarantine/disposition | Full receipt only; decide partial-receipt need and storage/suitability/destruction/supplier-return SOP | Pending pharmacist |
| Supplier expiry acceptance | Wireframe rejects expired stock; current receiving accepts past dates. Decide reject vs quarantine/record-only policy; POS/restock remain excluded | Pending pharmacist/owner |
| Qualification | Evidence, independent verification, expiry/revocation and provisioning procedure; role alone never qualifies | Pending pharmacist/owner |
| Notifications/extra fields | Preference UI absent; supplier/account/PO field and lifecycle gaps disclosed | Pending acceptance/scope |
| Fiscal receipt | No certified print/invoice layout; actual fiscal procedure must be validated | Blocked |
| Senior/PWD | No activated discounted posting/invoice/report journey; validation and implementation needed | Blocked |

Record actual reviewer name, role, date, synthetic scenario, expected/actual
outcome, evidence path, severity and accepted scope. Never infer human acceptance
from automation. No real customer identity or qualification record is required
in this disposable review environment.

Prepared 2026-11-21 Asia/Manila. Automated evidence is complete for the scoped
desktop journeys; **owner and pharmacist acceptance remain pending**.
Use only the attested disposable local environment and synthetic identities.
Never use the production `.env`, real customer information or real pharmacist
privilege changes for this checklist. Temporary credentials stay private.

[Automated results and screenshot gallery](BATCH4_RESULTS.md) provide the
repeatable local commands, database evidence and actual screenshots. The
automated harness closes its local app servers after the run; arrange a guarded
local review session before recording hands-on owner results. No production
activation is implied by accepting this evidence.

| Scenario | Owner / reviewer expected observation | Automated evidence | Owner result |
|---|---|---|---|
| Sign-in and role navigation | Employee lacks Admin/management links; Manager lacks account administration; role is account-assigned | Passed in Chrome | Pending |
| Cash POS | Explicit reviewed quote, earliest eligible batch, expired/today excluded, accurate cash/change and Manila receipt time | Passed | Pending |
| Adjustment request | Original batch and signed quantity/reason understandable; no stock change before review | Passed; batch-picker usability gap documented | Pending |
| Adjustment review | A different Manager/Admin decides; rejection reason recorded; duplicate approval does not post again | Passed | Pending |
| Receipt-linked return | Correct original receipt/item/batch; pending/rejected requests clearly distinguished | Passed | Pending |
| Return approval/rejection | Independent reviewer; no automatic refund, credit or sellable stock increase | Passed | Pending |
| Physical receipt | Confirm full actual receipt into quarantine once; partial receipt explicitly unsupported | Passed | Pending |
| Medicine disposition | Destroy/supplier-return/restock terminology matches real procedure; approvals consume quarantined units | Restock browser flow and all-action integration limits passed | Pending pharmacist review |
| Pharmacist restock | Real qualification evidence process defined; independent authorized reviewer assesses storage/integrity; no expired/today restock | Explicit synthetic authorization exercised; clinical policy not certified | Pending pharmacist review |
| Unified Approvals | Correct request/history tabs; own requests have no approval action; PO/Stock-In permissions preserved | Passed | Pending |
| Alerts and thresholds | Today/expired/upcoming separated; three calendar months; explicit unset and zero thresholds | Passed | Pending |
| Reporting after returns | Original reconciled cash sale/payment stays recognized through pending/rejected/approved return; no invented settlement | Passed, independently verified | Pending accounting review |
| Statutory discounts | Disabled until VAT, eligibility evidence, documentation, invoice and rounding requirements are validated | Fail-closed/disabled verified | Blocked pending validation |
| Wireframe usability | Review batch-ID entry, inline history/review density, receipt layout and print/shortcuts gaps; XLSX/PDF now tested | Current Batch 6 screenshots and nine reference images reviewed | Pending |

Record acceptance findings as reproducible steps, expected/actual behavior,
synthetic role, screenshot and severity. Separate a defect from a new scope
request; do not change accounting or approval rules during UAT without approval.

Owner/reviewer: ____________________  Review date: ____________________

Pharmacist reviewer and qualification-verification process: ____________________

Accepted local scope / outstanding findings: ____________________

Production migration approval: **Not granted by this checklist.**
