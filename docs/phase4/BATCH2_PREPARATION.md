# Batch 2 corrected proposals and inactive service preparation

Subsequent owner-authorized real PostgreSQL verification is recorded in
[LOCAL_POSTGRES_TEST_RESULTS.md](LOCAL_POSTGRES_TEST_RESULTS.md). It supersedes
the earlier database-unverified status below while preserving this preparation
record. No production migration or feature activation has occurred.

Authority: project owner's Batch 2 correction instruction, 2026-11-21,
Asia/Manila. This prepares code and tests only; it authorizes no migrations,
production writes, new database connection, infrastructure, accounts, discounted
checkout, commit, push or deployment. Batch 1 local changes are preserved.

## Decisions and source reconciliation

The Phase 3 SQL remains the baseline. Its comments about sale approval and
automatic returned-stock restoration are superseded by owner decisions:
completed reconciled cash sales, including future valid statutory sales, need
no routine approval. `sales.approved_by` is historical review metadata only.
PO/Stock-In retain their current permission and self-approval behavior. New
adjustment/return workflows require active Manager/Admin review and no
self-approval. Return acceptance is distinct from quarantine receipt and from
pharmacist-authorized sellable restocking. No operation here issues a refund.

## Corrected proposals (not executed)

| Draft | Correction and compatibility |
|---|---|
| 003 | Preserves empty-return precondition and original composite sale/item FK. Sold batch is derived exclusively from that line. Must ship with 008; old unlinked return writers cannot continue. No guessed mapping/backfill. |
| 007 | Removes proposed PO/Stock-In schema/policy changes. New adjustments enter pending; reason, initiator, request UUID, dated decision, distinct reviewer, nonnegative before/after balances required. Only pending-to-approved/rejected updates; terminal/legacy history cannot be deleted or rewritten. New legacy inserts/downgrades refused. Existing balances unchanged. |
| 008 | New returns enter pending and retain receipt/sale-item lineage. Approved totals cannot exceed sold quantities; source sale lines with return history become immutable. One full physical receipt only after acceptance, outside sellable stock. Dispositions serialize on parent return and cap all approved actions against received quarantine units. Terminal decisions immutable. Separate current pharmacist evidence required for restock, with distinct disposition and original-return initiators. Expired/expiring-today batches cannot restock. Deferred reciprocal restock/adjustment checks require approved states, original batch, exact positive quantity, same actors/posting time and both link IDs at commit. |
| 009 | Complete versioned headers/lines, quantity > 0, finite nonnegative cent-exact original unit price and monetary fields, original gross=quantity×price, scheme/source/version/rate/price-basis evidence, immutable history and deferred header/line reconciliation. New discounted markers cannot use NULL version. Header-created transaction ID prevents later appended versioned lines; review metadata remains editable. Legacy regular checkout remains compatible. Product defaults remain unverified/unknown; scheme-specific eligibility evidence table avoids assuming Senior/PWD share eligibility. VAT evidence is independent. |

`NUMERIC` is retained rather than `NUMERIC(p,2)`: equality to `round(value,2)`
rejects fractional cents rather than silently coercing them. Original legacy
regular prices are not rounded/backfilled. New snapshot precision is a cutover
precondition; old high-precision products need an approved pricing policy.
Financial reconciliation checks all seven line/header totals, snapshot version
and benefit/policy versions. Existing tax/discount history is never reconstructed
from today's catalog or mutable discount lookup.

The SQL adds guards but does not independently authorize inventory mutation.
Application transactions must update batch, decision and audit together. SQL
errors, deferred constraints and lock behavior still require disposable
PostgreSQL execution before these drafts can be called verified migrations.

## Prepared backend contract (no routes)

`createPreparedWorkflows(explicitPoolProvider)` has no default production pool
and is not imported by startup, routers or current repositories. It provides:

- Adjustment request and approve/reject. Full input is bound to its UUID;
  approval locks the request and batch, validates quantity/balance and updates
  inventory, dated decision and audit atomically. Restock cannot use this manual
  approval entry point. Supplier deliveries continue through existing Stock-In.
- Return request and approve/reject. A unique actual receipt, cash payment,
  original items and cashier POS audit must reconcile; current preparation
  deliberately fails closed for discounted originals until versioned financial
  qualification is implemented. The original sale-item row is the common lock
  for competing requests. Approved cumulative quantities are checked under that
  lock. No batch/payment update occurs on return acceptance.
- One full quarantine receipt; a repeated receipt acknowledgement returns the
  existing result without adding units or another audit record. Partial physical
  receipts are unsupported; they would require a separately reviewed event ledger.
