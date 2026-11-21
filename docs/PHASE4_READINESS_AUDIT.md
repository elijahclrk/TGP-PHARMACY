# Phase 4 requirements and deployment readiness audit

## Batch 7 latest local status — 2026-11-21

[Batch 7 results](phase4/BATCH7_RESULTS.md) records corrected canonical packaging,
within-category rankings, limited browser-local Admin reminders, batch picker and
expiry-only inventory measures. Current QA: 120 frontend, 183 backend entries,
17 Chrome groups/38 screenshots; lint/build pass. Docker runtime is blocked by
unavailable Docker. Durable settings, statutory/fiscal completion and genuine
owner/pharmacist acceptance remain pending. No production connection occurred.

## Current status superseding historical findings — Batch 6, 2026-11-21

See [requirements matrix](phase4/FINAL_REQUIREMENTS_MATRIX.md),
[QA/known blockers](phase4/BATCH6_QA_RESULTS.md) and
[release gates](phase4/RELEASE_CHECKLIST.md). Current local results: 113 frontend,
178 backend entries, 15 real Chrome groups, lint/build passed; no permitted local
DB suite skipped. Exports/protected workflows locally tested; statutory checkout
unavailable. Full live release blocked; owner/pharmacist UAT pending. Batch 6
never connected to Neon. Statements below about absent Git, live/empty accounts,
missing browsers, earlier counts or now-implemented modules are historical,
not current verification of production; retained as the original record.

## Subsequent owner-authorized account update - 2026-11-20

The project owner subsequently authorized one initial Admin and one Employee in existing Neon `neondb`. Both active accounts were created through the existing bootstrap/account services, with random private credentials and Argon2id verification. **18 real local HTTP checks passed**, including both logins, role dashboards, Employee restrictions, logout and revocation. Earlier empty-user/login-blocker statements below are historical and superseded by this update. Business tables remain empty; stock receiving, paid sales and populated reports are still not demonstrated. No new database, business seed, schema/migration change, image activation, commit, push or deployment occurred. See [ACADEMIC_ACCOUNT_SETUP.md](phase4/ACADEMIC_ACCOUNT_SETUP.md) for the redacted evidence and private credential-file instructions. No instructor/adviser approval is implied.

## Authoritative finalization update - 2026-11-20

This section supersedes historical status/test claims later in this report. Finalization fixes and documents existing functionality only; no optional module, architecture replacement, database, infrastructure, seed, reset, deployment, commit or push was performed. Original Phase 3 files/migrations and connection TLS configuration remain unchanged. Cloudinary and discounts remain disabled; migration 006 remains unapplied.

**Submission decision: partial completion with explicit blockers, not a completed working demonstration or live-pharmacy release.** Existing Neon was checked read-only and all 15 application tables, including users, remain empty. No valid account can log in, and there are no products/stock/transactions to demonstrate. Under the no-data-change/no-new-resource instruction, that cannot be repaired by fabricated data. Do not execute the earlier prepared demo initialization/seeding tools for this finalization.

Verified changes/evidence:

