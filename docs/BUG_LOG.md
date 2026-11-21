# Finalization bug and limitation register

## Batch 8 harness corrections — 2026-11-22

The interrupted run exposed Fetch restricted-port failures in local POS tests.
An initial port-0 retry could repeatedly receive the same unsuitable port.
The corrected helper explicitly requests high loopback ports, retries collisions
with a bound, and preserves browser/application security. Six focused launcher/
allocator tests and the final full isolated run (189 entries) pass.
The initial compiled-demo build inherited server development mode; the launcher
now scopes production NODE_ENV around frontend build/preview, restores it, and
checks emitted React assets before accepting production-bundle evidence.
See [Batch 8 results](phase4/BATCH8_RESULTS.md). Windows connection-aborted error
10053 is an interruption reported by the owner; no unsupported network root-cause
or application fix is claimed. Docker, human UAT, statutory/fiscal validation and
production migration/restore gates remain open.

## Batch 7 corrections — 2026-11-21

[BATCH7_RESULTS.md](phase4/BATCH7_RESULTS.md) supersedes prior missing canonical
resource, within-category ranking and adjustment-picker findings. Two limited
browser-local Admin reminder preferences and expiry-only inventory measures are
implemented. Docker execution, durable settings, statutory/fiscal completion,
production migration/restore readiness and actual human acceptance remain open.

## Current register — Batch 6, 2026-11-21

[Current QA](phase4/BATCH6_QA_RESULTS.md) records release blockers B01–B10 and
noncritical gaps. Key issues: disabled statutory posting, Docker's missing
canonical workflow resources, populated-target migration/restore readiness,
partial notification/category/receipt requirements and pending human UAT.
Current results: 113 frontend, 178 backend entries, 15 Chrome groups passed.
No production connection or application implementation change occurred.
Historical entries below are superseded where current evidence differs.

Recorded 2026-11-20. No invented reporter names, sign-offs, ticket history or successful live retests are claimed. Fixed means the stated automated checks passed; outstanding evidence remains explicit.

| ID | Severity / scope | Reproduction / finding | Resolution and actual retest | Status |
| --- | --- | --- | --- | --- |
| POS-001 | High; cashier workflow | Submit insufficient cash or encounter changed stock; saved attempt kept cart/payment locked with no normal correction path. Discarding it unsafely could let a delayed old request post later. | Savepoint rollback plus durable `POS_checkout` closure under the existing advisory transaction lock. Confirmed closure unlocks editing and clears quote. Resolve endpoint returns paid receipt or closes only an unused reference. Seven new route/repository tests and five new UI/storage tests passed; one API-helper test passed. Added PostgreSQL scenario remains skipped. | Fixed in code; automated retest passed; PostgreSQL/browser verification pending. |
| DEP-001 | High; production configuration | Production Express previously had no compiled frontend/deep-link serving arrangement. Frontend-only hosting cannot provide the API. | Production static/SPA middleware, Dockerfile, exclusions and env template added for the same Express architecture. Two focused tests and 15 production-mode HTTP checks passed. | Fixed/configured; Docker/host/TLS validation pending. |
| ENV-001 | Blocking populated transaction demonstration; login blocker resolved | Business tables remain empty. Subsequent owner authorization permitted exactly one Admin and one Employee. | Both active accounts created through existing bootstrap/account services; 18 actual login/profile/dashboard/access/logout/revocation checks passed. No business seed or new database. Receiving/checkout/populated reports remain unverified. | Account access resolved; business-data/demo limitation remains open. |
| QA-001 | High; evidence gap | Six opt-in PostgreSQL suites do not run in default tests/CI. Existing Neon cannot be used for schema-creating fixtures under current constraints. | 44 backend tests passed; six DB suites explicitly skipped. New closure SQL/row-lock behavior is not runtime-certified on PostgreSQL today. | Open; no false pass claimed. |
| QA-002 | High; UI/E2E evidence | Browser access host unavailable; jsdom does not establish real-browser visual, storage, cookie or mobile behavior. | 47 frontend tests, lint and build passed. No screenshot or real-browser pass invented. | Open. |
| COMP-001 | Critical for live pharmacy | Senior Citizen/PWD legal/VAT/eligibility/approval requirements remain unvalidated. | Discounted checkout stays disabled; no fabricated calculations. Clearly disclosed in POS/manual. | Open production blocker. |
| API-001 | Week 15 deliverable | Cloudinary code exists but 006 is unapplied and provider is disabled. Owner approval is not adviser/instructor acceptance or real API evidence. | Kept disabled; no live provider/migration execution. | Open; not required to run the image-independent MVP. |
| OPS-001 | Deployment limitation | Session allowlist and rate limits are process-local; restart logs users out and unreviewed multi-instance hosting is unsupported. | Same-origin single-process deployment config; manual explains reauthentication and saved-reference recovery. | Known limitation, preserved. |
| OPS-002 | Checkout durability boundary | Receipt UUID has no database unique constraint; closed attempt state now uses existing audit events. Independent writers/log purges can bypass the protocol. | All app checkout/resolve paths share the advisory lock; closure checked before new posting; audit events must be retained. No schema changes or log cleanup introduced. | Operational requirement; external writers and purges unsupported. |
| REQ-001 | Approved requirements gap | General settings/audit-review UI, user-management UI, returns/adjustment posting and fiscal receipt compliance are not complete. | Manual and presentation checklist describe only actual functionality. No new optional modules added. | Open scope/acceptance limitation. |
| REL-001 | Submission evidence | New fixes/container config are uncommitted, not pushed/deployed, and have no new hosted CI run or URL. | Local exact counts recorded; prior green CI is user-reported historical evidence only. | Pending owner-authorized review/release steps. |

## Retest procedure for POS-001

Automated tests cover insufficient cash/stock, fresh reference after confirmed closure, rejection of delayed old references, concurrent retry/resolution, fresh runtime instances, owner isolation, audit failure and lost commit response. UI tests cover re-review, uncertain-not-found retention, explicit resolution after refresh, paid receipt recovery, and preserving another saved reference.

On an already authorized existing environment with real permitted accounts/data, the remaining browser/DB retest is: reject a checkout -> confirm no sale/payment/deduction -> correct cash/cart -> re-review -> complete once -> replay the old closed reference and same successful reference -> confirm exactly one sale/payment and correct batch deductions. Do not perform this on current Neon merely to satisfy presentation evidence. No additional database or infrastructure is created by this register.

Report future bugs with role, page, non-sensitive reference, steps, expected/actual result, severity, owner and actual retest evidence. Exclude credentials, cookies, connection strings and private screenshots. Owner assignment/closure approval remains unrecorded until actually supplied.
