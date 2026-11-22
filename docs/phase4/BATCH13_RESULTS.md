# Batch 13 — Local product exchange implementation and verification

Date: **22 November 2026, Asia/Manila**. Local checkpoint baseline: `d4c289edabb553ed54dfde507dc84af479cc99d8`. All Batch 12 research/specification/checklist files were retained unchanged. **Local MVP implemented and tested; no production activation, legal certification or pharmacy acceptance is claimed.**

## A. Implemented exchange functionality

The approved voluntary equal/higher-value scope is implemented inside the existing application:

- Exact original receipt/item/batch lookup; approved return plus full physical receipt required. Partial quantities and multiple original/replacement lines work within one root receipt.
- Required reason/actor; pending, approved, rejected, cancelled and posted states; independent current Manager/Admin review, including denial of a Manager reviewing their own request. Approval reserves claim quantity but does not move replacement stock or collect cash. Cancellation releases reservations explicitly; completed history cannot reopen.
- Reuses the actual paid-sale reconciliation helper and POS price/Manila FEFO snapshot. No fictional ordinary sale or original-payment mutation. Claim caps apply across competing approved/posted exchanges; pending requests do not reserve.
- Product-ID replacement pairs must be explicitly present in the private **synthetic local policy**, with current separately verified pharmacist authorization/evidence and a supported nonprescription assessment. Missing/unapproved pair, expired evidence, revoked qualification or prescription requirement fails closed. Role title or generic-name similarity does not establish equivalence.
- Exact-cent equal/higher settlement; guarded, atomic once-only FEFO stock deduction; immutable source/replacement/price/batch evidence, settlement and audit. Expired/expiry-today stock remains excluded. Exchange posting does not change quarantine or create a restock/refund.
- Signed five-minute actor/mode/fingerprint quote; product prices/identity metadata, allocation, expiry, business date, policy/evidence and source capacity changes require renewed review. Reviewed content cannot be silently repriced; a changed approved candidate is cancelled/recreated for independent approval.
- Request and posting UUID/digest replay, durable unused-reference closure and serialized lost-response recovery. Committed replay precedes live-policy/price revalidation. Browser storage contains only opaque operation references, not beneficiary information, free-text reasons or the complete request.
- Returns-page exchange workspace, Unified Approvals exchange view, history and accessible existing Modal component; historical internal confirmation; Admin-only date-filtered exchange report and XLSX/PDF exports.

### Deliberately narrower than the full Batch 12 design

The eight-table research proposal was reviewed. This approved MVP uses **six core tables**; it does not add unused replacement-return/disposition tables or a generic credit wallet. Issued replacement items retain immutable IDs/batches and root-sale lineage for future claims, but automatic processing of a return of a replacement is unavailable. Defective replacements must be referred for authorized handling, never treated as prohibited by a one-exchange-only policy. The separate chain-return adapter and its physical-disposition history remain future work after policy approval.

The broader proposed evidence-only `resolved_externally` terminal workflow is also deferred: an unsupported case is referred without fabricating a settlement, refund, liability, inventory action or an assertion that the customer has been satisfied. Define the human case register and reconciliation procedure before operational release.

## B. Migration and isolated PostgreSQL results

New proposal: [`012_local_product_exchanges.sql`](../../server/database/migrations/proposed/batch13/012_local_product_exchanges.sql).

SHA-256 of the tested file: `4e3b0def83ad79415f3f40ff88b01bf0c9ac2c38e7faef4d612d2f78105f8c01`.

Tables: `product_exchanges`, `exchange_claims`, `exchange_pricing_lines`, `exchange_items`, `exchange_settlements`, `exchange_events`. An exact money domain rejects excess scale/nonfinite/negative/overflow values rather than silently rounding them. FKs, immutable lifecycle guards, original-source checks, cumulative capacity, unique posting/operation references, allocation/header/settlement sums, posted audit evidence and current clinical authorization are enforced. The posting trigger deducts replacement stock exactly once; deferred reconciliation/audit failure rolls the whole transaction back.

Readiness compares three canonical function bodies, checks 12 table triggers plus the audit guard, 48 validated constraints (including six deferred constraint-trigger catalog entries), and the money-domain check. Missing/stale resources or disabled guards yield controlled unavailable behavior. Canonical 012 is narrowly included in container packaging; no runner or automatic migration was added. Actual Docker execution remains unverified.

### Independent isolation evidence

The retained instance was stopped initially; it was restarted with its existing configuration/data directory, without installing a service or changing credentials. Before any test writes, the existing verifier passed:

