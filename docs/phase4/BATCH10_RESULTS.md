# Batch 10 — local Senior/PWD checkout implementation

Project date: **22 November 2026, Asia/Manila**. Scope: local implementation and isolated testing only. **Production statutory checkout and fiscal invoicing remain unavailable.** This report does not certify legal compliance or record owner/pharmacist/accountant acceptance.

The three Batch 9 documents were read before implementation and preserved. They remain the source register and branch approval checklist: [research](BATCH9_SENIOR_PWD_RESEARCH.md), [specification](BATCH9_SENIOR_PWD_TECHNICAL_SPEC.md), [validation](BATCH9_VALIDATION_CHECKLIST.md). Their implementation-status statements describe Batch 9 historically; the evidence below supersedes them only for the local technical work completed here.

## A. Features implemented

- Regular, Senior Citizen and PWD selection in the locally activated POS. Beneficiary name, identification number, scheme-specific presented document and explicit verification attestations are required. Identity stays out of ordinary receipts, reports, exports, logs, URLs and checkout recovery storage.
- Senior and PWD documentary checklists are separate. The synthetic Senior procedure has no medicine-booklet requirement; the synthetic PWD procedure requires booklet verification. Representative/guardian evidence is explicit. These test procedures are not branch SOP approval.
- Effective, server-controlled, versioned policy and per-product benefit/tax/price-basis evidence. Unknown eligibility, unknown tax/basis, expired or missing evidence, unsupported promotions and incomplete documents fail closed. Client-submitted financial metadata is rejected.
- Mixed eligible/ineligible baskets, eligible VAT-inclusive and already VAT-exempt items, and explicitly configured synthetic non-VAT mode. No VAT removal is applied to already exempt or non-VAT prices. Promotion stacking is unavailable.
- Quote tokens bind actor, opaque documentary verification, cart, prices, FEFO/business date, policy, classification and calculated totals. Identity edits invalidate the UI quote; stale server data requires explicit fresh review. Quotes reserve no stock.
- Cash, physical FEFO allocation, financial snapshots, payment and paid-sale audit post in one transaction. Normal completed benefit sales have no routine approval or fabricated `approved_by`. Existing role/CSRF/session checks and checkout closure/recovery remain.
- Same-reference identical retries recover the original receipt. Changed payloads or another cashier receive a conflict, without treating a completed request as a correctable fresh sale. A genuinely stale unposted quote closes its reference before editing.
- Prescription-required synthetic items require a current explicit pharmacist authorization belonging to the dispensing cashier, a prescription reference and a verified base-unit quantity. Local cumulative fills are capped under transaction serialization, including competing requests. Manager role alone confers no qualification. This is not a cross-pharmacy prescription ledger or a replacement for physical endorsement procedures.

## B. Migration design and isolated execution

New proposal: `server/database/migrations/proposed/batch10/011_local_benefit_checkout.sql`.

The complete isolated dependency order tested is **001 → 002 → 004 → 003 → 007 → 008 → 009 → 011**. Migration 010 remains independent and unapplied. The direct financial schema dependency is 009; the exercised dispensing/return environment also requires 003/007/008, including the professional authorization registry. The original 001/002/004 and previously completed 003/007/008/009/010 files were not edited in this batch.

011 adds immutable policy versions, product evidence versions, documentary verifications, logical product pricing lines, prescription-fill records and version2 header/item extensions. Existing version1/legacy checks are retained; only version2 uses the new complete financial checks. Quantities, cent precision, source/rate consistency, tax bases, cash net payment, paid audit, logical-to-FEFO allocation, identity and totals reconcile. New fields cannot silently attach partial benefit metadata to legacy rows. Completed snapshots, evidence, payments and paid audit records are protected from rewriting.

The local gate compares installed canonical 009/011 function bodies, required enabled triggers and required constraints. Missing/stale schema or disabled guards keep the feature unavailable. Tests covered fresh installation, populated legacy/version1 preservation, failed historical edits, uncommitted DDL rollback and reapplication inside an owned test transaction. No down migration or historical backfill was executed.

**Important compatibility limit:** 011 deliberately requires `test_only=true` policies. It is a local test contract, not a production activation recipe. A future production policy provider, production gate, branch evidence publication/privacy procedures and any successor migration require separate review. Do not remove a test-only check or substitute an environment flag to activate it.