- Disposition request and approve/reject. Parent return is locked before the
  disposition, all approved actions consume quarantine quantity, rejection does
  not. Destroy/supplier-return disposition never mutates sellable inventory.
- Restock approval separately verifies current pharmacist authorization under
  a share lock, rejects both original and disposition self-review, derives the
  original sold batch, rechecks Manila expiry, creates one linked adjustment,
  then posts batch/adjustment/disposition/audits in one transaction. No automatic
  cash settlement. Clinical storage/integrity evidence must be defined before
  exposing this operation; possession of the Manager role is insufficient.

Every operation uses explicit BEGIN/COMMIT/ROLLBACK, a locked current account
role/status check, and the shared counterpart of existing account-change lock
742901/2. Request UUID advisory locks serialize replay and reject changed input.
Guarded pending updates plus row locks prevent repeated posting. A terminal
decision retry conflicts; callers must read its stored state after ambiguous
network failure. A lost COMMIT acknowledgement is not proof of rollback.
Future endpoints need authentication, trusted origin/CSRF, strict body schemas,
safe error handling, bounded read/history APIs and UI state/recovery flows.

## Senior/PWD calculation interface

`prepareBenefitQuote` is pure, inactive arithmetic, never called by checkout.
Inputs must include beneficiary name/ID, an explicitly verified scheme-specific
policy, evidence/source versions, per-line eligibility for that SAME scheme,
independent VAT classification/evidence, price basis and approved rates. Unknown
eligibility/tax, mismatched schemes, missing evidence and fractional-cent prices
fail closed. Integer-cent BigInt arithmetic and explicit per-line half-up rounding
produce exact line/header sums. Mixed eligible/ineligible and independently
VAT-exempt medicines are supported; no blanket tax assumption or statutory rate
default exists. Test rates are synthetic fixtures, not legal approval.

Before activation, qualified legal/accounting review must settle the applicable
product lists and effective versions for each scheme, VAT registration and
independent exemptions, documentary/prescription requirements, allowed rates and
VAT price basis, mixed baskets, rounding/allocation and invoice presentation,
retention/access protection for beneficiary details, and treatment of later
returns/settlement. The `verified` policy marker is trusted server configuration
only; it must never be accepted from a cashier/browser as legal evidence.
This batch does not certify statutory compliance or enable discounts.

## Safe database testing

All six existing mutation suites and the proposal validator now require the
shared disposable-target guard. No `DATABASE_URL` fallback exists. Pre-connect
checks require separate normalized host AND database name, explicit attestation
and exact expected identity; pooled aliases and URL connection redirection are
rejected. A READ ONLY handshake checks database name and an independently
provisioned database-level token before exposing a write-capable test connection.
No infrastructure/marker is created by these helpers. No test flag was enabled.
Do not use `.env.demo` or a schema on production as a substitute for approval.

The new opt-in SQL contract suite prepares original baseline plus unchanged
002/004 and corrected 003/007/008/009 in a rollback-only disposable schema. It
covers lifecycle, FK, quantity, quarantine and financial constraints. It has
NOT been executed: no approved disposable target is configured. Mocked competing
approvals prove service state/lock ordering behavior only, not PostgreSQL races.
Real multi-connection races, deadlocks, COMMIT-time pair constraints, authorization
revocation and financial migrations must pass on the approved target first.

## Order, data preconditions and rollback

1. Separately authorize/provide the disposable target and server attestation;
   run corrected SQL contracts plus existing regression/concurrency suites.
   Add real competing return/disposition/adjustment and authorization-revocation
   tests; unit serialization is not the release gate for database concurrency.
2. Finalize pharmacist evidence/onboarding, available independent reviewers,
   clinical disposition policy and business audit/history/read contracts. Current
   one-Admin/one-Employee staffing cannot review Admin-initiated requests without
   an additional distinct management reviewer. No accounts were created.
3. Build a reviewed migration runner for populated databases; preserve exact
   recorded 001/002/004 history. Old initialization `--check` performs DDL/locks
   and its empty-table precondition is unsuitable. Never renumber applied history.
4. Before any authorized rollout, check empty/unmapped returns for 003, legacy
   rows and pending decisions, collisions, duplicate receipt identifiers,
   quantity/batch integrity and price precision. Approve explicit conversions if
   actual data violates preconditions. Back up and rehearse restore/lock duration.
