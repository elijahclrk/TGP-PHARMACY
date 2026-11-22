# Admin Audit Logs

Implemented scope: Admin-only read API and React page for existing audit history.
No audit producer, authentication rule, schema, migration or transaction-writing
workflow was changed. No edit, delete, export or retention feature was added.

## Requirements traceability

| Original source | Implemented requirement |
| --- | --- |
| `docs/phase1/TGP_SystemRequestForm.pdf`, Section 5, Accountability row, page 3 | Show the existing actor/action history; no fabricated events or actors. |
| Same PDF, Section 6, Admin paragraph/table, page 3 | General audit review is Admin-only. Manager permissions do not grant general audit access. |
| `docs/phase3/tgp_database.sql`, lines 20-27 | Read `activity_logs(log_id,user_id,action,module,logged_at)` and its existing user FK. |
| `docs/phase3/TGP_ERD.png`, activity_logs/users entities | Join current username/full_name through the existing user relationship. |
| `docs/phase3/TGP_Low_Fidelity_Wireframe.png`, panel 17 | Search/module toolbar; User, Action, Module, Reference, Time table; most-recent-first paging. |
| Official Phase 4 screenshot, Week 14 and Week 17 | Backend/frontend implementation, QA tests and user-manual update. No additional logging policy is inferred. |

No Phase 2 SDS was available. Wireframe placeholder records, approvals, receipt
references and names are not seed data and were not copied into the database.

## Read API

`GET /api/audit-logs` uses the existing active-session authentication and a
server-side Admin role check. Anonymous/inactive/expired sessions receive 401;
Employee/Manager sessions receive 403. Responses have `Cache-Control: no-store`.

| Query | Meaning / technical limits |
| --- | --- |
| `q` | Optional literal case-insensitive substring in username, current full_name, action or module; trimmed, max 200 characters. Percent/underscore are literal, not SQL wildcard operators. |
| `module` | Exact stored module value, max 200 characters; empty means all. It is not normalized or replaced by a fabricated category. |
| `page` | 1..999999, default 1. |
| `limit` | 1..100, default 20. |

Unknown/repeated fields and invalid bounds return safe 400 JSON. All filter and
paging values are SQL parameters. The fixed SELECT uses a LEFT JOIN to avoid
silently dropping a log if its current user data cannot be joined. Native
timestamps sort descending with nulls last; log_id descending makes ties stable.
Count, page and available module options come from one SQL statement/snapshot.
Available module options come from actual nonempty stored labels within the
filter's 200-character technical bound, independent of the current page/search.
Other stored labels remain visible in rows and searchable through `q`.

Response: `success`, `total`, `page`, `limit`, `modules` and `data`. Each row
contains only `log_id`, `user_id`, `username`, `full_name`, `action`, `module`,
`logged_at`. Both SQL and route projections exclude password hashes, tokens and
other unrelated user fields. The repository has no mutation method; reads do
not call the existing audit writer or account transaction service.

## Faithful display and limitations

- The original `logged_at` is TIMESTAMP WITHOUT TIME ZONE. SQL returns its text
  value without synthesizing `Z`/offset or changing precision. UI shows it as
  recorded. No undocumented historical timezone is inferred.
- User ID is the recorded actor; username/full_name are current user data, not
  historical snapshots. No historical role, IP, device or request metadata exists
  in this read model.
- The action/module remain verbatim text rendered through React escaping. Unknown
  legacy actions are retained; null fields say Not recorded rather than making
  up a value.
- There is no stored Reference column. A display-only helper recognizes current
  module/action pairs: account created/deactivated, product created/updated,
  batch created_zero_stock/metadata_updated, supplier created/updated, PO and
  receiving created/approved, POS sale.paid, product-image producer formats,
  and checkout.closed request UUIDs. IDs must fit the existing INTEGER range.
  No receipt prefix, padding, FK relationship or record existence is invented.
  Unknown/mismatched formats show a dash. A checkout UUID here is a checkout
  reference already in the stored action, not an authentication token.
- No logging completeness, tamper-proof storage, retention, historical-name
  snapshot, missing-module implementation or full-system compliance is claimed.

## Verification - 2026-11-20

- Frontend `npm test`: **86 passed, 0 failed, 0 skipped**, 11 files.
- Frontend lint and build: **exit 0**, Vite 8.3.8, 58 modules transformed.
- Backend `node --test --test-concurrency=1` (existing npm test script):
  **59 passed, 0 failed, 6 skipped**, 65 reported tests. Run with blank database
  URL, throwaway JWT secret and all six database-suite flags disabled.
- New HTTP tests use a local Express server, real JWT/session checks and in-memory
  users/logs. They cover anonymous/Employee/Manager/inactive/expired/demoted
  access, filter/query bounds, injection-shaped literal input, ordering/paging,
  empty data, safe failures, public projection, absent mutation/export endpoints
  and unchanged fixtures. Query tests check parameters and native timestamp
  ordering. Frontend checks cover role/route isolation, panel columns, selected
  module preservation, paging/search reset, loading/error/empty states, unknown
  events, HTML escaping and bounded reference parsing.
- A separate existing-Neon `BEGIN ISOLATION LEVEL REPEATABLE READ, READ ONLY`
  transaction verified the actual new SQL: list/count, module/literal filters,
  pagination/native ordering, public column projection and exact stored timestamp
  text, then rolled back. No login or event/account/business writes occurred.
  No audit contents, credentials, tokens or connection details were printed.
- Six broader PostgreSQL suites remain skipped: auth, inventory, purchasing,
  POS/FEFO, reports and product images. No mutation/concurrency certification
  is inferred from this read-only query check.
- Browser/native access host is unavailable. Screenshots, viewport/screen-reader
  behavior, real authenticated browser E2E and client visual acceptance remain
  **UNVERIFIED**. Existing auth/audit-writing production workflows were not run.

No credentials/configuration, database objects or stored records were changed.
No commit, push or deployment. See the updated wireframe checklist and manual.
