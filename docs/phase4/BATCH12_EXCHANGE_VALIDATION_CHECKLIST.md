# Batch 12 — Exchange decisions and validation checklist

Date: **22 November 2026, Asia/Manila**. **RESEARCH / DESIGN ONLY.** All approvals, implementation tests and activation gates below are **PENDING** unless explicitly stated otherwise. This checklist is not permission to implement, connect to a database, migrate, enable a feature, commit, push or deploy.

Companions: [primary-source research](BATCH12_EXCHANGE_RESEARCH.md) and [technical specification](BATCH12_EXCHANGE_TECHNICAL_SPEC.md). Legal references L01–L09 and proposed rules E01–E15 refer to that research. No branch fact, professional qualification, invoice registration or acceptance is inferred from a test fixture.

## 1. Required decisions before implementation scope is approved

Record only decision/evidence references, reviewer function, date, source/effective version, outcome and next review date. Do not put real customer IDs, prescriptions, credentials or sensitive branch registrations into repository documentation or chat.

| ID | Decision / exact question | Required reviewer/evidence | Safe behavior while unresolved |
| --- | --- | --- | --- |
| X01 | How will “No refund, change product lang” distinguish voluntary exchange from statutory defect, quantity, warranty, recall and dispensing-error remedies? | Owner + qualified legal adviser, pharmacist as relevant; policy mapped to L01/L02 | No blanket no-refund notice or software rejection of lawful remedies; effective human escalation required |
| X02 | What voluntary exchange conditions, time window and customer evidence are accepted, without overriding statutory cases? | Owner/pharmacist, written policy and public wording | No invented 7/30-day deadline, unopened-only universal statutory restriction or forced waiver |
| X03 | How are missing receipts, alternative proof, pre-system sales and ambiguous duplicate references investigated? | Owner/legal/accountant; source-establishment procedure | No fabricated paid sale, source item or automatic denial solely because paper/system reference is absent |
| X04 | Is voluntary applied value the original actual net consideration of returned supported units? Which discounts/promotions/rounding affect it? | Owner/accountant; signed exact examples and prefix-allocation policy | Candidate unavailable where value is unsupported; never use today's original-product price |
| X05 | How are same-kind defective replacements handled when current price changes? Who bears a different-kind statutory value difference? | Legal/owner/accountant; applicable remedy and customer-choice evidence | Do not automatically charge customer an increase or force a paid upgrade |
| X06 | May the customer voluntarily select a higher-value suitable replacement and pay positive cash difference? | Owner/legal/accountant; consent and tender/change SOP | No forced upsell; no top-up until approved route/equation exists |
| X07 | What lawful treatment applies when replacement value is lower? How are any required refunds, price reductions or outstanding liabilities handled? | Owner/legal/accountant, written settlement/document procedure | Show unresolved difference; no forfeiture, donation, forced additional purchase, automatic store credit or disguised refund-as-change |
| X08 | Are multiple source lines/replacements within one root receipt sufficient? Are fractional units or cross-receipt pooling required? | Owner/pharmacist; supported unit model and quantity policy | Positive integer base units, one root receipt; no unsupported conversions or transferable balance |
| X09 | Who independently reviews exchanges, and can the original initiator complete approved posting using a second distinct reviewer? How are cancellations/absences covered? | Owner; role/staffing matrix and UAT | No self-approval or shared credentials; existing PO/Stock-In rules unchanged |
| X10 | Who clinically verifies replacements, prescription/generic substitution, dosage/form/strength and pharmacist-only OTC? | Pharmacist; qualification evidence and current dispensing SOP | Role title/price match never proves suitability; no unsupported substitution |
| X11 | What return quarantine, custody, cold-chain, damage, counterfeit/recall and destruction/supplier-return procedures apply? Can any patient-returned medicine legally and safely be reissued? | Pharmacist/FDA clarification where needed; approved written SOP and quality evidence | No automatic stock restoration; new chain-return restock unavailable; original technical capability is not blanket legal approval |
| X12 | How will defective replacements be accepted/received/disposed and replaced again without reusing consumed units? | Owner/pharmacist/legal; lineage and new-source procedure | No one-exchange-only rule; no reuse of original `sale_item_id` for a different issued batch |
| X13 | How will Senior/PWD replacement entitlement, identity/representative evidence, mixed eligibility and tax classification be verified? | Pharmacist/accountant; Batch 9 B01–B16 plus exchange examples | No unknown-as-ineligible, no automatic Regular conversion or production synthetic provider |
| X14 | Does a defect replacement correct an original prescription fill or represent additional dispensing? How are balances, booklets and protected records endorsed? | Pharmacist; separate Senior/PWD SOP, including current amendments | No silent deletion/decrement of historical fill ledger or fictitious sale FK; affected benefit exchanges blocked |
| X15 | What original return/correction document and replacement invoice are required, for which values/tax bases and periods? Which series/registration applies? | Accountant/RDO as applicable; legible authorized samples and current legal assessment | Internal confirmation only; no auto credit note, fiscal serial, tax return or VAT reversal |
| X16 | Which cash, replacement, applied-value, discount, tax and cost/margin measures should reports show? How are warranty contributions treated if relevant? | Accountant/owner; signed reconciliation/data dictionary | Preserve original cash; report only actual top-up as additional cash; withhold unsupported margin/tax claims |
| X17 | What visibility/retention applies to identity, clinical evidence, supporting documents and external remedy cases? | Privacy responsible person/owner/accountant; lawful basis, access matrix, tax/legal hold schedule | No PII in general exports, audit text, URLs, browser storage or logs; no arbitrary deletion/indefinite collection |
| X18 | How will approved reservations be cancelled/released when unused or stale? Is any timed expiry actually desired? | Owner; staffing/escalation procedure | Explicit audited cancellation; no silent timeout or stock reservation invented |
| X19 | How will legitimate statutory/manual resolutions outside automated scope be recorded and excluded from duplicate settlement? | Owner/legal/accountant; secure case register and reconciliation owner | Keep claim unresolved until evidence of lawful resolution; do not mark a customer settled merely because automation is unavailable |
| X20 | Can any existing original returns be safely linked for 003? Which migration/provider is suitable for real benefit posting rather than local test-only 011? | Technical owner/accountant; authorized preflight and data mapping | No bypass of empty-return guard; no invented source linkage, real policy or branch configuration |

