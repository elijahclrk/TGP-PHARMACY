# Batch 8 — local finalization and release handoff

Date: 2026-11-22 Asia/Manila. **Local demo and technical handoff ready. Full live-pharmacy release remains NO-GO pending the gates below.**

Production Neon was not connected or modified. No production migration, account,
demo data, flag activation, commit, push or deployment occurred. Prior Batch 1–7
changes and completed Batch 8 work were retained.

## 1. Resumption and completed corrections

Inspected the dirty Git tree, current differences, existing Batch 8 harness and
retained browser/test artifacts before editing. Did not repeat business feature
implementation. The existing temporary PostgreSQL instance was stopped; restarted
that same instance, then independently reverified TLS/identity/attestation before
any isolated schema/data writes. No initialization or permanent service occurred.

- Added the guarded `local-demo.mjs verify|reset|start` facade. Preflight failure
  prevents fixture creation. The only database argument is the attested temporary
  directory; production URL fallback is replaced by an unusable sentinel.
- Repeatable synthetic scenarios use new uniquely owned schemas. Reset never
  deletes/reseeds old schemas or overwrites prior evidence. Start runs the browser
  checks, then holds the local app for hands-on review; Enter stops local app
  servers while preserving the cluster and evidence.
- The browser now exercises an actual compiled production frontend, with built
  assets and index checksum checked independently. Receipt Manila-time formatting,
  Last receipt reopen and Escape close are asserted.
- Corrected two verified harness defects: inherited server development mode in
  the frontend build, and Fetch-restricted HTTP ports. Frontend production mode is
  scoped/restored; emitted assets are checked for development React. The HTTP
  helper explicitly requests high loopback ports, retries collision/refusal with
  a bound and leaves Fetch/application security intact.
- Finalized start/stop/reset/preservation instructions, a nontechnical walkthrough,
  screenshot evidence pointers, requirements/release/UAT updates and known limits.

The owner-reported Windows error 10053 interrupted execution; no conclusive
network root cause was established. Earlier unsuccessful harness runs are not
counted as passes: restricted-port errors were followed by an initial allocator
that repeatedly accepted port 0 and exhausted its retries. Both were superseded
by the corrected explicit high-port helper and the successful final full run.
The first compiled run inherited development React; only corrected, independently
verified production-bundle evidence is used for final acceptance below.

## 2. Actual validation results

| Validation | Result | Scope/evidence |
| --- | --- | --- |
| Frontend regression | **120 passed, 0 failed** / 16 files | Completed earlier in this Batch 8; reused on resume because frontend source/dependencies were unchanged. |
| Backend regression and PostgreSQL integration/concurrency | **189 reported entries passed, 0 failed, 0 skipped, 0 cancelled** | Final Node 24 run, 49,909.0053 ms; includes nested Node test entries, not 189 independent integration suites. All local DB opt-ins enabled. |
| Focused demo/HTTP helper tests | **6 passed** | Included in the final 189; do not add them again. Invalid launcher arguments, preflight failure, fresh-schema plan, production-mode restoration, low-port rejection and bounded collision retries. |
| Frontend lint | **Passed** | Rerun successfully after resumption. |
| Production frontend build | **Passed**, 72 modules | Fresh isolated output; JS 393.54 kB (116.26 kB gzip), CSS 33.55 kB. No replacement of existing client/dist. Production React markers and built index/assets verified. |
| Real Chrome desktop journeys | **17 groups passed**, 38 screenshots | Chrome 157.0.8103.79, 1440 × 1000, Asia/Manila, production-bundle frontend. No runtime errors or external page requests. Only expected unauthenticated /api/auth/me 401s. |
| Export downloads | **Passed** | Actual browser XLSX/PDF files; signatures and server/on-screen filtered totals checked. Eleven report types supported. |
| Independent read-only fixture verification | **Passed** | TLS, attestation, migration checksums, balances, cash recognition, once-only restock, built frontend and exports. |
| Review lifecycle | **Passed** | Loopback HTTP 200 while held; Enter returned exit 0; the frontend listener was confirmed closed. |
| Whitespace/diff validation | **Passed** | git diff --check. |
| Docker/Linux runtime | **BLOCKED / not run** | Docker unavailable; existing static/copied-runtime component verification is not a Linux container test. |
| Actual owner/pharmacist UAT and production HTTPS | **Not performed** | Human acceptance unsigned; local API uses test-only development configuration. |

