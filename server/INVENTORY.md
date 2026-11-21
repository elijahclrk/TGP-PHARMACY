# Product and inventory management

**Batch 1 update (2026-11-21):** upcoming expiry is strictly after today through
three calendar months from the Manila business date. `expiring_today` is a
separate stock-bearing filter. `days` overrides are rejected. Lists return
`business_date`, `near_expiry_through` and per-batch `expiry_status`. Admin
threshold management reuses `products.reorder_level` (NULL is explicitly unset).
See [current design/compatibility contract](../docs/phase4/DEVELOPMENT_BATCH1_DESIGN.md).
This supersedes earlier configurable-window descriptions below.

Implemented against the existing Phase 3 products, batches and activity_logs tables. No schema migration or business records are added by installation. Authentication, CSRF checks and active-account checks apply to all inventory APIs.

## Permissions and stock safety

- Employees may view products and batch quantities, expiry dates and selling prices. Batch cost is omitted by the server, as well as hidden in the UI.
- Managers and administrators may create/edit product and batch metadata. Only administrators may set reorder thresholds, following Section 6 of the System Request Form.
- Every new batch has SQL-assigned `qty_on_hand = 0`. An optional creation quantity is accepted only if it is numeric zero. Any quantity field in a batch PATCH is rejected, including zero, null and mixed metadata/quantity requests, for both manager and admin.
- No deletion or quantity-update API is provided. Future authorized stock-in, adjustment, sales and approved-return modules must own quantity changes. This phase implements neither stock posting nor FEFO deduction.
- Writes and their audit records commit together. Existing account locking and current-role checks are retained. Changing recorded cost for a batch already referenced by receiving or sales is rejected to protect historical calculations.

## API

All paths below start with `/api`. Existing cookie authentication and mutation CSRF headers are required.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | /products | Search/list products and aggregated recorded stock |
| GET | /products/:id | Product details and recorded stock |
| POST / PATCH | /products, /products/:id | Create/edit product metadata |
| GET | /inventory/low-stock | Products at or below their configured reorder level |
| GET | /inventory/batches | Search/list batches |
| GET | /inventory/near-expiry | Batches with positive stock inside the supplied expiry window |
| POST | /products/:id/batches | Create zero-stock batch |
| PATCH | /inventory/batches/:id | Edit metadata only |

Lists support `page` (default 1) and `limit` (default 20, maximum 100). Product filters are `q`, exact `category`, and `stock=all|low`. Batch filters are `q`, `product_id`, `status=all|near_expiry|expired`, and `days=0..365`. Near-expiry queries require days. Search uses parameterized literal substring matching, including literal percent/underscore characters.

Product fields: name, generic_name, category, unit_price, reorder_level. Batch metadata: batch_no, expiry_date, cost_price, selling_price. Decimal values are returned as strings to preserve database precision. Unknown fields, invalid dates, negative money and invalid integer thresholds are rejected.

## Interpretation and pending business decisions

Categories remain free text; no category list was invented. Reorder levels may remain unset pending admin confirmation. Recorded stock includes expired stock and does not promise sale eligibility. A product with no batches has zero stock; any unknown batch quantity makes its aggregate and low-stock classification unknown.

Near expiry includes today through today plus the requested days, using Asia/Manila. The UI's editable 30-day default is a search window, not an approved alert policy. Expired and near-expiry filters require positive quantities. Global alert thresholds, duplicate batch-number policy, stock posting, sale eligibility and FEFO remain outside this phase.

## Actual validation (2026-11-20)

- Backend default suite: 10 passed; the two opt-in database suites were skipped there and run separately.
- Isolated inventory PostgreSQL suite: 11 passed (parent plus 10 scenarios), including quantity rejection for admin and manager, search/injection resistance, pagination, cost protection, low-stock/expiry boundaries and audit failure rollback.
- Isolated authentication PostgreSQL suite: 13 passed (parent plus 12 scenarios), including roles, inactive users, expiration, revocation and audit rollback.
- Frontend: 13 tests passed; ESLint and production build passed.
- Actual `/api/health` and `/api/health/db` requests returned HTTP 200.

Database suites use unique transaction-local schemas, baseline plus approved 002/004 only, and roll back all fixtures. Baseline checksum and application migration history/row counts are verified unchanged. Inventory tests also compare public constraint definitions. No production business data was inserted. Browser visual inspection was not completed; UI validation used React/jsdom tests and a production build.

Run from server in PowerShell: `npm.cmd test`; `$env:RUN_INVENTORY_DB_TESTS='1'; npm.cmd run test:inventory:db`; `$env:RUN_AUTH_DB_TESTS='1'; npm.cmd run test:auth:db`. Run from client: `npm.cmd test`, `npm.cmd run lint`, `npm.cmd run build`.