| Check | Actual result |
| --- | --- |
| PostgreSQL | **17.12**, loopback **127.0.0.1:58446**, nondefault port |
| TLS | **TLSv1.3**, certificate authorized; hostname/CA validation retained |
| Database identity | Expected dedicated disposable name, database attestation, server address/port/data directory verified |
| Negative isolation checks | Wrong attestation, wrong hostname and untrusted CA rejected |
| Test role | Not superuser; cannot create databases or roles |
| Protected history | Public baseline 001/002/004 ledger and SHA-256 checks passed |
| Production fallback | Test children receive an unusable sentinel DATABASE_URL plus separately attested TEST_DATABASE_URL; local app children explicitly use only that same verified local target |

Proposed migration execution happened **only in owned disposable schemas**. Public baseline migration history remained 001/002/004. The PostgreSQL fixture used **001 → 002 → 004 → 003 → 007 → 008 → 009 → 011 → 012**, including existing benefit integration. Exchange browser schemas used **001/002/004/003/007/008/009/012**, proving 011 is not required for the regular exchange MVP. Migration 010 was not applied. No previously existing schema was reset/reseeded by the UAT runner; each run created its own synthetic schema.

003/007/008 are required for original-item linkage, decisions and physical receipt/qualification. 009 is compatible and supplies optional historical markers; 011 is local/test-only benefit support and discounted source transactions are explicitly refused by this MVP. Do not promote 011 as a real production policy publication mechanism. Original 001/002/004 raw hashes match the Batch 11 manifest; all prior migration files remain unchanged.

Successful tests include transactional installation, complete rollback of a new-schema migration transaction, strict database money checks, coexistence with 009/011, disabled-trigger unavailability, competing reservations, concurrent same-key posting, POS-versus-exchange last-stock contention and audit failure deferred until COMMIT after stock writes. Rollback after real posted history must gate off new work and forward-fix with compatible readers; do not erase posted exchanges or reopen consumed claims. Any future production backup/migration/restore requires separate approval and rehearsal.

## C. APIs, UI, approval and feature gates

All exchange endpoints require current authenticated access, trusted-origin/request-marker protection and no-store responses. IDs/inputs are strict; UUIDs normalize case, injected actor/reviewer/price/refund fields are refused. Service transactions recheck actor status/role and use the existing exclusive account/POS advisory lock before source/product/batch locks.

| API under `/api/exchanges` | Implemented behavior |
| --- | --- |
| `GET /availability` | Defaults unavailable; local capability lists supported and unavailable modes |
| `GET /sources?receipt=...`, `GET /products?q=...` | Bounded source/product search with operational projections |
| `POST /quote`, `POST /` | Server-calculated reviewed candidate and idempotent pending request |
| `GET /?state=...`, `GET /:id` | Own Employee records; authorized management history/detail |
| `POST /:id/decision` | Independent Manager/Admin approval/rejection; rejection reason required |
| `POST /:id/cancel` | Authorized explicit cancellation and reservation release; terminal states protected |
| `POST /:id/quote`, `POST /:id/post` | Initiator reviews approved content and completes exact settlement once |
| `POST /resolve-request`, `POST /:id/resolve` | Serialized recorded/posted outcome or durable closure of unused attempt |
| `GET /report?from=...&to=...&format=xlsx|pdf` | Admin-only posted-exchange reporting/export; max 366 inclusive days and 10,000 rows |

The default application constructs no exchange service and has no environment switch that can activate the synthetic module. Production runtime rejects explicit local-exchange injection. The separate `verifiedLocalExchanges` constructor refuses remote/default-port/production/mismatched/unattested targets before workflow access and re-verifies trusted TLS/identity on its connections. Required policy/schema/canonical resources must also pass; a flag alone cannot activate it. Existing production/shared configuration was not edited.

The UI uses the existing desktop shell, red primary actions, bordered cards/tables and accessible modal. Actual exchange screenshots were visually inspected; this is qualitative wireframe alignment, not a pixel-diff or owner visual acceptance. Known presentation limit: the exchange section follows the existing Returns form/history, so the page requires vertical scrolling; recent history is capped at 200 rows and explicitly labeled. Date-filtered owner reports support wider history independently. Normal purchasing permissions and all original return/quarantine/pharmacist-disposition actions remain intact.

## D. Financial/reporting reconciliation

For supported voluntary cases: **replacement payable = original historical return value applied + additional cash due**. Tender minus change equals additional cash due. Equal-value exchanges require zero tender/change; change is never used to disguise a refund of unused original value. Original regular prices must be supported cent values; legacy unknown tax is not guessed.

The new report keeps original paid-sale history separate from posted replacement value/units and actual additional cash. Screen, XLSX and parsed PDF use the same Admin-authorized filters/cohort. Standard report exports cannot accidentally route to an ungated exchange repository; exchange exports use their dedicated gated endpoint. Formula escaping, decimal text and PII allowlists are reused. No beneficiary identifiers, prescriptions, clinical notes or free-text reasons enter ordinary exchange exports.

Verified browser examples:

