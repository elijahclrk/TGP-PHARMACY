# Batch 11 — owner/pharmacist/accountant local UAT walkthrough

Date: 22 November 2026, Asia/Manila. **Prepared for review; no human acceptance recorded.** Automated green checks are evidence for the local implementation, not clinical, legal, accounting or production approval.

## Open the safe demonstration

Use the existing disposable PostgreSQL environment only. From `server/`, use the verified Node 24 executable:

```powershell
rtk proxy C:/Users/spori/AppData/Local/Temp/tgp-node24-qZh55x/node.exe testing/local-postgres.mjs verify C:/Users/spori/AppData/Local/Temp/tgp-pg-1795265396785
rtk proxy C:/Users/spori/AppData/Local/Temp/tgp-node24-qZh55x/node.exe testing/batch4-uat.mjs C:/Users/spori/AppData/Local/Temp/tgp-pg-1795265396785 --built-client --review
```

For a **separate synthetic benefit session**, use the same second command with `--benefits --review` instead of just `--review`. The launcher independently proves local identity, authorized TLS and disposable attestation, creates a fresh owned synthetic schema and verifies migration checksums before activating the local app. It runs browser checks before hands-on review. It preserves prior schemas; never reset a business database or copy a production environment file. If verification, certificate validity or browser startup fails, stop and retain the failure; never disable TLS/attestation.

Open only the loopback URL printed by the launcher. Synthetic account credentials stay in that run's private manifest; the operator can enter them privately. Do not share passwords, ID documents or real customer data in the acceptance record. Press Enter/Ctrl+C in the review terminal to stop the app. Retain temporary database/evidence until the owner decides preservation/disposal; no permanent service or deployment is implied.

## Review the core workflows

| Step | What the reviewer should do/observe | Actual human result |
| --- | --- | --- |
| 1. Roles | Sign in separately as Employee, Manager and Admin. Roles come from accounts. Employee cannot manage accounts, approve stock or export reports. | Pending |
| 2. Regular cash POS | Find a synthetic product, adjust quantity, review price, enter cash and finish. Check earliest eligible batch; expired/today batches are excluded. Receipt, cashier, Manila time, change and stock deduction match. | Pending |
| 3. Quote/recovery | Change a quote-critical value in a controlled fixture, or review captured automated evidence. Expect a fresh review, not silent repricing. Lost response freezes the saved reference; original cashier recovers one sale after refresh/re-login. | Pending |
| 4. Delivery and PO | Create/view synthetic supplier/PO/stock-in. PO approval alone adds no stock; approved stock-in posts once. Existing Manager/Admin permissions are preserved. PO-to-delivery/partial receipt linkage is not implemented. | Pending |
| 5. Adjustment | Employee submits batch, signed change and reason without changing quantity. A different Manager/Admin approves or rejects. Rejection and repeated decisions cannot post stock. Accept the request-only Employee policy or record a scope decision. | Pending |
| 6. Return | Find original receipt and sold item/batch. Submit a quantity/reason; independent management review rechecks cumulative limits. Original cash remains recorded through pending/rejected/accepted states. | Pending |
| 7. Quarantine | Confirm full physical receipt only after acceptance; goods remain outside sellable inventory. Partial physical receipt is unsupported. Check the real storage/segregation procedure separately. | Pending pharmacist |
| 8. Disposition | Review destroy/supplier-return/restock requests. Only the explicit test-qualified professional fixture may authorize eligible restocking independently; expired/today stock and repeated postings are denied. Manager role alone is insufficient. No real qualification is created. | Pending pharmacist |
| 9. Approvals/alerts | Review actionable requests and history. Normal sales do not enter an approval queue. Check expired/today/upcoming groups, three calendar months and explicit unset/zero reorder levels. | Pending |
| 10. Reports/exports | Admin compares receipts, cash and return records with all relevant reports and filtered XLSX/PDF. Check current-category labels, exact net amounts, unknown-cost warnings and no customer identifiers in ordinary downloads. | Pending accountant |
| 11. Admin/audit | Inspect public account fields, supported creation/deactivation and audit actions. Check distinct actors and history; do not expect role editing/password recovery/last-active fields that are not implemented. | Pending |
| 12. Notifications | Admin's browser-local dashboard preferences persist only for that browser/account. Safety alerts remain visible. No global/durable preferences, scheduled digest, email/SMS or push delivery is claimed. | Pending |

