# Local client demonstration walkthrough

Date: 2026-11-22 Asia/Manila. **Synthetic demonstration only. Owner and pharmacist acceptance remains unsigned.**

Ask the operator to start the guarded demo using [the local handoff](BATCH8_DEMO_HANDOFF.md). Open only the local address supplied by that run. Use its separate test accounts, never real pharmacy credentials or customer identities. Automated examples will already be visible. Additional manual actions create legitimate new local history; start a fresh scenario to repeat the original totals.

| Step | What to review | Expected behavior |
| --- | --- | --- |
| 1. Sign in | Employee, Manager and Admin navigation | One web application with different permissions. Admin account/report/settings screens are unavailable to unauthorized roles. Signing out invalidates the old session. |
| 2. Cashier sale | Search the synthetic FEFO medicine, review batch/price/quantity, pay cash, reopen Last receipt | Earliest eligible batch is selected; expired/today batches are excluded. Completed synthetic example: 2 × PHP 112 = PHP 224, PHP 300 tender, PHP 76 change. Receipt shows cashier and Manila time. Review any changed quote again before payment. |
| 3. Delivery | Purchase orders, Stock-In and unified approvals | Existing PO/Stock-In permissions apply; approve the synthetic delivery once. Supplier deliveries use Stock-In, not inventory adjustments. |
| 4. Adjustment | Employee selects original batch, signed quantity and reason; separate Manager/Admin reviews | No direct stock edit by Employee, no self-approval, approved quantity posts once. Rejection changes no stock and remains in history. Review both approved/rejected automated examples. |
| 5. Return | Find the actual synthetic receipt and original sold line/batch | Quantity is limited by the original sale and other returns. Separate Manager/Admin accepts or rejects. A request or acceptance does not refund cash or restore sellable stock. |
| 6. Physical medicine | Accepted return, physical receipt and quarantine | Physical receipt is separate from acceptance. Received medicine stays quarantined until a supported disposition. Pending/rejected examples do not become sellable stock. |
| 7. Professional decision | Separate explicitly qualified synthetic professional reviews evidence | Manager role alone grants no pharmacist qualification. Eligible original-batch restocking needs the separate authorized assessment and posts once. Expired/ineligible medicine cannot be restocked. This fixture is not a real professional registration. |
| 8. Owner reports | Transactions, category rankings, slow-moving, accepted returns | Original reconciled cash sale remains PHP 224 through pending, rejected and accepted returns. Returns are shown separately; no invented refund, credit or revenue reversal. Additional manual sales change totals normally. |
| 9. Downloads | Apply the same report filters, download Excel/PDF | Eleven report types support exports. Compare totals and filters with the screen. Files are analytical reports; transaction confirmation is not a validated fiscal invoice. |
| 10. Alerts/settings | Expired/today/upcoming, recorded versus within-date quantities, Admin thresholds and reminders | Three calendar months/Manila dates; unset thresholds explicit. Two optional dashboard reminders apply only to this account/browser. Safety Alerts remain accessible; no SMS/email/push service is implied. |
| 11. Audit/history | Unified approval history and Admin audit records | Correct initiator, independent reviewer, decision, reason and posting trail. Normal cash sales do not wait in approvals. |
| 12. Unavailable functions | Senior/PWD and fiscal invoice notices | Preparation fields/calculation checks exist, but statutory checkout and fiscal invoice functionality stay unavailable pending validation. Do not enter real names/IDs or treat a synthetic calculation as compliance evidence. |

Review the gallery linked in [Batch 8 results](BATCH8_RESULTS.md) against the nine clickable references. The shell, hierarchy and working role screens follow the reference direction; some forms remain inline, the adjustment uses a signed original-batch change, and protected return/disposition steps are more explicit. Cash-only payment, unavailable statutory rules, absence of an invented critical-stock formula and limited local reminders are deliberate documented scope differences. Record any remaining visual concern instead of assuming pixel-perfect acceptance.

## Acceptance record — not completed by automated QA

- Owner/reviewer, date and reviewed run: **pending**.
- Pharmacist/reviewer and professional evidence: **pending**.
- Cash, delivery, adjustment, return/quarantine/disposition, reports and role permissions: **pending human acceptance**.
- Operating policy for Employee adjustment requests versus original SRF access restrictions: **pending owner decision**.
- Pharmacy VAT status, medicine eligibility evidence, tax classifications, documentary checks and fiscal invoice/accounting review: **pending; statutory posting remains disabled**.
- Accepted limitations, requested changes, responsible person and due date: **to be recorded by reviewers**.
- Deployment/backup/restore/migration authorization: **separate and not granted by this walkthrough**.