- Original return value **PHP112**, replacement **PHP112**: additional cash **PHP0**.
- Original return value **PHP112**, replacement **PHP140**: additional cash **PHP28**, tender **PHP50**, change **PHP22**.
- Two posted exchanges: replacement value **PHP252**, applied return value **PHP224**, actual additional cash **PHP28**. Original ordinary sales remained **PHP448** across the synthetic sales/returns used by that browser run; replacement value was not added as another ordinary cash sale.
- A lower-value quote stayed unresolved; no forfeiture, refund, customer credit or tax/revenue reversal was created.

Replacement snapshots record `unassessed_internal` tax status explicitly; no VAT/benefit/fiscal accounting claim is made. Existing valid local Senior/PWD paid sales still report/recover through unchanged v2 snapshots, while discounted exchange sources are refused. No exchange margin, COGS adjustment, supplier reimbursement, VAT reversal, credit note or registered fiscal invoice is invented. Confirmations are labeled **internal exchange transaction confirmations, not registered fiscal invoices**.

## E. Exact validation results

These are separate current Batch 13 layers, not a sum of independent business scenarios or reused historical totals.

| Run | Passed | Failed | Skipped | Evidence / scope |
| --- | ---: | ---: | ---: | --- |
| Frontend full regression, Node 24, one worker | **125** | **0** | **0** | 18 files, including three exchange UI tests; 43.02 s |
| Final full backend with permitted PostgreSQL suites | **224 reported entries** | **0** | **0** | 46.681 s; includes nested tests and support-module entries; not 224 independent user journeys |
| Regular Chrome run | **17 journey groups** | **0** | **0** | Production frontend bundle, 38 screenshots, zero runtime errors |
| Existing local Senior/PWD Chrome run | **9 journey groups** | **0** | **0** | Production bundle, 8 screenshots; real exports/recovery/documentary failures |
| Final exchange Chrome run | **7 journey groups** | **0** | **0** | Production bundle, 5 screenshots; role/CSRF, review, FEFO, top-up, lost acknowledgement and parsed exports |
| Frontend ESLint | Pass | 0 errors | — | Node 24 |
| Production frontend build | Pass | 0 errors | — | Node 24.22.3; Vite 8.3.8; 75 modules, 369 ms for direct final build |

The nine new PostgreSQL exchange subtests cover: equal posting/replay/immutable history; higher cash and report/export reconciliation; multiple items/physical receipt; lower/statutory/unauthorized/discounted refusal; partial quantities/competing decisions/Manager no-self-review/rejection/cancellation; stale price and generic identity/expiry/qualification/closures; post-write deferred audit rollback/schema gate; DDL rollback/money precision; ordinary POS versus exchange concurrency. Four new unit tests cover cent settlement/input/token semantics and refusal of unsafe local activation before connecting. Existing full suites continue to cover auth, role revocation, CSRF, POS recovery, FEFO, returns, adjustments, disposition, reports and exports.

Early development runs exposed a JSON-array-to-PostgreSQL serialization defect, an initially incomplete readiness constraint count (deferred triggers are also catalog constraints), and test-fixture assumptions about available quantity/Manager visibility. Those were corrected without changing approved business rules. ESLint required lazy initialization of the report date. The first frontend run with 17 concurrent workers had an unchanged notification test time out; the final full one-worker run passed without increasing timeouts or weakening security. Earlier failed/intermediate counts are not added to the final results.

### Retained real-browser evidence

All evidence is local under `C:/Users/spori/AppData/Local/Temp/tgp-pg-1795265396785/`, outside Git:

| Run | Retained run directory |
| --- | --- |
| Regular 17 groups | `tgp_uat_a6b888ad2754408aa6a768ad254cc487` |
| Benefit 9 groups | `tgp_uat_764a0ce1ea2b4b599351c493355ce88d` |
| Final exchange 7 groups | `tgp_uat_af250572191446e3b330809ba6632221` |

Final exchange evidence: `exchange-browser-results.json`, `downloads/exchanges.xlsx`, `downloads/exchanges.pdf`, and screenshots `exchange-equal-review.png`, `exchange-approved-queue.png`, `exchange-equal-recovered.png`, `exchange-higher-confirmation.png`, `exchange-owner-report.png`. Browser version: **Chrome157.0.8103.79**, 1440×900 exchange viewport. The runner blocked external browser requests and recorded no runtime errors/external requests. A local private manifest contains synthetic test credentials; it was not displayed or added to Git. `last-test-run.log` in the retained instance contains the final backend output.

## F. Exact Batch 13 files changed

Modified existing files (12):