For future migration planning: take and verify an authorized backup/restore first; inspect actual installed checksums and legacy data; release compatible readers/reports before any new posting; apply only reviewed additive successors with a migration ledger; perform post-migration reconciliation before considering activation. On an incident, disable **new** benefit posting while retaining compatible historical receipt/recovery/report readers. Preserve committed financial history and forward-fix; dropping snapshot tables or reverting to readers that exclude discounted sales is unsafe. No live backup, migration, restore or deployment was attempted here.

## C. Calculation evidence

All amounts below are **synthetic test vectors**, not approved branch prices or a universal legal rounding determination.

| Vector | Verified result |
| --- | --- |
| Eligible VAT-inclusive 112.00, VAT-registered synthetic policy | 12.00 VAT removed, 20.00 discount, 80.00 payable |
| Eligible already VAT-exempt 100.00 | No VAT removal, 20.00 discount, 80.00 payable |
| Known ineligible VAT-inclusive 112.00 | No statutory discount/removal; 100.00 VATable base + 12.00 VAT |
| One of each above, Senior and PWD | Gross 324.00; removed VAT 12.00; discount 40.00; payable 272.00 |
| Explicit non-VAT mode, eligible 112.00 + ineligible 112.00 | Payable/non-VAT base 201.60; VAT and VAT removed zero |
| Eligible 0.99, configured intermediate half-up | Payable 0.70; the alternative convention remains an accounting sign-off question |
| Three units at 0.01, split across FEFO batches | Logical payable 0.02; allocated cents still sum to 0.02 |

The local calculation version is explicitly `half_up_product_line_v1`, with integer/BigInt cent arithmetic and deterministic largest-remainder allocation across physical batch rows. Fractional base-unit quantities are rejected; no unapproved package/unit conversion is inferred. Missing name/ID, wrong scheme document, absent PWD booklet, invalid attestations, unknown classifications, unsupported promotion/double-discount input, invalid price precision, expired policy and insufficient/unauthorized prescription evidence are tested negative paths.

## D. Checkout, receipts, reporting and privacy

Internal historical transaction confirmations use stored item names, batch/expiry, unit prices, net amounts, discounts and VAT amounts. They show item and header breakdowns, cash tender and change, without claiming to be fiscal invoices. Product renaming/repricing does not rewrite the completed receipt. No invented invoice authorization, serial series, refund, credit, exchange or supplier reimbursement was introduced.

Supported immutable version2 sales join the existing immediately recognized, cash/payment/item/audit-reconciled report cohort. Snapshot net line amounts replace gross-price multiplication only for supported benefit snapshots. Transaction history and its Excel/PDF exports add scheme, snapshot gross, discount, VAT removed and VAT charged. Other sales/product/category/ranking totals use the same posted net values; categories remain explicitly current catalog categories. Ordinary report RBAC, server filters, exact decimal export text and formula escaping remain intact.

The real browser run posted three sales totaling **432.02**: Senior mixed basket **352.00**, PWD exempt basket **80.00**, and recovered PWD tiny-line basket **0.02**. Transaction export discount total was **80.01**. Excel and PDF bytes were downloaded, parsed and checked against posted snapshots. No beneficiary name or identification number appeared in those exports or recovery storage. Discounted-sale profit/cost estimates are intentionally withheld pending an approved accounting basis; these are not tax-deductible-discount schedules.

Discounted receipt lookup and return qualification now accept supported reconciled version2 transactions. Acceptance/physical receipt creates quarantine only; pending/accepted return records leave the cash-sale total at **432.02**. Existing rejection/reporting cases also remain covered by the regression suite. No automatic refund or sellable-stock restoration occurs. Existing independent review and separate pharmacist disposition controls remain unchanged.

## E. Validation results and retained evidence

| Validation | Passed | Failed | Skipped | Evidence/qualification |
| --- | ---: | ---: | ---: | --- |
| Frontend Vitest, 17 files | 122 | 0 | 0 | Final run after receipt/UI changes |
| Full backend and enabled isolated PostgreSQL suite | 209 | 0 | 0 | Node-reported entries include parent tests and support-file entries, not 209 independent business scenarios |
| Final targeted benefit suites, after final guards | 19 | 0 | 0 | Subset of backend coverage, not 19 additional distinct regression entries |
| Existing desktop Chrome journey groups | 17 | 0 | 0 | Existing workflows, discount gate off, 38 screenshots |
| New Senior/PWD desktop Chrome journey groups | 9 | 0 | 0 | Latest canonical 011, real HTTP replay/mismatch tests, 8 screenshots |
| Frontend ESLint | Success | 0 | — | No findings |
| Vite production build | Success | 0 | — | Built in retained owned run directories; production React verified, existing project dist preserved |

