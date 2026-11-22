# Suppliers, purchase orders and stock-in

**Batch 1 update (2026-11-21):** the Manager/Admin `/approvals` view reuses
existing detail and secure approval operations. Lists support bounded
`status=all|pending|approved` filtering by `approved_by`. Existing self-approval
and stock-posting rules remain unchanged. Two-person decisions/rejection are
inactive proposals, tested separately; no migration was applied. See
[batch 1 design](../docs/phase4/DEVELOPMENT_BATCH1_DESIGN.md).

## Scope and approved MVP assumptions

Implemented with the existing Phase 3 tables and approved constraints. No schema migrations, new foreign keys or application seed records are introduced. Source review covered Sections 5 and 6 of `docs/phase1/TGP_SystemRequestForm.pdf`, `docs/phase3/tgp_database.sql`, and `docs/phase3/TGP_ERD.png`. No wireframes were available in the workspace.

The following user-approved MVP assumptions remain pending client validation:

1. Active Managers and Admins may record and approve stock-in. Self-approval is permitted for this MVP, not asserted as a permanent pharmacy policy. Employees have no supplier, purchase-order or receiving access.
2. Purchase orders and receiving remain independent. PO creation stores `pending`; Manager/Admin approval changes it to `approved`. Receiving never transitions a PO to `received` and does not reconcile partial deliveries.
3. Exactly-once posting applies to a single stock-in ID. Delivery references are required but are not unique. Separate records with the same reference are permitted; identifying duplicate physical deliveries remains a client decision. After an uncertain creation response, review the list before submitting again.
4. Suppliers support add, edit, list and view only. No supplier deletion is provided.
5. Every receiving line creates a separate zero-stock batch, consistent with the Phase 3 SQL comments. Receiving does not merge into existing batches or post into the standalone zero-stock records created from Inventory. Batch matching/reuse rules remain unconfirmed.
6. Pending receiving does not increase inventory. Approval posts quantities exactly once. No partial approval, cancellation, reversal, supplier return, POS or FEFO deduction is implemented.

## Transaction and audit guarantees

Creation writes the receiving header, zero-stock batches, line quantities/costs and audit entry in one transaction. The authenticated actor supplies `received_by`; the server supplies `date_received`. Neither is accepted from request data.

Approval uses a PostgreSQL transaction, locks the stock-in header with `FOR UPDATE`, verifies `approved_by IS NULL`, locks its lines and batches in a stable order, then increments batch quantities with overflow/null guards. A guarded header update records `approved_by`; the audit event records the approver and approval timestamp. Any failure, including audit failure, rolls back every stock update and the approval marker. A repeat approval returns HTTP 409 without changing quantities. Both Manager and Admin use the same checks.

The existing account transaction advisory lock and current-account role/status recheck are retained. This serializes writes with account deactivation and protects permission checks; row locks independently protect posting records. Approved document lines have no edit/delete endpoints. Batch identity (number/expiry) is locked once referenced by receiving, and the existing used-cost guard remains enforced. Selling prices remain editable under existing inventory permissions.

`activity_logs` stores `suppliers.created`, `suppliers.updated`, `orders.created`, `orders.approved`, `receiving.created`, and `receiving.approved`, each suffixed with its record ID. Existing `logged_at` supplies timestamps without adding schema columns. Detail views show document actors and creation/approval history. Logs do not store credentials, tokens or request bodies.

## APIs

All paths start with `/api`. Authentication, active account checks and Manager/Admin authorization are enforced server-side. Mutations require the existing trusted Origin and `X-TGP-Request` CSRF marker. Responses use `Cache-Control: no-store`.

| Path | Methods | Behavior |
| --- | --- | --- |
| `/suppliers` | GET, POST | List/search; add supplier |
| `/suppliers/:id` | GET, PATCH | View; edit name/contact/address |
| `/purchase-orders` | GET, POST | List; create pending order and items |
| `/purchase-orders/:id` | GET | Order, lines and activity history |
| `/purchase-orders/:id/approve` | POST | Approve pending order, without stock posting |
| `/stock-ins` | GET, POST | List/search; record pending delivery and zero-stock batches |
| `/stock-ins/:id` | GET | Delivery, lines, current batch stock and activity history |
| `/stock-ins/:id/approve` | POST | Approve and post once |

Lists accept literal substring `q`, `page` (default 1) and `limit` (default 20; maximum 100). Stock-in search matches supplier name and delivery reference. Other lists search supplier name. Supplier/product pickers show 20 results and allow refining search.

