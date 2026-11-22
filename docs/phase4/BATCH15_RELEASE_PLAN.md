# Future release plan — preparation only

22 November 2026, Asia/Manila. **NO-GO for commercial production activation.** No instruction below authorizes a live connection, backup, migration, account change or deployment. Actual execution requires a separately reviewed artifact/target and explicit owner authorization. See [Batch 15 decision](BATCH15_RESULTS.md) and [remaining requirements](FINAL_REQUIREMENTS_MATRIX.md).

## Migration dependency and compatibility gates through 013

The existing protected applied history is **001 → 002 → 004**. Verify its raw hashes/ledger before any future operation; never reapply/rewrite it blindly. Names/numbers alone are not a dependency order.

| Proposal | Required foundation | Data/activation precondition |
|---|---|---|
| 003 original return item link | Protected baseline, original sales/items/returns | Refuses nonempty unlinked returns. Require empty returns or a separately reviewed authoritative mapping migration. Never guess a historical sale line or batch. |
| 007 adjustment decisions | Protected users/batches/adjustment baseline | Review legacy states and balances; preserve legacy classification, immutable terminal decisions, independent review and once-only posting. Stop incompatible old writers. |
| 008 return/quarantine/disposition | **003 + 007** | Full original item lineage; legacy review; actual professional authorization/SOP/staffing before qualified restock. No automatic stock restoration/refund. |
| 009 financial snapshots | Protected baseline; independent of return activation | Preserve legacy/version1 records and money semantics. No invented tax/eligibility backfill; schema alone does not authorize discounts. |
| 010 own-Admin preferences | Original users/activity audit foundation | Preserve proposal bytes; defaults apply on absent record, no production seed. Review schema/roles/revisions/audit and retention on rollback. Independent of 011/012/013. |
| 011 local benefit successor | **009** plus protected foundation | Explicit **LOCAL TEST CONTRACT** with `test_only` policy constraints. Production cannot use it merely by changing a flag or stripping guards. Design/review an additive production-capable policy/evidence successor and provider after B01–B16. Retain historical readers. |
| 012 local product exchanges | **003 + 007 + 008**; compatible sale readers | 009/011 are optional source readers, not permission to exchange discounted sales. Production-capable clinical policy/provider and lawful settlement handling need separate approval; current local voluntary equal/higher scope stays gated. |
| 013 operational completion | Protected users/products/batches/suppliers/PO/stock-in foundation | Nullable facts and PO links, no guessed backfill. Review scoped delivery-reference uniqueness, FK/trigger/index locks, remaining-quantity integrity and compatibility of all writers. Independent of 010/011. |

All-feature **disposable** rehearsal order used by the current launcher: **001 → 002 → 004 → 003 → 007 → 008 → 009 → 011 → 012 → 010 → 013**. A numeric valid topological order after the protected baseline is **003 → 007 → 008 → 009 → 010 → 011 → 012 → 013**. Neither list is an approved live migration command. Retain deferred 005 and optional image 006 outside the MVP activation plan. Current Docker copies canonical compatibility resources, not a production migration runner.

Before any future production proposal: obtain authorized read-only target inventory; compare actual ledger/checksums, schema/function/trigger/constraint/index state, legacy returns/adjustments/sales/payment consistency, unlinked receiving and active writers; assess table/index locks and maintenance duration on an isolated release-like copy. Stop on incompatibility. Record exact proposed SQL/artifact hashes, transaction boundaries, backup recovery point, operator, maintenance lock, expected postchecks and abort criteria for approval.

## Feature configuration and activation

| Setting/capability | Safe state now | Requirement before any future activation |
|---|---|---|
| `CONTROLLED_WORKFLOWS_ENABLED` | Production/shared config remains false/unset. Local child alone uses true. | Approved 003/007/008 and exact schema readiness; qualified staffing, independent reviewer/UAT and explicit activation approval. |
| `RETURN_RESTOCK_ENABLED` | Production/shared false/unset; local fixture true only. | Separate current pharmacist authorization, independent review, suitability/storage/disposition SOP, expiry guard and once-only stock/audit integrity. Role title is insufficient. |
| Benefits | No production activation flag/provider; default availability false. | Complete verified branch/accounting/documentary/tax/product inputs, protected effective-version publication and statutory record interfaces, production-compatible additive design, fiscal prerequisites and separately approved activation. |
| Exchanges | Default service absent, controlled unavailable. | Approved clinical pair/evidence provider, scope/remedy/settlement/tax decisions, independent review and immutable source/stock/cash/report adapters. Unsupported scenarios must remain gated. |
| Operational service (010/013) | Default service absent; local verified capability only. | Separately reviewed production-safe provider/constructor and complete schema gates; no reuse of disposable attestation as a live approval. Linked approval must fail safely when capability is absent. |
| `PRODUCT_IMAGES_ENABLED` | false; no image requirement | Keep out of this MVP; no provider credentials or image migration needed. |

Local synthetic constructors reject production mode. **Do not remove that guard to deploy the demo.** `senior_pwd_enabled:false` on generic workflow capabilities is not the benefits service's separate local availability. No named flag can stand in for professional/tax validation.