1. `.dockerignore`
2. `Dockerfile`
3. `client/src/pages/Approvals.jsx`
4. `client/src/pages/ControlledWorkflows.jsx`
5. `server/src/app.js`
6. `server/src/repositories/pos.repository.js`
7. `server/src/routes/reports.routes.js`
8. `server/src/services/prepared-workflows.js`
9. `server/src/services/report-exports.js`
10. `server/testing/batch4-uat.mjs`
11. `server/testing/local-uat-app.mjs`
12. `docs/phase4/FINAL_REQUIREMENTS_MATRIX.md`

Created files (12):

13. `client/src/workflows/Exchanges.jsx`
14. `client/src/workflows/Exchanges.test.jsx`
15. `server/database/migrations/proposed/batch13/012_local_product_exchanges.sql`
16. `server/src/repositories/exchanges.repository.js`
17. `server/src/routes/exchanges.routes.js`
18. `server/src/services/exchange-validation.js`
19. `server/test/exchanges.integration.test.js`
20. `server/test/exchanges.test.js`
21. `server/test/support/exchange-fixture.js`
22. `server/testing/batch13-browser.mjs`
23. `server/testing/local-exchange-runtime.mjs`
24. `docs/phase4/BATCH13_RESULTS.md`

The three pre-existing untracked Batch 12 documents remain untracked and unchanged; they are **not newly created by Batch 13**. No dependency/package lock, original migration, environment/credential file or real account was changed. Production build output is ignored. The requirements inventory remains 63 rows; R63 is now accurately PARTIAL because broader exchange/production routes remain blocked, rather than labeling research or a local MVP as complete live functionality.

## G. Unresolved legal, clinical and accounting scenarios

Still unavailable for automatic posting: lower-value settlement; statutory/defect/recall/dispensing-error remedy valuation; Senior/PWD/other discounted originals or replacement benefits; prescription substitutions/fill corrections; unsupported clinical pairs; replacement-return chains; external remedy-resolution recording; cross-receipt pooling/fractional unit conversion; fiscal document and accounting adjustments. The client-approved no-automatic-refund MVP does not override statutory rights. Staff must use an approved human referral process; software unavailability is not a determination that the customer lacks a remedy.

Actual branch product identity/eligibility/tax evidence, professional onboarding and medicine-handling SOP, refund/price-reduction exceptions, invoice/correction format, privacy/retention and accountant-approved exchange measures require the relevant Batch 9 and Batch 12 checklist decisions. A synthetic pharmacist fixture/pair is not approval of a real clinical replacement. No new restock authorization or production clinical privilege was created.

## H. Remaining release blockers and local review

Production exchanges remain unavailable. Before any release: review the local code/migration and deferred routes; approve actual branch/clinical/accounting policy; establish lawful unsupported-case handling; complete signed owner/pharmacist/accountant UAT; resolve remaining matrix requirements; verify actual Docker/runtime/hosting; rehearse backup/restore and approved migration cutover, particularly 003's populated-return precondition; obtain separate production migration/activation approval. No automatic deployment, full accounting or legal compliance is claimed.

Local setup check: the shell-default Node is **22.23.4**, below the declared requirement; it was not used for the reported tests/build. Use the verified **24.22.3** executable above or an approved Node24 runtime. The `docker` command is unavailable on this computer, so actual container build/runtime verification remains blocked; static packaging checks passed in the backend suite. Final Git diff whitespace checks and all 12 local documentation links passed, and the exact 24-file inventory was verified. One unchanged pre-existing whitespace line was preserved rather than reformatted.

Repeat a **new synthetic local review only**, from `server/`, using the existing retained attested instance:

```powershell
rtk proxy C:/Users/spori/AppData/Local/Temp/tgp-node24-qZh55x/node.exe testing/local-postgres.mjs verify C:/Users/spori/AppData/Local/Temp/tgp-pg-1795265396785
rtk proxy C:/Users/spori/AppData/Local/Temp/tgp-node24-qZh55x/node.exe testing/batch4-uat.mjs C:/Users/spori/AppData/Local/Temp/tgp-pg-1795265396785 --built-client --exchanges --review
```

This revalidates TLS/identity/public migration checksums, creates a fresh owned schema and synthetic fixtures, installs only its reviewed local dependency sequence, runs the seven exchange Chrome groups, then leaves the local review app open until Enter/Ctrl+C. Synthetic credentials stay in its private manifest. Do not substitute a production URL, bypass expired certificates, enable production flags or delete existing run directories. Automated runs in this batch stopped their API/frontend/browser processes; the retained local PostgreSQL instance and UAT evidence were preserved for review.

## I. Production safety confirmation

**No production Neon connection, migration, mutation, feature activation, credential/account change, real pharmacy/customer data change, commit, push or deployment occurred.** All generated accounts/transactions and migration writes were limited to attested disposable local schemas. Original applied migration hashes and prior work were preserved. No Git reset/clean/restore/discard/staging was used. The application remains at local Git HEAD `d4c289e` with reviewed development work uncommitted; stop here for owner review before any production operation.