| Area | Current result |
| --- | --- |
| POS rejected-checkout defect | Correctable rejection rolls back to a savepoint and durably closes its UUID in existing audit logs under the same transaction lock. UI unlocks only after committed closure and requires re-review. Resolution returns an existing paid receipt or closes an unused reference; late retries cannot create another sale. No refund/void policy or schema change. |
| Backend tests | `npm test`: **44 passed, 0 failed, 6 skipped**, 50 reported tests. Includes seven new rejection/resolve protocol tests and two production-static tests. DB behavior in those protocol tests uses doubles; real PostgreSQL verification is not claimed. |
| Frontend tests/lint/build | **47 passed across 7 files**, 0 failed; ESLint and Vite production build exit 0. Six added correction/storage/API-helper cases. |
| Existing data/schema | 001/002/004 recorded, baseline checksum matches, no image column, all application row counts zero. No schema/data mutation. |
| Current module query compatibility | **16 read-only repository checks passed** on existing Neon for product/inventory, supplier/PO/receiving, POS product/status queries and reports. Empty results are not populated workflow evidence. |
| Startup / authentication | Existing frontend/API and health endpoints checked with actual HTTP. Protected requests reject missing sessions; nonexistent credentials reject generically without a success audit. Successful live login blocked by no users; JWT/Argon/RBAC behavior tested with fixtures. |
| Deployment preparation | Multi-stage Dockerfile, context exclusions, blank environment template, and production Express static/SPA serving for the existing single-origin architecture. **15 real production-mode HTTP smoke checks passed** against the compiled client with DB access disabled. No container image build, host setup, new service or deployment. |
| Documentation | Text user manual, bug/limitation register, deployment guide, exact finalization results and final presentation checklist supplied. No screenshot, signature or acceptance invented. |

Six PostgreSQL suites (auth, inventory, purchasing, POS, reports, product images) remain explicitly skipped. Existing resources are not authorized for schema-creating fixtures, no new database is allowed, and Docker's daemon/browser access host were unavailable. Updated POS SQL runtime/concurrency tests, real-browser E2E/visual checks, Linux container build, HTTPS/proxy and deployed-host verification remain incomplete. The prior user-reported green hosted CI run predates these changes; no fresh hosted result is claimed.

| Official week | Current completion evidence / gap |
| --- | --- |
| 13 | Stack, repository and CI preparation exist; collaborative PR/contribution, assigned Sprint 4 planning and missing SDS/wireframes evidence are not fabricated. |
| 14 | Authorized core modules implemented/tested locally; actual interactive demonstration is blocked by no users/data and remaining approved-scope gaps. |
| 15 | Owner-approved Cloudinary feature code exists, but stays disabled with 006 unapplied; no real provider interaction or adviser/instructor acceptance evidence. |
| 16 | CI workflow and production configuration prepared; updated hosted CI, approved host/domain and cloud-deployed prototype URL absent. |
| 17 | Automated checks, text manual and bug log supplied; six DB suites, actual browser screenshots/E2E and UAT remain outstanding. |
| 18 | Final presentation checklist supplied; actual defense deck/rehearsal/acceptance remain unevidenced. |

Remaining release blockers: Senior/PWD compliance; actual accounts/data and permitted successful walkthrough; real DB/browser/host verification; operational proxy/session/backup ownership and acceptance of provisional business definitions. Retain checkout-closure audit events and the common writer lock; external writers/purges cannot bypass this invariant. Full settings/audit-review/user-management UI, returns/adjustment posting and fiscal receipt validation remain incomplete rather than newly implemented here.

See [FINALIZATION_RESULTS.md](phase4/FINALIZATION_RESULTS.md), [USER_MANUAL.md](USER_MANUAL.md), [BUG_LOG.md](BUG_LOG.md), [DEPLOYMENT.md](DEPLOYMENT.md), and [final presentation checklist](phase4/FINAL_PRESENTATION_CHECKLIST.md). No resource expansion or restarted implementation plan is proposed; next steps are review, truthful submission scope acceptance and verification/actions only when separately authorized.

---

## Historical audit snapshot (superseded where the update above differs)

Audit date: 2026-11-20, Asia/Manila. Scope: local source, available approved documents, implementation notes and local checks. No application code, database schema, connection configuration or business data was changed. No deployment or new business module was implemented. Frontend build regenerated its ignored build output.

## Executive decision

**Official schedule reconciliation update:** 2026-11-20. Visually reviewed [official screenshot](phase4/Screenshot%202026-11-20%20163015.png) against this report and the latest checkout-recovery implementation. The screenshot is a schedule/objectives artifact, not a detailed scoring rubric or approval of additional business rules. The initial audit test results below are preserved as historical evidence; no tests or deployment were performed for this documentation-only update.

