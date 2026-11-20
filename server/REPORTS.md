# Dashboard and reports

## Provisional recognition policy — pending client validation

User-approved Option 1 recognizes successfully completed, fully paid regular POS sales regardless of `sales.approved_by`. NULL is shown as unreviewed, never approved. This is an explicit reporting-policy deviation from the original Phase 3 approved-only owner report notes; it changes no transaction or approval records. Existing POS workflow is untouched.

Sales qualify when their POS `sale.paid` audit event matches the cashier, their single cash payment less change equals stored sale total, and valid sale-item quantities/prices reconcile exactly to that total. Payment and item aggregates are computed independently to avoid multiplying totals for multi-batch sales. Incomplete/unpaid/unreconciled records are excluded with a visible excluded-record count. This iteration supports the existing regular-price POS only: discounted/tax-exempt/return-associated records are excluded rather than applying unapproved accounting rules. Missing sale dates cannot be assigned to a period and are outside date-filtered coverage. No Senior/PWD calculations were implemented.

## Permissions and API

All `/api/reports` endpoints enforce active-account authentication, no-store responses and Manager/Admin authorization. Employees receive 403 and their dashboard makes no reporting requests. Manager access is limited to daily/weekly sales and current low-stock/near-expiry information. Admin additionally has monthly sales, product performance, cost valuation and gross-profit estimates.

| GET endpoint | Filters | Access |
| --- | --- | --- |
| `/sales` | from, to, period=day/week/month | Manager day/week; Admin all |
| `/products` | from, to, page, limit | Admin |
| `/profit` | from, to | Admin |
| `/valuation` | none | Admin |
| `/low-stock` | existing product search/pagination filters | Manager/Admin |
| `/near-expiry` | days=0..365, existing batch search/pagination filters | Manager/Admin |

Sales filters require valid inclusive calendar dates, ordered and spanning at most 366 days. Weekly grouping starts Monday. A group at the range boundary contains only the selected dates, not an implied full week/month. Product results are bounded/paginated and ordered by units sold with product-ID ties. Categories are existing current catalog values; no category list or unsupported slow-moving classification is invented. Zero-sale products are not returned by sales-by-product.

All SQL request values are parameterized. Grouping is restricted to server-validated day/week/month. Reporting repository queries are SELECT-only; no endpoint modifies stock, payments, sales, audits, schema or migrations.

## Time and money

The existing `sale_date` column is timestamp without timezone. The database session was verified as GMT with zero application sales before implementation; current POS writes CURRENT_TIMESTAMP under that configuration. Reports interpret stored values as UTC and explicitly convert to Asia/Manila. Do not import local-time timestamps or change the connection timezone without a separately validated timestamp policy. Filtering converts Manila date boundaries to UTC and uses a half-open timestamp interval; grouping occurs after Manila conversion. No historical records were rewritten.

PostgreSQL NUMERIC performs all aggregation and profit calculations. API monetary values are decimal strings; UI PHP formatting uses string operations, preserving values beyond JavaScript safe-integer precision. Display totals round to two decimals. Product quantities aggregate across FEFO sale-item rows; transactions use distinct sale IDs.

## Costs and coverage

Inventory valuation is current recorded on-hand quantity multiplied by batch cost. Positive stock requires a matching approved stock-in unit cost and no conflicting approved receiving cost for that batch. Unknown quantities or unverified costs withhold the complete valuation; group-level coverage is visible. Zero-stock batches contribute zero without needing a cost. Expired/on-expiry, future-expiry and unknown-expiry groups are separate. Values are recorded cost, not realizable value or accounting write-downs. No historical inventory reconstruction is offered.

Gross profit is qualifying sale-line revenue minus quantity times verified receiving-backed batch cost. Gross margin is gross profit divided by revenue times 100; zero revenue produces an unavailable percentage. If any contributing line lacks verified cost, cost/profit/margin totals are withheld. These are estimates: batch cost is not a separate immutable sale-time cost snapshot, although existing application controls prevent changing used batch costs. Operating expenses, taxes, unimplemented discounts and returns are not modeled; this is not net profit. Client confirmation of financial definitions remains necessary.

Low-stock preserves the existing recorded-stock definition, including expired quantities, and excludes unknown quantity/threshold classifications. Near-expiry preserves existing inclusive today-through-window behavior for positive quantities. POS separately excludes today's expiry. Dashboard 30-day expiry view is a search preset, not a new pharmacy alert policy.

## UI and changed files

Employee dashboard retains basic cashier/catalog/inventory links. Manager/Admin dashboards show today's and Monday-to-date paid sales, reviewed/unreviewed counts, low-stock product count and 30-day near-expiry batch count. `/reports` exposes authorized report types, date/group filters, pagination, coverage warnings, retry/loading/empty states and responsive tables. Admin financial details are in Reports.

Backend: `src/services/report-validation.js`, `src/repositories/reports.repository.js`, `src/routes/reports.routes.js`, registration in `src/app.js`. Frontend: `src/reports/ReportPanel.jsx`, `DashboardSummary.jsx`, `format.js`, `src/pages/Reports.jsx`, dashboard/route/navigation integration. Tests: `test/reports.integration.test.js`, `test/report-validation.test.js`, `client/src/reports/reports.test.jsx`. npm script: `test:reports:db`.

## Validation

Real reporting integration fixtures are created using the actual POS checkout repository in a uniquely named isolated PostgreSQL schema. Fixture-only timestamps exercise midnight/week/month boundaries. Reports are checked against stored fully paid sale records; complete table snapshots verify report reads do not mutate fixtures. Tests cover unpaid exclusion, approval labels, multi-batch aggregation, exact large decimals, RBAC, invalid ranges, empty data, stock reports, verified/missing costs. Owned schema cleanup and public counts/constraints/migration history checks protect application data.

From server, enable `RUN_AUTH_DB_TESTS`, `RUN_INVENTORY_DB_TESTS`, `RUN_PURCHASING_DB_TESTS`, `RUN_POS_DB_TESTS` and `RUN_REPORTS_DB_TESTS` as `1`, then run `npm.cmd test`. Files run sequentially; concurrent checkout tests still use multiple connections internally. From client run `npm.cmd test`, `npm.cmd run lint`, `npm.cmd run build`.

Browser visual inspection remains unverified. No deployment was performed. Senior/PWD legal and operational validation remains a production-release blocker from the POS phase.

## Actual results — 2026-11-20

- Full backend command with all five database flags enabled: **65 passed, 0 failed, 0 skipped**, 135.53 seconds. Includes authentication, inventory, purchasing, POS and reporting regressions.
- Reporting integration: **7 passed**, including its parent test; real POS fixtures reconcile despite NULL approval status, Manila boundaries and large decimal totals pass, and complete fixture snapshots remain identical after report reads.
- Frontend: **33 tests passed** across five files. ESLint and Vite production build passed.
- Actual HTTP `/api/health` and `/api/health/db`: **200**.
- Isolated test schemas removed; public row counts, constraint definitions, baseline checksum and migration history checks passed. No application data, schema or historical transactions were changed.
