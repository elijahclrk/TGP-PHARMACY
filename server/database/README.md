# Deployment status - 2026-11-20

001, 002_supported_integrity.sql and 004_lookup_indexes.sql are applied and
recorded. 003 and deferred 005 remain unexecuted. Migration SQL files were not
edited during deployment, preserving the reviewed bytes and checksums even
though historical header comments still call them drafts.

Use the baseline-followup runner from the workspace root:

    node server/database/apply-integrity.mjs --check
    node server/database/apply-integrity.mjs --apply

This runner is strictly allowlisted to 001 as reference and 002/004 as applicable
changes; it never reads 003/005. It pins SHA-256 hashes, verifies ordered migration
history, requires empty application tables, compares exact catalog definitions
against isolated reference schemas and holds transaction locks during checks and
application. Both pending migrations and their tracking rows commit together.
Repeat application checks and skips matching recorded versions. Unknown history,
checksum changes, schema differences or business data stop the command.

Both modes build a temporary reference schema inside a savepoint and roll it
back; --check is not a purely read-only SQL session, but changes no application
objects or data. It takes exclusive table locks, so use during a maintenance
window. This initialization runner intentionally stops after business data is
present; it is not a general-purpose future migration runner. The older
apply-baseline.mjs is superseded for status checks after this deployment and
will reject the additional history entries by design.

Actual verification: 15 empty application tables, 15 PKs, 24 FKs, 22 CHECK
constraints (original role check plus 21 from 002), four new required fields,
and 40 indexes (16 original plus 24 from 004). Exact columns, defaults,
constraints, index definitions, user triggers and table settings matched the
reference. The optional return index is absent as expected with 003 deferred.

Applied 002 and 004 at 2026-11-20 09:11:42 Asia/Manila. History includes filenames,
SHA-256 checksums and database timestamps. Reapplication safely skipped both.
No application records were inserted. Existing GET /api/health/db returned
HTTP 200 with success=true and status=ok. npm.cmd test: 5 passed, 0 failed.
The 76-case deferred-combination suite was not rerun during this deployment,
because 003 and 005 were outside the authorized execution scope.

Frontend, API logic, connection settings and original baseline are unchanged.
The following earlier proposal notes are historical and superseded by this
application record where they describe 002/004 as unexecuted.

---

# Current proposal decision - 2026-11-20

The current authoritative review and actual rerun results are in
[VALIDATION_RESULTS.md](VALIDATION_RESULTS.md).

- Recommend revised 002 and 004 for future authorized application only.
- 002 now retains explicitly required reason/audit fields; other NOT NULL rules
  have moved to proposed/deferred/005_complete_records.sql for lifecycle approval.
- 004 no longer creates sale_returns_sale_id_idx. When 003 is adopted its
  composite return index covers that lookup. Without 003 that lookup has no
  dedicated index; 004 remains valid independently.
- 003 and 005 remain deferred. Full isolated suite: 76 rejection tests, 42
  indexes. Supported subset: 40 indexes and deferred fields remain nullable.
- No proposed migration was applied to the application schema.

The following original package notes are historical; their required-field and
index descriptions describe the earlier drafts and are superseded above.

---

# Phase 3 migration review package

Status: the original baseline was applied and verified on 2026-11-20.
All files under `migrations/proposed/` remain unapproved and unexecuted.
No automatic startup integration has been added.

## Baseline execution record

`apply-baseline.mjs` uses the existing secure pool and accepts only `--check`
(read-only preflight) or `--apply` (baseline-only initialization). Run from the
workspace root with `node server/database/apply-baseline.mjs --check`.
It never enumerates or executes proposed migrations. A pinned SHA-256 rejects
changes to the reviewed baseline. Existing untracked application tables or
unexpected non-extension user relations stop execution without schema changes.

Initialization uses one client, a transaction-scoped advisory lock, explicit
public search path, a rolled-back savepoint rehearsal for PostgreSQL syntax and
compatibility validation, catalog verification, and an atomic commit of schema
and tracking metadata. Ordinary external DDL does not honor the advisory lock;
avoid concurrent schema administration during initialization. Conflicting
CREATE statements fail rather than overwrite objects.

`public.tgp_schema_migrations` records filename, checksum and application time.
This is one additional infrastructure table, separate from the 15 application
tables. Its one metadata row is the only inserted data. A matching recorded
checksum verifies table/PK/FK counts and skips reapplication; a mismatch stops.
The count verification is not a comprehensive schema-drift detector.

Actual results: PostgreSQL rehearsal succeeded and was rolled back; baseline
committed; 15 application tables, 15 primary keys and 24 foreign keys verified;
all application tables empty; tracking record verified. A second `--apply`
invocation confirmed that reapplication is skipped without changes.

## Files and approval boundaries

| File | Purpose |
| --- | --- |
| `migrations/001_phase3_baseline.sql` | Byte-for-byte copy of `docs/phase3/tgp_database.sql`: 15 tables, 15 application-assigned integer primary keys, 24 foreign keys, original relationships and comments. |
| `migrations/proposed/002_supported_integrity.sql` | Proposed row-level required fields, quantity and monetary validation, cash payment validation, mandatory audit fields. |
| `migrations/proposed/003_return_sale_item_link.sql` | Optional structural amendment linking each return to one original sale line. Requires explicit approval of that granularity. |
| `migrations/proposed/004_lookup_indexes.sql` | Baseline FK indexes and a partial FEFO lookup index. Independent of 003. |

Only the original design is preserved as baseline. All proposed amendment DDL remains
under `proposed/`; do not recursively execute this directory or treat numbering
as approval. Baseline authorization does not authorize these proposed amendments.

## Proposed constraints and evidence

Source references below refer to the approved SQL. These proposals narrow what
can be stored; they are not claims that the original schema enforced the rules.

