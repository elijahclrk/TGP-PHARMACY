# Batch 11 — consolidated audit and proposed local checkpoint

Date: **22 November 2026, Asia/Manila**. This is an audit/checkpoint proposal. **No staging, commit, push, production access, migration or deployment was performed.** Actual owner, pharmacist and accountant acceptance remains pending.

## A. Readiness verdict

**GO for owner review of the proposed local Git checkpoint and guarded synthetic UAT. NO-GO for full client-required pharmacy release.** Core regular cash POS, FEFO, purchasing/inventory, protected adjustments/returns/dispositions, approvals, alerts, thresholds, reports/exports and local-only Senior/PWD checkout passed fresh automated validation.

The required **product exchange** is missing. Production Senior/PWD integration, real evidence/SOP/privacy approval and registered fiscal invoicing are not delivered by a synthetic test policy. Real host/container/HTTPS, populated production migration, backup/restore and signed pharmacy acceptance remain release gates. Local technical success does not establish legal compliance or clinical suitability.

No feature implementation or business rule was changed in Batch 11. Changes are documentation, offline checkpoint review tooling and narrower artifact exclusions. Batches 1–10 application/test/migration work is preserved.

## B. Requirements and source reconciliation

The [current traceability matrix](FINAL_REQUIREMENTS_MATRIX.md) now contains **63** requirements:

| Primary classification | Count | Meaning |
| --- | ---: | --- |
| TESTED | 36 | Implemented behavior passed scoped local automation; not deployed or accepted |
| PARTIAL | 12 | Requirement has missing portions or operational scope decisions |
| BLOCKED | 5 | Named external/technical approval or dependency prevents delivery/activation |
| MISSING | 1 | Required product exchange has no implemented fulfillment workflow |
| OUT OF SCOPE | 9 | Explicitly excluded, optional/deferred or superseded |

These counts describe requirement rows, not a completion percentage. An otherwise TESTED workflow may still be blocked for production by migration/operating gates.

Original available sources reviewed: System Request Form requirements on pages 2–4 (personal/contact information not republished), Phase 2 use-case/DFD/ERD, Phase 3 original SQL/ERD/architecture/deployment/pipeline/low-fidelity diagram, all nine clickable references, Phase 4 audits/manual/deployment/release/UAT guidance and Batch 1–10 evidence. The full Feasibility Report and additional textual use-case narratives are still absent from available repository documentation. The supplied §2.1 single-web-app decision is a **CONFIRMED CLIENT DECISION**, not a claim that the missing report was independently read. Original source artifacts and historical batch reports were preserved.

Latest decisions prevail over older artifacts: one role-based web app rather than two native applications; desktop English UI; cash-only; no required product images; three Manila calendar months; per-product explicit reorder levels; no routine cash/valid-benefit-sale approval; new adjustment/return independent Manager/Admin review; separate pharmacist qualification; no automatic refund/restock; and XLSX/PDF rather than the wireframe CSV. Original `sales.approved_by` remains historical metadata. The original automatic approved-return restock comment is superseded. Employee adjustment **request-only** access is locally implemented; owner operational acceptance of its difference from the SRF exclusion remains pending.

### Senior/PWD against Batch 9

| Specification/research area | Current verified local implementation | Remaining limitation |
| --- | --- | --- |
| Separate scheme/identity/documents | Name/ID, scheme-specific document types/attestations, Senior no-booklet versus PWD test booklet, representative/guardian fields | Operator attestations are not external entitlement authentication; branch B01–B16 and source-closure items remain pending |
| Eligibility and independent tax | Effective immutable local per-scheme product versions, reviewed source/version, explicit price basis; unknown/expired/inactive evidence unavailable | Actual SKU matching, source digests, clinical/tax dual-review publication and Admin management UI absent; no real medicines classified |
| Mixed VAT-inclusive/already-exempt/non-VAT | Explicit synthetic policy, BigInt cents, logical product calculation and deterministic FEFO allocation | Rounding/promotional alternatives need accounting approval; promotion comparison is unavailable, fractional base units rejected |
| Quote, cash, FEFO and recovery | Actor/mode-signed expiring quote, explicit review, atomic stock/items/payment/audit, request digest, authoritative closure/replay | Production provider/gate and operational key lifecycle/restart/cutover need their own reviewed integration; no environment flag activates this test implementation |
| Prescription dispensing | Current explicit pharmacist authorization and capped local cumulative fills, including competing requests | Qualified cashier only in this test contract; complete prescribing details, OTC duration limits, physical endorsements, full special register and cross-pharmacy evidence are not automated |
| Immutable history | 009 preserved; 011 adds local policies/evidence/verifications/logical lines and complete version2 monetary snapshots | 011 deliberately requires test-only policies; future production successor/provider and privacy controls require review |
| Receipts and reporting | Historical item/header discount/VAT/net/cash snapshots; paid supported version2 sales recognized immediately; exports omit beneficiary identity | UUID transaction confirmation is not a registered fiscal invoice; invoice series/void/reprint/printing and privileged statutory register are absent; discounted profit/deductible share unresolved |
| Proposed API/presentation details | Local `/pos/benefits/verify` and `/pos/benefits/quote` implement the proposed verification/quote concepts; canonical schema checks fail closed | Names differ from the proposed aliases. Availability is aggregate, not per scheme; unavailable errors lack per-product reason diagnostics. Workflow capabilities still advertise `senior_pwd_enabled:false`; local POS uses its dedicated availability endpoint. These contracts need consolidation before production |

