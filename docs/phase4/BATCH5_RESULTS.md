# Batch 5 — reporting, exports and protected benefit preparation

Date: 2026-11-21 (Asia/Manila). Local implementation only. **Production Neon was not connected or changed.** No production migration, feature activation, account creation, commit, push or deployment.

## Implemented and disabled

- Admin report views: transaction history with cashier, original cash tender/change and return-request counts; sales by current category; slow-moving products, defined explicitly as at most a selected number of reconciled units in the selected range (default 0); separate return decisions and physical receipt quantities.
- Existing cash-sale cohort/payment/item/POS-audit reconciliation and historical approved_by metadata are unchanged. Pending, rejected and accepted returns do not remove completed sales. Return requests/acceptance do not create refunds, credits, exchanges or revenue reversals. Unclassified legacy decisions are labeled, never inferred from approved_by.
- All ten report types export genuine XLSX and PDF through Admin-only GET /api/reports/:kind/export?format=xlsx|pdf and the same validated server filters. Exports cover all filtered rows, not just the visible page; requests over 10,000 rows fail rather than truncate. Date ranges stay inclusive Manila business dates, maximum 366 days. Managers retain their original daily/weekly sales and inventory permissions; no export permission was added.
- Explicit export allowlists omit beneficiary name/ID and return free text. Text that could begin a spreadsheet formula is escaped; cells contain strings rather than executable formulas. Financial amounts remain exact decimal text (including values above JavaScript's safe integer range). Summary/coverage sheets and PDF summaries use the same repository results as on-screen calculations.
- PDF uses bundled, unmodified Noto Sans with the SIL OFL license and no runtime download. Parsed output verifies names, peso and Greek glyphs as well as monetary values and multiple pages.
- POS Senior/PWD selection, required beneficiary name and ID fields stay visibly unavailable/disabled. No beneficiary data is sent, persisted or logged through this UI. Authenticated GET /api/pos/benefits/availability explicitly returns available:false.
- New unmounted server-only benefit adapter reads migration 009 scheme-specific eligibility evidence and independently reviewed tax metadata, obtains authoritative regular POS prices/FEFO under the caller's transaction, then invokes the existing integer-cent calculator. Mixed eligible/ineligible and VATable/exempt baskets are supported in preparation tests.
- A reviewed server policy must identify source/version, price basis by tax treatment, rounding and rates, plus verified branch tax, medicine evidence, documentary procedure and invoice signoffs. Default policy provider returns null. Unknown/missing evidence or price basis fails closed. No rates are statutory defaults.
- Quote fingerprint binds cashier, beneficiary identity, normal price/date/FEFO quote, full metadata/evidence versions, policy and calculated amounts. Any change requires fresh review, even when the net price is unchanged. A future activated caller must verify the existing cashier-bound HMAC token and pass its verified fingerprint, never a browser bare hash.
- No discounted quote/checkout/posting route was activated. Existing regular checkout validation, transaction/recovery and FEFO logic remain unchanged. Migration 009 and all original migration files were preserved.

## Exact validation

Runtime: Node.js **24.22.3**, satisfying declared >=24. Installed shell default is still Node 22; commands explicitly used the verified temporary Node 24 executable.

| Check | Final result |
|---|---|
| Frontend Vitest | 113 passed, 0 failed, 0 skipped; 15 files |
| Backend Node test runner, all allowed local DB flags | 178 reported entries passed, 0 failed, 0 skipped; 34.74 seconds |
| ESLint | Passed |
| Vite production build | Passed, 69 modules, write:false; existing dist preserved |
| Production dependency audit after UUID correction | 0 vulnerabilities |
| Real Chrome 157.0.8103.79, 1440×1000 | 13 journey groups passed; 28 screenshots; 0 runtime errors, unexpected API errors or external page requests |
| Independent final read-only UAT verification | Passed: local TLS/attestation, seven migration checksums, unchanged empty public baseline, cash payments and once-only restocking |
| git diff --check | Passed |

The 178 Node entries include grouped parent entries and support-file discovery; they are not 178 distinct browser scenarios. No database integration suites were skipped. Discounted posting, fiscal invoice acceptance and client/pharmacy UAT approval remain unperformed and unavailable by design.

Coverage includes prior authentication, current-role RBAC, CSRF, purchasing/stock-in, inventory, FEFO, quote recovery, adjustment/return/disposition approval, independent pharmacist authorization, concurrency, rollback and immutable financial snapshots. New checks cover exact XLSX/PDF parsing, formula injection, PII exclusion, multi-page PDFs, all 20 report/format combinations, Admin enforcement, date/filter rejection, transaction/category/zero-sales reconciliation and legacy return compatibility. Real migration 009 classifications integrate with actual locked POS quotes without posting a sale; evidence-version edits invalidate review, unknown classifications reject, and fixture changes roll back. Missing beneficiary identity, client price/discount injection, duplicate products/double schemes, unknown classifications, invalid money and rounding are rejected or verified by the combined benefit suites.

Browser groups replay the original eleven Batch 4 journeys plus new report-view and actual XLSX/PDF-download journeys. Original cash sale: PHP 224.00, tender PHP 300.00, change PHP 76.00, approved_by NULL. Recognition survives pending, rejected and accepted returns. Accepted return physically receives one unit into quarantine; only separately verified synthetic pharmacist authorization permits once-only original-batch restock. The final return report separately shows one approved/received record and one rejected/unreceived record.

## Isolation and retained evidence

Existing disposable PostgreSQL **17.12**, literal **127.0.0.1:58446**, verified **TLS 1.3**, valid IP/SAN certificate and external database attestation. Untrusted CA, wrong hostname and wrong attestation negative checks pass. Dedicated test role is unprivileged. No production URL is a fallback; test children receive a nonconnecting production.invalid sentinel and a distinct explicitly attested local test target.

Full suites use owned disposable schemas and clean up their own fixtures. Browser UAT applies **001 → 002 → 004 → 003 → 007 → 008 → 009** only inside a newly owned synthetic schema. Public 001/002/004 baseline, constraints and zero business rows remain unchanged. No migration source/checksum was altered. Workflow flags true only in local UAT child processes; shared/production configuration was not edited. Statutory benefits remain false.

Final UAT schema: tgp_uat_5ffe6c056ddb4aa98cb272b007f267f2.
Retained directory:
C:/Users/spori/AppData/Local/Temp/tgp-pg-1795265396785/tgp_uat_5ffe6c056ddb4aa98cb272b007f267f2

- review.html: screenshot gallery and passed journeys
- browser-results.json: browser outcomes
- verification.json: independent read-only database checks
- screenshots/: 28 actual UI captures
- downloads/tgp-sales.xlsx and downloads/tgp-sales.pdf: actual browser downloads
- Local PostgreSQL root last-test-run.log: complete final backend transcript

No temporary instance or retained evidence was deleted. Local TLS certificate expires 2026-11-28 20:55:04 Asia/Manila; renewed test-only certificate verification is needed for later runs after expiry.

## Statutory and predeployment dependencies

**BLOCKED for statutory activation:** pharmacy accountant/owner must verify branch VAT/non-VAT registration, product-specific current tax treatment including independently exempt medicines, scheme-specific medicine eligibility/evidence and review ownership, authorized beneficiary/representative documentation and identity verification procedures, current prescription/booklet requirements, privacy/access/retention, VAT-inclusive price basis and rounding, invoice fields/numbering/layout and any BIR registration/certification requirements. No legal compliance certification is claimed.

Authoritative starting references reviewed, not a substitute for pharmacy-specific/current signoff:
- [BIR RR 7-2010, Supreme Court E-Library](https://elibrary.judiciary.gov.ph/thebookshelf/showdocs/10/55830)
- [BIR RR 5-2017, official NCDA publication](https://ncda.gov.ph/disability-laws/implementing-rules-and-regulations-irr/revenue-regulations-no-5-2017-rules-and-regulations-implementing-republic-act-no-10754/)
- [BIR computerized receipt/invoice checklist, RMC 5-2021 Annex B](https://bir-cdn.bir.gov.ph/local/pdf/RMC%20No.%205-2021%20Annex%20B.pdf)

These sources address benefit/tax/documentation topics; they do not establish this branch's tax registration, product classifications, or compliance with subsequent issuances. Current documentary/invoice amendments still require statutory review. Calculator fixtures use synthetic rates and policy sources for arithmetic only.

Before any future discounted activation:
1. Obtain the above dated pharmacy/accounting decisions, reviewed scheme-specific metadata and a versioned server policy.
2. Approve deployment/migration plan, backups, data preconditions, verification and rollback compatibility separately; no production migrations were authorized in this batch.
3. Implement the gated discounted posting transaction and signed cashier review using complete immutable 009 snapshots, payment reconciliation, FEFO/recovery and deterministic per-batch cent allocation; validate real invoice output.
4. Extend reporting recognition explicitly for reconciled snapshot-versioned discounted sales. Current cohort deliberately remains regular cash only; do not silently broaden it.
5. Complete isolated mixed-basket/posting/concurrency/invoice tests and owner/pharmacy UAT. No routine approval queue for valid statutory or ordinary cash sales.
6. Define exchange/refund/credit accounting separately before introducing such financial events. Existing accepted returns are quantity/disposition records only.
7. Package server dependencies plus bundled font/license, use Node 24+, and verify environment-specific gates stay disabled until separately approved.

Current reports/exports require no new migration and remain compatible with baseline 001/002/004; return decision/received fields are read through to_jsonb, with unknown legacy metadata labeled explicitly. Existing draft 009 remains a future posting dependency, not an activation toggle.

## Defects found and corrected

- New benefit adapter initially inherited array shape without the regular cart's duplicate-product refinement; explicit unique-product validation now rejects duplicate discount lines.
- Initial PDF parser test used an outdated cleanup method; corrected to the installed parser loading-task cleanup API.
- ExcelJS transitive UUID advisory fixed with scoped uuid 11.1.1 override; production dependency audit now zero. Excel generation/load, all export endpoints and browser downloads reran successfully.
- PDF standard-font limitations removed by bundling and testing Noto Sans.
- UAT evidence verifier updated to verify new export artifacts and retain compatibility with prior eleven-journey evidence.

No unresolved failing regression or browser defect was observed in the approved scope. Statutory posting, exchange accounting and formal owner UAT are distinct outstanding dependencies.

## Exact Batch 5 file changes

Compared by SHA-256 against the start-of-batch snapshot, preserving prior uncommitted/untracked work. No prior file was deleted.

- `client/src/auth/api.js`
- `client/src/reports/ReportPanel.jsx`
- `client/src/reports/reports.test.jsx`
- `client/src/workflows/BenefitPreparation.jsx`
- `docs/USER_MANUAL.md`
- `docs/phase4/BATCH5_RESULTS.md`
- `server/REPORTS.md`
- `server/package-lock.json`
- `server/package.json`
- `server/src/assets/fonts/NotoSans.ttf`
- `server/src/assets/fonts/OFL.txt`
- `server/src/assets/fonts/README.md`
- `server/src/repositories/reports.repository.js`
- `server/src/routes/pos.routes.js`
- `server/src/routes/reports.routes.js`
- `server/src/services/report-exports.js`
- `server/src/services/report-validation.js`
- `server/src/services/verified-benefit-quotes.js`
- `server/test/report-exports.test.js`
- `server/test/reports.integration.test.js`
- `server/test/verified-benefit-quotes.test.js`
- `server/test/workflow-migrations.integration.test.js`
- `server/testing/batch4-browser.mjs`
- `server/testing/verify-uat.mjs`

