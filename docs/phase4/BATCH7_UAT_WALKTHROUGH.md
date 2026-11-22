# Batch 7 owner/pharmacist local UAT walkthrough

Current launcher: use [Batch 8 handoff](BATCH8_DEMO_HANDOFF.md) for the guarded
compiled-frontend demonstration, fresh-schema reset, start/stop and evidence,
and [client walkthrough](BATCH8_CLIENT_WALKTHROUGH.md) for review. The original
Batch 7 procedure below is retained as historical reference.

**Acceptance status: PENDING.** This is a repeatable local synthetic review, not
production activation or statutory/clinical certification.

## Start and stop the guarded review

Use the retained attested local PostgreSQL environment only. It must pass verified
TLS, exact loopback/database identity, attestation and baseline checks before
fixtures are created. Local certificate expires 2026-11-28 20:55:04 Asia/Manila;
after expiry, obtain/verify a valid test certificate before proceeding.

From server/ using Node 24.22.3 or another approved Node 24+ executable:

```powershell
rtk proxy C:/Users/spori/AppData/Local/Temp/tgp-node24-qZh55x/node.exe testing/local-postgres.mjs verify C:/Users/spori/AppData/Local/Temp/tgp-pg-1795265396785
rtk proxy C:/Users/spori/AppData/Local/Temp/tgp-node24-qZh55x/node.exe testing/batch4-uat.mjs C:/Users/spori/AppData/Local/Temp/tgp-pg-1795265396785 --review
```

The second command creates a fresh isolated synthetic schema, verifies seven
migration checksums, runs the 17 automated browser groups, then keeps the local API
and UI open. Use the printed **127.0.0.1 URL** in your desktop browser. Read only
the generated private-uat.json manifest in that run's ACL-protected temporary
directory to obtain the test logins. Never use the academic/production credential
file; never paste passwords into reports/screenshots or command arguments.

Use separate browser profiles for Employee, Manager, Admin and the explicitly
synthetic pharmacist-authorized Manager fixture. The fixture represents a verified
test authorization; it does not certify any real person or create production
privileges. After review, press **Enter or Ctrl+C** in the launcher to stop local
app servers. PostgreSQL, evidence and schemas are retained; no permanent service
is installed. Review-mode start, HTTP availability and stop were smoke-tested
without a human acceptance claim.

## Guided review

| Step | Reviewer action | Expected observation / decision |
|---|---|---|
| 1. Roles | Sign in separately as Employee, Manager and Admin | Account determines role. Employee cannot open reports/accounts/approvals; Manager cannot administer accounts, preferences or full Admin exports. |
| 2. POS | Employee searches UAT medicine, adds an available quantity, reviews quote, enters cash and completes one synthetic sale | Future-expiry FEFO batch, correct price/change/receipt/cashier. Expired/today stock excluded. New synthetic transactions stay local and change later demonstration totals legitimately. |
| 3. Quote/recovery explanation | Review provided regression evidence and saved-checkout UI | Changed price/stock/date needs fresh explicit review; uncertain saved request uses same reference. Never replace an uncertain checkout UUID. Do not claim all network faults were manually exercised. |
| 4. Adjustment request | Employee opens Adjustments, searches UAT-LATER, chooses its batch, enters a small signed discrepancy and reason | Original ID selected; no stock change before review. Decide whether Employee request-only access satisfies the operating policy. |
| 5. Independent review | A different Manager/Admin approves one request and rejects another with a reason | Only approved request posts, once; no self-approval. Refresh history. Supplier deliveries remain Stock-In. |
| 6. Return | Employee finds an actual local receipt and selects its sold item/batch/quantity with a reason | Request remains pending; independent review, no automatic refund or sellable stock increase. Respect cumulative quantities after earlier automated returns. |
| 7. Quarantine | Independently accept a request, then confirm the actual full synthetic physical receipt | Accepted and physically received states differ; receipt enters return quarantine, not sellable stock. Decide whether partial physical receipt is required. |
| 8. Pharmacist disposition | Management requests disposition; distinct authorized synthetic pharmacist fixture reviews restock eligibility/storage evidence | Separate current authorization and suitability assessment required; expired/today cannot restock; original batch posts once. Agree real onboarding and clinical SOP separately. |
| 9. Physical stock | Open Products and Alerts | Recorded stock, within-date (expiry only), expired/today quantities are distinct. Low-stock thresholds still compare original recorded quantity; unset differs from zero. No supplier quarantine is fabricated. |
| 10. Purchasing | Inspect PO and Stock-In and their existing approval history | PO approval does not post stock; Stock-In posts once. Existing purchasing self-approval remains; linked received/partial-delivery PO lifecycle remains unavailable. |
| 11. Reports | Admin chooses Best-selling by category and Slow-moving products, applies date/category and max-unit filters | Dense ranks within current category; equal units tie. Best-selling positive-unit sales; slow-moving includes zero-sale products. Categories are current catalog, not historical snapshots. |
| 12. Exports | Download XLSX and PDF for the same applied report filters | All filtered rows up to 10k, same amounts/ranks; exact decimal text in Excel, Unicode PDF, no beneficiary name/ID. Current cash history is not reversed by return acceptance. |
| 13. Preferences | Admin disables an upcoming-expiry dashboard reminder, reloads, then opens Alerts | Optional reminder suppressed only on that account/browser. All safety Alerts remain available. Restore preference. Durable/global settings and other reminder types are unavailable. |
| 14. Audit/session | Admin searches audit action/reference; Employee logs out and signs in again | Stored actor/action/history readable; original cashier receipt accessible after re-login; revoked session rejected. Raw general audit timestamps are explicitly labeled unzoned storage. |
| 15. Deliberately unavailable | Open statutory preparation panel and inspect invoice/print expectations | Senior/PWD fields/actions disabled. No fiscal-certified print/invoice or discounted posting. Record statutory/accounting requirements, not an acceptance of nonexistent functionality. |

Automated final baseline before any human-created additional transactions: cash
sale 224.00/tender 300.00/change 76.00; original batch final quantity 4. For a new
reviewer-created sale, compare its actual receipt and report delta rather than
expecting the old total to remain constant.

## Record genuine acceptance

Reviewer name/role: ____________________  Date/time: ____________________

Scenario and synthetic receipt/request: ____________________

Expected versus actual / screenshot path / severity: ____________________

Owner adjustment-role decision: ____________________

Pharmacist receiving/quarantine/qualification/disposition decision: ____________________

Report/ranking/notification-scope acceptance: ____________________

Accepted local scope / unresolved items: ____________________

**All fields remain unsigned. Production migration, statutory activation and
deployment approval are separate and are not granted by this walkthrough.**