### Official-source closure

- [ ] Recheck L01/L02 against current law/DTI guidance; approve an exception path that preserves actual consumer choices, alternative proof and legitimate repeat replacements.
- [ ] Confirm medicine-quality/dispensing applicability with the pharmacist, using DOH AO 2013-0027, FDA Advisory 2022-1895, updated WHO §9 and current Philippine retail/dispensing requirements. Do not treat supplier returns, patient returns and hospital-only policies as interchangeable.
- [ ] Review complete legible current invoice/correction requirements and any later BIR amendments/e-invoicing coverage identified in Batch 9. Document unresolved publication/effectivity/application questions honestly.
- [ ] Confirm actual branch VAT/price basis and per-SKU independent eligibility/tax evidence; do not infer from “medicine,” disease/category text, brand or a synthetic fixture.
- [ ] Carry forward applicable Batch 9 B01–B16 gates, including distinct Senior/PWD documents, no double discount, current ID procedures, prescription limits, rounding and protected statutory records.
- [ ] Obtain exchange-specific accountant treatment for original/replacement discounts, VAT, gross versus cash, lower differences and any supplier/warranty contributions. Existing general benefit calculations alone do not answer these questions.

## 2. Proposed functional and arithmetic acceptance cases

**Every test below is NOT RUN / PROPOSED.** Values are synthetic PHP examples under explicitly stated test policy, not real SKU classifications, branch VAT facts or statutory accounting prescriptions. `C` = supported applied return value; `P` = replacement payable; `A` = extra cash. Normal equations apply only to the proposed voluntary equal/higher route.