5. With features disabled, apply additive drafts only after separate approval:
   003 and 007 precede 008; 009 is independent. Existing 004 stays recorded before
   the previously deferred 003. Do not apply optional 005/006 implicitly.
6. Prepare report qualification BEFORE inserting the first return: today's
   report cohort excludes a sale with ANY return row, including pending/rejected.
   No automatic revenue reduction/refund rule is authorized. Discounted-sale
   reporting/payment/item/receipt reconciliation must precede discount activation.
7. Add protected routes/UI/recovery only after these gates, then separately
   authorize production migration and feature activation. PO/Stock-In remain on
   their existing permissions throughout.

Rollback before activation: disable new writers, keep additive schema and all
history. After real workflow records exist, retain compatible readers and use
forward fixes/compensating auditable entries; never drop financial snapshots,
decision history, quarantine evidence or posted stock links as a routine down
migration. Snapshot transaction IDs require PostgreSQL 13+; validate against the
approved target's actual server version. New legacy adjustment/return writes and
old unlinked return writers are intentionally refused after schema cutover.

## Exact files changed in this batch

- `server/database/README.md`
- `server/database/validate-proposals.mjs`
- `server/database/migrations/proposed/003_return_sale_item_link.sql`
- `server/database/migrations/proposed/batch1/007_decision_workflows.sql`
- `server/database/migrations/proposed/batch1/008_return_dispositions.sql`
- `server/database/migrations/proposed/batch1/009_discount_financial_snapshots.sql`
- `server/database/migrations/proposed/batch1/workflow-policy.mjs`
- `server/src/services/prepared-workflows.js` (new)
- `server/src/services/prepared-benefits.js` (new)
- `server/test/auth.integration.test.js`
- `server/test/inventory.integration.test.js`
- `server/test/purchasing.integration.test.js`
- `server/test/pos.integration.test.js`
- `server/test/reports.integration.test.js`
- `server/test/product-images.integration.test.js`
- `server/test/workflow-design.test.js`
- `server/test/disposable-database.test.js` (new)
- `server/test/prepared-benefits.test.js` (new)
- `server/test/prepared-workflows.test.js` (new)
- `server/test/workflow-migrations.integration.test.js` (new)
- `server/test/support/disposable-database.js` (new)
- `server/test/support/workflow-fixture.js` (new)
- `docs/phase4/DEVELOPMENT_BATCH1_DESIGN.md` (supersession notice only)
- `docs/phase4/BATCH2_PREPARATION.md` (this file)

No frontend, active router, checkout, report repository, package/lockfile,
environment/credential, applied migration or original Phase 3 SQL changed in
this batch. Existing Batch 1 modifications remain in the working tree.

## Validation results

Executed with the previously checksum-verified temporary Node **v24.22.3**;
default installed Node remains v22.23.4. No runtime installation or credential
change was made. Frontend checks used the existing dependencies/configuration.

| Check | Exact result |
|---|---|
| Frontend Vitest | 102 passed, 13 files; 20.10 seconds; exit 0 |
| Backend Node runner | 95 reported entries: 88 passed (86 test cases plus 2 helper-module load checks), 0 failed, 7 skipped; 41.2478283 seconds; exit 0 |
| Frontend ESLint | exit 0 |
| Vite production build | v8.3.8, 63 modules, 1.17 seconds, exit 0; `write:false`, no bundle files overwritten |
| Prepared JavaScript syntax checks | 4 selected service/harness/test files passed `node --check` |
| Git whitespace check | `git -c core.safecrlf=false diff --check`, exit 0 |
| Production read-only verification | exit 0; read-only repeatable-read transaction and verified TLS; 23 repository reads and 6 SQL date cases passed |
| Browser | Not performed; unverified |

Backend execution explicitly set `DATABASE_URL=''`, a synthetic JWT secret,
disabled product images and set all seven `RUN_*_DB_TESTS` flags to `0` in the
child process only. No environment file was edited. Skipped PostgreSQL suites:
authentication, inventory, purchasing, POS/FEFO, reports, product images, and the
new corrected workflow/financial migration contract suite. No write-based
integration or real PostgreSQL concurrency claim is made.

The separate existing `src/scripts/verify-batch1-readonly.js` used production
configuration solely inside `BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY`
and ROLLBACK. It verified original Phase 3 SQL equals 001, and recorded hashes
match unchanged 001/002/004. Counts remained 2 users, 13 activity logs and zero
rows in all 13 business tables. No proposed migration was applied; no new target
was connected, infrastructure created, account created, production mutation,
commit, push or deployment performed. Secrets were neither printed nor changed.