Supplier body: `name`, optional `contact_no` and `address`. PO body: `supplier_id`, `items` containing `product_id`, positive integer `quantity`, nonnegative decimal `unit_cost`. Receiving body: `supplier_id`, `delivery_ref`, `items` containing `product_id`, `batch_no`, valid `expiry_date`, positive integer `quantity`, nonnegative decimal `cost_price` and `selling_price`. Each document accepts 1–100 lines. Decimal strings preserve precision. Approval body is `{}`. Client-supplied status, actor IDs, stock balances, PO links or unknown fields are rejected.

## Frontend

Routes: `/suppliers`, `/purchase-orders`, `/stock-ins`. Employee navigation hides these routes; direct URL access redirects to the employee workspace. Pages include search, pagination, detail views, item forms, loading/empty/error states and success feedback. Pending stock-in details explain the approval effect. Approval refreshes stock and removes the posting button after success. No token storage or authentication configuration was changed.

## Tests and commands

Run database suites sequentially. The older auth/inventory fixtures hold the shared advisory lock inside long-lived rollback transactions. Running these suites concurrently can cause contention and query timeouts; `npm test` uses test-file concurrency 1. The purchasing suite still launches concurrent HTTP requests internally on separate database connections to test actual locking.

From `server` in PowerShell:

```powershell
npm.cmd test
$env:RUN_AUTH_DB_TESTS='1'
$env:RUN_INVENTORY_DB_TESTS='1'
$env:RUN_PURCHASING_DB_TESTS='1'
npm.cmd test
```

Or run `test:auth:db`, `test:inventory:db`, and `test:purchasing:db` separately with their respective flags. From `client`: `npm.cmd test`, `npm.cmd run lint`, `npm.cmd run build`.

Purchasing tests create a uniquely named isolated schema using the baseline and approved 002/004 only. Committed fixtures in that schema allow real multi-connection concurrency tests. Every fixture query selects its schema with `SET LOCAL` inside an explicit transaction, including reads; session-level settings are not relied on across Neon's transaction pooler. Cleanup drops only that task-owned schema. Public application row counts, constraint definitions, baseline checksum and migration history are verified unchanged. Catalog snapshots use a consistent transaction-local search path so foreign-key name formatting is comparable. Auth/inventory regression suites use their existing rollback-only fixtures. No application data is seeded.

Validation covers employee/anonymous denial, CSRF, inactive users, supplier operations, search/injection resistance, PO creation/approval, pending zero stock, invalid quantities, protected receipt identity, self-approval, duplicate approval, row-lock contention, concurrent independent receiving, audit failure rollback, multi-line overflow rollback and recorded actors/timestamps. Frontend tests cover forms, posting feedback, route restrictions and regressions.

## Files

- Backend: `src/routes/purchasing.routes.js`, `src/repositories/purchasing.repository.js`, `src/services/purchasing-validation.js`, registration in `src/app.js`, receiving identity protection in `src/repositories/inventory.repository.js`.
- Tests: `test/purchasing.integration.test.js`, `test/purchasing-validation.test.js`, npm scripts in `package.json`.
- Frontend: `src/pages/Purchasing.jsx`, `src/purchasing/RecordPicker.jsx`, `src/purchasing/PurchasingForm.jsx`, `src/purchasing/purchasing.test.jsx`; route/navigation integration in `src/App.jsx` and `src/components/Workspace.jsx`; role regression tests in `src/App.test.jsx`; updated locked-batch error text in `src/inventory/BatchForm.jsx`.

Browser visual inspection has not been completed. Frontend verification uses React/jsdom tests, ESLint and the Vite production build.

## Actual results — 2026-11-20

| Check | Result |
| --- | --- |
| Default backend test command | 11 passed; 3 opt-in database suites skipped in this command |
| Backend with auth and inventory database flags | 35 passed; purchasing suite skipped there and run separately |
| Dedicated purchasing PostgreSQL suite | 11 passed (10 scenarios plus parent); no skips |
| Frontend Vitest | 22 passed, including auth/inventory regression and new purchasing tests |
| Frontend ESLint | Passed |
| Vite production build | Passed |
| HTTP `/api/health` | 200 |
| HTTP `/api/health/db` | 200 |

Earlier purchasing runs exposed test harness issues: schema-qualified constraint formatting differed across pooled sessions, and session-level schema selection was unreliable with Neon transaction pooling. The harness now uses transaction-local schema selection and a fixed catalog snapshot path; its final complete run passed. Test files are executed sequentially to avoid contention from existing rollback fixtures' long-held advisory locks. Concurrent HTTP posting remains tested within the purchasing suite.

No live application records were inserted or changed by these tests. Deferred migrations 003/005 were not applied. Client validation is still needed for the MVP assumptions above, particularly self-approval, physical duplicate-delivery identification and future PO/receiving linkage.