| ID | Scenario | Required result |
| --- | --- | --- |
| T01 | Equal-value regular: C100.00, P100.00 | A0.00; no cash tender/change; one zero-additional-cash settlement, one FEFO issue, original payment unchanged |
| T02 | Higher-value voluntary choice: C100.00, P125.00, tender50.00 | A25.00, change25.00; replacement125.00 and cash25.00 reported separately |
| T03 | Lower-value: C100.00, P80.00 | Show unresolved20.00 and block posting under current proposed route; no refund/change/credit/profit fiction |
| T04 | Extra cash25.00, tender24.99; malformed money, 3 decimals, NaN, infinity or overflow | Reject before writes; no silent SQL scale rounding |
| T05 | Same-kind defect replacement originally100.00, current retail120.00 | No automatic20.00 customer top-up; route-specific approved remedy needed; voluntary policy cannot silently decide it |
| T06 | Defect, quantity shortage, dispensing error, recall and voluntary change of mind | Distinct case/evidence and permissible remedy path; unsafe replacement unavailable; no universal deadline invented |
| T07 | Original paper receipt missing but other proof exists | Human case path visible; no fake sale, automatic claim posting or categorical rights denial |
| T08 | Pending/rejected/approved-unreceived return | No exchange posting/reservation against unreceived units; original paid sale still reported |
| T09 | Approved fully received return quantity5; exchange only2 | Reserve/consume2, remaining3; physical quarantine unchanged |
| T10 | Two approved return rows for same sold batch line | Total source-unit intervals/values cannot overlap; each return received cap and overall issued cap hold |
| T11 | Multiple original lines and replacement lines under one root | Exact aggregate settlement, separate clinical/benefit evidence, stable logical-line and FEFO allocation sums |
| T12 | Cross-receipt pooling, fractional/negative/zero/excessive quantities or wrong batch/source | Reject unsupported route/shape; never infer unit conversion or apply another sale's entitlement |
| T13 | Replacement quantity exceeds usable stock | Conflict, complete rollback; approved claim remains recoverable/cancellable without stock or cash posting |
| T14 | Earliest batch expired, expiring today, zero stock or unknown expiry | Exclude it; select valid FEFO or report unavailable; no cashier batch bypass |
| T15 | Multiple valid FEFO batches | Allocate expiry then batch ID deterministically; logical price/benefit total independent of physical split |
| T16 | Product price, allocation, expiry date, Manila business date, policy/evidence or clinical status changes | Stale review even if total unchanged; fresh candidate and independent approval when fingerprint changes |
| T17 | Quote merely expires, same business fingerprint | Only authenticated server renewal after current checks; cashier re-reviews; do not silently extend a stale token |
| T18 | Rejection/cancellation | Nonblank reason/history; no stock/cash; cancellation releases exact reserved intervals and cannot cancel posted record |
| T19 | A cancelled interval creates a hole between other reserved units | Reuse actual free interval without overlap or cent duplication; never use active-quantity sum as the next offset |
| T20 | Gross.03, net.02, quantity3, removed0, discount.01 under proposed prefix v1 | Unit net allocations .01/.00/.01; total.02, full gross/discount conserved; zero-cent unit not silently discarded |
| T21 | Gross.09, removed.01, discount.02, net.06, quantity3 | Three one-unit claims preserve net.02 each under proposed net-first prefix; cumulative VAT-removal/discount components sum exactly to original |
| T22 | Partial claims made in different orders, then cancellation/reuse and full exhaustion | Same interval always has same component values; no more than full original net; sums/invariants hold across all supported quantities |
| T23 | Legacy regular source has unknown historical tax | Retain unknown; calculate only supported historical net, never invent old VAT/discount or automatic fiscal reversal |
| T24 | Unsupported v1/ambiguous historical discount, corrupt payment/item/audit or duplicate receipt | Controlled review/unavailable; no fabricated eligibility or monetary entitlement |
| T25 | Received returned medicines already destroyed/supplier-returned | Legitimate remaining remedy claim still visible; exchange does not recreate quarantine or stock |
| T26 | Accepted exchange while original return remains quarantined | Quarantine unchanged; clinical disposition still independently required |
| T27 | Replacement itself defective | New source points to actual issued exchange batch/item, independent review/receipt, then new bounded exchange; no blanket single-exchange lifetime limit |
| T28 | Repeat claim for the same replacement units, unposted parent, wrong root or self/ancestor cycle | Reject; no over-return, duplicated credit or ordinary-sale fabrication |
| T29 | Repeated replacement after previous paid upgrade | Source funding/quantity lineage preserved; cannot mint credit using higher current catalog price; unsupported warranty valuation escalated |
| T30 | New chain-return restock attempt | Unavailable under initial design; no call bypassing original 008 disposition/restock guards |
| T31 | Verified external remedy resolution, duplicate automatic claim and later attempted cancellation | Independently recorded exact source consumption prevents duplicate remedy; external state immutable and separately reported; no fictitious cash/stock/settlement posting |

### Senior/PWD vectors — both schemes, explicit synthetic classifications