The backend run covered authentication/session revocation, CSRF/RBAC, purchasing,
inventory, POS FEFO/recovery and changed quotes, audit rollback, concurrent
approvals/checkout/returns, no-self-approval, cumulative quantity limits,
quarantine/qualified disposition, financial snapshots and fail-closed benefit
calculations. Empty/failing/stale schema gates and disposable-target refusal
checks remain in the regression suite. No write-based test used a business DB.

## 3. Isolation and migration evidence

PostgreSQL **17.12**, literal **127.0.0.1:58446**, dedicated temporary directory
`C:\Users\spori\AppData\Local\Temp\tgp-pg-1795265396785`, dedicated disposable
database `tgp_disposable_batch2` and unprivileged application test role.

TLS 1.3 with certificate/hostname verification and minimum TLS 1.2 passed.
Isolation attestation and original baseline migration checksums passed. Wrong
attestation, wrong hostname and untrusted CA were rejected. Configuration was not
weakened. The certificate expires 2026-11-28 20:55:04 Asia/Manila.

Fresh demo schema `tgp_uat_ca9946bcf4a445eea1b94148446ef768` received the tested
dependency sequence **001 → 002 → 004 → 003 → 007 → 008 → 009**, in that schema
only. Proposal **010 remains unapplied**; its preference relation is absent.
The pre-existing public baseline and earlier retained synthetic schemas were not
reset. Independent verification reports `publicBaselineUnchanged: true`.

Workflows/restocking are enabled only in the local child configuration. A separate
explicit synthetic professional fixture represents verified authorization; no
real professional privilege/account was changed. Production flags are untouched.

## 4. Demonstration outcomes and evidence

Current evidence directory, beneath the temporary instance root:
`tgp_uat_ca9946bcf4a445eea1b94148446ef768`.

- `review.html`: final 38-screenshot gallery, labeled Batch 8.
- `browser-results.json`: all 17 actual browser group results, synthetic outcome,
  zero runtime errors and zero external requests.
- `verification.json`: independent read-only integrity results.
- `downloads/`: synthetic sales and category-ranking Excel/PDF downloads.
- `built-client/`: verified production frontend and retained index checksum.
- Instance-root `last-test-run.log`: final 189-entry backend/isolated DB run.

Do not share private-uat.json, private.json or browser-profile contents. No
credentials or real customer identification are included in this report.

The verified example sale remains **PHP 224.00**, cash tender **PHP 300.00**,
change **PHP 76.00**, with cashier identity and no fabricated approval. A pending,
rejected or accepted return does not erase that original reconciled cash sale.
One accepted return was physically received, quarantined and separately authorized
for once-only original-batch restocking; one rejected return was not received.
No automatic refund/revenue reversal occurred. Final batch quantities 301–305:
**4, 54, 3, 3, 4**; recorded stock 68, expiry-only within-date stock 62 and
expired/today stock 6. Additional manual transactions legitimately change these
fixture totals; create a fresh scenario for repeatable assertions.

The 17 groups cover login/navigation; POS/receipt/FEFO; adjustment approval;
adjustment rejection/self-review denial; pending/rejected/accepted-return report
recognition; physical receipt/quarantine; separate pharmacist disposition;
PO/Stock-In permissions; expiry/thresholds; reports; downloads; RBAC/CSRF/statutory
blocks; Admin audit/accounts; stale-cookie revocation/relogin; category rankings/
quantity meanings; and browser-local reminder persistence without hiding safety
alerts. Sales reports and account/audit screens remain Admin-only where defined.

## 5. UI and requirements status

The [62-requirement matrix](FINAL_REQUIREMENTS_MATRIX.md) retains its classifications
and source/client-decision distinctions. Batch 8 adds reliable demonstration and
compiled-browser evidence; it does not upgrade unresolved requirements to tested.
The [nine-reference review](WIREFRAME_ALIGNMENT.md) remains qualitative. Fresh
compiled screenshots confirm role menus, table/card structure, red/neutral shell,
receipt dialog, date rendering, and downloadable results.