**Not ready for live pharmacy production.** The application is a substantial, tested regular-price MVP, suitable for preparing a controlled staging demonstration after hosting, secrets and routing are configured. A successful local build is not deployment certification. Live operation is blocked by the deliberately unavailable Senior/PWD workflow, remaining checkout correction/recovery edge cases, missing browser/UAT evidence and unfinished operational safeguards. The official Phase 4 schedule is now available and mapped below; external API, collaborative Git, CI/CD, cloud deployment, QA documentation and defense evidence remain incomplete.

The current architecture can support a single long-running API process behind one HTTPS origin with Neon. It is not presently suitable for unreviewed multi-instance, ephemeral/serverless or cross-origin deployment: session/revocation state and login throttling are local to a process; frontend requests and cookies assume same-origin `/api` routing.

## Evidence and requirement authority

Available approved artifacts:

- `docs/phase1/TGP_SystemRequestForm.pdf`, particularly Sections 3–6, 8–9: branch/owner access, core functions, approved owner data, reporting estimates, optional features, and hosting/backup decisions left open.
- `docs/phase3/tgp_database.sql` and `docs/phase3/TGP_ERD.png`: original 15-table design and relationships, batch-level sale items, approval references and timestamp/monetary fields.
- Implementation documentation: `server/AUTHENTICATION.md`, `INVENTORY.md`, `PURCHASING.md`, `POS.md`, `REPORTS.md`, server/client READMEs, `server/database/README.md` and `VALIDATION_RESULTS.md`.
- React route/auth/page/component files; Express routes/services/repositories; environment, database, session and server startup code; migration scripts and test files.

**Update: the official Phase 4 schedule screenshot is now available at `docs/phase4/Screenshot 2026-11-20 163015.png` and was visually inspected. No Phase 2 document, full SDS package/Phase 3 wireframe, detailed marking rubric, Form B template, deployment manifest, browser E2E configuration, Postman collection, or `.github/workflows` directory was found in this checkout.** No `.git` directory was found at project root/client/server; remote version-control/CI state was not available and is not inferred from local files. Existing lockfiles are present.

The earlier user-approved technology stack names **Cloudinary** for image storage, **Postman** for API testing and **GitHub Actions** for CI/CD. Those are project-specific technology instructions; the official Phase 4 schedule requires external API integration and CI/CD but does not name those vendors/tools. No implementation/export/workflow for those was found. Neon integration is implemented; a hosted database connection alone does not demonstrate a separate external REST API assignment. The SRF explicitly excludes integrating the existing TGP inventory application.

**The official Phase 4 schedule requires external API integration and cloud deployment but does not mandate a specific API vendor or hosting platform.** Maps, SMS and Payment are examples. The SRF leaves hosting, backup and network setup undecided. Confirm the proposed API use case through Form B and choose an authorized hosting topology; no product image field currently exists in the approved schema.

## Completed implementation within the authorized MVP scope

| Area | Evidence-backed status |
| --- | --- |
| React/Vite/Tailwind and Express | Working page/routes structure, green/white UI, build/test scripts, ES modules |
| Neon integration | Reusable pg pool, verified TLS configuration, URL SSL overrides neutralized, safe DB-health errors, timeouts and graceful shutdown |
| Authentication/RBAC | Argon2id, expiring JWT, HttpOnly/Strict cookies, Secure production cookies, current DB role/status checks, revocation, CSRF origin/header checks, login limiter, no public registration |
| Accounts backend | Admin create/deactivate APIs for manager/employee; one-time environment-driven admin bootstrap; transactional auditing |
| Inventory | Product search/pagination, metadata editing, employee cost omission, zero-stock standalone batches, direct quantity edits rejected, low-stock/expiry views |
| Suppliers/purchasing | Supplier add/edit/list/view, independent PO creation/approval, receiving, zero-stock receipt batches, guarded once-only stock posting, row locks and audits |
| Regular-price POS/FEFO | Server product pricing, exact numeric rounding, full cash payment/change, multi-batch traceability, strict future-expiry eligibility, concurrent overselling prevention, atomic payment/stock/audit writes |
| Checkout recovery | Exact request persisted per cashier before submission; original-cashier status lookup and committed-receipt retries survive refresh/re-login and fresh API runtime. Storage loss, multiple tabs and rejected-attempt resolution remain limited. |
| Dashboards/reports | Role-specific dashboard and report restrictions, daily/weekly/monthly summaries, fully paid qualification, separate approval counts, product sales, stock views, verified-cost valuation/gross-margin estimates, bounded Manila date filters |
| Schema discipline | Existing migrations tracked with checksums; 003/005 deferred; no new business tables introduced by later modules |
| Automated tests | Node test suites and React/jsdom tests cover core behavior, SQL-backed transactions, concurrency, RBAC and reporting reconciliation |

