# Batch 6 — final QA evidence and release readiness

Date: 2026-11-21, Asia/Manila. Scope: local code, available Phase 1–3 sources, owner decisions, Batches 1–5 and isolated synthetic QA. **Production Neon was never connected or changed.**

## Verdict

**READY for a guarded local synthetic review; NOT READY for full client-required live-pharmacy release.**

Core regular cash POS, inventory/purchasing, protected adjustments/returns, audit review, alerts, reorder thresholds and reports/exports passed local QA. The mandatory Senior/PWD sale remains deliberately disabled and unfinished end to end. Fiscal receipt validation, real pharmacist/owner acceptance, controlled migration/cutover, packaging and operating safeguards remain release blockers.

This is not legal/clinical/security certification, proof of live-data quality, a fresh hosted-CI result or real-pharmacy user acceptance. No reviewer signed or personally completed UAT in this batch.

Primary traceability: [62 requirement rows and 13 decision differences](FINAL_REQUIREMENTS_MATRIX.md). Release procedure/approvals: [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md). Human review: [UAT_CHECKLIST.md](UAT_CHECKLIST.md).

## Current Git and runtime

- Branch main; HEAD 43b3211, “Complete admin modules and clickable wireframe UI alignment”, 2026-11-20 20:31:23 +08:00.
- HEAD vs cached origin/main: 0 ahead / 0 behind. **No fetch/network synchronization was performed**, so current remote state is not independently certified.
- Existing extensive Batch 1–5 local modifications and untracked files were preserved. QA is of this worktree, not just committed HEAD. No release revision/tag exists for these changes.
- Actual QA runtime Node **24.22.3**, meeting >=24. Shell default remains **22.23.4**, which does not meet the declared runtime.
- No dependency or application-source changes were made in Batch 6. Only local browser/evidence harnesses and release documentation changed.
- Docker executable was not available through Get-Command; no Linux container build or deployed-host test was performed.

## Final QA results

| Check | Actual Batch 6 result |
|---|---|
| Frontend Vitest | **113 passed**, 15 files, 0 failed/skipped; 9.78 s |
| Backend full runner with all permitted local DB suites | **178 reported entries passed**, 0 failed/skipped; 29.74 s |
| Isolated migration/concurrency/integrity suites | Passed within full backend run; 001/002/004/003/007/008/009 tested |
| ESLint | Exit 0 |
| Vite production build | Exit 0; 69 modules; 473 ms, write:false/emptyOutDir:false, preserving existing dist |
| Server production dependency audit | 0 reported vulnerabilities |
| Client production dependency audit | 0 reported vulnerabilities |
| Actual desktop Chrome | **15 journey groups passed**, Chrome 157.0.8103.79, 1440×1000 |
| Actual UI screenshots | **32 retained**, no generated mockups |
| Browser errors | 0 runtime errors, 0 unexpected API errors, 0 external page requests |
| Final read-only UAT verification | Passed TLS, attestation, baseline/history, financial/inventory invariants and downloads |
| Limited source-secret scan | 106 nonignored non-test JS/JSX/JSON/YAML files; 0 literal Neon URLs/private-key headers detected |
| git diff --check | Exit 0 |

The backend count includes Node parent/subtest/support-file entries; it is not 178 independent E2E journeys. Source scanning is limited to the stated patterns/files, not a forensic history/secret scan or penetration test. npm audit is a point-in-time advisory result, not a security guarantee.

No PostgreSQL suite was skipped in the permitted local run. **Unperformed:** actual discounted posting/fiscal invoices; owner/pharmacist UAT; real production data/account inspection; live provider interactions; physical printing/scanning; Safari/Firefox/mobile; accessibility/screen-reader acceptance; load/soak tests; Linux Docker/HTTPS/reverse-proxy/host backup-restore testing. These are not included in the green counts.

### Reproducible commands

Use the verified Node 24 executable (temporary path may change) and retain RTK prefix:

- server: node testing/local-postgres.mjs verify <attested-local-root>
- server: node testing/local-postgres.mjs test <attested-local-root>
- client: node node_modules/vitest/vitest.mjs run --configLoader runner --no-cache --no-fsModuleCache
- client: node node_modules/eslint/bin/eslint.js .
- client: in-memory Vite production build through build({...base,configFile:false,build:{write:false,emptyOutDir:false}})
- server: node testing/batch4-uat.mjs <attested-local-root> (historical filename; now 15 groups)
- server: node testing/verify-uat.mjs <attested-local-root> <retained-run>
- root: git -c core.safecrlf=false diff --check