| ID | Scenario | Required result / boundary |
| --- | --- | --- |
| B01 | Original eligible VAT-inclusive gross112.00, stored net80.00; replacement eligible gross112.00, approved synthetic 12%/20% policy | C80.00, replacement removed12.00/discount20.00/P80.00, A0.00; do not apply20% again to C |
| B02 | Same original; replacement eligible VAT-inclusive gross140.00 | Independently calculate base125.00, removed15.00, discount25.00, P100.00; proposed voluntary A20.00, not discounting only the difference |
| B03 | Same original; replacement intrinsically exempt gross100.00 | Removed0.00, discount20.00, P80.00; never divide already exempt100.00 by1.12 |
| B04 | Same original; explicit ineligible vatable replacement112.00 | Discount/removed0; taxable100.00, VAT12.00, P112.00; proposed voluntary A32.00, not25.60 |
| B05 | Replacement basket eligible VAT-inclusive112.00 plus explicit ineligible vatable112.00; C160.00 | Replacement gross224.00, removed12.00, discount20.00, payable192.00, charged VAT12.00; proposed voluntary A32.00 |
| B06 | Verified non-VAT synthetic policy, eligible gross112.00 | P89.60, removed0; never invent VAT exemption/removal from registration guess |
| B07 | Unknown/unverified/expired/revoked tax or scheme eligibility, wrong scheme, inconsistent price basis | No quote/post; unknown is not ineligible, no Regular fallback |
| B08 | Missing beneficiary name/ID, invalid documentary/representative state, unverified prescriber or inappropriate replacement | Strict failure with no financial/stock record; no role-based evidence bypass |
| B09 | Senior plus PWD, already promotional price without approved comparison, manual rate override | Reject stacking/unsupported policy; same person does not receive both benefits |
| B10 | Original metadata later renamed/reclassified/repriced | Original component/identity references remain historical; fresh replacement evidence separate; confirmation not recalculated |
| B11 | Tiny/rounding-tie lines and every FEFO split | Batch 10 logical calculation unchanged; allocation/cash exact; accountant approves expected intermediate-rounding policy, not a legal assumption |
| B12 | Prescription correction/replacement versus additional fill | No silent balance restoration or fake sale-specific fill; approved exchange adapter/evidence required before supported posting |
| B13 | Original paid regular, later customer requests benefit on replacement | No retroactive benefit rewrite; route-specific new eligibility/accounting policy or controlled unavailable |
| B14 | Beneficiary differs between original and replacement, other person/representative or digital/legacy ID | Verify permitted route and actual scheme SOP; no transferable credit/automatic identity substitution; no Senior booklet requirement copied from PWD |

## 3. Concurrency, security and rollback tests to implement

| ID | Test | Required evidence |
| --- | --- | --- |
| C01 | Two pending exchanges approve against the last received units | At most available capacity reserved; loser conflict; no negative availability |
| C02 | Same request/posting UUID submitted concurrently and retried | One exchange/settlement/stock issue/audit-post event; exact matching replay; changed payload conflict |
| C03 | Different keys compete to post the same approved exchange | Header/unique settlement prevents double posting; one confirmation reference |
| C04 | Ordinary POS competes for last replacement stock | One valid deduction; nonnegative stock; no deadlock or partial settlement |
| C05 | Exchange approval/post/cancel competes with return approval, disposition, restock, product update and qualification/role revocation | Consistent lock order, rechecks and bounded retry; no shared-to-exclusive upgrade |
| C06 | Concurrent replacement-return approvals against one issued item | Approved totals capped by actual issued quantity; original root and batch consistency enforced |
| C07 | Fault after each stock/claim/snapshot/settlement write, audit failure and deferred constraint failure | Entire transaction rolled back; original sale/payment intact; no false posted state |
| C08 | Connection lost after COMMIT, then price/policy/gate changes and server restart | Resolve same attempt to persisted confirmation; zero extra deduction/payment; no dependency on current policy for committed replay |
| C09 | Connection lost before COMMIT and resolve races an in-flight post | Serialize outcome; close unused key durably; closed key cannot later post; no new UUID while unresolved |
| C10 | Employee decision request, self-review, wrong actor replay, inactive/deactivated account or stale role | HTTP and database/service boundaries reject; current actor/role checks, not hidden-button-only enforcement |
| C11 | Missing CSRF marker, invalid origin, expired/logout session, tampered/wrong-mode quote | Reject; reauthentication preserves opaque recovery reference without exposing another cashier's record |
| C12 | Pharmacist authorization missing/expired/revoked or Manager role only | Clinical action unavailable; no invented qualification; expiry rechecked after lock/wait |
| C13 | Direct append/update/delete/reparent of posted snapshots, events, settlement or supporting audit | Constraints/guards reject; no mutation through cancellation/rejection endpoint |
| C14 | Malicious SQL-like query, UUID, overlong reason/identity, injected totals/rates/refund fields | Parameterization and strict schemas; safe bounded errors and no PII/SQL dumps |
| C15 | Identifier guessing and unauthorized history/export access | Own/management scopes enforced; Employee no reports/exports; Manager restrictions unchanged |
| C16 | Sensitive-data leak checks | No full identity/prescription/token in URLs, generic logs, browser storage, audit text, screenshots or ordinary XLSX/PDF |
| C17 | External-resolution recording races exchange approval/posting, or has only an unsupported note | Same parent/range locks and caps prevent double consumption; missing independent proof/reconciliation rejects; no automatic refund endpoint |