These are implementation findings, not a claim that all original SRF requirements are complete or that controls have been verified in a deployed browser environment.

## Partial or missing documented functionality

| Requirement | Gap / interpretation |
| --- | --- |
| Senior/PWD process — Must Have | Explicitly disabled. Legal/VAT, eligibility and pharmacy approval requirements remain unvalidated. SQL's example percentage is not an approved rule. |
| Branch and Owner Desktop Applications | One role-based web application exists. No separate desktop packaging or owner client is present; confirm whether the web implementation is accepted as the approved deliverable. Do not assume a desktop framework is required. |
| Owner approved-data reporting | Current user-approved provisional policy recognizes paid POS sales even with NULL approval, separately labelled. This intentionally differs from original approved-only owner reporting and needs client sign-off. No general sales-approval workflow exists. |
| User management | Backend complete for the limited create/deactivate scope; no admin account-list/create/deactivate UI. No agreed password-change/recovery/admin succession procedure. |
| Stock adjustments and return approvals | Tables/role descriptions exist, but adjustment, sale-return and associated approval modules are not implemented. Return-to-sale-item amendment 003 remains deferred; do not activate it without approval. |
| Audit review/settings | Transactional logs exist, with limited document histories. No general admin audit browsing/export UI or settings interface for notifications/discount rules. Product reorder thresholds are admin-editable. |
| Product performance by category | Sales-by-product includes current category labels, but no category-grouped best/slow-moving report or agreed slow-moving definition. SRF labels this Should Have. |
| Profit/valuation | Carefully labelled estimates; unknown/unverified costs suppress totals. No immutable sale-time cost/name snapshots, tax/net-profit accounting or historical inventory valuation. |
| Alerts | Low-stock/expiry views and dashboard counts exist. No independently configured proactive alert/notification service. Email/SMS is optional if time permits, not a mandatory invented integration. |
| Customer/prescription profiles | Not implemented; Should Have and limited to client-confirmed fields. Do not add speculative personal data. |
| Receipts | Stored transaction display exists. Fiscal formatting/numbering, printing and legal receipt acceptance have not been validated. Printer/scanner were unavailable in the SRF; barcode is optional. |
| Delivery/PO lifecycle | Independent records, no received transition or partial-delivery reconciliation by approved MVP decision. Delivery-reference uniqueness, batch matching/reuse, cancellation/reversal and supplier-return behavior remain unconfirmed. |
| External API / Cloudinary | No outbound integration or image upload flow. Cloudinary was named in the requested stack; functional scope and any schema need require clarification. Week 15 now explicitly establishes an external API deliverable; the provider/use case remains to be approved. |
| CI/CD / Postman | No local GitHub Actions workflow or Postman collection/environment export. No deployment automation or promotion evidence. |
| Documentation/handoffs | Good per-module notes, but client README remains Vite template; server README still says no business tables/features; authentication introduction still says other modules absent. Database validation notes include historical draft statements superseded elsewhere. No consolidated installation/user/admin/recovery runbook or acceptance traceability matrix. Jira/handoff evidence is not present locally. |

