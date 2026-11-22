# Batch 3 — protected workflows and UI

Owner-authorized local implementation, 2026-11-21 Asia/Manila. Existing Batch 1/2
work is preserved. No production connection, migration, data/credential/account
change, commit, push or deployment occurred. Both activation flags remain unset;
new production workflows remain unavailable.

## A. Features implemented

Adjustment requests record original batch, signed nonzero integer quantity,
reason, immutable request UUID and authenticated initiator. Independent active
Manager/Admin approval posts one locked batch update, terminal decision and audit
atomically. Rejection records reviewer/time/reason without changing stock. The
service refuses terminal reposting and prevents negative/overflowing balances.
Supplier deliveries continue through existing Stock-In.

Returns use exact receipt lookup and original sale-item lineage; the sold batch
is derived from that item, never trusted from a request. Creation checks already
accepted quantities under the sold-line lock; acceptance rechecks cumulative
approved returns across competing requests. Pending requests do not reserve
units. Only a distinct active Manager/Admin can accept/reject. A full physical
receipt then records quarantine; repeated receipt does not add units. Employees
can receive their own accepted returns; management can receive others.

Management can request destroy/supplier-return/restock dispositions. All approved
actions consume the received quarantine balance, serialized on the original
return. Restock additionally requires current, unrevoked, independently verified
pharmacist authorization, no self-review against both original return and
disposition initiators, a nonblank suitability/storage assessment and explicit
eligibility confirmation. Expired/expiring-today/unknown-expiry batches cannot
restock. The linked adjustment, original batch, disposition and audits commit
together; deferred consistency checks abort mismatched posting at COMMIT.
No acceptance, receipt or disposition issues cash, creates credit, or reverses revenue.

The UI includes request/history pages, exact receipt/item lookup, physical
quarantine receipt, controlled disposition/review and recorded event history.
Adjustment/return/disposition requests preserve their exact UUID/body in
per-user browser-tab session storage during uncertain outcomes. Retrying uses
the saved reference; outcome checks use the same key. Known invalid/denied/
missing-input responses allow correction. No automatic replacement request is
issued while a response remains uncertain.

## B. APIs, UI and RBAC

All new paths are under `/api/workflows`. Authentication and current account
status are mandatory. Writes enforce the existing trusted Origin and CSRF
request marker. Bodies and bounded query parameters use strict Zod schemas;
actor/reviewer IDs and trusted batch/financial fields cannot be injected.
Every mutation rechecks active role/status inside its transaction using the
existing account-change lock namespace. Error responses contain no raw SQL.

| Endpoint | Behavior / permission |
|---|---|
| `GET /capabilities` | Authenticated availability, separate restock availability, statutory checkout always false |
| `GET /receipt?receipt=...` | Exact unambiguous regular receipt and original item/batch/accepted/pending quantities; no beneficiary name/ID exposed. Request service separately requires fully reconciled paid sale. |
| `GET /adjustments`, `/returns` | Bounded status/page/limit/request-key filters. Employee sees own requests; Manager/Admin sees all. |
| `GET /adjustments/:id`, `/returns/:id` | Same ownership rules, original reference and recorded audit history; return quarantine/disposition tracking |
| `POST /adjustments`, `/returns` | Authenticated request creation; UUID binds full input and actor |
| `POST /adjustments/:id/decision`, `/returns/:id/decision` | Independent Manager/Admin, approved/rejected only; rejection reason required |
| `POST /returns/:id/receive` | Empty body only; one full accepted receipt, no quantity override; own Employee or management |
| `GET/POST /dispositions`, `GET /dispositions/:id` | Management only; controlled quarantine action requests and history |
| `POST /dispositions/:id/decision` | Independent management; restock also needs own current pharmacist authorization, `restock_eligible:true`, nonblank `assessment` and separate availability gate |
| `GET /pharmacist-authorizations` | Management's own currently valid authorization IDs/expiry only; private credential evidence is not exposed |

`/adjustments` and `/returns` are authenticated application pages. Navigation
becomes active only after server capabilities confirm availability. Direct URLs
show a controlled unavailable message otherwise. Capabilities are loaded once
per authenticated session identity/role rather than adding requests to every
existing module render. Backend checks remain authoritative after UI rendering.

