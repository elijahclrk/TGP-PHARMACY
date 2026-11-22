# Batch 4 — local activation, Chrome journeys and UAT preparation

Date: 2026-11-21, Asia/Manila. Owner authorization covered local activation and
synthetic testing only. **Production Neon was not connected or modified.**
Production/shared workflow configuration remains unchanged and both flags are
false. No commit, push or deployment occurred.

## 1. Local isolation proof

The existing disposable **PostgreSQL 17.12**, **127.0.0.1:58446** instance passed
the read-only preflight: verified TLS 1.3 certificate/IP identity, exact port,
random database attestation, unprivileged fixture login, protected baseline
001/002/004 history and matching checksums. Untrusted CA, incorrect hostname and
wrong attestation were rejected. The source original schema/applied migration
files are unchanged. No TLS validation was disabled.

The public baseline remains unchanged with zero application rows. UAT writes
used a freshly owned schema in that disposable database, never public or Neon.
The final evidence schema is:

`tgp_uat_bc7c288ce6fc4c5293b3e1ef3b790923`.

Installed and independently checksum-verified there only:
**001 → 002 → 004 → 003 → 007 → 008 → 009**. Optional 005/006 were not silently
added to the UAT release. The existing image integration test separately checks
006 in a rolled-back disposable schema; images remain disabled in the app.

The local app child received an explicitly constructed 127.0.0.1 database URL,
the temporary CA, exact `PGOPTIONS` schema scope, local JWT and local-only
`CONTROLLED_WORKFLOWS_ENABLED=true` / `RETURN_RESTOCK_ENABLED=true`. Before
listening, it independently checked TLS, identity, attestation, current schema
and installed workflow compatibility. The API and Vite bound to loopback only.
Parent/project `.env` files were not edited. Backend regression children retained
their unusable production sentinel and separate attested test URL.

Five synthetic accounts represented a requesting Employee, management reviewer,
Admin, a distinct Manager with an explicit **SYNTHETIC TEST ONLY** pharmacist
authorization, and its separate synthetic verifier. Manager role alone was never
treated as pharmacist qualification. All accounts, inventory, transactions,
authorization fixtures, credentials, browser profile, screenshots and generated
UAT artifacts are retained within the disposable environment.

The original local PostgreSQL instance and prior review schemas were not deleted.
The temporary UAT API, frontend and browser processes shut down after the runs;
no Windows service or permanent infrastructure was created.

## 2. Actual browser results and screenshots

Chrome **157.0.8103.79** was actually launched headlessly at **1440 × 1000**,
locale en-PH, timezone Asia/Manila. No Playwright installation was initially
available. A pinned **playwright-core 1.65.1** driver was installed under the
disposable root and used the already installed Chrome executable. No browser
download or project dependency/package-lock change was needed. The driver
blocked non-loopback page requests; no external page request occurred.

The final run passed **11 browser journey groups**, captured **23 actual
screenshots**, and recorded **0 page runtime errors** and **0 unexpected API
failures**. Four initial `/auth/me` 401 responses were expected before sign-in.
Deliberate authorization/conflict probes used authenticated API requests and
were checked for the expected denial status.

Review all screenshots in the retained [HTML evidence gallery](C:/Users/spori/AppData/Local/Temp/tgp-pg-1795265396785/tgp_uat_bc7c288ce6fc4c5293b3e1ef3b790923/review.html).

Selected actual screenshots:

- [Cash receipt with correct Manila time](C:/Users/spori/AppData/Local/Temp/tgp-pg-1795265396785/tgp_uat_bc7c288ce6fc4c5293b3e1ef3b790923/screenshots/pos-receipt.png)
- [Independent adjustment approval and history](C:/Users/spori/AppData/Local/Temp/tgp-pg-1795265396785/tgp_uat_bc7c288ce6fc4c5293b3e1ef3b790923/screenshots/adjustment-approved.png)
- [Physical return receipt into quarantine](C:/Users/spori/AppData/Local/Temp/tgp-pg-1795265396785/tgp_uat_bc7c288ce6fc4c5293b3e1ef3b790923/screenshots/return-quarantine.png)
- [Explicit synthetic pharmacist assessment](C:/Users/spori/AppData/Local/Temp/tgp-pg-1795265396785/tgp_uat_bc7c288ce6fc4c5293b3e1ef3b790923/screenshots/pharmacist-assessment.png)
- [Original cash-sale report after restock](C:/Users/spori/AppData/Local/Temp/tgp-pg-1795265396785/tgp_uat_bc7c288ce6fc4c5293b3e1ef3b790923/screenshots/report-after-restock.png)