## Production blockers and deployment risks

1. **Discount compliance:** regular-price-only checkout must not be presented as a complete pharmacy production POS. Resolve requirements with the client and qualified compliance guidance; this audit does not establish legal formulas.
2. **Checkout recovery ? partially remediated:** `client/src/checkout-recovery.js` persists the exact request per cashier before submission; `GET /api/pos/checkouts/:requestId` restricts status recovery to the original user. Refresh/re-login and fresh API-runtime recovery have automated coverage. Remaining gaps: permanently rejected/underpaid attempts require operator resolution; browser storage loss and multiple independent tabs are not covered; OS-kill-during-COMMIT and real-browser refresh tests remain unverified. Authentication sessions still expire on restart. Ambiguous receiving creation responses also lack a creation-idempotency protocol.
3. **Browser/E2E acceptance:** jsdom tests mock frontend HTTP. No real browser visual, accessibility, responsive, cash-desk workflow, HTTPS-cookie, reverse-proxy, hard-refresh, print or end-to-end acceptance evidence exists. Must verify all three roles with actual backend in staging and client UAT.
4. **Session/runtime topology:** process-local allowlist/limiter means restart logs everyone out, multiple instances disagree on sessions, and scale-out throttling is not shared. A single instance with explicitly accepted restart behavior may support staging. Persistence/scaling needs reviewed shared state; sticky routing alone is not a complete solution. Session expiry also compounds checkout recovery.
5. **Production routing/config:** Vite proxy only covers development. Express does not serve frontend assets. Production needs static `client/dist`, `/api` reverse proxy and SPA fallback, HTTPS and appropriate response headers. Cross-origin hosts are not plug-and-play (`credentials: same-origin`, host-only Strict cookies). Reverse-proxy trust/client-IP rate limiting must be configured and tested for the selected topology; otherwise all users may share a proxy IP limit. Production config permits HTTP origins and development defaults if operators omit values, so release validation must fail closed operationally.
6. **Secrets/privileges:** server `.env` variants are ignored; actual credential contents were not opened or printed. Client ignore rules do not broadly cover `.env`/`.env.production`; `VITE_*` values are public by design. Before introducing deployment files, protect secrets everywhere and check the actual repository. Production secret management/rotation, least-privileged DB runtime role and separate migration/test roles have no verified deployment evidence. Current test harness capability to create/drop schemas must not be assumed appropriate for the runtime role.
7. **Backups and operations:** no documented retention, restore drill, incident response, monitoring/alert routing, rollback procedure or owner responsibilities. Health endpoints and graceful shutdown are useful but insufficient. Neon account backup/PITR settings, access controls, network rules and recovery capability were not inspected; absence of local evidence is not proof the provider lacks them.
8. **Provisional business rules:** self-approval in receiving, independent POs, duplicate delivery handling, product-price authority/rounding, expiry-day exclusion, reporting recognition and estimate definitions need client acceptance. Do not silently call these permanent pharmacy policy.
9. **Timestamp contract:** schema timestamps lack timezone; reporting interprets sale timestamps as UTC because the verified database default was GMT. Enforce/test the UTC session contract in deployment and on imports. Mixed historical local timestamps cannot be repaired by a display conversion alone.
10. **Data integrity boundaries:** nullable legacy fields remain intentionally supported; app validations and report coverage checks fail safely but do not prove legacy data completeness. Receipt retry uniqueness is protected by a shared advisory protocol, not a UNIQUE receipt constraint; bypass writers invalidate that guarantee. General audit append-only database privileges are not verified. Approval/self-approval rules must stay consistent across all writers.
11. **Capacity/release assurance:** a single global advisory transaction lock serializes account/inventory/purchasing/POS writes, including quotes. No realistic load, timeout, pool saturation or high-volume reporting benchmark exists. Reporting queries can scan relevant data and use correlated reconciliation; bounded dates do not replace performance measurement. No current dependency vulnerability scan/SBOM/secret-history scan is evidenced. No claim of zero vulnerabilities is made.

