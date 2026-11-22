# Point of Sale and FEFO — provisional MVP

## Development batch 1 update — 2026-11-21

New checkouts require the server-signed quote_token from an explicit quote review.
Prices, product identity, Manila business date and FEFO allocation must match.
Changed quotes close unused references durably and require a fresh review.
Already paid references still replay before quote checks, including old tokenless
requests; unresolved requests retain the existing recovery protocol.
Normal completed cash sales require no manual approval; approved_by remains
optional historical review metadata. Discounts remain disabled.
See [current batch contract](../docs/phase4/DEVELOPMENT_BATCH1_DESIGN.md).
Older validation counts and API examples below are historical.


## Finalization: rejected-checkout correction

Current local validation (2026-11-20): **44 backend tests passed, 0 failed, 6 PostgreSQL suites skipped; 47 frontend tests passed; lint/build passed.** Seven new route/repository protocol tests use DB doubles, and six frontend/API-helper tests cover the correction/storage behavior. The added PostgreSQL closure scenario was not run: no approved disposable resource is available and finalization forbids creating a database or mutating existing Neon. Earlier results below are historical, not a current integration pass.

Checkout now runs inside a savepoint within the existing advisory-lock transaction. Correctable stock/pricing/payment rejection rolls the attempted sale/lines/payment/stock back to that savepoint, then records `checkout.closed:<UUID>` in existing `activity_logs` under module `POS_checkout`. The closure and rejection acknowledgement commit together. Only a committed acknowledgement carries `checkout_state:'closed'`; audit/commit uncertainty never unlocks the cashier automatically.

Every new checkout checks durable closure after existing receipt lookup and before pricing/stock writes. Delayed requests for a closed reference cannot post. No new table, column, index, migration, or change to historical records is required. Existing successful-sale audit events remain in `POS`; report eligibility is unchanged.

`POST /api/pos/checkouts/:requestId/resolve` accepts exactly `{}` and uses the same lock, role/status recheck, cookie and CSRF controls. An already paid sale returns the original cashier's receipt. Otherwise the unused reference is closed idempotently before the UI permits editing. Other users' references are not disclosed. This retires an unposted request, not a cancellation, refund, void or payment-settlement rule.

GET status now returns `closed` to its original cashier when appropriate. `not_found` alone remains nonterminal. The UI restores the saved cart/tender after confirmed closure, clears the quote and requires fresh review before a new UUID is used. Unknown/5xx/storage failures retain the saved attempt. Clearing a resolved reference refuses to remove a different saved reference. Use one active POS tab; independent simultaneous carts remain outside the single-reference guarantee.

**Retention requirement:** keep `POS_checkout` closure events. They are durable protocol state as well as audit evidence; purging them can reopen old references. External writers must not bypass the common lock and closure checks. There is still no unique receipt-number database constraint. No purge job or external writer was added.

The old operator-only rejected-attempt limitation below is superseded by this fix. Real PostgreSQL locking/rollback and browser E2E verification remain outstanding; current Neon has no users/data, and no real sale or account was fabricated to present a completed demonstration.

## Checkout recovery update

Actual verification on 2026-11-20: full backend run with all five DB suites enabled **66 passed, 0 failed, 0 skipped** (163.24 seconds); frontend **35 passed**; ESLint and production build passed. Isolated schemas were cleaned up and public data counts/constraints/migration history remained unchanged. Earlier test counts below are historical. Added frontend cases cover retained-storage remount after simulated lost response and storage failure preventing HTTP submission. Backend adds fresh-runtime/session recovery and original-cashier status isolation to existing concurrent retry, payment and rollback checks.

No migration is required for committed-sale retry safety: the existing PostgreSQL receipt reference, sale items and payment persist across process restart, and the existing shared advisory transaction lock serializes every lookup/insert. There remains no database uniqueness constraint; external writers must not bypass this protocol.

