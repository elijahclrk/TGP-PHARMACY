# Full-feature academic cloud implementation — local verification

22 November 2026, Asia/Manila. Baseline HEAD remains
`a4eac249a9faa4eb165aba1d6abd579fd905f4f4`. No staging, commit, push,
PR merge, deployment, remote provisioning or billing operation was performed.

## Implemented

Dedicated `src/academic-server.js` parses explicit process configuration before
application imports, refuses generic database fallback, and listens only after
signed target/database/schema verification. The ordinary production entry point
and its local-service rejection are preserved. Local constructors retain their
loopback and disposable-attestation restrictions.

Ed25519 manifests bind exact allowed Neon endpoints, project attestation,
database, runtime role, public schema, demo/seed IDs, phase, migration/catalog
digests, synthetic exchange policy and validity (at most seven days). Project
ownership is independently confirmed by the future operator; SQL alone does not
prove a Neon project ID. Signing keys/operator credentials are not hosted.

The verified provider checks certificate/hostname, role, database comment,
ownership/membership/DDL/TEMP restrictions, UTC, migration checksums, canonical
functions/triggers and signed catalog/permission fingerprints. Only a successful
handshake creates a frozen opaque capability bound to that provider. Forged,
borrowed, expired and setup-only capabilities cannot serve the application.
Every application repository, including database health, uses the verified pool.

The academic factory constructs the existing benefits, exchange and operational
services and enables controlled workflows only inside the verified application.
Global production workflow flags stay false. Existing RBAC/CSRF, independent
review, pharmacist separation, quote review, financial snapshots, FEFO, atomic
posting, idempotency and recovery rules remain. Synthetic customer prefixes are
required for cloud benefits. The notice appears on login, authenticated screens,
receipts and exported reports; labels identify the cloud rather than localhost.

The runtime trusts only explicitly configured proxy CIDRs, requires HTTPS except
for liveness, retains Secure/HttpOnly/Strict cookies and existing login limits,
uses at most three database connections, and bounds concurrent API/export work.
There are no startup migrations, seed/reset/repair calls or public operator APIs.

## Operator tools and migration history

`academic/operator.mjs` provides explicit prepare/inspect/init/seed/verify actions.
Private files must be Git-ignored and are exclusively created. Preparation is
offline. Initialization refuses nonempty targets and applies unchanged files:

001 / 002 / 004 / 003 / 007 / 008 / 009 / 011 / 012 / 010 / 013.

All eleven versions and canonical runtime resources are packaged. Operator tools,
signing private keys, credentials and local test material are excluded. Protected
001/002/004 raw SHA-256 checksums match their original reviewed values.

Explicit academic grant hardening adds an owner-controlled evidence guard to
discounts/pharmacist authorization tables. PostgreSQL row locks need UPDATE
privilege; narrowly granted immutable ID columns permit locking while triggers
deny forbidden changes. Runtime cannot edit policies, grant qualifications,
create schema/TEMP tables, modify migration tracking or replace attestation.
These additive administrative guard objects are fingerprinted; no original
migration was rewritten and no business migration 014 was added.

Seeding creates distinct synthetic users and policies, then performs actual
receiving/PO fulfillment, regular/mixed Senior/PWD checkout, returns/quarantine,
supported exchanges, independent adjustments, qualified disposition and preference
operations through existing transaction services. Cash/items/audit, stock,
approved-return limits and exchange settlements reconcile before ready publication.
Setup and ready signatures are separate. Partial setup stops for review rather
than resetting/resuming blindly. Stable signing material preserves paid recovery.

## Final validation — separate runs, not an accumulated historical total

| Validation | Final result |
|---|---|
| Runtime | Node 24.22.3; disposable PostgreSQL 17.12, TLS 1.3 |
| Frontend full regression | 132 passed in 20 files; 0 failed |
| Backend full regression, permitted SQL/concurrency tests included | 253 reported entries passed; 0 failed, 0 skipped |
| Academic Chrome | 18 checks: 14 role/screen checks, regular/Senior/PWD checkout and labeled confirmations, historical receipt/Excel/PDF downloads |
| Original local-demo browser recipe in NEW owned schema | 7 operations groups + 3 demo groups passed; 13 screenshots |
| Frontend ESLint | Passed |
| Production build | Passed, 83 modules |
| Packaged canonical resources | Copied-runtime manifest/checksum tests passed |
| Git whitespace validation | Passed (Git emitted line-ending conversion advisories only) |
| Secret/sensitive-path scan | No private key/token markers or unexpected sensitive/generated paths in intended changes |
| Linux Docker build/runtime | NOT EXECUTED — Docker unavailable |
| Actual Neon/Railway HTTPS, permissions, proxy, quota behavior | NOT EXECUTED — external operations remain unauthorized |

