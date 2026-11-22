# Final integrity proposal validation - 2026-11-20

## Recommendation

Recommend 002_supported_integrity.sql and 004_lookup_indexes.sql for a future
explicitly authorized application. Neither was applied to public in this task.
003 remains deferred pending return granularity approval. New
proposed/deferred/005_complete_records.sql remains deferred pending agreement
that incomplete operational rows may not be persisted.

## Changes and rationale

- Removed sale_returns_sale_id_idx from 004. The retained 003 index
  sale_returns_original_item_idx on (sale_id, sale_item_id) covers that lookup.
  The parent sale_items_sale_item_pair_uq constraint and index remain unchanged.
- 004 is valid without 003 and now creates 24 indexes: 23 baseline FK lookup
  indexes and one FEFO index. Without 003 there is no dedicated sale_returns
  sale_id lookup index. This is a performance gap, not a loss of referential
  integrity. 003 remains optional and is not implicitly approved by 004.
- 002 retains nonnegative stock/reorder checks, positive line quantities,
  nonzero signed adjustments, finite nonnegative monetary checks, cash-method
  and change bounds. Checks reject invalid supplied values but allow NULL.
- 002 retains required nonblank adjustment reasons and required audit action,
  module and timestamp: these are explicitly supported by the original comments.
- Moved other proposed NOT NULL rules into 005: batch expiry/quantity/prices,
  product price/reorder level, PO/receipt/sale/return quantities and costs,
  adjustment quantity, sale total, and payment fields. The documents do not
  settle whether these fields may be incomplete while a record is a draft.
- Baseline and its checksum are unchanged. No discounts, defaults, monetary
  precision, customer fields or additional business policy were introduced.

## Actual PostgreSQL results

The updated existing harness ran against a unique transaction-owned test schema.
Only in-memory copies had outer transaction wrappers and public search paths
removed. All fixtures and DDL were rolled back; public was only read.

- Supported 002 + 004 subset passed independently: deferred fields remained
  nullable, 40 total indexes existed, and there was no dependency on 003.
- Full isolated combination (002 + 003 + 004 + deferred 005) passed all 76
  expected-rejection tests from the earlier suite. These include NULL rejection
  under deferred 005, not a claim that 002 alone rejects those NULLs.
- Negative stock; zero/negative line quantities; negative, NaN and infinite
  amounts; missing required reasons/audit data; cross-sale and missing-item
  returns; invalid cash method/change; and legacy-return amendment guard passed.
- Valid zero stock/prices and signed adjustments passed. Data rollback passed.
- Baseline/002/003/004 repeated execution failed safely at duplicate objects.
  Repeated 005 succeeded: SET NOT NULL is repeatable. The first run incorrectly
  expected failure here; its transaction was rolled back, the test expectation
  was corrected, and the complete rerun succeeded. No migration syntax fix was
  necessary.
- Full catalog: 15 primary keys, 25 foreign keys and 42 indexes (previously 43).
  Redundant index absent; composite child index and parent uniqueness retained.
  All foreign-key targets were inside the isolated schema.
- Final rollback removed the task-owned schema. Public constraints, migration
  history and all application row counts matched the initial snapshot.
- Baseline bytes matched the approved Phase 3 source and its recorded checksum.

## Deferred decisions and limitations

- 003: one original sale line per return versus grouped return records;
  cumulative approved return limits and refund rules remain unimplemented.
- 005: incomplete draft lifecycle versus unconditional field completeness.
- Approval/posting timing, replay prevention, reversal and concurrency policy.
- Expiry-day eligibility, return saleability and physical batch identity.
- PO receipt linkage, partial delivery and over-receiving policy.
- Receipt uniqueness scope, cash reconciliation and payment cardinality.
- Monetary precision/rounding, discount/VAT treatment and historical pricing.
- Status rules, audit immutability, role enforcement and ID allocation.

Supported-subset validation is not POS readiness: NULL operational fields still
need validation before posting, and row checks do not enforce cross-row totals,
FEFO selection or atomic inventory movement. No performance benchmark was run.
The baseline-only runner still cannot apply proposals. Extend approved migration
tracking before a future authorized deployment; do not recursively execute drafts.

Changed artifacts: 002, 004, new deferred 005, validate-proposals.mjs, README.md
and this report. Frontend, API, connection configuration and baseline untouched.