No command here authorizes production access. Do not run mutation tests using normal DATABASE_URL or the production schema. The existing legacy initialization --check scripts are not interchangeable with read-only preflight.

### Browser groups actually exercised

1. Chrome launch, real login and role-specific navigation.
2. POS cash checkout, FEFO selection and real receipt.
3. Adjustment request and independent approval; exactly-once posting.
4. Adjustment rejection and Manager no-self-approval.
5. Pending return preserves recognized cash sale.
6. Independent rejection preserves cash sale.
7. Independent acceptance and physical receipt into quarantine.
8. Separate pharmacist authorization/evidence, original-batch once-only restock.
9. Unified PO/Stock-In review preserves existing permissions and stock posting.
10. Expired/today/upcoming alerts and Admin-only reorder thresholds.
11. Admin transaction/category/slow-moving and separate return reports.
12. Real XLSX/PDF downloads parsed against displayed totals; Manager export denial.
13. CSRF/RBAC boundaries and unavailable statutory checkout.
14. Admin global audit/account review and Manager direct-route/API denial.
15. Actual logout revokes a copied stale cookie; original cashier re-login can retrieve the completed receipt, while old cookie remains rejected.

Session expiration, demotion/deactivation, stale roles and permission-revocation races are also exercised in backend/fixture tests. The browser check is genuine logout revocation and re-login, not a claim that a one-hour session-expiry timer was waited out. Receipt retrieval after re-login is not a new claim to browser-test every uncertain-network recovery path; those paths have frontend/HTTP/PostgreSQL coverage.

## Database isolation and preserved integrity

Verified disposable PostgreSQL **17.12**, literal **127.0.0.1:58446**, dedicated unprivileged test login, externally provisioned database attestation and authorized **TLS 1.3** certificate/IP hostname. Wrong attestation, wrong hostname and untrusted CA are rejected. No TLS bypass or production fallback was introduced.

The runner replaces child DATABASE_URL with a nonconnecting production.invalid sentinel for DB tests and injects a distinct attested TEST_DATABASE_URL. Browser app children receive only the explicit local target and unique schema. The app/Vite bind to loopback. Private credentials/tokens are never printed. Synthetic fixtures and pharmacist authorization exist solely inside the disposable environment.

Final retained schema:
tgp_uat_5fa7680f43044d51830c7fe44e740fe4

Final independent read-only evidence verifies:

- Public baseline 001/002/004, checksum history and zero business rows unchanged.
- Seven UAT migration checksums match their source files.
- Original cash sale PHP **224.00**, tender **300.00**, change **76.00**, historical approved_by NULL; no refund/reversal after return activity.
- One rejected/unreceived return and one approved/physically received one-unit return.
- Original-batch restock once, using explicitly synthetic separately verified pharmacist fixture.
- Final batch quantities 301=4, 302=54, 303=3, 304=3, 305=4.
- Both browser-generated report files and new audit/stale-session groups verified.

Source docs/phase3/tgp_database.sql is byte-identical to 001. This batch changed no migration file. No SQL/diagram source was rewritten to hide historical differences.

Local certificate expiry remains **2026-11-28 20:55:04 Asia/Manila**; future test runs after expiry need a separately valid test certificate and a fresh TLS preflight. No instance/data/evidence deletion occurred.

Retained evidence root:
C:/Users/spori/AppData/Local/Temp/tgp-pg-1795265396785

Final run directory:
tgp_uat_5fa7680f43044d51830c7fe44e740fe4

Safe review artifacts: review.html, browser-results.json, verification.json, screenshots/ and downloads/tgp-sales.xlsx|pdf. Full backend output: root last-test-run.log. **Do not share private.json/private-uat.json, local TLS private keys or entire unfiltered temp directories.** These contain test credentials; they are not report artifacts.

## Security and integrity findings