Unified Approvals retains existing Purchase Order/Stock-In operations and
self-approval permissions. Gated Adjustments/Returns/Dispositions have pending
views, approved/rejected history, role-appropriate detail and actual audit events.
Own new requests cannot be approved/rejected by their initiator. Ordinary cash
sales and future valid statutory sales are not inserted into an approval queue.

## C. Migration compatibility and gates

- `CONTROLLED_WORKFLOWS_ENABLED` defaults off; only exact `true` opts in.
- `RETURN_RESTOCK_ENABLED` defaults off and cannot enable restock unless the
  main workflow gate also passes. No environment file/activation flag was changed.
- Availability verifies required 003/007/008 columns, named constraints,
  enabled lifecycle/consistency triggers and installed lifecycle function bodies
  against the shipped canonical proposals. Missing/stale/disabled schema returns
  `503 WORKFLOWS_UNAVAILABLE` before workflow SQL. Missing-object races also return
  controlled unavailable responses. Disabled capabilities do not query new tables.
- Proposed **008** now additionally records `restock_eligible` and
  `restock_assessment`, requires them only for approved restocking, and permits
  their terminal transition in its immutable lifecycle guard. It remains an
  **unapplied proposal**, not a rewrite of applied production history. Older
  disposable review schemas remain retained; the gate rejects their stale shape.
- Required order remains 003 and 007 before latest 008. Existing 001/002/004 bytes,
  original Phase 3 SQL and their recorded history are preserved. 009 remains
  independent, preparation-only, and is not required merely to process regular
  cash-sale returns. Discounted original receipts still fail closed.
- Production activation needs a separately reviewed migration runner/cutover,
  data preconditions and backup/restore plan. Ship canonical proposal files with
  the server for the compatibility check; a missing file fails closed.

## D. Validation

All checks used Node **24.22.3**, satisfying the declared Node 24 runtime.

| Check | Exact result |
|---|---|
| Full frontend Vitest | **110 passed**, 0 failed, 14 files; 20.63 seconds |
| Final affected frontend rerun | **30 passed**, 0 failed, 3 files; 15.10 seconds |
| Full backend Node runner | **166 reported entries passed**, 0 failed, **0 skipped**, exit 0; 74.6970462 seconds |
| Final protected-router rerun | 5 passed, 0 failed; includes malformed-ID/body response check |
| Frontend ESLint | exit 0 |
| Vite production build | v8.3.8, **68 modules**, 1.23 seconds, exit 0; production build with `write:false`, no existing bundle overwritten |
| Git whitespace check | exit 0 |

Node's backend total includes parent/nested entries and two helper-module load
entries; it is not 166 independent database scenarios. All eight PostgreSQL
groups executed, with no skipped integration suites: authentication, inventory,
purchasing/Stock-In approvals, POS/FEFO/recovery, reporting, images, corrected
migration contracts and real prepared workflow transactions.

The existing disposable instance was reverified before writes:
**PostgreSQL 17.12, 127.0.0.1:58446, TLS 1.3**, certificate chain/IP identity
authorized, token matched, test role unprivileged. The runner now also checks
exact baseline 001/002/004 history/checksums inside a READ ONLY transaction before
starting write tests. Child `DATABASE_URL` remains an unusable `production.invalid`
sentinel; only the separately attested local test URL can be used. No TLS or
production-fallback checks were weakened.

Latest owned schemas installed 001 → 002 → 004 → 003 → 007 → latest 008 → 009,
only on that disposable target. Tests cover actual competing requests/approvals,
once-only posting, audit rollback, stock/cumulative quantity limits, quarantine,
pharmacist revocation locking, expired-batch rejection, deferred wrong-batch
rollback, mixed classified snapshots, current permissions and protected HTTP
behavior. Pending/rejected/approved returns were tested against sales totals,
sales by product and gross-profit estimates; original payments remained unchanged.
Disabling a required trigger made schema availability fail closed.

