# Development batch 1: core corrections and inactive workflow design

**Batch 2 supersession:** The owner's later approved direction and
[BATCH2_PREPARATION.md](BATCH2_PREPARATION.md) supersede the proposed workflow
sections below. PO/Stock-In permissions remain unchanged; new adjustment/return
reviews require distinct management reviewers. Revised 003/007/008/009 remain
unapplied. This document otherwise preserves the Batch 1 implementation record.

Authority: the project owner's Development Batch 1 instruction, 2026-11-21
(Asia/Manila), supersedes conflicting original comments and clickable examples.
This document and the SQL below do not authorize migration execution, new
accounts/data, statutory-discount activation, commit, push or deployment.

## Implemented scope and compatibility contract

One English, desktop-focused web application retains React/Vite/Tailwind,
Express and Neon. Cash-only checkout and existing roles remain. No product-image
activation, critical-stock formula or production data change is included.

### Reviewed POS quote

`POST /api/pos/quote` still accepts `{items:[{product_id,quantity}]}`. It now
returns `items`, `total`, `business_date`, and a server-authenticated `quote_token`.
The token binds the authenticated cashier to a SHA-256 fingerprint of the
ordered server-priced lines (including product names, quantities and amounts),
Manila business date, and ordered FEFO allocations (product/batch identity,
batch number, expiry, allocated quantity, price). HMAC-SHA256 uses the existing
server signing key with a quote-specific domain; no secrets enter the browser.
It does not reserve stock. An unrelated balance change that leaves the required
allocation intact is not a quote change.

`POST /api/pos/checkout` adds `quote_token` to the existing immutable request.
The server rechecks current role/status, prices and FEFO under the existing
transaction advisory lock and row locks. A missing, forged, wrong-cashier or
stale quote cannot create a new sale. A correctable rejection rolls back to the
existing savepoint, durably closes the unused reference, and only then permits
editing. The cashier must request a fresh quote and explicitly submit again.
New reference creation never silently retries at a new price.

Paid-reference lookup/replay precedes quote validation. Pre-upgrade paid
references without tokens remain recoverable, even after repricing, date change
or key rotation. Unpaid old saved requests close without posting and need review.
Network ambiguity still freezes the saved payload until status/resolution.
Frontend storage preserves the exact token with the exact checkout request.
All writers must retain the common lock and checkout-closure audit history.

### Normal sales and reports

Normal completed cash sales need no manual approval. `sales.approved_by` remains
NULL unless an actual historical review exists. No approval is fabricated.
SQL recognition is unchanged: payment, sale-item, amount and POS audit
reconciliation, discount exclusions and existing return exclusion are retained.
The `reviewed`/`unreviewed` response keys remain for compatibility but mean only
historical review metadata. UI labels and documentation no longer imply a queue.
No discounted-sale recognition or return financial rule changes in this batch.

### Calendar-month expiry policy

Business date is `(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila')::date`.
The inclusive upcoming boundary is `(business_date + interval '3 months')::date`,
which clamps month ends: January 31 -> April 30; November 30 -> February 28/29.
For 2026-11-21 the boundary is 2027-02-21, not a 90-day approximation.

The batch read API returns `expiry_status`: `unknown`, `expired`,
`expiring_today`, `near_expiry` (strictly after today through the boundary), or
`within_date`. Stock-bearing expired/today/upcoming filters are separate.
List responses expose `business_date` and `near_expiry_through`, including empty
results. Custom `days` query parameters are intentionally rejected with 400;
update external callers rather than silently honoring a conflicting policy.
POS still excludes today and earlier. Unknown expiry is never sale-eligible.

The read-only `/alerts` page consolidates existing product/batch reads for all
authenticated roles; it offers no inventory mutation. Low-stock still means all
recorded batch quantities <= the product's explicit reorder level. Expired stock
is included in that original aggregate; the UI discloses this limitation instead
of silently changing the client's stock definition.

### Thresholds and current approvals

`/reorder-thresholds` is Admin-only and sends only `reorder_level` through the
existing audited product PATCH route. Blank means NULL/unset and no evaluation;
zero is a valid explicit value. There is no critical level or invented default.