## Audit verification results

Actually rerun during this audit, without database writes:

| Check | Result |
| --- | --- |
| `server: npm.cmd test` | 13 passed, 0 failed, 5 opt-in DB suites skipped |
| `client: npm.cmd test` | 33 passed across 5 files |
| `client: npm.cmd run lint` | Passed |
| `client: npm.cmd run build` | Passed |

The previous implementation run documented in `server/REPORTS.md` recorded 65 backend tests passed with all five database flags enabled and HTTP 200 health checks. These are prior results, not a fresh live-database/deployment certification from this audit. No live DB queries, provider account inspection, vulnerability feed check, migrations or browser automation were performed in this audit. No dependency installation was necessary.

## Recommended implementation order

1. Use the official Phase 4 schedule below; obtain the missing SDS/wireframes, Form B template and any detailed marking rubric. Confirm API/platform choices, web-versus-desktop acceptance, and remaining SRF priorities. Record client decisions and reconcile old approved-only reporting wording.
2. Resolve production policy blockers: Senior/PWD requirements, fiscal receipt expectations, stock adjustments/returns approval and client sign-off on provisional MVP rules. Do not implement speculative workflows.
3. Finish rejected-checkout/operator recovery and real-browser/session-loss validation, then choose single-instance versus persistent/shared-session architecture. Preserve credential protections and schema approval requirements.
4. Complete approved missing operator/admin screens and workflows in scoped tasks; update user/admin/setup/handoff documentation. Treat optional SRF features separately from release-critical ones.
5. Establish version-controlled release source, accurate READMEs, environment contract, least-privileged database access and isolated test environment. Build the requested GitHub Actions pipeline once repository access and deployment target are confirmed; add Postman/API contract artifacts. Implement Cloudinary/another API only after confirming its authorized use case.
6. Run real browser/E2E/UAT, failure recovery, security configuration, load and backup-restore testing in staging. Repair findings before promotion.
7. Approve a release checklist, rollback plan and operations ownership; deploy only with explicit authorization after gates pass.

## Required deployment steps — plan only, not executed

1. Select an approved hosting topology/provider; document domain/TLS, static assets, long-running Node process, networking and operational ownership. No provider is selected by this report.
2. Freeze a release commit and lockfiles. CI should use `npm ci` in client/server, run frontend tests/lint/build and backend tests, then explicitly enable DB suites against a dedicated disposable test database/branch. Default backend tests skip integration. Do not run schema-creating integration tests with production credentials or concurrently with production operations.
3. Provision isolated staging and later production environments. Set supported Node runtime and production-only dependencies for server. Supply `NODE_ENV=production`, `PORT`, exact HTTPS `CLIENT_ORIGIN`, `DATABASE_URL`, high-entropy `JWT_SECRET`, bounded `JWT_TTL_SECONDS` via the approved secret store. Never embed secrets in client builds. Verify UTC database sessions and verified TLS. Ensure native Argon2 loads on the selected OS/runtime.
4. Configure one origin: static `client/dist`, `/api` to Express, SPA history fallback excluding API paths, appropriate cache/security headers, HTTPS redirects and trusted-proxy/client-IP behavior. Run one API process until state-sharing is explicitly designed and tested. Do not use Vite dev/preview as the production hosting plan.
5. Verify schema and migration history read-only against approved checksums. The historical initialization runners require empty tables and may take exclusive locks/create reference schemas even under `--check`; do not run them on a populated production database as routine deployment health checks. Never automatically apply deferred 003/005 or reset data. Future schema changes need a separate reviewed plan.
6. Verify backup/restore and rollback. For an initially empty users table only, bootstrap an admin through the existing secure CLI using operator-provided credentials, remove bootstrap variables, and provision named accounts. Establish approved password/admin recovery procedures before use.
7. Run deployment smoke/E2E checks: HTTPS cookie flags, login/logout/expiry/restart, all role denials, hard-refreshed routes, health endpoints, cash/FEFO/retry recovery, receiving approval, report reconciliation and Manila boundaries. Use staging fixtures; do not insert sample business transactions into production.
8. Confirm monitoring, error redaction, audit retention/access, backup ownership, dependency maintenance and incident escalation. Perform documented client acceptance and obtain go-live authorization. After authorized promotion, verify health and non-mutating smoke checks and retain the tested rollback artifact.