Academic Chrome uses the real application and SQL database through a local
certificate-verified HTTPS bridge. No certificate-ignore option is used.
Cloud DNS/SAN identity is simulated in the issuer test fixture. This is not
certification of an actual Neon endpoint or browser-to-Railway ingress.

The separate real-role test created and disposed one fresh LOCAL database/role;
it exercised the actual migration runner, SQL grants, signed comment, service
recipe and forbidden mutations. No fixture database/role remained afterward.
Other integration suites use independently attested, newly owned schemas.

Intermediate failures were not counted as passes: duplicate synthetic policy
version (corrected to scheme-specific versions); missing jsdom test annotation;
early browser labeling timeout followed by a passing run after the build; restricted PostgreSQL
row-lock permissions (corrected with narrow grants/guards); existing supplier
Save accessibility locator ambiguity (now uniquely scoped to its form submit
control, with count assertion). Final runs above supersede those attempts.

Final academic browser evidence:
`C:/Users/spori/AppData/Local/Temp/tgp-academic-https-eH5dAg/browser-results.json`.
Final preserved local-recipe evidence:
`C:/Users/spori/AppData/Local/Temp/tgp-pg-1795265396785/tgp_uat_3ef404f975974e7fa3cb9e0fc21080d9/`.
These temporary folders include private certificates/manifests; do not publish
them wholesale. The backend harness retains `last-test-run.log` privately.

## Professor demo and production safety

Original frontend `http://127.0.0.1:63965/login` and API port 30144 still return
200. Read-only inspection of its original retained schema confirms 7 sales,
PHP 912.00, 51 audit rows and 6 users, matching the pre-implementation evidence.
No existing demo records, credentials or private environment files were changed.

No production Neon connection, remote migration/seed, external database creation,
Railway change, feature activation, paid service or billing change occurred.

## Remaining release gates

Local implementation is ready for review. Separate permission is required for
new isolated Neon provisioning, actual target/privilege verification and any
remote initialization/seed. Actual Docker runtime, Railway HTTPS/proxy topology,
free-tier eligibility/capacity, hosted CI startup and public credential handoff
must pass before deployment acceptance. Do not substitute an owner database
credential or broad proxy/TLS settings to bypass failed verification.

Synthetic policies/qualifications are not statutory or clinical acceptance.
Fiscal invoices and unsupported exchange cases remain unavailable. Free-text
synthetic provenance cannot be automatically guaranteed; use privately controlled
accounts. Free services can sleep or exhaust quotas; preserve the local fallback.

## Exact changed paths — 34 total, 17 modified and 17 new

```text
.dockerignore
Dockerfile
client/src/App.jsx
client/src/components/AcademicDemoNotice.jsx
client/src/components/AcademicDemoNotice.test.jsx
client/src/components/AcademicDemoProvider.jsx
client/src/components/academic-context.js
client/src/index.css
client/src/pages/Pos.jsx
client/src/workflows/BenefitCheckout.jsx
client/src/workflows/Exchanges.jsx
deploy/academic-demo.env.example
docs/ACADEMIC_CLOUD_DEMO.md
docs/phase4/ACADEMIC_CLOUD_IMPLEMENTATION_RESULTS.md
server/academic/operator.mjs
server/academic/seed.mjs
server/src/academic-server.js
server/src/academic/capabilities.js
server/src/academic/manifest.js
server/src/academic/migrations.js
server/src/academic/pool.js
server/src/app.js
server/src/config/env.js
server/src/repositories/exchanges.repository.js
server/src/repositories/local-benefits.repository.js
server/src/repositories/operations.repository.js
server/src/routes/exchanges.routes.js
server/src/routes/reports.routes.js
server/src/services/report-exports.js
server/test/academic.integration.test.js
server/test/academic.test.js
server/test/support/academic-fixture.js
server/test/support/packaged-workflow-fixture.js
server/testing/batch14-browser.mjs
```
