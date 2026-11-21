# Release checklist — Batch 6 gates, not execution authorization

## Batch 11 controlling update — 2026-11-22 Asia/Manila

This section supersedes outdated implementation/count statements below; prior sections remain historical gate context. Current evidence is [BATCH11_RESULTS.md](BATCH11_RESULTS.md), the [63-requirement matrix](FINAL_REQUIREMENTS_MATRIX.md), the [exact proposed checkpoint](BATCH11_CHECKPOINT_FILES.md) and the [unsigned current UAT](BATCH11_UAT_WALKTHROUGH.md). Fresh validation passed 122 frontend tests, 209 backend reported entries with all isolated DB suites enabled, two separate Chrome runs of 17 existing and 9 local-benefit groups, lint and Node 24 production builds. No commit, staging, push, release, business acceptance or production access is authorized by those results.

### Minimum release gates still open

- [ ] Owner approves the exact local checkpoint contents; rerun content/hash/secret review if any listed file changes. Keep environment/academic accounts, private manifests, keys/certificates, temporary PG data and generated browser/build/download artifacts outside Git. No blanket staging.
- [ ] Resolve **required product exchange**: current return approval/quarantine is not replacement fulfillment. Approve original-return-to-replacement linkage, equal/higher/lower-value treatment, any additional cash/unused balance policy, statutory discount/tax treatment and reporting, independent review, once-only exchange consumption and replacement FEFO. No cash refunds. Implement/retest the reviewed additive design; do not fake a second fully cash-paid replacement sale.
- [ ] Close B01–B16 and the official-source gaps in [Batch 9 validation](BATCH9_VALIDATION_CHECKLIST.md). Actual branch VAT, eligible SKU evidence, documentary/dispensing SOPs, promotions, rounding, privacy and invoice/accounting inputs are not inferred from fixtures.
- [ ] Build reviewed production benefit policy/classification publication and protected statutory record interfaces. Batch 10 implemented local verification/quote/posting/recovery/receipts/reports; its `test_only` registry and local constructor cannot be activated in production by a flag.
- [ ] Validate registered fiscal invoice issuance, actual seller/tax/permit/series/numbering/reprint process, printer and applicable electronic-invoicing obligations. Existing UUID confirmations are internal transaction records; PDFs are not fiscal acceptance.
- [ ] Owner/pharmacist/accountant complete actual UAT and training, including distinct reviewers, professional authorization onboarding/revocation, receiving/segregation/disposition SOPs, full physical return receipt and account recovery/succession.
- [ ] Explicitly accept or scope remaining supplier/product/account/PO UI fields, full PO-to-receiving lifecycle, durable notifications and report presentation gaps. Do not equate green tests with delivered missing requirements.
- [ ] Obtain the missing complete Feasibility Report, or record the accepted traceability limitation. The owner's one-web-app decision remains authoritative without that file.
- [ ] Establish Node 24+, actual HTTPS/proxy/Secure-cookie behavior, least privilege, single-process sessions, monitoring, operational ownership and a tested release artifact. Docker is unavailable locally; copied-runtime/static checks passed, actual Linux container/native-dependency verification remains blocked.
- [ ] Authorize and demonstrate encrypted backup plus independent isolated restore, RPO/RTO and post-restore transaction reconciliation. No production backup/restore was performed during this audit.
- [ ] Approve a populated-target migration runner, checksums/ledger, maintenance locks, legacy mapping, rollback and postchecks before production migration. Existing disposable UAT initialization is not that runner.
- [ ] Separately authorize production target inspection, migration, any workflow activation and later deployment. Approval of a local commit is not approval of production operations.

### Current proposal status and dependencies

| Proposal | Tested/reviewed status | Preconditions before future production consideration |
| --- | --- | --- |
| 003 return original-item link | Tested in disposable schemas; unapplied to production by project history, not rechecked through a live connection | Preserve 001/002/004; empty `sale_returns` or a separately reviewed authoritative historical mapping/backfill. Never guess a line/batch; stop incompatible old return writers. 003 alone cannot activate returns. |
| 007 decision workflows | Tested adjustment lifecycle/independent review/terminal history/once-only posting | Baseline integrity and legacy state review. Existing PO/Stock-In permissions stay unchanged; independent review applies to the new workflows. |
| 008 return disposition | Tested return decisions, cumulative caps, quarantine, separate qualified restock and reciprocal posting constraints | Requires 003 + 007; real pharmacist verification/provisioning, disposition SOP and staffing; full physical receipt contract. |
| 009 financial snapshots | Tested historical version1/legacy compatibility, immutability and reconciliation | Baseline 001/002/004; preserve existing migration bytes. Does not itself authorize statutory posting. |
| 010 durable Admin preferences | Proposal only; **unapplied locally and in production; not executed by current test/demo runners** | Separate scope/schema/API/transaction/optimistic-revision/security tests and approval. Browser-local preferences remain the implemented behavior. |
| 011 local benefit checkout | Tested fresh/populated legacy/version1 upgrade, rollback and version2 posting/recovery | Financial dependency 009; complete exercised environment is 001/002/004/003/007/008/009/011. Test-only policy constraints and production constructor refusal are deliberate. A reviewed production successor/provider is required; do not remove guards to repurpose fixtures. |