## Audit completion boundary

Only this report was added during the original audit and updated during this follow-up. Application source, environment files, schema and workflows remain unchanged; no deployment or new module was performed. Phase 4 completion and production readiness remain **not approved** pending the evidence and remediation above.

## Official Phase 4 deliverable matrix

| Week | Official requirement | Current status | Missing completion evidence / action |
| --- | --- | --- | --- |
| 13 | Audit SDS; GitHub setup; Sprint 4 planning; initialize tech stack | Partial. Stack initialized and local requirements/schema audits completed. | Full SDS/wireframes are not available, so blueprint conformance is not fully verifiable. No local Git repository/GitHub remote evidence, collaborative PR history, Sprint 4 backlog, assignments or acceptance criteria. Establish these artifacts; remote setup may exist elsewhere but is unverified. |
| 14 | Core development: database creation, backend routing, frontend templating | Substantially implemented for the authorized MVP. | Database, routes and pages exist with tests. Original blueprint gaps remain: discounts, adjustments/returns, admin UI/audit review and acceptance of web versus desktop delivery. Do not equate core-code completion with all SRF requirements fulfilled. |
| 15 | External API integration (Maps, SMS, Payment examples); Change Requests (Form B) | Missing local integration and formal change-request evidence. | Select one justified integration, obtain acceptance of its scope, record Form B, implement/test actual success and failure responses. No official Form B template or completed forms were found. Previously approved conversational MVP decisions should be transcribed and reviewed, not backdated as formal sign-offs. |
| 16 | CI/CD and cloud deployment; move prototype from local to live | Missing. | GitHub Actions workflow, configured secrets/environments, reproducible pipeline evidence, chosen cloud topology, deployed prototype URL and smoke/rollback evidence. Neon is cloud-hosted storage; it does not constitute deployment of the React/Express prototype. |
| 17 | QA/testing, bug logging, user manual | Partial. | Automated suites and module notes exist. Need bug register with severity/reproduction/owner/retest evidence; API contract evidence; actual-browser UI/UX, E2E and user acceptance against SDS; role-based user manual with screenshots and recovery instructions. Developer READMEs are not the required user manual. |
| 18 | Final defense and working-prototype presentation | Not evidenced. | Defense deck, requirement-to-demo script, cloud URL, prepared non-production demo accounts/data, test/bug summary, limitations, contribution/change-request evidence and rehearsal. No completed defense is inferred from code. |

Objective mapping:

- **Collaborative Git workflows:** not evidenced locally. A repository upload alone is insufficient evidence of collaboration; retain branches, reviewed PRs, linked issues and meaningful contributor history going forward. Do not fabricate historical collaboration.
- **Test/debug against API responses and UI/UX specifications:** partially met by Node/PostgreSQL and React/jsdom suites. Postman was named in the project stack, but no collection export exists. Missing SDS/wireframes and real-browser checks prevent full UI/UX conformity verification.
- **Functional cloud-deployed prototype adhering to approved blueprints:** not yet met. Local functional coverage is substantial; a deployed application, accepted deviations and blueprint traceability are still required.

## Recommended external API integration

**Preferred proposal: Cloudinary product-image upload and delivery**, because Cloudinary was already named in the requested technology stack and an image-management flow can be kept separate from payment and stock posting. This is a proposed use case, not a newly declared approved pharmacy requirement. Ask the instructor/client to accept it as the Week 15 external API demonstration through Form B before implementation.