## Review local Senior/PWD checkout separately

The banner must state **synthetic local benefit checkout**. The normal production application remains unavailable for discounted posting. All displayed tax/eligibility records below are explicit test fixtures, not classification of a real medicine or a declaration of the pharmacy's VAT status.

| Step | Expected review | Actual human result |
| --- | --- | --- |
| 13. Scheme and identity | Choose one of Regular, Senior Citizen or PWD. For a benefit use a clearly synthetic name/ID; complete the scheme checklist. Senior and PWD procedures are separate; Senior has no medicine-booklet field, PWD test procedure requires its booklet attestation. Review representative/guardian evidence as applicable. | Pending pharmacist |
| 14. Mixed basket | Check current displayed prices first. The automation deliberately changes the synthetic exempt product from 100.00 to 101.00 to test stale quotes. After that run, one each of eligible inclusive 112.00, eligible exempt 101.00 and ineligible 112.00 yields 272.80: removed VAT 12.00, discount 40.20, VAT charged 12.00. The original 100.00 fixture vector yielded 272.00. Existing stored receipts retain their original prices. Check each line rather than copying an old total. | Pending pharmacist/accountant |
| 15. Limits/unavailability | Missing ID/name, incomplete attestations, unknown evidence and unsupported promotions must not produce an incomplete financial sale. Prescription-required items need explicit current qualified dispensing authorization and remaining base-unit quantity. No actual public registry verification is claimed. | Pending pharmacist |
| 16. Rounding/FEFO | Compare 0.99 → 0.70 under the **test** intermediate rounding version and three 0.01 units → 0.02 across batch splits. Accountant must approve a production convention; a different convention requires a separately versioned calculation and tests. Fractional base units are unsupported. | Pending accountant |
| 17. Review and pay | Changing identity or quote-critical metadata invalidates review. Explicitly review again, enter cash, complete once and inspect historical per-item/header discount/VAT/tender/change. No routine benefit-sale approval queue. | Pending |
| 18. Benefit recovery/privacy | Inspect automated lost-acknowledgement evidence; recover the original receipt without another sale. Browser checkout recovery contains only opaque verification/reference/cart/cash/token data, not beneficiary identity. Ordinary exports omit identity. Review protected retention/access/SOPs separately. | Pending privacy/owner |
| 19. Reporting/return | A supported completed benefit sale is recognized immediately from immutable net snapshots. Return acceptance and quarantine do not erase its original payment or issue a refund. Discounted profit, deductible share and exchange accounting are not inferred. | Pending accountant |
| 20. Invoice distinction | The confirmation is an internal record, **not a registered fiscal invoice**. There is no accepted seller/permit/serial/print/electronic-invoice procedure here. Review actual approved invoice/printer samples only after branch inputs are supplied. | Blocked pending branch validation |

## Required exchange gap — do not sign off a substitute

The client policy is **product exchange only, no cash refunds**. Current returns/quarantine do not supply a replacement product. No exchange UI/API/ledger exists. Do not demonstrate an unrelated second cash sale as a completed exchange.

Owner, pharmacist and accountant must define eligible exchange reasons/timeframes, original approved-return linkage, equal/higher/lower-value cases, any additional cash and residual-value handling without a cash refund, benefit/tax treatment on the replacement, quantity consumption, approval permissions and report measures. Replacement inventory must use FEFO; returned medicine must stay quarantined until a separate qualified disposition. A reviewed additive implementation and new concurrency/recovery/report tests are required before accepting this requirement. No exchange migration or settlement rule is authorized by this walkthrough.

## Record acceptance accurately

For each scenario record reviewer role, date, synthetic scenario/reference, expected/actual result, screenshot/evidence path, severity, correction or accepted limitation and retest. Keep names of actual approvers only in the approved acceptance process; do not include beneficiary IDs or passwords. All current results above are pending; no signature is assumed.

- Owner acceptance/reference: **Pending**.
- Pharmacist procedure/qualification acceptance: **Pending**.
- Accountant calculation/invoice/report acceptance: **Pending**.
- Required exchange implementation and acceptance: **Missing / pending**.
- Approved reduced scope, if any: **Not supplied**.
- Local Git checkpoint approval: **Pending separately**.
- Production migration/activation/deployment approval: **Not granted**.
