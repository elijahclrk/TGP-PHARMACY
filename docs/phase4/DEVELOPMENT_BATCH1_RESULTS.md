# Development batch 1 results

Completed 2026-11-21 (Asia/Manila), against original Git HEAD
`43b321101d04775ee27394e21773b279b45856b4`. Changes remain local and uncommitted.

## Completed corrections

- POS checkout now requires a cashier-bound authenticated quote matching current
  prices, displayed product identity, Manila date and FEFO allocation. Rejection
  closes the unused reference before editing and requires explicit review.
  Existing paid-reference replay, uncertain-outcome recovery, transaction lock,
  savepoint/audit rollback and expired/today exclusion remain.
- Normal completed, reconciled cash sales require no manual approval. UI labels
  describe optional historical review; report recognition SQL, payment/item/audit
  checks and existing discount/return financial exclusions are unchanged.
- Three calendar months replaces the 30-day window. Server metadata distinguishes
  expired, expiring today, upcoming expiry and within-date batches. Dashboard,
  inventory/report reads and a combined read-only alert center share that policy.
- Admin reorder-threshold management uses existing `products.reorder_level` and
  audited PATCH permissions. Blank is explicitly unset; zero is valid. No
  default threshold or critical-stock formula was introduced.
- Unified approvals consolidate existing PO/stock-in reads, filtered totals,
  details and secure approval operations. Existing role/self-approval rules and
  once-only receiving posting remain; no unsupported decision actions were added.
- Exact additive SQL and API/transaction/compatibility plans were prepared for
  inactive adjustments, returns/disposition and Senior/PWD snapshots.

## Source and decision alignment

Original Phase 1–3 role, cash, batch, FEFO, per-product reorder and audit concepts
are preserved. The owner's latest one-web-app, no-normal-sale-approval and
three-calendar-month decisions supersede conflicting original desktop,
approved-only reporting comments and 90-day visual examples. The nine reference
images inform the management views without adding unsupported fields/actions.
Original SQL is byte-identical to baseline 001; applied 001/002/004 checksums
remain unchanged. Product images, discounts, refunds and new return/adjustment
posting were not activated.

## Exact validation

Validation used official Node **v24.22.3**, downloaded to the OS temporary
directory and SHA-256 verified against Node.js's official checksum listing.
The installed default Node **v22.23.4** was not replaced. Package manifests and
lockfiles were not changed.

| Check | Result |
| --- | --- |
| Frontend regression | 102 passed, 13 files, 0 failed; 11.64 seconds |
| Backend regression | 70 passed, 0 failed, 6 skipped, 76 total; 21.032 seconds |
| Frontend ESLint | Exit 0, no reported issues |
| Production build | Exit 0; Vite 8.3.8, 63 modules; generated ignored client/dist |
| Neon repository SELECT checks | 23 passed inside enforced READ ONLY transaction |
| PostgreSQL date checks | 6 passed: five calendar-month/leap/year boundaries and Manila midnight |
| Original schema and applied checksums | Byte equality and all three recorded hashes verified |
| Git diff whitespace check | Passed |
| Browser/desktop visual/E2E | Unverified; no screenshots or browser pass claimed |
| Proposed SQL execution | Not performed; static proposal only |

Frontend commands were the package-script entry points with runner loading and
test caches disabled: `vitest run --configLoader runner --no-cache
--no-fsModuleCache`, `eslint .`, `vite build --configLoader runner`.
Backend ran `node --test --test-concurrency=1` with a synthetic process-only
signing key, blank DATABASE_URL and every RUN_*_DB_TESTS flag explicitly zero.
Six PostgreSQL mutation suites were skipped, not passed. Updated optional
integration/demo callers were kept compatible with quote/window contracts but
were not executed against production.

New coverage includes price increases/decreases, identity/allocation/expiry/day
changes, unsigned/tampered/wrong-cashier quotes, legacy paid replay, explicit
cashier re-review, month-end boundaries, combined alert separation, Admin
null/zero thresholds, URL/RBAC guards, filtered approval reads and existing
approval actions. Inactive policy tests cover two-person decisions,
pharmacist-authorization validity and the incompatibility with current
self-approval flows.

## Production protection evidence