Rehearsed **disposable-only** order: **001 → 002 → 004 → 003 → 007 → 008 → 009 → 011**. 010 is independent/unapplied, not a missing mandatory predecessor of 011. Future exchange changes require their own reviewed additive design; no exchange migration was created here. Original applied 001/002/004 hashes match HEAD and the attested local baseline ledger. No claim is made about a newly inspected production ledger because no Neon connection was made.

Keep gate-off compatible readers available after new financial/workflow history exists. Roll back an uncommitted failed migration transaction; after committed records exist, retain history and forward-fix. Do not drop tables, invent historic approvals/tax classifications or resume older readers that exclude benefit sales. A disaster restore requires separate authorization and reconciliation of every transaction after its recovery point.

## Batch 8 handoff — 2026-11-22, no live release authorization

Use [the guarded compiled local demo](BATCH8_DEMO_HANDOFF.md) and
[unsigned client walkthrough](BATCH8_CLIENT_WALKTHROUGH.md). Current automated
evidence: 120 frontend tests, 189 backend reported entries, 17 Chrome groups and
38 screenshots; see [exact scope/results](BATCH8_RESULTS.md).
The local API uses a development configuration; production HTTPS and Docker
runtime remain unverified. All production and human acceptance gates remain.

Future migration planning order is 001 → 002 → 004 → 003 → 007 → 008 → 009.
First inventory the actual installed ledger/checksums; never replay or rewrite
applied 001/002/004. Rehearse pending 003/007/008/009 against a restored isolated
populated copy after backup/restore validation and an approved tracked runner.
Keep proposal 010 unapplied. Preserve application compatibility with flags off;
test controlled unavailable responses before separately approved activation.
Do not use destructive down-migrations to erase financial/workflow history.
No production connection, backup, restore, migration or activation was executed.

## Batch 7 update — safe local corrections, no deployment authorization

Canonical 007/008 resources are now included and verified using copied runtime
code against isolated PostgreSQL; within-category rankings and browser-local
Admin reminders are tested. Actual Docker/Linux execution remains blocked by
unavailable Docker. Durable preference proposal 010 is not installed. Follow
[Batch 7 results](BATCH7_RESULTS.md) and the
[local UAT walkthrough](BATCH7_UAT_WALKTHROUGH.md); all production/backup/migration/
restore/statutory and human acceptance gates below remain separate.

Date: 2026-11-21 Asia/Manila. **Do not connect to production, migrate, seed, activate flags, provision users, commit, push or deploy by following this document without separate authorization.**

Current decision: **NO-GO for full live-pharmacy release.** A guarded local synthetic review may proceed with the [known gaps](BATCH6_QA_RESULTS.md) clearly disclosed. Completed automated QA does not grant owner/pharmacist acceptance.

## Gate 1 — accountable scope and release artifact

- [ ] Owner reviews [FINAL_REQUIREMENTS_MATRIX.md](FINAL_REQUIREMENTS_MATRIX.md), including blocked Senior/PWD and partial notification/category/receipt/PO fields.
- [ ] Confirm acceptance of single web app, cash-only MVP, immediate reconciled-sale recognition, current PO/Stock-In permissions and separate return cash/disposition accounting.
- [ ] Resolve Employee adjustment-request vs original SRF access restriction (R37/D09).
- [ ] Provide full Feasibility Report or explicitly accept the documented source limitation; preserve originals.
- [ ] Record a precise reviewed release file tree and checksums including currently untracked Batch 1–5 sources, migrations and font/license. Current committed HEAD alone is not this tested implementation.
- [ ] Obtain authorization for later commit/PR/hosted CI/release work. No such action was done by Batch 6.

## Gate 2 — close code/packaging gaps