The gallery, `browser-results.json`, `verification.json`, API log and private UAT
manifest are under that retained schema's directory within the temporary root.
Do not publish private manifests: they contain temporary test credentials.
No credentials or connection strings were printed or added to this repository.

## 3. Complete journey outcomes

| Browser journey | Verified outcome |
|---|---|
| Login / navigation | Real Employee, Manager, Admin and pharmacist-fixture logins; role-specific navigation; Employee denied Admin threshold route |
| POS / receipt | Two units sold for PHP 224.00; PHP 300 cash, PHP 76 change; FEFO used original earliest eligible batch; expired/today stock unchanged |
| Adjustment approval | Employee requested −1; distinct Manager approved; stock 55 → 54; repeated decision returned conflict without another posting |
| Adjustment rejection / self-review | Rejected −2 left stock unchanged; management's own request showed no approval action and API self-approval was forbidden |
| Pending return | Actual receipt/original sale item/batch selected; pending request did not erase PHP 224.00 cash-sale recognition |
| Rejected return | Independent Admin rejected with a reason; cash report and payment remained unchanged |
| Accepted return / quarantine | Separate return accepted by Admin; Employee recorded one physical unit in quarantine; sellable original batch remained at 3 |
| Pharmacist disposition / restock | Distinct qualified test reviewer selected authorization and recorded suitability assessment; one unit posted to original batch 3 → 4; repeat failed, quarantine balance 0 |
| Unified approvals | Existing Manager self-approval of PO and Stock-In remained compatible; PO did not post stock, Stock-In posted four units once; rejected return history remained viewable |
| Alerts / thresholds | Today, expired and upcoming batches appeared in separate views; Admin explicitly set an unset threshold to zero; Employee access remained denied |
| Protection / statutory preparation | CSRF and Employee review probes denied; Senior/PWD name/ID controls disabled; no discounted checkout or financial snapshot was fabricated |

Final independent SELECT-only verification confirmed one original cash sale,
unchanged PHP 300 payment/PHP 76 change and NULL historical `approved_by`, one
rejected return, one accepted/physically received return, and one authorized
restock. Batch balances were **301=4, 302=54, 303=3, 304=3, 305=4**. All seven UAT
migration checksums matched current source and the public baseline stayed empty.

## 4. Regression results

Runtime: existing temporary **Node 24.22.3**; default installed Node unchanged.

| Check | Exact result |
|---|---|
| Real Chrome journeys | **11 passed**, 0 failed in final run; 23 screenshots |
| Frontend Vitest | **111 passed**, 0 failed, 15 files; 14.04 seconds |
| Backend Node runner | **168 reported entries passed**, 0 failed, **0 skipped**; 33.1561114 seconds |
| PostgreSQL suites | All eight groups executed against the attested local instance |
| Frontend ESLint | exit 0 |
| Production Vite build | v8.3.8, 69 modules, 808 ms, exit 0; `write:false`, existing bundle not overwritten |
| Git whitespace check | exit 0 |
| Final evidence verification | Read-only database and checksum assertions passed |

Backend totals include parent/nested entries and two helper-module load checks.
Coverage retained CSRF, RBAC, rejection, active-role rechecks, FEFO exclusions,
checkout recovery, competing requests/approvals, return limits, pharmacist
revocation locking, atomic audit rollback, deferred wrong-batch rejection and
financial snapshot reconciliation. No integration suite was skipped.

## 5. Verified defects corrected and remaining requirements

Two application defects were confirmed by browser evidence and corrected:

1. **Host-timezone-dependent dates:** Phase 3 UTC `TIMESTAMP WITHOUT TIME ZONE`
   values were decoded by pg as Node-local time, shifting the receipt and
   workflow history by eight hours on this Manila host. POS/receipt lookup,
   purchasing dates and related history now project explicit UTC instants.
   Workflow history then formats them explicitly for Asia/Manila. Stored values,
   financial data and schema history were not changed. New regressions compare
   UTC, Manila and New York Node timezones.
2. **Rejected-history background requests:** the unified screen sent
   `status=rejected` to PO/Stock-In endpoints that do not support that state,
   causing hidden 400 responses. Background purchasing reads now retain their
   existing pending/approved contract. Final Chrome evidence has no such failures.

The first browser attempt stopped after four successful groups because the
automation expected a peso symbol while the established formatter correctly
displayed `PHP`. The selector was corrected, not the financial display behavior.
The first new timezone regression run also exposed an assertion mismatch between
PostgreSQL microseconds and the API's JavaScript Date millisecond precision.
Three assertions (and parent entries: 6 reported failures) were corrected to the
API precision; the final full run is clean. These were test-harness corrections,
not financial rounding changes. Prior failed artifacts remain retained.

### Wireframe comparison