Runtime used: **Node 24.22.3**, satisfying declared Node >=24; shell-default Node 22.23.4 is not the validation runtime. PostgreSQL **17.12**, port **58446**, loopback **127.0.0.1**, certificate-authorized **TLS 1.3**. Wrong attestation, wrong hostname and untrusted CA were rejected; the test role has no superuser/createdb/createrole privileges. Public baseline ledger/checksums remain 001/002/004; proposed migrations are installed only in owned disposable schemas.

Retained temporary root: `C:\Users\spori\AppData\Local\Temp\tgp-pg-1795265396785`.

- Full clean backend log: `batch10-full-backend.log` under that root.
- Latest targeted backend log: `last-test-run.log` under that root.
- Latest benefit browser run: `tgp_uat_c53b537b0aa640348c652199ee242a46`; `browser-results.json`, screenshots, downloads, built client and redacted API log are retained there.
- Existing 17-journey regression run: `tgp_uat_d2e1fe90fcf04e2491648386a68bb4db`, also under the root.
- Private manifests contain synthetic credentials; they are not included in this document or source control. Do not copy them into handoff screenshots or public reports.

Verified defects corrected during this work: fixture date parameter typing and JSONB cart-key normalization; SQL-comment normalization in canonical function checks; pharmacist authorization expiry-column mismatch; complete enabled-trigger readiness; noncorrectable completed-reference payload conflicts; receipt/item financial display; stale benefit identity clearing and mode preservation; and remaining Windows HTTP fixture ports. All remaining HTTP fixtures now reuse the established high-port loopback allocator instead of `listen(0)`; no Fetch port protection was disabled. One new inactive-session test mock initially lacked `revoke`; its mock was completed and the full suite subsequently passed. Earlier failed development attempts are not reported as passing runs.

The full regression preceded final additional canonical tax/source checks and completed-reference distinction; the affected 19-test subset and the nine real Chrome journeys were rerun successfully afterward. Actual owner/pharmacist/accountant UAT, fiscal printer/invoice acceptance, external documentary registries and a Docker runtime were **not** verified by these tests.

## F. Remaining pharmacy/accounting approvals

All applicable **B01–B16** decisions and official-source closure items in the Batch 9 checklist remain pending. In particular: actual legal seller/VAT registration/effective dates; selling-price basis; scheme-specific product eligibility and current SKU tax-list evidence; professional review/publication permissions; current Senior/PWD identity and representative SOPs; prescription endorsement/remaining quantity procedures; promotional alternative/non-stacking treatment; rounding/grouping; registered invoice issuance/layout/numbering and electronic-invoice applicability; privacy access, notice, retention and disposal; and financial/discount burden-sharing, tax schedules and exchange accounting.

The local evidence model is a test implementation of versioned snapshots, not a completed production clinical/tax dual-review publication portal or statutory beneficiary register. Existing 009 product preparation metadata remains intact; the new effective `benefit_product_versions` registry supplies local checkout authority instead of silently treating old nullable/advisory fields as verified. Future mapping/publication of actual 009/catalog evidence needs qualified review and source digests. Real pharmacist qualification is never inferred from Manager status.

Future production discount activation also needs reviewed production code/policy integration, compatible migration/backup/restore and monitoring plans, current Docker runtime verification where containers are used, signed business UAT and explicit production migration/activation authorization. None was supplied or inferred in this batch.

## G. Exact Batch 10 source files changed

This list is relative to the preserved pre-Batch-10 filesystem hash snapshot, not all dirty Git files from previous batches. **26 existing files modified; 14 files added (40 total).** No pre-existing snapshot file was removed. Original migrations and unrelated prior batch files remained byte-identical.

Modified implementation/UI (10):