- [x] Include exact canonical 007/008 files with narrow context/COPY rules; no runner or secret inclusion. Real copied-code local schema/function checks pass and missing/stale resources fail closed. Checks were not weakened.
- [ ] Add a real packaged-runtime test proving baseline stays available with flags off, and migrated workflows can pass schemaReady with exact canonical resources present.
- [ ] Use Node 24+ in build/runtime; Windows shell default 22.23.4 is insufficient.
- [ ] Include server production dependencies, scoped patched UUID override and Noto Sans/OFL assets. PDFs must require no runtime download.
- [ ] Re-run exact frontend/backend/DB/browser/lint/build checks for the final changed release artifact. Existing hosted CI skips database integration; a green hosted job is not a substitute for isolated DB evidence.
- [ ] Establish approved Linux/container/host test environment and complete runtime/native dependency checks; no container was built in this batch.
- [x] Implement/test within-category best/slow unit rankings with filters and matching Excel/PDF exports.
- [ ] Accept limited browser-local Admin reminder scope, or separately approve/implement durable settings. Proposal 010 is not an activation instruction.

## Gate 3 — owner, pharmacist and accounting acceptance

- [ ] Complete [UAT_CHECKLIST.md](UAT_CHECKLIST.md) with actual named reviewers/date, findings and acceptance scope. Empty signature fields mean pending.
- [ ] Verify sufficient distinct Manager/Admin reviewers. Never relax no-self-approval because of staffing.
- [ ] Define pharmacist qualification evidence, onboarding, independent verification, expiry/revocation responsibility and approved provisioning mechanism. A Manager/Admin title is not evidence.
- [ ] Approve physical receipt/quarantine, full-vs-partial receipt, storage-integrity assessment and destroy/supplier-return/restock procedures. Return acceptance must not trigger sellable stock/refund.
- [ ] Resolve the receiving expiry mismatch: reference says reject expired stock, current receiving accepts valid past dates. Approve reject vs quarantine/record-only handling and required implementation/tests before operational acceptance. POS/restock exclusion is a separate existing rule.
- [ ] Verify fiscal receipt/invoice fields, numbering, printer/process expectations, branch tax registration and any applicable regulatory registration; current confirmation display is provisional.
- [ ] Decide credential distribution, lost-password/admin succession, staff training and operational incident ownership.

## Gate 4 — separate statutory checkout authorization

The current code has **no activated discounted posting endpoint** and availability returns false. There is no safe “turn it on” environment toggle to skip the following work.

- [ ] Pharmacy/accountant validates branch VAT/non-VAT status and current product-specific tax treatment, including independently exempt products.
- [ ] Validate scheme-specific eligible/ineligible medicine evidence, reviewed source/version and review ownership; unknown is never treated as eligible.
- [ ] Approve beneficiary/authorized-representative identity and documentary/prescription procedures, privacy/access/retention and current invoice format.
- [ ] Approve versioned pricing basis by tax classification, rates, rounding and deterministic per-batch cent allocation. Synthetic test policy values are not an approved live policy.
- [ ] Complete cashier-bound signed quote/review/posting/recovery, immutable 009 snapshots and payment reconciliation, with no routine approval queue.
- [ ] Explicitly extend reporting and return qualification for versioned discounted sales **before** posting the first one. Current regular-sale cohort must not silently count unsupported discounted records.
- [ ] Complete isolated mixed baskets, metadata/version changes, duplicate schemes, unknown metadata, cent rounding, FEFO/concurrency/rollback, recovery and actual invoice acceptance.
- [ ] Obtain explicit statutory activation approval only after the implementation and evidence are reviewable.

No clinical/legal compliance certificate was issued by this project QA.

## Gate 5 — backup, target identity and data preconditions

All checks below require a later separately authorized production maintenance procedure. They were **not executed against Neon**.

- [ ] Identify exact approved business target privately; require independent operator verification. No URL/credentials in logs or command arguments.
- [ ] Preserve source and recorded history for original 001, 002 and 004; compare exact hashes/catalogs under authorized read-only preflight.
- [ ] Obtain a consistent encrypted backup and applicable provider recovery point; record owner, retention, RPO/RTO, restore location and checksum.
- [ ] Rehearse restore into an independently approved isolated environment; do not restore over the business DB merely to rehearse.
- [ ] Inspect existing returns: current 003 **requires empty sale_returns**, or a separately reviewed authoritative sale/item mapping/backfill migration. Never choose an arbitrary item of a multi-item receipt.
- [ ] Inspect legacy adjustments/decisions, unmapped returns, duplicate receipts/request keys, quantity/batch integrity, existing pending records, monetary precision and unknown classification.
- [ ] Plan explicit treatment of legacy rows/NOT VALID constraints. Preserve history; do not invent approvals, tax evidence or stock balances.
- [ ] Verify PostgreSQL version supports 009 xid8 (13+), actual application timezone behavior, required privileges, lock budget and other writers.
- [ ] Build and rehearse a populated-target migration runner with exact allowlist/checksums, operator acknowledgement, transaction/lock handling, failure rollback and postchecks.
- [ ] **Do not use apply-integrity.mjs --check as read-only**: it performs reference DDL and locks, and initialization runners refuse populated business data. UAT/test scripts are never business migration runners.