The quote UI presents eligibility/basis and monetary discount/VAT breakdown, but does not expose the full proposed evidence/reason/rate/discount-base review panel. The long synthetic documentary form puts the cart below the first desktop viewport. These are explicit specification/UX follow-ups, not reasons to invent legal approval or silently enable production. No new legal-currentness research or branch facts were asserted in this audit; the Batch 9 source register and unresolved official-text/effectivity/SKU questions remain the research boundary.

### Nine clickable references

All nine were visually rechecked: Access, OVERVIEW, OPERATIONS, INVENTORY, MANAGEMENT, ADMINISTRATION, cards, Dialogs and the combined TGP Clickable Wireframe. Actual current synthetic POS review/receipt screenshots were also inspected; fresh Chrome covered the other screens.

The branding/sidebar/cards/tables/search/dialog direction is retained qualitatively. Remaining differences: account-assigned roles instead of a role selector granting access; compact wireframe POS versus explicit quote/documentary/recovery controls; product and batch views separated; inline forms/details instead of every modal; missing F2/F8/scanner/payment alternatives; no registered invoice/print layout; missing supplier contact-person/email/status, structured dosage/strength, PO notes/expected/received/partial linkage, account editing/last-active, live discount-rule publication and durable notification/reminder controls. No critical-stock formula, fake trend comparison, sample identity, 90-day approximation or routine-sale approval queue was copied. This is not pixel-perfect or owner visual acceptance.

## C. Fresh complete validation

All counts below are from **this Batch 11**, with application/test source unchanged during the audit. Earlier batch totals are historical only.

| Validation | Result | Scope |
| --- | --- | --- |
| Frontend Vitest | **122 passed, 0 failed, 0 skipped; 17 files**, 18.16 s | Complete suite |
| Backend Node runner | **209 reported entries passed, 0 failed, 0 skipped, 0 cancelled**, 44.224 s | Complete suite; all AUTH/INVENTORY/PURCHASING/POS/REPORTS/IMAGE/WORKFLOW DB opt-ins enabled |
| Existing Chrome run | **17 journey groups passed, 0 failed**, 38 screenshots | Regular cash/FEFO/recovery, purchasing, adjustments, independent reviews, returns/quarantine/disposition, approvals, alerts/thresholds, reports/exports, accounts/audit, stale sessions and preferences |
| Local-benefit Chrome run | **9 journey groups passed, 0 failed**, 8 screenshots | Senior/PWD, mixed basket, documentary failures, unknown metadata, stale-price closure, changed-request/wrong-cashier conflict, lost acknowledgement, historical receipt, exports, discounted returns and CSRF/RBAC |
| Frontend lint | **Passed**, no findings | ESLint |
| Production build | **Passed** in both browser launchers; 74 modules | Vite 8.3.8, verified production React; current JS 400.18 kB / 117.90 kB gzip, CSS 33.55 kB; output confined to new disposable run directories |
| Isolation/schema compatibility | **Passed** | TLS/attestation/negative guards, original baseline checksums, fresh proposal ledgers, missing/stale/disabled schema checks and migration/concurrency suites |

