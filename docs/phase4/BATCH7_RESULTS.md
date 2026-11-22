# Batch 7 — final safe gaps, packaging and local UAT preparation

Date: 2026-11-21 Asia/Manila. **Production Neon was never connected or modified.**
Existing Batch 1–6 work and all original/applied migration bytes were preserved.
No production flag, account, data, credential, migration, commit, push or deployment.

## A. Completed gap corrections

- Docker runtime now includes exact canonical workflow compatibility files 007/008
  at the paths schemaReady reads. Narrow .dockerignore exceptions admit only
  those resources; no initialization/migration runner or credentials are copied.
- Within-category **best-selling** and **slow-moving** product rankings, exact
  category/date filters, dense ties and consistent XLSX/PDF exports implemented.
- Admin Notifications page controls optional low-stock/upcoming-expiry dashboard
  reminders for that account/browser only. Clearly labeled limits, persistence,
  corrupt-data defaults, storage errors and role restrictions are tested.
- Searchable adjustment batch picker shows actual original product/batch/expiry/
  recorded quantity and selects the existing batch ID. Signed quantity/reason and
  independent posting authority remain unchanged; no delivery-as-adjustment path.
- Products, Alerts and low-stock reports distinguish recorded stock, within-date
  (expiry-only) stock and expired/today quantities. Unknowns are not guessed.
- Explicit local --review option holds API/UI after automated UAT, then stops on
  Enter/Ctrl+C. Default automated runs still stop. New step-by-step
  [owner/pharmacist walkthrough](BATCH7_UAT_WALKTHROUGH.md) remains unsigned.
- [Traceability matrix](FINAL_REQUIREMENTS_MATRIX.md), release gates/manual and
  operational-rule documents updated without erasing prior historical evidence.

## B. Docker/container packaging verification

**Docker executable unavailable. No Linux image was built or run. Actual
container runtime verification is BLOCKED**, not passed.

The Dockerfile copies only:
server/database/migrations/proposed/batch1/007_decision_workflows.sql and
008_return_dispositions.sql into the runtime's matching database path.
The original src copy includes Noto Sans/OFL for PDFs. Runtime startup remains the
existing server command; copying SQL does not apply it.