## Gate 6 — approved migration dependency plan

| Migration/resource | Preconditions and action under later authorization |
|---|---|
| 001 baseline | Already recorded per historical baseline; never reset/reapply/renumber or edit bytes. |
| 002 supported integrity | Preserve existing recorded bytes/history. |
| 004 indexes | Preserve existing recorded order before deferred 003. |
| 003 return sale-item link | Empty returns or approved authoritative mapping/backfill; cut over old unlinked return writers. |
| 007 decision workflows | Baseline integrity/history verified; preserve frozen legacy adjustments and terminal new decisions. |
| 008 return dispositions | Requires **003 + 007**; add quarantine/disposition/professional-authorization constraints/triggers. |
| 009 financial snapshots | Independent of return activation after baseline; required before any future statutory posting, not itself approval to post. |
| 005 / 006 | Not implicitly included. Deferred completeness/image changes need their own scope/approval. |

Rehearsed local sequence: **001 → 002 → 004 → 003 → 007 → 008 → 009**. This is verified dependency order, not a production command. Review final approved files/checksums and transaction boundaries; do not recursively apply a proposed directory.

- [ ] Disable new workflow writers during migration; resolve/reconcile in-flight checkout IDs; stop incompatible external/old writers.
- [ ] Acquire approved locks, apply exactly approved additive changes through reviewed runner, verify ledger/catalog/triggers/functions atomically.
- [ ] Reconcile pre/post row counts, cash totals, batch balances, audit closures and preserved historical records.
- [ ] If migration fails, roll back its uncommitted transaction; do not retry by deleting data or rewriting history.
- [ ] Keep workflow/restock activation off after schema installation until independent postchecks and approval.

## Gate 7 — host security and operational cutover

- [ ] Approved HTTPS origin serves SPA and /api together; Secure/HttpOnly/Strict cookie works in the actual browser.
- [ ] One long-running API process only. Session allowlist and login limiting are process-local; process restart revokes sessions.
- [ ] Review actual reverse proxy/client-IP handling and rate limits; no blanket trust proxy or relaxed CSRF.
- [ ] Verified database TLS remains enforced; least-privilege runtime role, separate migration privilege and no unreviewed external writers.
- [ ] Secret store/rotation/distribution ownership, app/DB monitoring, redacted logs and outage/restore runbooks are accepted.
- [ ] No synthetic records, test authorizations or temporary test secrets copied from UAT. Do not package private temp manifests/keys.
- [ ] Verify baseline-only regular app first. Then separately approve CONTROLLED_WORKFLOWS_ENABLED and RETURN_RESTOCK_ENABLED only for the properly migrated/packaged target.
- [ ] Senior/PWD remains unavailable until Gate 4 independently passes; workflow flags do not enable it.
- [ ] Later authorized smoke uses approved legitimate records and carefully scoped actions. Do not create fake production transactions to make charts look populated.
- [ ] Record actual owner/go-live approval, monitoring window and rollback decision authority.

## Gate 8 — rollback and forward compatibility

- [ ] Keep prior reviewed app artifact and configuration, exact migration manifests, backup and recovery instructions.
- [ ] Before new records exist, disable gated writers and retain additive schema/history; code rollback is only to an artifact known compatible with that schema.
- [ ] After new adjustments/returns/dispositions/snapshots exist, keep compatible readers and prefer forward fixes. Old unlinked return/adjustment writers must not resume.
- [ ] Never drop immutable snapshots/decision history/quarantine/posting links or purge POS terminal closure events as a rollback shortcut.
- [ ] Never “undo” accepted returns by deleting payments/sales. Corrections require an approved auditable business procedure.
- [ ] If disaster restore is required, reconcile all transactions after the recovery point under explicit owner/accounting control; no unreviewed overwrite of business history.
- [ ] Recheck authentication/session invalidation, cashier checkout recovery, FEFO, receipts, original payment recognition and audit invariants after any switch.

Release owner: ____________________  Approved scope/revision: ____________________

Backup/restore evidence: ____________________  Migration approval: ____________________

Pharmacist/accounting UAT references: ____________________  Go-live approval/date: ____________________

**All fields are pending. This checklist grants no approval.**