No write/concurrency suite may run until the existing harness proves a separate disposable target, trusted TLS, identity and isolation attestation. Production `DATABASE_URL` must never be a fallback. These are future test requirements, not tests run by this research task.

## 4. Migration and compatibility acceptance plan

- [ ] Review final provisional 012 number/file and exact SQL separately; no SQL file is created in Batch 12.
- [ ] Preserve original 001/002/004 and all existing proposal checksums; record approved hashes before implementation.
- [ ] Prove 003's empty-return precondition, or obtain an approved populated-data mapping plan. Never bypass the guard or fabricate original items.
- [ ] Test fresh disposable order 001/002/004/003/007/008/009/011/012, with 011 explicitly local-only; leave independent 010 unapplied unless separately authorized.
- [ ] Test populated legacy regular/v1/v2 compatibility, parent duplicate/orphan detection and rollback of an intentionally failed migration. No financial/tax backfill by current-catalog inference.
- [ ] Test all FK/root/batch/type/quantity/precision constraints, range overlap/cancellation holes, decision transitions, aggregate sums, settlement/audit reconciliation and immutability with direct SQL against isolated fixtures.
- [ ] Ensure rejected/zero/negative/excess-precision/overflow values cannot be rounded into validity by column assignment.
- [ ] Check readiness against exact canonical definitions and enabled triggers, including missing/stale packaged resources; no table-exists-only pass.
- [ ] Prove no unsupported regular/benefit/statutory/lower-value route becomes available merely because another route is enabled.
- [ ] Gate-off new work while committed history/recovery/report readers remain available; old incompatible report versions are not accepted as a full rollback target.
- [ ] Review transactional migration locks, index impact, backup/restore rehearsal and forward-fix recovery before any separately authorized production operation.
- [ ] Test actual container runtime when Docker is available; retain static/copied-runtime evidence as a different, weaker result.

## 5. Reporting/export and browser/UAT plan

| ID | Scenario | Acceptance |
| --- | --- | --- |
| R01 | Original completed sale with pending, rejected, approved and posted return/exchange records | Original payment/cohort remains recognizable once; no full-sale exclusion |
| R02 | T01/T02 and multiple replacement batches/claims/events | Replacement100/125 and extra cash0/25 distinct; joins do not multiply totals; original payment never duplicated |
| R03 | Ordinary product category rankings and separate replacement movement | Existing paid-unit ranking preserved; any combined outbound view clearly labeled and reconciled |
| R04 | Original/discounted/exchange dates cross Manila midnight/month/end/year | Correct separate source and posting periods, inclusive filters, no browser timezone drift |
| R05 | XLSX/PDF/screen totals, pagination and export cap | Same authorized server filters/cohort, exact cents, parsed file totals, formula-safe strings and no PII |
| R06 | Historical confirmation after name/price/tax edits, re-login and replay | Same immutable reference/components/batch; no new fiscal serial, current-data repricing or extra payment |
| R07 | Unknown cost or unapproved tax/revenue treatment | Explicit unavailable/coverage state; no invented profit, COGS, VAT reversal or tax deduction |
| U01 | Desktop cashier: find receipt -> select approved received units -> replacements -> review -> request | Clear original/physical/financial distinctions; accessible labels/focus, no false available action |
| U02 | Distinct Manager/Admin reviewer -> approve/reject -> cashier complete | Own request cannot approve; history/actionable queue correct; two-account flow practical |
| U03 | Equal/higher/lower, changed quote, insufficient stock, expiry today and missing classification | Correct amounts and controlled failure/unavailable states; no silent recomputation |
| U04 | Receipt-linked return, receive/quarantine, physical disposition, replacement defect/new claim | No automatic restock/refund; lineage and cumulative limits visible; quality complaint escalation works |
| U05 | Local-only Senior/PWD mixed-basket and documentary paths | Full proposed breakdown, privacy, no production activation or legal/fiscal compliance label |
| U06 | Browser/network interruption, expired session, reload/back/navigation | Opaque recovery retained; outcome resolved before new attempt; no duplicate cash/stock |
| U07 | Nine clickable references, 1366×768 and 1440×900 | Existing shell/menu/cards/tables/dialog vocabulary preserved; cart/settlement readable, no sample data copied as real facts |
| U08 | Owner/accountant reports, exports and internal confirmation | Actual balances reviewed; internal confirmation distinguished from registered invoice; approved document examples assessed separately |