`server/src/scripts/verify-batch1-readonly.js` executed only reads in
`BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY`, checked READ ONLY was on,
verified client TLS, and ended with ROLLBACK. Output contained only metadata,
counts and booleans. No successful login was attempted because it would audit.

- Users: 2; activity logs: 13, matching the preceding audit.
- All 13 business tables: 0 rows.
- Recorded migrations: only 001 baseline, 002 integrity and 004 indexes.
- No migration/seed/bootstrap, production mutation, credential change, new user,
  demo record, provider activation, commit, push or deployment was performed.
- Proposal files are absent from migration/demo execution allowlists. Original
  migration files and history remain unchanged.

## Proposed migrations and remaining dependencies

See [the exact design](DEVELOPMENT_BATCH1_DESIGN.md) and
`server/database/migrations/proposed/batch1/`:

1. 007: decision states, rejection/history, proposed no-self-approval and
   adjustment posting metadata; depends on original 001/002/004.
2. Existing 003: exact original-sale-item linkage; requires an empty returns
   table or a separately reviewed mapping migration.
3. 008: return acceptance, one full physical receipt, controlled dispositions,
   independent professional authorization and linked once-only restock
   adjustments; depends on 003 + 007.
4. 009: unverified product eligibility/tax classifications and versioned customer,
   VAT/discount/financial snapshots; independent of return activation.

Future activation requires authorized migration execution, isolated PostgreSQL
constraint/concurrency tests, professional/tax/invoice validation, compatible
reporting and a coordinated policy cutover. No-self-approval is only proposed:
current PO/stock-in permissions remain. The present one-Admin/one-Employee
staffing cannot review an Admin's own requests under the proposed policy, and
role names do not prove pharmacist qualification. No automatic refund/restock
is part of return acceptance. Financial settlement remains unspecified.

The default shell still needs Node 24 selected for ordinary development commands.
Browser/UAT and real PostgreSQL write/concurrency coverage remain outstanding.
These are disclosed future verification/activation dependencies, not hidden
production actions taken during this safe batch.

## Files changed

The following manifest includes tracked modifications and new files, excluding
ignored generated build/cache artifacts:

```text
client/src/App.jsx
client/src/App.test.jsx
client/src/components/Workspace.jsx
client/src/components/layout.test.jsx
client/src/inventory/inventory.test.jsx
client/src/inventory/shared.jsx
client/src/pages/Alerts.jsx
client/src/pages/Approvals.jsx
client/src/pages/Inventory.jsx
client/src/pages/Pos.jsx
client/src/pages/Purchasing.jsx
client/src/pages/ReorderThresholds.jsx
client/src/pages/core-management.test.jsx
client/src/pos.test.jsx
client/src/reports/DashboardSummary.jsx
client/src/reports/ReportPanel.jsx
client/src/reports/reports.test.jsx
docs/USER_MANUAL.md
docs/phase4/DEVELOPMENT_BATCH1_DESIGN.md
docs/phase4/DEVELOPMENT_BATCH1_RESULTS.md
server/INVENTORY.md
server/POS.md
server/PURCHASING.md
server/REPORTS.md
server/database/migrations/proposed/batch1/007_decision_workflows.sql
server/database/migrations/proposed/batch1/008_return_dispositions.sql
server/database/migrations/proposed/batch1/009_discount_financial_snapshots.sql
server/database/migrations/proposed/batch1/workflow-policy.mjs
server/demo/workflows.mjs
server/src/repositories/inventory.repository.js
server/src/repositories/pos.repository.js
server/src/repositories/purchasing.repository.js
server/src/repositories/reports.repository.js
server/src/routes/pos.routes.js
server/src/scripts/verify-batch1-readonly.js
server/src/services/expiry-policy.js
server/src/services/inventory-validation.js
server/src/services/pos-quotes.js
server/src/services/pos-validation.js
server/src/services/purchasing-validation.js
server/test/approvals-http.test.js
server/test/expiry-policy.test.js
server/test/inventory-validation.test.js
server/test/inventory.integration.test.js
server/test/pos-recovery.test.js
server/test/pos.integration.test.js
server/test/reports.integration.test.js
server/test/thresholds-http.test.js
server/test/workflow-design.test.js
```