`GET /api/pos/checkouts/:requestId` is authenticated, UUID-validated and serialized with checkout transactions. It returns `completed` with the stored receipt only to the original cashier (even an admin cannot use this recovery endpoint to retrieve another cashier's attempt). Otherwise it returns `not_found` without disclosing another user's data. Existing receipt-by-ID RBAC is unchanged. The actor is rechecked for active status inside the transaction.

`not_found` means no committed receipt was visible, not a durable failed/cancelled state: a delayed request may still arrive. No cancellation, refund or settlement rules were introduced. Failed validation/payment responses are shown explicitly but preserve the exact saved request rather than silently issuing a new UUID. Permanently invalid/underpaid attempts currently require operator resolution; the UI deliberately does not offer an unsafe discard-and-replace operation. A durable terminal rejection/cancellation protocol is still needed for a complete cashier correction workflow.

The browser stores only request UUID, product IDs/quantities and tender under a cashier-specific key. It does not persist receipt details, passwords or JWTs. Clearing site data, private-browser eviction, device loss, malicious same-origin scripts and simultaneous independent carts across tabs are outside this storage guarantee. Use one cashier checkout tab; secure the shared workstation. An existing saved reference detected before submission takes priority over a new cart. React state is keyed by user ID so switching users does not reuse another cashier's pending state.

API restart still invalidates process-local authentication sessions by design. Re-authenticate as the original cashier and recover the saved transaction. Session persistence itself was not changed. Tests replace the HTTP server, repositories and session registry with fresh instances against the same isolated database; this exercises runtime-state loss, not an OS kill during COMMIT. Simulated lost-response tests discard a committed response. Browser refresh coverage is React unmount/remount with retained Web Storage, not real-browser E2E certification.

## Production release blocker

**Senior Citizen/PWD discounted checkout is explicitly unavailable. This iteration must not be released for production pharmacy use until applicable Philippine legal requirements, VAT treatment, eligibility checks and the pharmacy approval process have been validated and implemented.** No discount rates, stacking or approval rules were invented. The UI states this limitation, and strict API validation rejects discount/VAT/approval fields. The existing discounts table is preserved but not populated or used for fabricated calculations.

## User-approved provisional decisions

All decisions below remain pending client validation:

- `products.unit_price` is the official price for every batch of that product. PostgreSQL `NUMERIC` rounds each nonnegative official unit price to two decimal places using ROUND_HALF_UP (`round(numeric,2)`), then multiplies by integer quantity and sums line amounts. Sale items store this rounded price. Money calculations do not use JavaScript floating point.
- Currency is PHP. Only full cash payment is supported. Cash input is a decimal string with at most two decimal places; underpayment, negative amounts, nonfinite values and fractional-cent tender are rejected. Change is computed exactly in PostgreSQL. No partial-payment, void or return workflow is implemented.
- A successful ordinary sale atomically records the sale, batch-level sale items, cash payment, FEFO deduction and audit entry. `sales.approved_by` stays NULL; no additional sales approval gate is introduced. Baseline and deployed integrity constraints allow this. This does not make the transaction eligible for future approved-only owner reports; reporting rules remain outside this task.
- Only batches with positive known quantity and `expiry_date` strictly after today's Asia/Manila calendar date are eligible. Today's expiry, expired batches and unknown expiry/stock are excluded. Price is read from the product, never from the batch or client.
- FEFO orders by expiry ascending, then batch ID ascending as a deterministic tie-breaker. Each allocated batch produces a separate existing `sale_items` row, preserving quantity, batch foreign key and sale-time unit price. No new tables or migrations are needed.
- Employee, Manager and Admin may use the cashier interface. Employees can retrieve only their own receipts; Manager/Admin can retrieve receipts by ID. No transaction report or dashboard was added.

## Transaction and concurrency behavior

Checkout uses the existing transaction helper and advisory lock, rechecks the authenticated user's current active status and role, locks products in product-ID order, and locks eligible batches with `FOR UPDATE` in FEFO order. Deduction also checks quantity and expiry in its guarded UPDATE. Insufficient stock or any write/audit failure rolls back the complete operation. Existing purchasing and inventory workflows are unchanged.

The shared advisory lock already used by account, inventory and purchasing mutations serializes application writes; batch row locks protect balances as well. The current implementation favors correctness over high-throughput parallel writes. Do not remove this shared protocol without redesigning and testing the locking order and retry guarantee.

Reviewing a cart is a short transaction, not a reservation. Checkout always recalculates prices and availability. A changed price can alter the final receipt; inadequate tender rejects the transaction. The UI explains that the quote is checked again.

Checkout includes a UUID `request_id`. The server derives `receipt_no = POS-<uuid>`. Under the existing shared transaction lock it checks for a prior receipt and returns it only if the cashier, cart quantities and tender match. A changed payload or different cashier reusing that reference returns 409. This prevents repeated HTTP submissions from deducting twice without changing the approved schema. There is no database UNIQUE constraint on receipt_no; all sale writers must use this protocol. External/manual writes are outside this guarantee.

On an uncertain network/server response, the UI freezes the submitted cart and tender. The exact request is saved before HTTP submission in per-cashier browser localStorage (no tokens or credentials), preserving the reference across reloads and re-login. Storage failure prevents submission. Check status or retry the saved request; never create a replacement for an unresolved attempt. Clearing browser storage or changing browser/device loses this local recovery record.

## Receipt and audit records

`sale.paid:<sale_id>` is written to `activity_logs` with module `POS`, authenticated actor and server timestamp in the same transaction. Retrying a committed checkout does not create another audit/payment/sale record.

Receipt data is read from stored sales, sale_items and payments; names and batch labels are joined from existing catalog/batch records. Sale-time monetary values and batch IDs remain stored, but the approved schema has no immutable snapshot of product names. The display is an MVP transaction confirmation, not a claim of compliance with fiscal receipt requirements. Receipt numbering/legal formatting remains subject to validation.

Regular sales store NULL for discount_id, senior_pwd_id and vat_exempt; no tax exemption is asserted. No tokens, passwords, connection strings or personal discount identifiers are logged.

## API and interface

All endpoints use the existing cookie authentication, active-account checks, no-store responses and mutation CSRF controls.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/pos/products?q=&page=1&limit=20` | Product search, rounded official prices and eligible stock |
| POST | `/api/pos/quote` | Validate cart and return exact server-calculated prices/total |
| POST | `/api/pos/checkout` | Atomic full-cash checkout or matching replay |
| GET | `/api/pos/sales/:id` | Stored receipt with role/ownership checks |

Quote body: `{ "items": [{ "product_id": 1, "quantity": 2 }] }`.

Checkout adds `request_id` (UUID) and `amount_paid` (decimal string). IDs and quantities must be positive 32-bit integers; duplicate product IDs and unknown fields are rejected. Maximum cart size is 100 product lines. Search uses parameterized literal substring matching. Monetary outputs are decimal strings. Request amounts/prices/totals are never interpolated into SQL.

The `/pos` React route offers product search, quantity editing/removal, server quote, tender input, checkout and receipt confirmation. Navigation is available to all cashier roles. It never computes a monetary total in JavaScript. Existing Inventory and Purchasing pages remain intact.

## Test procedure

Run from `server` in PowerShell:

```powershell
$env:RUN_AUTH_DB_TESTS='1'
$env:RUN_INVENTORY_DB_TESTS='1'
$env:RUN_PURCHASING_DB_TESTS='1'
$env:RUN_POS_DB_TESTS='1'
npm.cmd test
```

The test command runs files sequentially to avoid interference from long-held advisory locks in older rollback fixtures. POS tests use a committed, uniquely named isolated schema so separate database connections can contend realistically. Every test query selects that schema inside a transaction using SET LOCAL for Neon transaction-pooler compatibility. Only the task-owned schema is removed afterward. Baseline checksum, public row counts, constraint definitions and migration history are compared before/after. No production business records are seeded and no deferred migrations are applied.

POS integration covers all cashier roles, authentication/CSRF, receipt ownership, eligible stock, FEFO/tie ordering, multi-batch traceability, null/today/expired exclusions, insufficient stock, tender validation, injection rejection, exact rounding beyond JavaScript integer precision, competing checkout, concurrent same-request retry, atomic audit-failure rollback, sale-time price retention, actor/timestamp logs and inactive accounts.

Frontend tests cover all cashier roles, server-provided total/receipt, disabled discounts, uncertainty retry with the same reference, underpayment feedback, cart quote invalidation and search, plus prior module regressions. Browser visual inspection has not been completed; frontend verification uses React/jsdom, ESLint and Vite build.

## Changed files

- Backend: `src/services/pos-validation.js`, `src/repositories/pos.repository.js`, `src/routes/pos.routes.js`, endpoint registration in `src/app.js`.
- Backend tests: `test/pos-validation.test.js`, `test/pos.integration.test.js`; `test:pos:db` script in `package.json`.
- Frontend: `src/pages/Pos.jsx`, `src/pos.test.jsx`, protected route in `src/App.jsx`, POS navigation in `src/components/Workspace.jsx`.
- Documentation: this file. No database schema, migration, connection configuration, inventory/purchasing business logic, dashboard or reporting changes.

## Actual validation — 2026-11-20

| Check | Actual result |
| --- | --- |
| Full backend command, all four DB flags enabled | 57 passed, 0 failed, 0 skipped (108.37 seconds) |
| Included authentication integration | 13 passed, including parent test |
| Included inventory integration | 11 passed, including parent test |
| Included purchasing integration | 11 passed, including parent test |
| Included POS integration | 10 passed, including parent test |
| Remaining backend security/input/health tests | 12 passed |
| Frontend Vitest | 28 passed across 4 files |
| Frontend ESLint | Passed |
| Vite production build | Passed |
| Actual `/api/health` HTTP request | 200 |
| Actual `/api/health/db` HTTP request | 200 |

All isolated database fixtures were cleaned up. Public row counts, constraints, baseline checksum and migration history checks passed. No application data was inserted by this implementation. Browser visual inspection remains unverified. Discount/legal validation, fiscal receipt requirements, provisional pricing/expiry policies and reload-safe checkout recovery remain outstanding as described above.