Static validation checks the explicit COPY paths, required parent-directory
re-inclusions, exact canonical bytes, font/license and absence of runner/private
files in the copied runtime root. The ordered exception approach follows
[Docker's documented build-context exclusions](https://docs.docker.com/build/concepts/context/#dockerignore-files).

Beyond file existence, tests create an owned temporary copy of the runtime source,
package metadata and canonical resources, then **execute the copied workflow
repository code against actual isolated PostgreSQL catalogs/functions**:

- Complete migrated schema + matching copied canonical functions: ready=true.
- Missing copied canonical file: ready=false.
- Altered copied function body: ready=false.
- Absent schema: ready=false.
- Temporary copy is removed only after path verification; original resources and
  retained PostgreSQL/UAT evidence are untouched.

This is host-Node execution of the copied compatibility component, not execution
of the entire Linux image, native image dependencies or container networking.
The packaging omission is corrected and locally verified, while full container
acceptance remains a release gate. Future container QA must use a separately
verified isolated target/certificate/network; never use Neon, disable TLS, or
assume host 127.0.0.1 refers to the host from inside a normal container.

## C. Reports and notifications

### Within-category ranking

The original completed/reconciled regular-cash cohort is unchanged: one valid
cash payment, matching positive sale items, finite monetary values and cashier
POS audit. Historical approved_by is optional review metadata. Pending/rejected/
approved returns do not erase paid sales or invent financial reversals.

Product units are aggregated from qualifying sold batch lines, then ranked
**within current product category**:
- Best-selling: descending units, positive-unit products only.
- Slow-moving: ascending units, includes zero-sale catalog products and the
  existing explicit max_units cutoff (default 0).
- Equal units share a dense rank; product name/ID deterministically order ties.
- Category filter matches the exact current label; absent category remains NULL/
  unclassified rather than inventing a pharmacy category.
- Ranks are unit-based, not a turnover, aging, margin or clinical classification.
  Categories are current metadata, not sale-time immutable category snapshots.

Admin-only GET /api/reports/best-selling uses the existing detail-range validation.
The slow-moving endpoint adds category_rank and exact category filtering. Exports
reuse the same queries and filter validation. Manager/Employee permissions remain
unchanged; unsupported category filters on other detail reports are rejected.

**Eleven report types × XLSX/PDF** are verified. Exact monetary strings, formula
escaping, beneficiary/free-text omission, 10k cap and server-side filters remain.
Tests exercise cross-category ranks, ties, NULL category, zero-sale products,
empty/exact filters, independent RBAC and actual generated workbook values.
Browser downloads of both category-ranked formats reconcile to the original
PHP 224.00 sale.

### Supported preference scope

Only active Admin UI navigation exposes /notifications. Preferences store version
and two booleans in browser localStorage, scoped by Admin user ID; no customer
identity, token or password is stored. Other roles do not inherit the Admin
preference. This is a display preference, not server authority.

Turning off an optional dashboard reminder **does not hide safety Alerts**, change
the three-month window, stock/reorder math, permissions, approvals, reports or
checkout safeguards. A browser test disables a reminder, reloads, waits for actual
dashboard data, verifies suppression, then verifies the real upcoming-expiry batch
remains visible in Alerts. Preferences are restored after the check.

No SMS/email/push, scheduler, daily digest, approval notification, read/dismiss
tracking or global pharmacy setting was invented.

New **010_in_app_notification_preferences.sql is PROPOSAL ONLY**. It defines
possible durable per-Admin booleans, revision, actor/time/FKs and active-owner/
revision guards. Future API must bind self, validate CSRF/current role, lock role
changes, compare revision and update/audit atomically. Ownership/global scope and
remaining reminder types need review. No route uses the proposed table. **No
migration was applied to production or local UAT for 010**; final read-only check
confirms the table is absent. Existing migration runners/allowlists are unchanged.

## D. Inventory business-rule alignment

See [BATCH7_OPERATIONAL_RULES.md](BATCH7_OPERATIONAL_RULES.md).

Proposed operational policy: Employee may initiate a batch discrepancy request,
but never approve or directly post stock. A **different active Manager/Admin**
reviews; no-self-approval, terminal states, exactly-once posting and atomic
stock/audit remain enforced. This documents the existing accepted local flow,
not a permission expansion. Original SRF's broad Employee adjustment exclusion
still needs explicit owner acceptance of the request-versus-posting distinction.
PO/Stock-In retain their existing separately preserved approval permissions.

Compatible receiving behavior records physical deliveries through Stock-In.
Expired/expiring-today stock remains **excluded from POS/sellable allocation**,
while recorded quantities remain honest until an approved physical correction.
No fake supplier-quarantine record or automatic return-to-stock was introduced.

New read-only within_date_qty excludes expiry on/before Manila today and returns
unknown if quantity/positive-stock expiry is uncertain. expired_or_today_qty is
separate. Existing qty_on_hand and low-stock/reorder comparisons still include all
recorded batches; no new critical formula. Within-date is labeled **expiry only**,
not professional suitability or comprehensive saleability approval.

Final synthetic evidence: product recorded quantity **68**, within-date **62**,
expired/today **6**. Unknown expiry keeps within-date unavailable. POS/restock
expiry exclusion remains tested. The wireframe's rejection-of-expired-delivery
wording is reconciled to the latest compatible recording/separation direction;
actual receiving/physical segregation/disposition SOP remains pending owner/
pharmacist acceptance. No supplier quarantine lifecycle is claimed.

## E. Exact tests and browser results

Runtime: **Node 24.22.3**, declared >=24 satisfied. Shell default Node 22 is not
the supported QA/release runtime.

| Check | Final result |
|---|---|
| Frontend Vitest | **120 passed**, 16 files, 0 failed/skipped |
| Backend full Node runner | **183 reported entries passed**, 0 failed/skipped, 25.79 s |
| Local PostgreSQL integration/concurrency | Passed inside full backend; no DB suite skipped |
| Copied-package compatibility | Actual local catalog/function match passes; missing/stale resources fail closed |
| ESLint | Passed |
| Production Vite build | Passed, 72 modules; in-memory write:false, existing dist preserved |
| Chrome 157.0.8103.79 | **17 groups passed**, 1440×1000, **38 screenshots** |
| Browser error/external request counts | 0 runtime errors, 0 unexpected API failures, 0 external page requests |
| Local review mode | Held local servers, /api/health returned 200, Enter stopped them; subsequent connection refused |
| Final independent read-only UAT evidence | Passed TLS/attestation, seven migration checksums, unchanged public baseline, cash and once-only restock |
| Proposed 010 | Table absent in final UAT; not applied |
| Server/client production dependency advisories | Both 0; no dependency changes |
| Limited source-secret scan | 109 nonignored non-test JS/JSX/JSON/YAML files; no literal Neon URL/private-key header found |
| Credential file exclusion | Academic credential file remains ignored; values not read/printed |
| git diff --check | Passed |

The 183 count includes Node parent/subtest/support-file entries, not 183 browser
journeys. Source scanning/advisory checks are limited evidence, not penetration
testing or compliance certification.

The first frontend run had one obsolete assertion that Notifications must remain
unavailable; updated to assert the new Admin-only link. An initial ranking fixture
reused existing batch ID 3; fixed to unused synthetic IDs and rerun. Neither issue
was a production mutation or a reason to relax business/security checks.

The 17 Chrome groups retain all 15 prior journeys (authentication/roles, POS/FEFO,
adjustment approvals/rejection, returns/quarantine/professional restock,
PO/Stock-In, alerts/thresholds, reports/exports, global audit/accounts and
stale-cookie/re-login) plus category ranking/expiry-stock and preference/safety
checks. The first adjustment now actually uses the searchable batch picker.

**Unverified/blocked:** actual Docker/Linux runtime/networking, host HTTPS/proxy,
backup/restore rehearsal, real owner/pharmacist UAT, real qualification onboarding,
statutory posting/invoices, printer/scanner, other browsers, full accessibility and
load testing. No successful human business acceptance is inferred from automation.

### Isolation and retained evidence

PostgreSQL **17.12**, **127.0.0.1:58446**, verified **TLS 1.3** certificate/IP,
dedicated unprivileged login and external database attestation. Wrong certificate,
hostname or token is refused. Production fallback stays impossible in test
harnesses. Local workflow flags true only in isolated UAT child processes.

Final UAT schema/run:
tgp_uat_a7e4f1f0260148309466fc4d0fcd3e12

Retained root:
C:/Users/spori/AppData/Local/Temp/tgp-pg-1795265396785

Safe artifacts in final run: review.html, browser-results.json, verification.json,
screenshots/, downloads/tgp-sales.xlsx|pdf and downloads/tgp-best-selling.xlsx|pdf.
Full backend transcript: root last-test-run.log.

Installed only inside disposable UAT:
**001 → 002 → 004 → 003 → 007 → 008 → 009**.
Public 001/002/004 baseline and zero business rows remain unchanged. Original cash
payment remains 224.00/300.00/76.00 with approved_by NULL. One approved physically
received unit, one rejected unreceived return and original-batch once-only restock
are independently verified. Final batch balances 301=4, 302=54, 303=3, 304=3, 305=4.

Do not share private manifests, TLS private keys or entire unfiltered temporary
folders. Certificate expires **2026-11-28 20:55:04 Asia/Manila**; revalidate a valid
test certificate before later use. Temporary PostgreSQL/data/evidence retained.
Review app servers were stopped after smoke testing; no permanent service added.

## F. Exact changed files

SHA-256 comparison against the start-of-Batch-7 snapshot; prior changes preserved,
no prior file deleted. 44 files:

- `.dockerignore`
- `Dockerfile`
- `client/src/App.jsx`
- `client/src/components/Workspace.jsx`
- `client/src/components/layout.test.jsx`
- `client/src/inventory/shared.jsx`
- `client/src/notifications/preferences.js`
- `client/src/notifications/preferences.test.jsx`
- `client/src/pages/Alerts.jsx`
- `client/src/pages/ControlledWorkflows.jsx`
- `client/src/pages/Notifications.jsx`
- `client/src/pages/Products.jsx`
- `client/src/pages/Purchasing.jsx`
- `client/src/reports/DashboardSummary.jsx`
- `client/src/reports/ReportPanel.jsx`
- `client/src/reports/reports.test.jsx`
- `client/src/workflows/BatchPicker.jsx`
- `client/src/workflows/workflows.test.jsx`
- `docs/BUG_LOG.md`
- `docs/DEPLOYMENT.md`
- `docs/PHASE4_READINESS_AUDIT.md`
- `docs/USER_MANUAL.md`
- `docs/phase4/BATCH7_OPERATIONAL_RULES.md`
- `docs/phase4/BATCH7_RESULTS.md`
- `docs/phase4/BATCH7_UAT_WALKTHROUGH.md`
- `docs/phase4/FINAL_REQUIREMENTS_MATRIX.md`
- `docs/phase4/RELEASE_CHECKLIST.md`
- `docs/phase4/UAT_CHECKLIST.md`
- `docs/phase4/WIREFRAME_ALIGNMENT.md`
- `server/REPORTS.md`
- `server/database/migrations/proposed/batch7/010_in_app_notification_preferences.sql`
- `server/src/repositories/inventory.repository.js`
- `server/src/repositories/reports.repository.js`
- `server/src/routes/reports.routes.js`
- `server/src/services/report-exports.js`
- `server/src/services/report-validation.js`
- `server/test/container-packaging.test.js`
- `server/test/inventory.integration.test.js`
- `server/test/reports.integration.test.js`
- `server/test/support/packaged-workflow-fixture.js`
- `server/test/workflow-migrations.integration.test.js`
- `server/testing/batch4-browser.mjs`
- `server/testing/batch4-uat.mjs`
- `server/testing/verify-uat.mjs`

Only new migration proposal 010 was added. Original 001/002/004 and existing
003/007/008/009 bytes were not changed. No dependency/lockfile, credential or
production environment file changed.

## G. Remaining critical blockers and release gates

1. **Senior/PWD full posting and fiscal invoice remain unavailable.** Verified
   branch tax/price basis, independent tax/medicine evidence, documentary/privacy
   procedure, actual invoice format and accounting signoff are still required.
   Complete gated signed posting/recovery/per-batch cent allocation and explicit
   discounted report/return qualification before activation. No flag-only shortcut.
2. **Actual container/host verification blocked.** Docker is unavailable. Build and
   run a reviewed image later against a separately verified isolated target, never
   production; check native dependencies, TLS/network identity and required
   resources in that actual environment.
3. **Production migration/backup/restore/cutover remains unapproved.** Old
   initialization --check performs DDL/locks and is unsuitable for populated
   rollout. 003 needs empty returns or authoritative approved mapping. Preserve
   original history; review populated-target runner, backup/restore rehearsal,
   preconditions and rollback-compatible readers before any business migration.
4. **Actual owner/pharmacist UAT and operating decisions remain pending.** Obtain
   independent reviewer staffing, qualification verification/onboarding, clinical
   storage/segregation/disposition SOP and Employee request-only policy acceptance.
5. **Durable/full notification settings remain partial.** Only two clearly labeled
   per-browser display preferences are implemented; proposal 010 is not approved
   execution or a global preference service.
6. Other retained scope gaps: supplier/account/product reference fields, linked
   PO received/partial-delivery lifecycle, partial physical return receipt,
   account-recovery/admin succession, host monitoring/backup ownership,
   accessibility/load/printer validation and missing full Feasibility Report.
   Do not silently waive them; record owner scope decisions.

The [release checklist](RELEASE_CHECKLIST.md) retains feature-off migration,
separate activation, exact artifacts/checksums, single-process/HTTPS secret
handling and restore gates. Routine rollback disables new writers while
preserving additive schema/history; after real records exist, use compatible
readers/forward fixes, never drop snapshots/decision/quarantine/audit links or
purge closed POS request events.

**Ready for guarded local owner/pharmacist review, not full live-pharmacy release.**

## H. Production safety confirmation

No production Neon connection, mutation, migration, synthetic/real-customer data
entry, account creation or privilege change occurred. Production workflow flags
and credentials were not changed or remotely inspected. Senior/PWD availability
stays false; no fiscal functionality was enabled. No commit, push or deployment.