## Runtime, hosting and permissions

- Node **24 or newer matching declared engines**, locked dependencies and a reviewed build; local tested runtime is 24.22.3. Default Windows Node 22 is unsupported. Provision release Node explicitly rather than relying on an ephemeral local executable.
- One React production bundle and one long-running Express API, same HTTPS origin with `/api` routing and SPA fallback; database reachable only by backend over certificate/hostname-validated TLS. Do not put DB secrets in Vite/client variables or URL logs.
- One API process: JWT session allowlist is process-local and intentionally fails closed after restart. Horizontal replicas need a separately designed shared session/revocation model; do not deploy them silently. Document session interruption on restart.
- Explicit HTTPS certificate, exact `CLIENT_ORIGIN`, production `NODE_ENV`, Secure/HttpOnly/SameSite cookies, trusted mutation Origin plus `X-TGP-Request`, bounded body/upload sizes, security headers and reviewed reverse-proxy trust/rate-limit behavior. Do not trust arbitrary forwarded client IPs. Verify login, CSRF and logout/revocation through the real TLS proxy.
- Least-privilege application database identity; separate approved migration/backup operator identities as needed. Secrets belong in the approved host secret store, not Git or demo manifests. Restrict network exposure and logs/monitoring, and establish incident and recovery ownership.
- No production accounts were provisioned here. Before activation, owner must approve identity/role roster and initial Admin provisioning through the existing guarded procedure, independent Manager/Admin review coverage, staff credential handoff, inactivity/role-change revocation and protected owner recovery/succession procedure. Do not create fake approvals or leave bootstrap secrets configured.
- Real pharmacist evidence must have approved verification, independent provenance, expiry/revocation and access ownership. Do not convert the synthetic qualification fixture into a production grant.
- Docker is unavailable locally. A release operator must build the actual reviewed Node 24 image and test it against an authorized isolated TLS database, verifying Linux/native dependencies, canonical 007/008/010/012/013 files, nonroot runtime, font/PDF assets, compiled static files, health checks, exclusions and feature gates. Static/copied-runtime tests are evidence, not actual Docker runtime verification.

## Backup/restore rehearsal — plan, not performed

1. Owner approves topology, RPO/RTO, maintenance/restore decision maker, encrypted storage, access, retention and secret handling. Preserve application artifact plus migration/procedure versions with each recovery point.
2. First rehearse with synthetic data on an authorized isolated target. Produce an encrypted consistent PostgreSQL backup with the approved role/ledger/extension requirements. Record sanitized tool/version/checksum/time/coverage evidence; never log a connection string or password.
3. Restore into a **separately authorized, isolated empty database** with trusted TLS and no production app routing. This task did not authorize creation of new restore infrastructure. Verify identity before writes. Never restore over the live business database during a rehearsal.
4. Compare schema/ledger/functions/triggers/constraints/indexes and record counts; reconcile opening/ending batch balances, FEFO, paid sales/items/payments/audits, financial snapshots, approved adjustments, accepted returns/quarantine/dispositions, linked PO progress, exchange claims/stock/additional cash and preference revisions.
5. Launch the exact candidate artifact against the restored copy with correct gates; test login/session revocation, controlled unavailable behavior, quote/recovery/concurrency and XLSX/PDF. Measure elapsed restore time and actual data gap versus approved RPO/RTO.
6. Document failures and repeat until accepted. Retain recovery evidence securely. Only after that and separate owner authorization consider a real protected backup, migration or release window. Provider existence alone is not a restore test.

## Rollback and forward recovery

- Before commit of failed migration SQL: roll back that transaction and verify catalog/ledger/stock/financial state. Never mark a failed migration applied.
- After committed migrations or transactions exist: disable affected writers, retain additive columns/tables/history/audits and use a reviewed forward correction. Do not drop 010/013 or restore old blind receiving writers; pending linked receiving must remain guarded. Keep readers compatible with legacy, version1/version2 financial records and exchange separation.
- Quiesce in-flight operations and resolve saved idempotency references before resuming; a lost acknowledgement is not proof the transaction failed. Never duplicate cash collection, stock deduction/restock or exchange posting to “repair” uncertainty.
- A disaster restore loses operations after its recovery point unless explicitly reconciled. Require owner-approved restore authority, list/reconcile later sales/payments/audits and stock movements, and plan documentary/privacy obligations before reopening. Do not manufacture approvals, tax snapshots, refunds, credits or settlement records.
- Restart/redeploy revokes process-local sessions. Review affected cashiers' durable checkout references after re-login. Preserve audit continuity and professional qualification checks throughout recovery.

## Release decision

Academic local review can proceed with synthetic data and explicit limitations. Commercial use remains **NO-GO** until the 13 residual requirements and applicable branch-specific activation/hosting/recovery/UAT approvals are resolved or explicitly scoped by the proper owner/professionals. A local Git checkpoint approval does not authorize pushing, hosted auto-deployment, database operations or feature activation.