| Area | Finding and evidence | Limit / release action |
|---|---|---|
| Authentication | Argon2id, algorithm/issuer/audience/expiry checks, random session IDs, allowlist, HttpOnly Strict cookie; Secure production option; no public registration | Single process; restart invalidates sessions. Real HTTPS cookie behavior at approved host unverified. |
| Current-role RBAC | Database role/status read per authenticated request; mutation-time recheck; account/workflow advisory locking and row locks | Existing roles are not professional credentials. Role changes lack a management UI; backend demotion fixtures verify enforcement. |
| CSRF | Exact trusted Origin plus X-TGP-Request required on mutations; no-store sensitive responses | Host/proxy origin must be configured correctly; no blanket trust-proxy exception. |
| Inputs/SQL | Strict bounded Zod inputs and parameterized values; unsupported price/discount/reviewer/batch overrides rejected | Deployment grants must prevent out-of-band writers bypassing service locks/protocol. |
| Transactions | Sale/payment/items/FEFO/audit atomic; request keys, row locks and terminal states prevent repeated posting; cumulative sold/quarantine limits | Lost COMMIT acknowledgement remains uncertain until status/replay reconciliation; do not retry with a new UUID. |
| Recovery | Cashier-scoped saved exact checkout, signed quotes, durable closure audit; no auth credential in localStorage | Do not purge terminal checkout audit events; no multi-tab coordination certification. |
| Approvals | New workflows forbid self-review; PO/Stock-In preserved; professional authorization separately checked and locked | Real independent staffing and verified qualification/onboarding still pending. |
| Exports | Admin-only, server filters, 10k cap, whitelist, exact decimal strings, formula escaping, PDF font embedding | XLSX amounts intentionally text. Current category/name metadata is not historical. Expensive maximum-size export/load behavior not benchmarked. |
| Secrets | Academic credentials file ignored by server/.gitignore .env.*; Docker excludes env/key files; 106-file limited scan found no literal Neon URL/private-key header | No private file values printed or copied. Does not certify Git history, host secret stores or private credential distribution; production was not inspected. |
| Test containment | Dedicated local role/TLS/attestation; production.invalid sentinel; fixture schemas; no real customer inputs | No synthetic records/customer IDs were sent to production in this batch. Production contents were not queried; no assertion about pre-existing live records is made. |
| Audit | Actor-bound writes, rollback on audit failure, Admin read-only search/global browser evidence | Regular audit timestamps retain original unzoned storage; UI labels raw storage. Current usernames not historic identity snapshots. Append-only DB privileges/retention require operational review. |

## Known release-blocking issues

| ID | Severity / reproduction or evidence | Required disposition |
|---|---|---|
| B01 | **Mandatory statutory checkout incomplete.** Senior/PWD controls unavailable; no discounted posting endpoint, invoice acceptance or discounted-sale report qualification | Pharmacy/accounting validation, reviewed metadata/policy and complete signed quote/posting/recovery/snapshot/report/invoice implementation under new authorization. No automatic flag-only activation. |
| B02 | **Workflow container packaging defect.** schemaReady() reads canonical ../../database/migrations/proposed/batch1/007... and 008...; Docker copies only server/src and excludes server/database | Add a narrowly packaged immutable compatibility resource/manifest or include exact required files, with image/runtime tests. Until corrected a migrated/flagged container fails closed to unavailable. This is availability/release blocking, not a bypass; no production fix was applied. |
| B03 | **Production migration/cutover not prepared for populated data.** Existing initialization runners require empty tables; integrity --check performs DDL/locks; 003 rejects nonempty returns | Reviewed populated-target runner, exact history/preconditions, approved mapping if needed, backup/restore/lock rehearsal, artifact checksums and separate migration approval. Do not use the UAT runner against a business DB. |
| B04 | **Fiscal receipt/printing and statutory/accounting procedures unvalidated** | Owner/accountant/pharmacist acceptance of invoice rules and operational procedure; actual device/form verification where required. Current confirmation modal is not fiscal certification. |
| B05 | **No actual owner/pharmacist UAT, qualification onboarding or independent-staffing signoff** | Named authorized reviewers and clinical disposition/quarantine SOP; verify sufficient distinct management roles. No-self-approval can prevent Admin-originated decisions with only one management account. Do not create accounts/authorizations implicitly. |
| B06 | **Host/operational readiness unverified**: no approved deployed HTTPS/proxy topology, container build, backup/restore evidence, monitoring or account-recovery plan | Operational owner, Node 24+, single API process, least privilege, recovery/backup drill, planned cutover and rollback; later separately authorized host smoke. |
| B07 | **Client-required coverage not complete**: notification preferences, full within-category best/slow product view and some original/UI fields remain partial | Implement or obtain explicit scoped acceptance/deferral; partial features cannot be declared complete from green tests. |
| B08 | **Release artifact and traceability approval absent**: extensive uncommitted work, no fresh hosted CI; full Feasibility Report unavailable | Review exact future release tree/checksums; obtain missing source or record accepted traceability limitation, peer/owner approval and authorized commit/CI/release steps. No push/tag performed here. |
| B09 | **Role interpretation needs acceptance**: Employee adjustment request exists despite SRF inventory-adjustment exclusion | Owner accepts request-vs-posting separation, or authorizes restricting request routes/UI. Existing review/posting boundary remains enforced; no security change made in QA. |
| B10 | **Receiving expiry-policy mismatch**: WF says expired stock cannot be received; safe validator-only probe accepts a valid past date and receiving posting has no expiry cutoff | Resolve reject vs quarantine/record-only supplier receipt and implementation/acceptance before real operating use. Probe used no DB access. POS/restock expired/today exclusions remain tested; do not infer supplier receiving policy from them. |