Remaining deliberate or partial differences: some inline forms rather than the
reference dialogs; signed original-batch adjustment entry; explicit protected
quarantine/disposition steps; two browser-local reminder checkboxes rather than
four durable/global notification controls; unavailable statutory rule editing and
fiscal invoicing; no unsupported critical-stock formula or noncash payments.
Unsupported PO/product fields and original Employee adjustment-policy conflict
remain documented for owner review. No pixel-perfect or business acceptance claim.

## 6. Exact Batch 8 project files changed

This list identifies Batch 8 changes, not all pre-existing dirty/untracked Batch
1–7 work. No application business source, dependency, environment or migration
was changed by Batch 8. On this resumption, only the HTTP helper/tests and the
handoff documentation needed further edits. Hash comparison with the resumption
snapshot found no missing files and no other source/migration/dependency changes.

New harness/test files:

1. `server/testing/local-demo.mjs`
2. `server/testing/local-http.mjs`
3. `server/test/local-demo.test.js`
4. `server/test/local-http.test.js`

Updated harness/tests:

5. `server/testing/batch4-uat.mjs`
6. `server/testing/batch4-browser.mjs`
7. `server/testing/verify-uat.mjs`
8. `server/test/pos-recovery.test.js`
9. `server/test/pos.integration.test.js`

New documentation:

10. `docs/phase4/BATCH8_DEMO_HANDOFF.md`
11. `docs/phase4/BATCH8_CLIENT_WALKTHROUGH.md`
12. `docs/phase4/BATCH8_RESULTS.md`

Updated documentation, retaining previous history:

13. `docs/phase4/FINAL_REQUIREMENTS_MATRIX.md`
14. `docs/phase4/RELEASE_CHECKLIST.md`
15. `docs/phase4/UAT_CHECKLIST.md`
16. `docs/phase4/BATCH7_UAT_WALKTHROUGH.md`
17. `docs/phase4/WIREFRAME_ALIGNMENT.md`
18. `docs/USER_MANUAL.md`
19. `docs/DEPLOYMENT.md`
20. `docs/BUG_LOG.md`

Temporary artifacts outside Git: restarted existing cluster/local log, retained
test schemas, compiled client, browser profiles, screenshots, downloads and
redacted verification/gallery. Nothing was deleted. Git remains dirty with all
earlier work; no automatic commit or remote operation occurred.

## 7. Remaining release blockers and approvals

1. Actual owner/pharmacist review and acceptance using the
   [client walkthrough](BATCH8_CLIENT_WALKTHROUGH.md), including Employee-request
   policy versus original SRF and supported return/disposition operating procedures.
2. Verified pharmacy VAT status, versioned product tax/discount eligibility evidence,
   documentary procedures, invoice format and accounting/legal review. Senior/PWD
   posting and fiscal invoice functionality remain disabled; no compliance claim.
3. Professional verification/onboarding and authorized restocking SOP. Synthetic
   qualification proves enforcement only, not real pharmacist authorization.
4. Docker availability and actual Linux packaged-runtime, HTTPS/cookie and hosting
   checks. Default Node 22 must not be used as the release runtime.
5. Authorized production inventory/backup/restore rehearsal, populated-data
   migration validation, tracked ledger/runner, reviewed release artifact and
   separately authorized migration/activation. Proposed future order and
   forward/rollback boundaries are in [the release checklist](RELEASE_CHECKLIST.md).
   Never replay applied history. Proposal 010 stays unapplied pending review.
6. Durable shared notifications and unsupported fields/accounting remain explicit
   partial/deferred requirements. No exchange/refund/revenue reversals were invented.
7. Temporary local certificate renewal after expiry and preservation of reviewed
   evidence before eventual approved disposal. The temporary demo is not permanent
   production infrastructure.

**Production safety confirmation:** no production Neon connection, read/write,
migration, flag activation, credential/account change, real-data operation,
commit, push or deployment was performed. All synthetic writes and migrations
were restricted to the reverified disposable local target. Stop point: local
finalization and handoff only.