Node **24.22.3** was used explicitly; shell-default 22.23.4 is unsupported for this project. Chrome **157.0.8103.79**, desktop 1440×1000, Asia/Manila. Both browser evidence files contain zero runtime errors and zero external page requests. The 17 + 9 groups are two fresh runs totaling 26 groups, not 26 independent tests added to the Node/Vitest counts. Parent/support-file entries are included in Node's 209. Old targeted 19-test benefit results are not added again.

Fresh local evidence root: `C:\Users\spori\AppData\Local\Temp\tgp-pg-1795265396785`:

- Backend: `batch11-full-backend.log` (copy of this run's `last-test-run.log`).
- Existing browser: `tgp_uat_b4118cd0247c471aa86a34485a942611/browser-results.json`.
- Benefit browser: `tgp_uat_7ada62c1f34142ac88045f65b3f85a62/browser-results.json`.
- Each run retains screenshots, compiled frontend and generated XLSX/PDF evidence. Private manifests/credentials remain private and excluded.
- Two ignored review copies exist under repository `tmp/`; they are synthetic screenshot artifacts, not checkpoint files.

Synthetic baseline cash was 224.00. The separate benefit run posted 352.00 + 80.00 + 0.02 = **432.02**, with historical transaction discount total **80.01**; browser-downloaded XLSX/PDF were parsed and reconciled. These separate schemas are not aggregated into one business dataset. Accepted returns do not create refunds/revenue reversals. The stale-price scenario intentionally leaves the exempt fixture catalog price at 101.00; the UAT walkthrough uses current prices rather than pretending every fresh review still sees the original 100.00.

Not performed: real-pharmacy UAT/training, production HTTPS/proxy/cookies, actual Linux Docker runtime, real invoice/printer acceptance, external identity/provider integration, load/soak, cross-browser/mobile or operational backup/restore. These are unverified or blocked, not skipped assertions hidden inside the green counts.

## D. Remaining functional gaps and implementation order

1. **Required exchange (R63 — MISSING):** approve accounting/eligibility contract, then implement additive original-sale/item/batch → accepted-return → exchange → replacement item/batch linkage, capped once-only consumption, independent review, replacement FEFO, explicit settlement and reconciled reports. Returned medicine remains quarantined for a separate disposition. No cash refund. Equal/higher/lower value, additional cash, residual value, timing/reasons and replacement benefit/tax treatment are **UNSPECIFIED**; do not fabricate them or record an unrelated fully paid sale to simulate an exchange. No exchange code/migration was created in Batch 11.
2. **Production statutory/fiscal delivery (R32/R31/R60):** obtain branch evidence/approvals, implement reviewed publication/provider, detailed diagnostics/review UI, protected statutory records/privacy and registered invoice process, then rehearse production-compatible successors/readers. Local calculator/posting is tested but is not a live policy engine or fiscal invoicing solution.
3. **Operating SOP/professional authorization (R42/R56):** qualified onboarding/revocation, sufficient independent reviewers, quarantine/disposition/storage assessment, expired supplier-receiving policy, full physical receipt versus partial receipt, training and signed UAT.
4. **Production operations/migrations (R52–R55):** reviewed populated-target runner, actual backup/restore rehearsal, Docker/native/runtime/HTTPS/proxy verification, least privilege, single-process session limits, monitoring and recovery ownership. Never bulk-run proposals.
5. **Partial supported-scope decisions:** account recovery/edit/reactivation/succession (R07); durable preferences/scheduling (R17); supplier extra fields (R20); PO-to-receiving/partial delivery/notes (R22); general customer/prescription profile and records (R35); partial physical return receipt (R40); structured product strength/dosage (R61); receipt-search/item-count presentation and basic estimate definitions. Implement only after explicit scope, or record owner acceptance of the reduced contract.
6. **Traceability/pilot (R54/R57):** missing full Feasibility Report, reviewed/approved checkpoint and later CI, operational handoff and measured performance/loss/time-saving evidence. Do not report expected business benefits as achieved.

Out-of-scope rows remain R02/R16/R18/R26/R28/R36/R43/R58/R59: separate native apps, invented critical formula, external messaging, scanner dependency, noncash gateway, routine sales approval, prohibited automatic cash refunds, required images and enterprise/full-accounting/other excluded capabilities. Product exchange is expressly not on this exclusion list.

## E. Security and secret-scan findings

Reviewed current auth/session/role/CSRF paths, strict inputs, transaction/advisory/row locks, immutable snapshots, return/disposition protections, error responses and export allowlists, supported by the fresh regression/real-browser results. Argon2id, current active-role checks, HttpOnly/Strict/Secure-production cookies, signed expiring allowlisted JWT sessions, logout/deactivation revocation and trusted-origin mutation markers remain. Sessions/login limits are process-local; restart invalidates sessions and true multi-instance operation is not established. A gate or role title never confers pharmacist qualification.

An offline redacted scanner reviewed **263 tracked/nonignored text files**, including **158 text files in the 159-path checkpoint**, plus the explicitly reviewed font binary. It inventories paths, reviews patterns for provider/JWT/private-key literals, database URLs, quoted credentials, email/contact patterns and forbidden artifact paths, and hashes intended content. It never loads `.env`, stages files, connects to a DB or prints matched values. **No confirmed live credential, actual beneficiary identifier or unexplained candidate was found.** This is a pattern/manual review, not certification that all Git history or opaque unchanged binaries are free of secrets; no external scanner/service or upload was used. The final scan retained three manual-review patterns (resolved in the table below), expected fixture/placeholder matches and checksum-digit matches; no forbidden path or high-signal live secret was detected.

Flagged lines manually resolved without disclosing values:

| Location/rule | Resolution |
| --- | --- |
| `.github/workflows/ci.yml:46`, credential pattern; unchanged tracked file | CI generates a random secret at runtime; the scanner matched code syntax, not a stored credential |
| `server/database/apply-integrity.mjs:6` and `server/demo/database.mjs:6`, phone pattern; unchanged tracked files | Applied migration SHA-256 constants, not phone numbers; neither script was executed |
| `server/package-lock.json:2283`, email pattern | Public `node_modules/glob` deprecation/support metadata with normal registry integrity, not pharmacy/patient/account contact data |
| `server/test/prepared-workflows.integration.test.js:156`, credential literal | Deliberate isolated HTTP fixture signing key; not a production/academic account credential; test source excluded from runtime packaging |
| New `server/src/assets/fonts/NotoSans.ttf` binary | Known bundled PDF font, 2,049,096 bytes, source provenance README and SIL OFL included; ordinary generated PDF test passes. Retained as a reviewed asset, not silently skipped as an unexplained dump |

Expected explicit fixture recipes remain in test/demo source; generated synthetic account/beneficiary rows, credentials, private manifests, screenshots, downloads and PG data remain outside the checkpoint. The original personal System Request Form is ignored/local-only. Existing unchanged reference binaries are not new checkpoint content or an OCR scan of repository history.

`.gitignore` now additionally excludes disposable cluster/UAT directories, private manifests, certificate artifacts and browser test outputs. Git ignore probes confirmed server environment/academic accounts, original personal form, temp outputs, keys/certificates and private manifests are excluded; no such path is tracked. Separate local environment inspection emitted only safe booleans: database/JWT configured, workflow/restock flags unset (**off**), no discount-related flag present, no connection attempted. No values or academic credentials were displayed; academic environment contents were not opened. Secrets, source dependencies and production flags were not changed.

## F. Safe local Git checkpoint proposal

Branch **main**, HEAD **43b321101d04775ee27394e21773b279b45856b4**. Cached `origin/main` matches (0 ahead/0 behind); no fetch or remote synchronization claim was made. The index is empty. Initial accumulated work comprised **153** modified/untracked files; all legitimate prior changes remain.

The exact proposed cumulative contents are **159 paths: 59 modified tracked files and 100 new/untracked files**, listed in [BATCH11_CHECKPOINT_FILES.md](BATCH11_CHECKPOINT_FILES.md) and the machine-readable [manifest](BATCH11_CHECKPOINT_MANIFEST.json). They include Batches 1–10 application/UI/services/tests, guarded local harnesses, reviewed additive proposals, export dependencies/font/license, original completion documents and this audit/ignore update. No local environment, real account, generated demo dataset, TLS material or browser/build output is included. The manifest hashes raw working-tree bytes for review; Git may normalize LF/CRLF. Its own hash is omitted to avoid a recursive self-hash. A changed file invalidates the review until refreshed.

Recommended commit subject:

```text
feat: checkpoint protected pharmacy workflows and local benefit checkout
```

Suggested body: consolidate protected inventory/returns/approvals, quote/recovery safeguards, calendar expiry/reorder alerts, reports/exports and test-only Senior/PWD snapshots; retain production gates and record unresolved exchange/fiscal/operational release requirements.

**Approval requested is for the exact local checkpoint only.** No file was staged, no commit created and no push/deploy attempted. If a new sensitive/unexplained path or changed checksum appears, stop and review it instead of using blanket staging. Approval of this checkpoint is not approval of product-exchange rules, production migration or activation.

## G. Production prerequisites and migration status

The [controlling release checklist](RELEASE_CHECKLIST.md) gives exact 003/007/008/009/010/011 statuses and preconditions. Disposable order tested: **001 → 002 → 004 → 003 → 007 → 008 → 009 → 011**. 010 remains unapplied, proposal-only and outside all current execution allowlists. Original 001/002/004 bytes match HEAD and the attested local baseline ledger; original Phase 3 SQL equals 001. Earlier proposal header comments saying “design only/not in any runner” are historical: these proposals are now exercised by disposable test/UAT harnesses, never approved business migration runners. Migration bytes were not rewritten to update those comments.

003 refuses existing unlinked returns; authoritative mapping/backfill needs separate approval. 007 preserves legacy/terminal adjustment history and does not revise PO/Stock-In permissions. 008 requires 003/007 and separate professional disposition. 009 requires PostgreSQL xid8 support and complete immutable financial snapshots. 011 adds local version2 evidence/financial reconciliation, retains old checks and requires **test-only** policies; a production successor/provider must be reviewed rather than removing guards. 010 durable preferences and future exchange additions need separate scope/tests. Production installation status is based on supplied project history, not a fresh live query.

Docker remains unavailable. The copied workflow runtime/canonical 007/008 compatibility tests passed within the fresh suite; that is not a Linux image run. Current container packaging intentionally does not activate/package the separate local benefit harness as a production service; 009/011 production runtime resources/provider must be designed with the future production integration.

Before live operations: approved target identity and least privilege; encrypted consistent backup/recovery point and checksum; approved RPO/RTO; demonstrated restore into a separately isolated target; reviewed legacy data preconditions, migration runner/ledger/locks and reconciliation; compatible readers before any new posting; HTTPS/proxy/Secure-cookie verification; monitoring/training/UAT; explicit migration and later go-live authorizations. No live backup, restore, target inspection or migration was performed. Gate-off/forward-fix must preserve committed snapshots, payments, audits, approvals and quarantine/posting links; destructive down migrations are not a rollback plan.

## H. Exact Batch 11 changes

1. `.gitignore` — private/disposable/generated artifact exclusions.
2. `server/testing/batch11-checkpoint.mjs` — offline redacted inventory/scan/hash helper, no Git mutation/database access.
3. `docs/phase4/FINAL_REQUIREMENTS_MATRIX.md` — current 63-row traceability, local-benefit status and required missing exchange.
4. `docs/phase4/RELEASE_CHECKLIST.md` — current gates, migration dependencies, backup/restore and production limitations.
5. `docs/phase4/UAT_CHECKLIST.md` — controlling current walkthrough/evidence link; earlier history retained.
6. `docs/phase4/BATCH11_UAT_WALKTHROUGH.md` — unsigned owner/pharmacist/accountant core/benefit walkthrough and exchange limitation.
7. `docs/phase4/BATCH11_RESULTS.md` — this consolidated report.
8. `docs/phase4/BATCH11_CHECKPOINT_FILES.md` — exact cumulative proposed path list, exclusions and approval boundary.
9. `docs/phase4/BATCH11_CHECKPOINT_MANIFEST.json` — reviewed working-tree hashes and provenance; self-hash intentionally omitted.

Ignored scan/screenshot review files under `tmp/` and disposable test/evidence schemas outside the repository are not proposed commit contents. No application behavior, dependency or original migration was changed by this audit. No Git reset/clean/restore/discard was used.

## I. Production safety

**Production Neon was never connected to or modified in Batch 11.** No production migration, account/credential or real pharmacy record change, feature activation, commit, push or deployment occurred. PostgreSQL 17.12 at **127.0.0.1:58446** passed authorized **TLS 1.3**, target identity/attestation and negative wrong-host/CA/token checks before writes; the test role is not superuser/createdb/createrole. Test children use an unusable production sentinel; browser children receive only the verified local target and synthetic owned schemas. Local app processes closed after automation; the disposable cluster, prior data and evidence were retained.

Project-owner approval of the reviewed checkpoint is the next step. All production and actual business acceptance approvals remain separate and pending.