1. `client/src/pages/Pos.jsx`
2. `client/src/reports/ReportPanel.jsx`
3. `client/src/reports/reports.test.jsx`
4. `server/src/app.js`
5. `server/src/repositories/pos.repository.js`
6. `server/src/repositories/reports.repository.js`
7. `server/src/repositories/workflows.repository.js`
8. `server/src/routes/pos.routes.js`
9. `server/src/services/prepared-workflows.js`
10. `server/src/services/report-exports.js`

Modified local activation harness (2):

11. `server/testing/batch4-uat.mjs`
12. `server/testing/local-uat-app.mjs`

Modified HTTP test listeners only (14):

13. `server/test/accounts-http.test.js`
14. `server/test/approvals-http.test.js`
15. `server/test/audit.test.js`
16. `server/test/auth-http.test.js`
17. `server/test/auth.integration.test.js`
18. `server/test/database.test.js`
19. `server/test/frontend-serving.test.js`
20. `server/test/inventory.integration.test.js`
21. `server/test/prepared-workflows.integration.test.js`
22. `server/test/product-images.test.js`
23. `server/test/purchasing.integration.test.js`
24. `server/test/reports.integration.test.js`
25. `server/test/thresholds-http.test.js`
26. `server/test/workflows-http.test.js`

Added (14):

27. `client/src/workflows/BenefitCheckout.jsx`
28. `client/src/workflows/BenefitCheckout.test.jsx`
29. `client/src/workflows/benefit-draft.js`
30. `server/database/migrations/proposed/batch10/011_local_benefit_checkout.sql`
31. `server/src/repositories/local-benefits.repository.js`
32. `server/src/services/local-benefit-calculation.js`
33. `server/test/local-benefit-calculation.test.js`
34. `server/test/local-benefit-migrations.integration.test.js`
35. `server/test/local-benefits-http.test.js`
36. `server/test/local-benefits.integration.test.js`
37. `server/test/support/benefit-fixture.js`
38. `server/testing/batch10-browser.mjs`
39. `server/testing/local-benefit-runtime.mjs`
40. `docs/phase4/BATCH10_RESULTS.md`

Temporary evidence/builds/synthetic schemas were created only inside the retained disposable environment. No dependency/package lock, credential, shared environment, original migration or production feature configuration was changed in Batch 10.

## H. Local activation and repeatable review

Local discount activation was exercised successfully in child processes and owned schemas only. Automated API/frontend/browser processes were stopped after testing. The temporary PostgreSQL instance and evidence were retained; it was not reset or deleted. Existing demo schemas were preserved.

From `server/`, use the verified Node 24 executable (these commands do not require displaying any connection URL or password):

```powershell
rtk proxy C:/Users/spori/AppData/Local/Temp/tgp-node24-qZh55x/node.exe testing/local-postgres.mjs verify C:/Users/spori/AppData/Local/Temp/tgp-pg-1795265396785
rtk proxy C:/Users/spori/AppData/Local/Temp/tgp-node24-qZh55x/node.exe testing/batch4-uat.mjs C:/Users/spori/AppData/Local/Temp/tgp-pg-1795265396785 --built-client --benefits --review
```

The second command independently rechecks isolation, creates a new synthetic schema, applies the reviewed local sequence there, runs the real browser journeys, then leaves only the local app open for review. It does not modify production or destructively reseed an old run. Synthetic account credentials stay in that run's private manifest. Press Enter/Ctrl+C to stop the review app. Reverification must pass every time, including certificate expiry; do not disable certificate checks to reuse an expired fixture. No permanent Windows service or new infrastructure was installed in Batch 10.

The normal production application supplies no benefit service and returns controlled unavailable responses. There is no production environment flag that enables this synthetic implementation. The separate local constructor rejects production runtime, remote/default-port targets, missing attestation, mismatched configured targets and unverified TLS before activation. The production application factory also refuses injection of the synthetic service in production mode. Schema/functions/triggers and evidence must be ready even after local identity verification.

## I. Production safety confirmation

**No production Neon connection, write, migration, fixture/account creation, credential change, feature activation, commit, push or deployment occurred.** The academic-accounts environment file was not opened or changed. Write suites use an unusable production sentinel plus a separately attested local test target; the browser app's database URL is overridden only in its local child process. All generated beneficiary/account/product data is synthetic and confined to owned disposable schemas. Batches 1–9 work was preserved; no Git reset, restore, clean or stash was used.