`/approvals` is Manager/Admin-only. Both existing purchase-order and stock-in
list APIs accept bounded `status=all|pending|approved` filters based on the actual
`approved_by` marker. Counts/pagination cover filtered server records, not just
the currently rendered page. The consolidated view reuses purchasing detail and
approval components/endpoints; PO approval does not post stock, stock-in posts
once. Current self-approval permissions are deliberately unchanged.
There are no new rejection, return, adjustment or routine-sale approval buttons.

## Exact migration proposals: not executed

Files are under `server/database/migrations/proposed/batch1/`; no existing
migration, checksum history, runner or demo allowlist is changed.

| File | Dependency | Purpose |
| --- | --- | --- |
| `007_decision_workflows.sql` | Original 001 + applied 002/004 | PO decision policy/rejection metadata; stock-in/adjustment states, two-person decisions and adjustment posting balances |
| Existing `003_return_sale_item_link.sql` | Original schema; empty/unlinked returns preflight | Composite sale/item FK and batch traceability through the original sale item |
| `008_return_dispositions.sql` | 003 and 007 | Return acceptance/physical receipt, independent dispositions, professional authorization, unique restock adjustment provenance |
| `009_discount_financial_snapshots.sql` | Original 001 + applied 002/004 | Unverified product classifications and nullable versioned transaction/customer/financial snapshots |

007 and 008 use explicit `legacy` states/defaults for compatibility and preserve
existing actor/approval fields. There is no blind reinterpretation/backfill of
old pending, rejected or approved records. NOT VALID checks avoid certifying
unknown history; they still constrain new/updated versioned rows. Future code
must explicitly use the new states. Existing 005 remains deferred; 006 images is
not needed. New indexes are ordinary CREATE INDEX for a reviewed maintenance
window; choose separately reviewed concurrent deployment steps for large tables.

The SQL is an exact proposal reviewed statically, not a claim of successful
PostgreSQL migration/constraint execution. It needs isolated execution and
rollback/concurrency verification before any production approval.

## Proposed no-self-approval policy (inactive)

`workflow-policy.mjs` is an executable design specification outside `src/`; no
runtime route imports it. Tests exercise Employee, Manager and Admin flows.
Distinct active Manager/Admin reviewers are allowed; an initiator cannot review
their own PO, stock-in, adjustment, return or disposition, even if Admin. Inactive
or demoted reviewers are denied. Stock-restocking additionally requires an
unrevoked, currently valid pharmacist authorization bound to the reviewer.

The current purchasing repository still permits self-approval, and regression
fixtures explicitly demonstrate this difference. Enabling the proposed rule is
a separate policy cutover, not a hidden batch-1 permission change. The existing
Neon account set has one Admin and one Employee and no Manager: the proposed
policy blocks an Admin's own requests until another appropriately authorized
reviewer exists. No second reviewer/account is created by this work.

Proposed pharmacist authorizations require independently recorded evidence and
another Admin's authorization; a sole Admin cannot self-authorize. This is an
explicit operational blocker to resolve through an approved professional
verification process, not a reason to treat every Manager/Admin as licensed.

## Proposed API and transaction plan (no routes activated)

Common rules: derive actors from authenticated accounts; recheck active role
inside the transaction; keep `authRepository.transaction` and its common writer
lock; use parameterized SQL, bounded lists and server-generated IDs/timestamps.
All mutating requests require trusted Origin/header and strict bodies. New
request creation uses immutable UUID `request_key` and equality-checked replay;
decisions use the stored request identity and terminal-state/status recovery.
Existing PO/stock-in creation idempotency is unchanged in this batch. Lock request/header, original
sale item where relevant, professional authorization and affected batches in
stable ID order. Terminal decisions cannot be changed or reapplied. Mutation,
decision, posting marker and audit event commit together. No direct quantities,
reviewer IDs, decisions or balance values are accepted from the browser.