The full backend transcript remains in the temporary instance's
`last-test-run.log`. Its final retained review schema is
`tgp_prepared_test_f623deaea8124903bd003a396058e053`.
No temporary instance or previous retained review evidence was deleted.

During implementation, frontend tests caught capability-fetch coupling to
unrelated module mocks; capability loading was moved into the session provider.
A route test also needed to await the actual Employee dashboard render rather
than only the history pathname update. Permission assertions remain intact.
New receipt ownership rules required fixture updates to use an authorized receiver.
No outstanding failures remain in the executed checks.

## E. Senior/PWD and reporting dependencies

Senior/PWD preparation fields exist but are disabled; no beneficiary data is
collected, persisted or added to checkout payloads. `beneficiaryDraft` validates
scheme/name/ID at the future integration seam; the pure prepared calculator
still requires reviewed scheme-specific eligibility and independent VAT metadata.
Unknown eligibility/tax or unverified policy fails closed. It is disconnected
from checkout and no incomplete discounted transaction changes financial records.

Activation still needs branch VAT status, current authoritative product/tax
classifications and evidence versions, documentary/prescription procedures,
invoice format, rounding/accounting approval and privacy/retention controls.
Synthetic fixture rates are not legal validation. No statutory compliance claim
or ordinary-sale approval requirement has been introduced.

The return-associated sale exclusion was removed from the shared report cohort.
Reconciled completed regular cash sales now remain recognized regardless of
pending/rejected/approved return rows. Existing payment/line/cashier POS-audit
checks and discounted-sale exclusions remain. There is no automatic refund,
credit, exchange, COGS reversal or revenue reduction. Future exchange settlement
and inventory/financial reconciliation require a separately approved accounting
design; gross-profit output remains an estimate of original qualifying sales.

## F. Browser and UAT

Frontend interactions were tested in JSDOM and APIs against real local PostgreSQL.
No browser automation tool or configured Playwright/Cypress suite was available;
real-browser/E2E and owner UAT are **unverified**. Validate actual pharmacy receipt,
quarantine handling, clinical assessment language, keyboard/layout behavior and
available independent reviewers before any production activation. Qualified
pharmacist onboarding/evidence must be approved separately; no production account
or professional authorization was created in this batch.

## G. Exact files changed in this batch

- `client/src/App.jsx`
- `client/src/App.test.jsx`
- `client/src/auth/AuthProvider.jsx`
- `client/src/components/Workspace.jsx`
- `client/src/pages/Approvals.jsx`
- `client/src/pages/ControlledWorkflows.jsx`
- `client/src/pages/Pos.jsx`
- `client/src/reports/ReportPanel.jsx`
- `client/src/workflows/BenefitPreparation.jsx`
- `client/src/workflows/WorkflowDetails.jsx`
- `client/src/workflows/WorkflowGate.jsx`
- `client/src/workflows/useWorkflowCapabilities.js`
- `client/src/workflows/workflows.test.jsx`
- `docs/USER_MANUAL.md`
- `docs/phase4/BATCH3_RESULTS.md`
- `server/REPORTS.md`
- `server/database/migrations/proposed/batch1/008_return_dispositions.sql`
- `server/src/app.js`
- `server/src/repositories/reports.repository.js`
- `server/src/repositories/workflows.repository.js`
- `server/src/routes/workflows.routes.js`
- `server/src/services/benefit-preparation.js`
- `server/src/services/prepared-workflows.js`
- `server/src/services/workflow-validation.js`
- `server/test/benefit-preparation.test.js`
- `server/test/prepared-workflows.integration.test.js`
- `server/test/prepared-workflows.test.js`
- `server/test/workflows-http.test.js`
- `server/testing/local-postgres.mjs`

The list was derived by comparing hashes against the pre-Batch-3 working tree,
including existing untracked Batch 1/2 files. No preexisting changes were reset.

## H. Production safety

Production Neon was neither connected nor mutated. No production migrations,
demo/seed records, new accounts, credential changes, commits, pushes or deployments
were performed. Original applied schema history remains unchanged. Both workflow
flags remain unactivated. The local instance and review data remain retained.