Suggested bounded acceptance scope: authorized Manager/Admin upload of a product image, read-only image display, safe file type/size validation, protected server-side credentials/signing, clear upload failure states, and demonstrable real provider responses. Do not store prescriptions/customer IDs or upload confidential documents. Cloudinary's official Node documentation supports server uploads and browser uploads signed by a Node backend: [Node upload documentation](https://cloudinary.com/documentation/node_image_and_video_upload). A real API interaction and failure test should be shown, not just a static hosted image link.

**Schema decision required before coding:** products have no image-reference column. Document how an asset maps to a product, ownership, replacement and orphan cleanup in Form B. If a stored reference requires a column/table, propose the migration and stop for approval. Do not hide an unreviewed relationship in another field or assume external metadata automatically avoids the design review. The recommendation does not authorize schema changes.

Alternative if images are not accepted: an explicitly approved SMS low-stock/expiry notification to an authorized staff recipient. This aligns with the SRF's optional SMS alerts, but still requires recipient/consent, trigger, duplicate-send, cost and failure-handling decisions. Twilio is one technically compatible example, not a mandated vendor: [Messaging API](https://www.twilio.com/docs/messaging/api). Verify the selected provider's local delivery capabilities and account requirements before committing to it.

Maps has no demonstrated branch workflow in the approved single-branch design. A payment gateway would expand the approved cash-only POS and introduce settlement/refund/webhook requirements; it is not the recommended Phase 4 shortcut. **The examples are alternatives; do not implement Maps + SMS + Payment merely because they appear in the schedule.** No particular deployment provider is specified.

## Recommended next implementation task

**Establish the GitHub collaboration and CI foundation, with deployment disabled.** This closes the Week 13 dependency needed for Week 16 and preserves the existing working implementation before another module is added.

Concrete deliverables for the next authorized task:

1. Confirm repository owner, name, visibility and team access; inspect any existing remote before creating or pushing anything. Protect server/client secrets and build/dependency artifacts; scan staged content without printing credentials.
2. Set up the project repository and an agreed branch/PR/review workflow. Create Sprint 4 issues covering the matrix gaps and link acceptance criteria, owners and required Form B decisions. Do not rewrite/fabricate contribution history.
3. Add GitHub Actions CI using lockfiles: frontend test/lint/build and backend tests; explicitly run DB suites against a dedicated isolated test database with scoped secrets. Default tests skip database integration. Never use the operational Neon database for CI fixtures.
4. Produce one passing PR/pipeline record, update setup documentation, and keep deployment jobs absent or disabled. Repository permissions/branch-protection capabilities must be verified in the actual account.
5. In parallel planning, obtain the official Form B template and approval for the proposed Cloudinary scope. External API implementation then follows; cloud-host selection/deployment configuration follows explicit authorization.

Subsequent work: finish the approved API integration, create a controlled cloud staging prototype with same-origin HTTPS and one API process, complete browser QA/bug log/user manual, and prepare the Week 18 defense evidence. Deployment remains prohibited in the present task.

## Updated evidence and release distinction

Latest prior checkout-recovery run recorded in `server/POS.md`: **66 backend tests passed, 0 failed/skipped; 35 frontend tests passed; lint/build passed.** These results were inspected, not rerun during this update. Fresh-runtime recovery is tested with recreated HTTP/session/repository instances; no OS process-kill or real-browser E2E certification is claimed.

The official requirement is a **cloud-deployed prototype**. A restricted, synthetic-data academic demonstration and a live pharmacy rollout have different acceptance gates. Incomplete discounts, receipt compliance, operator recovery and operational safeguards still prohibit claiming production readiness. Do not automatically treat these limitations as permission to omit blueprint requirements from the defense: obtain explicit scope/deviation acceptance through the required change process.