| Proposed endpoint | Body/permission | Transaction effect |
| --- | --- | --- |
| `POST /api/adjustments` | `{request_key,batch_id,quantity,reason}`; Manager/Admin | Nonzero signed quantity, reason; pending request only; supplier deliveries refused as adjustment purpose |
| `POST /api/adjustments/:id/approve` | `{}`; distinct Manager/Admin | Lock pending request/batch; reject NULL/negative/overflow result; atomically post delta, save before/after balances, actual approver/time and audit |
| `POST /api/adjustments/:id/reject` | `{reason}`; distinct Manager/Admin | Terminal rejection and audit, no quantity change |
| `GET /api/returns/receipt?receipt_no=...` | Authenticated; exact stored receipt lookup | Returnable lines, actual sale-item/batch IDs and accepted quantities; no guessed catalog/batch matching |
| `POST /api/returns` | `{request_key,sale_id,sale_item_id,quantity,reason}`; Employee/Manager/Admin proposed | Validate original paid sale and line ownership; pending request; no sale/payment/batch mutation |
| `POST /api/returns/:id/approve` | `{}`; distinct Manager/Admin | Lock original sale item/return; cumulative approved quantities <= quantity sold; acceptance only, no refund or sellable stock |
| `POST /api/returns/:id/reject` | `{reason}`; distinct Manager/Admin | Terminal rejection; no original-sale, payment or stock mutation |
| `POST /api/returns/:id/receive` | `{request_key,quantity}`; authorized management proposed | One full physical receipt of the approved quantity; quarantine outside sellable batches; parent request key identifies replay; audit receipt once |
| `POST /api/returns/:id/dispositions` | `{request_key,action,quantity,reason}`; Manager/Admin | Pending destroy/supplier-return/restock disposition against physically received units |
| `POST /api/return-dispositions/:id/approve` | `{}`; distinct Manager/Admin; verified pharmacist for restock | Lock original return/item and authorization; cumulative approved disposition quantities <= received quantity. Restock also verifies original batch identity, future expiry, controlled storage/packaging eligibility and current balance; create linked internal adjustment and post once atomically |
| `POST /api/return-dispositions/:id/reject` | `{reason}`; distinct Manager/Admin | Decision/audit only; physical stock stays quarantined |

The proposed physical-receipt endpoint needs a separate immutable event/key
record if partial receipt/replay is enabled. The exact 008 header columns support
one full physical receipt only; first version must require `quantity` equals the
accepted quantity and use the parent return request key for idempotent replay.
Do not implement partial receipts against this header-only design. The table
above's `request_key` must match that original key for the single receipt.

Every accepted return links to its exact sold item; 003 prevents cross-sale item
substitution. Approval and disposition each recheck cumulative approved amounts
under the original item/return locks. Duplicate pending requests do not reserve
extra stock; excessive approvals fail atomically. No arbitrary batch selection
or automatic creation of a sale-eligible replacement batch is allowed.
The proposed restock endpoint must also deny review by the original return
initiator, even when a different user requested the disposition.

Restocking uses an internal `origin_kind=return_restock` adjustment with a unique
two-way disposition link. The public adjustment endpoint only accepts manual
adjustments and must reject attempts to relabel returned units as a positive
recount. Approved disposition and adjustment are committed together; the
deferred pair FK enforces the provenance link at COMMIT. Current role, licensure
expiry/revocation and pharmacy disposition evidence still require runtime checks.
Cross-row quantity caps cannot be enforced by per-row CHECK constraints alone.

Return acceptance/disposition creates no payment, cash refund, credit, exchange,
or automatic revenue reduction. Financial outcomes and legal remedies remain
unspecified. Before creating the first return row, future reporting must remove
the current blanket `NOT EXISTS(sale_returns)` exclusion: pending/rejected
requests must not erase a paid sale. Keep original paid sales intact and present
return activity separately until settlement treatment is approved. This report
change is a dependency of future returns activation, not implemented here.

## Senior/PWD design and activation dependencies

Normal legally valid statutory checkouts need no manual approval. Only defined,
approved exception workflows may require review; no arbitrary manual discount
or eligibility bypass is proposed. Customer name and ID are required. Do not
store credentials, full IDs or customer names in general audit payloads.

009 starts products at unverified eligibility/unknown tax treatment. Classify
against authoritative sources with version/evidence and an actual reviewer.
Generic name/category alone is insufficient. Resolve branch VAT registration,
price-includes-VAT convention, product-specific VAT exemptions, beneficiary and
representative evidence, prescription rules, statutory rates, rounding and mixed
basket allocation with the pharmacy/accounting reviewer before activation.