| Area | Proposed change | Supporting intent |
| --- | --- | --- |
| Inventory | Required expiry, quantity and prices; quantity >= 0 | Lines 50-61: physical batches with expiry/cost and stock deduction |
| Product values | Required nonnegative price and reorder level | Lines 41-47 and 180: pricing and low-stock threshold |
| PO, receipt, sale and return lines | Required quantity > 0 | Lines 75-105, 132-139, 165-175: ordered, received, sold and restored quantities |
| Monetary fields | Required finite nonnegative values for product price, batch prices, PO/receipt costs, sale-item price, sale total, cash and change | Existing price/cost/total fields; no currency precision or calculation policy inferred |
| Stock corrections | Required nonzero signed quantity and nonblank reason | Lines 152-162 explicitly require a reason and allow positive/negative adjustments |
| Cash payment | Required method = cash; change <= tendered amount | Lines 142-149: cash-only MVP with change calculation |
| Audit | Required nonblank action/module and required timestamp | Lines 20-26: who, what, when |

`NOT NULL` is paired with checks where required: a CHECK alone permits NULL.
For unconstrained NUMERIC, `value >= 0 AND value < 'Infinity'::numeric` excludes
negative values, both infinities and NaN. Zero prices/totals remain permitted;
there is no invented strictly-positive price rule or fixed decimal scale.
No default values or automatic data repair are added. Existing invalid data
would cause the integrity migration to fail and roll back.

Required prices and quantities assume these tables store complete operational
rows, even while approval is pending. If incomplete drafts must be persisted,
review lifecycle-specific validation before approving migration 002.

## Return amendment

The original return row references a sale but cannot identify its product/batch.
003 adds `sale_returns.sale_item_id`, a composite FK to
`sale_items(sale_id, sale_item_id)`, and the supporting parent uniqueness.
This prevents a return pointing to an item belonging to a different sale.
It retains the existing sale FK, return PK and all existing columns.

The migration fails before changing the schema if any return rows exist.
A populated database needs a separately reviewed, authoritative mapping and
backfill; never select an arbitrary line from a multi-line sale. No cascading
deletion, guessed backfill, new return header or refund model is introduced.
It does not enforce the sum of approved returns <= quantity originally sold;
that needs transaction locking and approval-once posting logic.

## Index decisions

004 includes one ordinary index for each of the 24 baseline FK columns.
The FEFO index orders positive-stock batches by product, expiry, then batch ID.
A full product FK index is retained because zero-stock batches still reference
products. No time-dependent predicate such as CURRENT_DATE is used.

If 003 is accepted, omit `sale_returns_sale_id_idx` from the approved version of
004: the composite return index already covers that leading column. Resolve
this choice before freezing migration checksums. Ordinary indexes suit an
initial empty schema; a populated production rollout needs separate lock and
deployment planning. Indexes do not enforce FEFO or inventory approval rules.

## Unresolved rules: no migrations drafted for these

- Inventory posting time for pending sales and stock receiving; replay-safe
  approval transitions and whether later reversal is allowed.
- Saleability of expired stock and approved returns, including expiry-day cutoff.
- One physical receipt lot versus reuse of a manufacturer batch across receipts;
  batch/reference uniqueness and receiving provenance.
- PO-to-receipt linkage, partial deliveries and over-receiving.
- Receipt-number uniqueness scope and stable checkout retry identifiers.
- Payment cardinality, cash reconciliation, discounts/VAT eligibility and
  rounding, monetary precision, and allocation of discounts to profit reports.
- Product versus batch selling-price precedence; historical cost/rate freezing
  versus snapshots; receipt cost matching batch cost.
- Return grouping, cumulative limits, refund accounting and mandatory reasons.
- Account/PO status enforcement, timestamp timezone changes, approval timestamps,
  append-only audit privileges and structured audit target references.
- Collision-safe application integer ID allocation; no identity/sequence or
  UUID conversion is included. Never allocate IDs with MAX(id) + 1.
- Whether additional names/reference fields must be required for draft records.

No fixed discount rates, customer/prescription fields, category tables or new
business modules have been added. The optional return link is the only new
column proposed. Original FK delete/update behaviour remains unchanged.

## Future execution and acceptance plan (not performed)

1. Review the drafts and resolve the choices above; freeze accepted files and
   checksums. Preserve the original baseline as provenance.
2. Verify the actual PostgreSQL version/schema and privileges in an isolated
   test environment. Use the intended `public` schema; baseline names are
   unqualified and must run under an explicitly controlled search path.
3. Execute the baseline inside a caller-managed transaction with stop-on-error.
   Each draft already contains its own transaction and local search path.
   Do not nest transaction wrappers. Files are one-time migrations, not rerun
   scripts; record applied versions/checksums in a future migration runner.
4. Validate rejection of NULL/zero/negative quantities, negative and nonfinite
   amounts, blank correction reasons, and cross-sale return links. Check both
   successful and failing cases and rollback on errors.
5. Before enabling POS, separately test competing sales for the last units,
   FEFO across batches, duplicate requests/approvals, cumulative returns and
   atomic rollback including payment and audit writes.

Use one checked-out pg client per transaction, parameterized application SQL,
consistent lock ordering, and guaranteed rollback/release. These files do not
implement those backend operations or establish production readiness.
The DDL uses standard PostgreSQL features supported by Neon and needs no
extension. Keep existing TLS/connection configuration unchanged. No credentials
belong in this directory, migration output or audit logs.

## Original package validation scope

Offline checks compare the baseline bytes with the approved source and inspect
table/key counts, constraint/index names and referenced baseline columns.
This is static review, not PostgreSQL parser or runtime validation. No database
connection, migration execution, or live-schema verification was part of that
original static review. The later baseline execution results are recorded above.