## Noncritical gaps / scoped limitations


- Friendly adjustment product/batch picker and increase/decrease selector absent; current original batch-ID/signed integer form needs usability acceptance.
- Supplier contact-person/email/status, account last-active/edit-role fields, PO expected-delivery/notes and received/partial delivery linkage are not supported by current schema/approved lifecycle. Core record/receiving operations work.
- Full physical return receipt only; partial-receipt history and real storage/disposition suitability procedure require explicit operating decisions.
- Transaction reporting lacks wireframe receipt-search/item-count/discount columns. Current regular-cash reports/exports work, but current categories/regular product names/costs are not immutable historical classification/cost snapshots.
- Notification preferences unavailable; read-only alert center is implemented. Optional SMS/email, images, scanner/noncash payments, critical-stock formula and CSV are not implied release requirements under latest decisions.
- F2/F8 shortcuts, print layout, full cross-browser/accessibility/performance acceptance not delivered by this QA.
- No refunds/credits/exchange revenue reversal; accepted-return quantities are separate from cash history. Future financial settlement needs independent scope/design.
- No measured achievement of SRF peso/time-saving targets or clinical/legal certification.
- Older audit/deployment documents retain historical statements. Their new notices point to this dated report; do not reuse old empty-account or skipped-browser claims as current facts.

## Migration and flag compatibility

| Schema/flag condition | Verified behavior / constraint |
|---|---|
| Baseline 001/002/004, workflow flags false/absent | Existing regular core modules/reports/exports work. Capabilities false and controlled unavailable response; UI hides gated actions. |
| Flags true but missing/stale workflow objects/functions | Returns controlled 503 WORKFLOWS_UNAVAILABLE; no unsafe workflow write or raw DB error. |
| Disposable 001/002/004/003/007/008 + local child workflow flag true | Adjustment/return/disposition paths pass; restock still needs separate flag and valid professional authorization. |
| 009 installed, no verified policy/signoffs | No discounted checkout route; availability stays false. Unknown eligibility/tax fails closed in preparation tests. |
| Docker artifact as presently defined | Omits canonical 007/008 compatibility files; flags alone cannot make protected workflows available. B02 must be resolved before packaged activation. |

Local shared .env contains no workflow/restock flag entries; source defaults are disabled. Deploy template also does not enable them. Remote environment was not inspected or modified; the owner-supplied production-disabled baseline remains the release assumption, not a new remote verification.

## Exact Batch 6 changes

Compared by SHA-256 with the start-of-batch worktree snapshot:

- docs/phase4/FINAL_REQUIREMENTS_MATRIX.md — new source/decision/status and nine-reference traceability.
- docs/phase4/BATCH6_QA_RESULTS.md — this report, actual evidence, risks and blockers.
- docs/phase4/RELEASE_CHECKLIST.md — new gated backup/migration/cutover/rollback checklist.
- docs/phase4/UAT_CHECKLIST.md — current report/export/audit/session checks, policy decisions and unsigned acceptance records.
- docs/PHASE4_READINESS_AUDIT.md — dated pointer superseding historical status.
- docs/DEPLOYMENT.md — dated gates/packaging notice; original instructions retained as history.
- docs/BUG_LOG.md — current issue/register pointer.
- docs/phase4/WIREFRAME_ALIGNMENT.md — current nine-image findings pointer.
- server/testing/batch4-browser.mjs — two additional actual audit/account and stale-session QA groups; no application behavior change.
- server/testing/verify-uat.mjs — verifies 15-group artifacts while retaining prior 11/13-group evidence compatibility.

No application source, dependencies, original diagrams/SQL, migration, credential, production configuration or existing business data changed. No existing file was deleted. No commit, push, deployment or production connection occurred.