The legal baseline reviewed in the preceding audit includes RA 9994, BIR RR
5-2017, DOH AO 2017-0008, the Senior Citizen booklet amendment AO 2024-0017,
BIR RMC 87-2026's FDA-endorsed VAT-exempt list, and current invoice guidance.
Senior and PWD documentary procedures must not be conflated. A VAT-inclusive
eligible price removes applicable VAT before the statutory discount; never
remove VAT twice from an already exempt product. No legal compliance is claimed.

Sources: [RA 9994](https://www.lawphil.net/statutes/repacts/ra2010/ra_9994_2010.html),
[RR 5-2017](https://ncda.gov.ph/disability-laws/implementing-rules-and-regulations-irr/revenue-regulations-no-5-2017-rules-and-regulations-implementing-republic-act-no-10754/),
[DOH AO 2017-0008](https://ncda.gov.ph/disability-laws/administrative-orders/doh-ao-2017-0008-implementing-guidelines-of-republic-act-10754-otherwise-known-as-an-act-expanding-the-benefits-and-privileges-of-persons-with-disability-for/),
[AO 2024-0017 government circulation](https://customs.gov.ph/wp-content/uploads/2025/01/2025CMC-10-2025.pdf),
[RMC 87-2026](https://bir-cdn.bir.gov.ph/BIR/pdf/RMC%20No.%2087-2026_redacted.pdf).

Future `/pos/quote`/`checkout` bodies add a strict benefit object
`{type,customer_name,customer_id,evidence_reference}` (minimal evidence only;
no ID-image upload). The server computes line eligibility and gross, VAT removed,
discount, taxable/exempt/VAT and net amounts; client totals never control pricing.
The signed quote and saved/replayed payload must bind these decisions as well.
Preserve monetary NUMERIC precision, allocate cents consistently across FEFO
lines, reconcile all header/line/payment totals, and render/export immutable
snapshots. `unit_price` stays the original regular sale-time unit price; future
discount-aware reports use net snapshots, with a legacy regular-sale fallback.
The existing header `vat_exempt` is only a compatibility benefit marker for new
benefit transactions, not a claim every line in a mixed basket is exempt.

Product name/tax/eligibility/rate and monetary snapshots must never be rewritten
by later product/rule edits. Use separate corrections, not in-place financial
history edits. Neither nullable legacy snapshots nor the editable `discounts`
lookup can supply invented historic tax data. Branch tax/invoice registration,
required statutory records, retention/access and Excel/PDF field exposure need
review before a legally operational pharmacy deployment.

## Cutover and rollback requirements

1. Keep original 001/002/004 and all historical checksums unchanged. Recheck
   actual counts, constraints, duplicates and NULL/legacy records read-only.
2. Exercise the exact proposals in an independently authorized disposable
   PostgreSQL database, including concurrent double decisions, cross-sale links,
   cumulative returns, pharmacist revocation, FK failures and audit rollback.
3. Obtain migration execution authorization and a verified backup/restore plan.
   Apply additive schema first with workflows disabled. No new feature is
   activated solely by a default, migration or environment toggle.
4. Deploy compatible readers/writers together. Stop old writers during the
   two-person-policy cutover; old code can still create/approve legacy rows and
   would bypass the new policy. Resolve each existing pending legacy request
   explicitly; do not silently relabel old approvals.
5. Activate one reviewed workflow at a time after roles, queue visibility,
   immutable request replay, reports and audits are ready. A sole-reviewer
   staffing situation remains blocked; never fall back to self-approval.
6. Roll back before activation by disabling new routes and retaining additive
   columns/tables. Do not run a destructive down migration. After versioned
   financial/disposition records exist, a rollback must retain readers for them;
   the old report code would exclude discounted or return-linked sales.
7. After any posting, use approved compensating records and a forward fix.
   Never delete decisions, rewrite stock/history, purge closure logs, discard
   uncertain checkouts, remove FKs or drop customer/financial snapshots.

Batch-1 quote enforcement also needs coordinated client/API release. Downgrading
the backend to silent repricing is not a safe rollback. Keep key material stable
where practical; rotating it invalidates unused quotes but never paid-receipt
recovery. Preserve the existing single-process session/topology assumptions.

## Remaining validation limits

No production write or migration test is authorized. Browser interaction and
pixel-level reference acceptance remain unverified unless separately captured.
The combined views contain actual API reads and honest empty states, never
hardcoded transaction samples. The design tests are policy/fixture evidence,
not live PostgreSQL constraint or professional-credential certification.