Run existing full frontend/backend suites, permitted isolated PostgreSQL/concurrency suites, desktop Chrome journeys, lint and production build using Node 24 in a future implementation batch. Record each run's actual pass/fail/skip counts separately. Do not add historical 122/209/26 figures to future results or treat synthetic Chrome journeys as pharmacy acceptance.

### Nontechnical reviewer walkthrough — future, unsigned

1. Cashier finds a synthetic original receipt and explains which approved returned units were physically received and which remain available for exchange.
2. Cashier chooses suitable replacement goods. Pharmacist reviews the medicine/prescription requirement separately from price/manager approval.
3. Manager/Admin, logged in separately, checks original value, replacements, policy and any extra cash, then approves or gives a rejection reason.
4. Cashier completes an equal-value example with no extra cash, then a higher-value example with correct tender/change. A lower-value example stays unresolved for the approved human policy.
5. Review original payment, replacement confirmation, quarantine and disposition independently; verify no automatic resale/refund occurred.
6. Repeat a legitimate defect return against a replacement and confirm actual issued batch lineage; retrying a completed attempt does not issue goods again.
7. Owner/accountant compare original cash, additional cash and replacement movement on screen and exports. Review a local Senior/PWD example only with synthetic verified evidence.
8. Review unsupported cases and statutory remedy escalation. Record issues and actual owner/pharmacist/accountant acceptance; do not sign for absent reviewers.

## 6. Batch 12 work actually performed

**Completed:** repository status/HEAD and source/design review; original source/wireframe review; authoritative web research; preparation of these three documents; documentation-scope/link and protected-file verification described in the final report. No exchange implementation or actual test result is implied by this checklist.

**Not run:** frontend/backend regressions, database/integration/concurrency tests, browser journeys, lint/build or any migration. These are unnecessary to claim as new results for research-only Markdown. Historical Batch 11 baseline is 122 frontend tests, 209 backend reported entries, and separate Chrome runs of 17 existing plus 9 local-benefit journey groups. Their prior success does not validate proposed exchanges.

**Documentation/design verification actually performed:** all 11 local Markdown links resolved; three new UTF-8 files had no replacement characters or trailing whitespace; no tracked-file diff; protected 001/002/004 SHA-256 values matched the reviewed Batch 11 manifest. An in-memory Node 24 arithmetic check of the proposed net-first prefix formula covered **220,532 synthetic component profiles / 2,274,896 prefix states**, with zero monotonicity/component-sum/full-source-conservation failures. Bounds were quantity1–12, cent unit price0–12, every possible net and VAT-removal split under those bounds. No database modules/imports, files, records or exchange service were created by that check. It is a bounded design sanity check, not application/unit/integration/concurrency acceptance or accountant approval; cancellation/range/tax-ledger tests remain proposed.

**Current review decision:** GO for owner/pharmacist/accountant/legal review of the design; **NO-GO for implementation or production activation under this research authorization**. Obtain explicit approval of selected business rules and the next implementation batch. Later require isolated technical evidence, actual UAT, verified branch policy/fiscal inputs, backup/restore and separate migration/activation authorization.

Exact new files:

1. `docs/phase4/BATCH12_EXCHANGE_RESEARCH.md`
2. `docs/phase4/BATCH12_EXCHANGE_TECHNICAL_SPEC.md`
3. `docs/phase4/BATCH12_EXCHANGE_VALIDATION_CHECKLIST.md`

All Batches 1–11 source, migration and configuration files remain unchanged. No production Neon connection/mutation, local database connection, executable migration, credential/account/business-record change, production feature activation, commit, push or deployment was performed.