All nine references under `docs/phase3` were inspected: Access, Overview,
Operations, Inventory, Management, Administration, cards, Dialogs and the
combined clickable-wireframe image. Comparison was qualitative, not an automated
pixel-diff claim. Actual tested screens retain the red brand, sidebar/breadcrumb,
gray workspace, white tables/cards and modal structure.

| Reference area | Remaining difference / disposition |
|---|---|
| Access | Role is derived from the account rather than chosen at login; intentional security behavior |
| POS / Dialogs | Cash-only, explicit quote review, PHP prefix and wider transaction-confirmation modal. Scanner, GCash/card, F2/F8 shortcuts, print/fiscal invoice layout remain absent or outside approved MVP. Senior/PWD controls remain disabled. |
| Returns | Functional lookup, request/history and quarantine/disposition sections replace the wireframe's large empty-state card. Owner should validate wording and density. |
| Adjustments | Current form uses original batch ID and signed quantity rather than a friendly product/batch picker and increase/decrease selector. This remains a usability/UAT gap, not silently redesigned in this batch. |
| Management | Separate request-type tabs and detail review replace inline per-row confirmation dialogs. No ordinary cash/statutory approval queue or fabricated monetary return impact. |
| Reports | Reconciled paid sales/history metadata rather than invented net-after-return/discount totals. Excel/PDF exports requested by the client are still missing; wireframe CSV button is not implemented. |
| Cards / Overview | Three calendar months replaces 90 days. No unapproved critical-stock formula or fabricated trend comparisons. |
| Administration | Explicit unset/zero reorder thresholds work. No separate critical level. Discount-rule activation and notification preference panels remain unavailable. Supplier/contact/extra account fields shown in references still need approved schema/scope where unsupported. |

No broad UI redesign or unsupported business-rule implementation was performed.
Remaining release gates include actual owner/pharmacist UAT, clinical disposition
procedures, sufficient independent reviewers, verified professional onboarding,
branch VAT/product eligibility/documentary/invoice validation, statutory reporting,
exchange/refund accounting design, requested exports, and a separately approved
production migration/backup/restore/cutover process. This run is neither legal nor
clinical qualification certification. Cross-browser, mobile, printer and fiscal
invoice acceptance remain unverified.

The [UAT checklist](UAT_CHECKLIST.md) separates automated evidence from the
owner's still-pending acceptance. No owner sign-off has been fabricated.

## 6. Exact repository files changed

- `client/src/pages/Approvals.jsx`
- `client/src/workflows/WorkflowDetails.jsx`
- `client/src/workflows/time.js`
- `client/src/workflows/time.test.js`
- `client/src/workflows/workflows.test.jsx`
- `docs/phase4/BATCH4_RESULTS.md`
- `docs/phase4/UAT_CHECKLIST.md`
- `server/src/repositories/pos.repository.js`
- `server/src/repositories/purchasing.repository.js`
- `server/src/repositories/workflows.repository.js`
- `server/test/pos.integration.test.js`
- `server/test/prepared-workflows.integration.test.js`
- `server/test/purchasing.integration.test.js`
- `server/testing/batch4-browser.mjs`
- `server/testing/batch4-uat.mjs`
- `server/testing/local-uat-app.mjs`
- `server/testing/verify-uat.mjs`

Hashes were compared with the pre-Batch-4 working tree, including untracked
Batch 1/2/3 files. Project dependency manifests/locks, original applied migrations,
Phase 3 SQL and existing local work are preserved. Temporary Playwright files and
synthetic artifacts are outside the repository, under the disposable root.

## 7. Production safety and repeatability

Production Neon received **no connection, writes, migrations or activation**.
No real accounts, business records, credentials, commits, pushes or deployments
were changed. Shared workflow flags were rechecked as **false/false**. Both flags
were true only in transient local UAT child processes, which have stopped.

To repeat the isolated automated journey, from `server` use:

```powershell
rtk proxy C:/Users/spori/AppData/Local/Temp/tgp-node24-qZh55x/node.exe testing/local-postgres.mjs verify C:/Users/spori/AppData/Local/Temp/tgp-pg-1795265396785
rtk proxy C:/Users/spori/AppData/Local/Temp/tgp-node24-qZh55x/node.exe testing/batch4-uat.mjs C:/Users/spori/AppData/Local/Temp/tgp-pg-1795265396785
```

This creates a new retained UAT schema, verifies installed checksums, starts only
loopback test processes and closes them after Chrome verification. The retained
local certificate expires 2026-11-28 20:55:04 Asia/Manila; do not bypass TLS if a
future run fails. Keep the instance and evidence until owner review and separate
cleanup instructions. Do not substitute the ordinary production configuration.
