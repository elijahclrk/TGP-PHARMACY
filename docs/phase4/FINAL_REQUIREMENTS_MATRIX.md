# Final requirements alignment matrix — Batch 11 consolidated audit

## Current authority — Batch 11, 2026-11-22 Asia/Manila

The table below is the current **63-requirement** assessment. Batch 8 and Batch 7 notices are retained as historical context, not current test counts or scope. Fresh Batch 11 evidence: **122 frontend tests; 209 backend reported entries (all permitted isolated PostgreSQL suites enabled); separate Chrome runs of 17 existing and 9 local-benefit journey groups; lint and Node 24 production build passed.** These are separate layers, not an additive count of independent business scenarios. See [Batch 11 audit](BATCH11_RESULTS.md).

Senior/PWD posting is now implemented and tested **only through the attested disposable local runtime**. Production policy publication, statutory records, branch-specific approvals and fiscal invoices are still blocked. A local synthetic confirmation is not a registered invoice. The latest owner instruction explicitly requires **product exchange only, no cash refunds**: exchange fulfillment is missing, not waived by the implemented return/quarantine workflow. R43 now covers prohibited automatic refunds/reversals; new R63 records the exchange gap.

## Batch 8 evidence update — 2026-11-22 Asia/Manila

The 62 requirement classifications below remain unchanged. Batch 8 adds a guarded,
repeatable synthetic demonstration against the compiled production frontend:
17 Chrome groups, 38 screenshots, Manila receipt rendering, modal reopen/close
and real Excel/PDF downloads. The final backend run passed 189 reported entries
with all isolated database suites enabled. Frontend source is unchanged; its
completed Batch 8 run passed 120 tests. See [results](BATCH8_RESULTS.md),
[handoff](BATCH8_DEMO_HANDOFF.md) and [client walkthrough](BATCH8_CLIENT_WALKTHROUGH.md).
Docker runtime, statutory/fiscal activation, durable settings, live release and
actual owner/pharmacist acceptance retain their existing blocked/partial status.
The dated Batch 7 notes below remain source/history context.

Batch 7 supersedes affected Batch 6 findings: category product rankings now
work within each current category, copied workflow resources pass local runtime
gate checks, browser-local Admin dashboard preferences and a batch picker exist,
and expiry-only quantities are distinct from recorded stock. Docker execution,
durable/shared settings and actual human acceptance remain unverified/pending.
See [BATCH7_RESULTS.md](BATCH7_RESULTS.md) and
[BATCH7_OPERATIONAL_RULES.md](BATCH7_OPERATIONAL_RULES.md).

Date: 2026-11-21, Asia/Manila. Applies to local Batches 1–7, retaining original source references and explicit partial/blocked scope. **No production activation or owner/pharmacist acceptance is implied.**

## Authority and classification

Authority order: latest explicit project-owner/client decisions in this conversation; original SRF and Phase 2–3 artifacts; new nine clickable references; implementation/test evidence. Historical audit notes do not override subsequent owner decisions.

- **TESTED**: implemented behavior passed automated checks in the stated local scope; not deployed or signed off.
- **IMPLEMENTED**: code/configuration exists, but the relevant operational verification is incomplete.
- **PARTIAL**: part of the requirement exists, or the required definition/fields/evidence remain incomplete.
- **MISSING**: an explicitly required capability has no implemented end-to-end workflow.
- **BLOCKED**: activation/delivery requires a named approval, missing dependency or verification.
- **OUT OF SCOPE**: explicitly excluded, optional/deferred for this MVP, or superseded by a confirmed decision.

The primary status is assigned per row. A TESTED local workflow can still be production-BLOCKED by the release gates. No percentage of overall compliance is inferred from row counts.

## Source inventory

| Key | Original source independently reviewed |
|---|---|
| SRF | docs/phase1/TGP_SystemRequestForm.pdf, all four pages; sections 3–6 and 8–9 |
| UC | docs/phase2/Copy of Case Diagram.webp |
| DFD | docs/phase2/Copy of DFD.jpg |
| ERD2 | docs/phase2/Copy of ERD.webp |
| SQL | docs/phase3/tgp_database.sql; byte-identical to migration 001 |
| ERD3 | docs/phase3/TGP_ERD.png |
| ARCH | docs/phase3/TGP_System_Architecture.png |
| DEP | docs/phase3/TGP_Deployment_Diagram.png |
| PIPE | docs/phase3/TGP_CI_CD_Pipeline.png |
| LF | docs/phase3/TGP_Low_Fidelity_Wireframe.png, secondary to newer references |
| WF | Access, OVERVIEW, OPERATIONS, INVENTORY, MANAGEMENT, ADMINISTRATION, cards, Dialogs, TGP Clickable Wireframe PNGs; all nine visually inspected |
| B1–B5 | DEVELOPMENT_BATCH1_RESULTS, BATCH2_PREPARATION, LOCAL_POSTGRES_TEST_RESULTS, BATCH3_RESULTS, BATCH4_RESULTS and BATCH5_RESULTS under docs/phase4 |

**Feasibility Report limitation:** no Feasibility Report file was found among tracked/nonignored project files or docs/. Its §2.1 recommendation is CONFIRMED CLIENT DECISION as supplied by the owner, corroborated by ARCH/DEP's single web system. Its complete original text, other sections and any additional requirements are **BLOCKED for independent document traceability**. The pipeline diagram cites §§2.1, 2.5, 4.2; those citations do not substitute for the missing report. No separate textual SDS/use-case narratives were found beyond the available diagrams. This matrix covers all independently available requirements; it does not claim unseen documents were reconciled.

## Functional and operational requirements

| ID | Requirement and original source | Latest decision / approved interpretation | Status | Current evidence and remaining gap |
|---|---|---|---|---|
| R01 | Branch + Owner desktop applications; SRF §§4,8 | One web app, Employee/Manager/Admin access; desktop/laptop English; same stack | TESTED | React/Vite/Tailwind + Express + PostgreSQL; real Chrome role journeys. ARCH/DEP already show one shared web app. |
| R02 | Separate native desktop clients; SRF §4 | Superseded by confirmed one-web-app decision | OUT OF SCOPE | No native packaging or two-app synchronization is required. |
| R03 | One selected branch, no existing TGP integration; SRF §§3,8 | Preserved | TESTED | One branch workspace; no connector to the legacy inventory application. No multi-branch claim. |
| R04 | Individual login/authentication; SRF §6, UC/DFD | Preserve secure existing authentication | TESTED | Argon2id, expiring signed JWT allowlist, cookies, logout revocation; PostgreSQL/HTTP/browser tests. |
| R05 | Three roles and current permissions; SRF §6, UC | Current account-assigned role; Manager title is not proof of pharmacist qualification | TESTED | Server checks current active role; Employee costs/reports/admin restrictions; direct-route denial; role/status changes tested in backend. |
| R06 | Admin creates/deactivates Employee/Manager and assigns roles; SRF §6 | Account management Admin-only | TESTED | Admin account UI/search/details/create/deactivate; hashes excluded; revocation tested. Browser list/denial passed. |
| R07 | Account lifecycle beyond create/deactivate; WF edit/last-active fields | No approval to invent user fields or role-edit/password-recovery policy | PARTIAL | Password reset/change, reactivation, admin succession and role editing UI absent. Current-role revocation defenses tested; operational account recovery needs an owner plan. |
| R08 | Product catalog/name/generic/category/price; SRF §5, SQL/ERDs | No product-image requirement; legitimate pharmacy category values only | TESTED | Authenticated catalog search, create/edit and input validation; no fabricated production categories. |
| R09 | Batch quantity/cost/selling price/expiry; SRF §5, SQL/ERDs | Supplier deliveries through Stock-In; standalone batch starts at zero | TESTED | Batch traceability, role cost protection, direct stock-edit refusal and stock-in posting tested. |
| R10 | Selling-price authority; SQL product and batch prices | Preserve reviewed existing POS product-price authority | TESTED | Server rounds product unit price to cents; client totals/prices rejected. Batch selling_price is stored metadata, not a second competing checkout authority. |
| R11 | Real-time stock and no overselling; SRF §§3,5 | Atomic FEFO deduction, completed cash sale immediately recorded | TESTED | PostgreSQL locking/concurrency, rollback, payment/item/audit reconciliation and browser receipt checks. |
| R12 | FEFO earliest expiry; SRF §5, SQL, UC/DFD | Exclude expired and expiring-today batches using Manila date | TESTED | Multi-batch allocation, expiry/date-change quote rejection and concurrent inventory checks pass. |
| R13 | Near-expiry alerts; SRF §5, WF 90-day labels | Three calendar months from Asia/Manila business date | TESTED | Month-end/leap/year/midnight tests; separate expired/today/upcoming browser views. Not a fixed 90-day interval. |
| R14 | In-app low-stock/expiry alerts; SRF Should Have, UC/DFD | Combined read-only alert center | TESTED | Current legitimate inventory APIs, dashboard alerts and role-appropriate navigation; no external proactive messaging claim. |
| R15 | Admin reorder thresholds; SRF §6, SQL/WF | Reuse products.reorder_level; unset distinct from zero | TESTED | Admin-only view/write/audit, explicit null/zero tests and browser editing. |
| R16 | Critical-level formula/field; WF cards/ADMINISTRATION | Do not invent critical-stock formula or default threshold | OUT OF SCOPE | No separate critical_level field/calculation. Wireframe sample values are not requirements authorization. |
| R17 | Notification settings/preferences; SRF §6, UC/ARCH/WF | Supported in-app display preferences only; no invented external messaging | PARTIAL | Admin low-stock/upcoming-expiry dashboard switches implemented/tested per account/browser. All safety alerts remain. Durable/shared settings, approval/digest/reminder scheduling and read/dismiss state unavailable; 010 is proposal only, not applied. |
| R18 | Email/SMS; SRF §5 optional, §8 complex SMS excluded | Optional only if time allows; no activation authorized | OUT OF SCOPE | No delivery or provider evidence is claimed. |
| R19 | Supplier records; SRF §§5–6, SQL/ERDs | Existing Manager/Admin supplier operations | TESTED | Supported name/contact_no/address list/add/edit/detail; Employee denial and transaction audit checks. |
| R20 | Supplier contact person/email/status; WF INVENTORY/Dialogs | Do not invent schema fields | PARTIAL | Reference has fields absent from original suppliers schema/current supported forms. Owner must accept reduced fields or approve additions. |
| R21 | Purchase orders and items; SRF §5, SQL/UC | Existing creation/view/Manager/Admin approval retained | TESTED | Independent PO records and approval; PO approval does not add inventory. |
| R22 | PO pending→approved→received, linked deliveries/partial receipt; ARCH/WF | Preserve currently implemented permissions/services until approved revision | PARTIAL | No PO-to-stock-in FK, automatic received transition, expected-delivery/notes lifecycle or partial/over-delivery reconciliation. Independent stock-in is tested; complete diagram lifecycle is not. |
| R23 | Stock-In with supplier/delivery/batch/cost/expiry; SRF §§3,5, SQL/DFD | Approval before stock posts; deliveries do not use adjustments | TESTED | Zero-stock staging, once-only receiving approval, row locks, audit and rollback. Browser synthetic delivery posts four units once. |
| R24 | PO/Stock-In review permissions; SQL/ARCH | Existing Manager/Admin self-approval remains allowed until separately revised | TESTED | Explicitly retained and tested; do not apply new-workflow no-self-approval retroactively. No unsupported rejection endpoint exists for these record types. |
| R25 | POS manual name/generic search and stock viewing; SRF §§5,9, UC | Manual product search; desktop UI | TESTED | Search/cart/quote/checkout/receipt browser flow and repository tests. |
| R26 | Barcode; SRF optional, WF scan placeholder | No scanner dependency for MVP | OUT OF SCOPE | Barcode model/scanner integration absent; manual search available. |
| R27 | Payment method/receipt/change; SRF §5, SQL | Cash-only MVP | TESTED | One reconciled cash payment, tender/change, immediate recognition; browser PHP 224/300/76 evidence. |
| R28 | GCash/card/payment gateway; WF OPERATIONS | Superseded by cash-only decision | OUT OF SCOPE | Not offered as working payment methods. |
| R29 | Cashier identity/receipt/batch history; SRF §§3,5, SQL | Preserve original financial/payment records | TESTED | sale.user_id, stored item prices/batches, receipt lookup, sale.paid audit; original cashier receipt recoverable after browser re-login. Current catalog names are not immutable regular-sale name snapshots. |
| R30 | Quote integrity and checkout recovery; B1–B5 | Any price/quote-critical change requires fresh explicit review | TESTED | HMAC cashier binding, UUID replay/closure, saved request isolation, stock/expiry/date changes, late retry and lost-commit tests; regular behavior preserved. |
| R31 | Printed/fiscal receipt; SRF receipt, DEP/WF Dialogs | Invoice format and branch fiscal requirements require validation | BLOCKED | Current transaction-confirmation modal is real; print action/printer integration/fiscal invoice acceptance absent. Not a BIR-certified invoice. |
| R32 | Senior/PWD end-to-end discounted sale; SRF Must Have, UC/DFD/SQL | Local implementation authorized in Batch 10; production requires validated branch tax/product/document/invoice inputs | PARTIAL | Local Senior/PWD verification, quote, atomic FEFO/cash/audit posting, recovery, historical receipts and reports tested. Production constructor rejects synthetic activation; policies are test-only. Real policy/provider, verified SKU publication and B01–B16 approvals remain blocked. |
| R33 | Eligible/ineligible basket/tax calculation; B2/B5/B9 specification | Scheme-specific eligibility and independent tax evidence, effective policy/price basis; unknown fails closed | TESTED | Local version2 snapshots cover mixed, VAT-inclusive, already exempt, explicit non-VAT mode, rounding/allocation and prescription quantity caps. 009 is preserved; 011 supplies immutable effective local evidence. Synthetic 20%/12% vectors are not branch approval. Promotion comparison and fractional unit conversion remain unavailable. |
| R34 | Beneficiary name and ID; confirmed owner decision | Required for discounted checkout; minimize and protect identity | TESTED | Local name/ID, scheme-specific identity/booklet/representative attestations and opaque verification references tested. No beneficiary data in ordinary exports or checkout recovery storage. Actual entitlement/authenticity verification, privacy procedures and branch documentary acceptance remain pending. |
| R35 | Customer/prescription profile; SRF Should Have, SQL intentionally omits | Store only client-confirmed fields; do not invent sensitive data | PARTIAL | Local protected documentary records and capped prescription fills exist; no general patient/customer profile, complete prescribing/dispensing module, approved retention/reveal/register interface or cross-pharmacy balance. |
| R36 | Routine discount/sale approval; original approved-only reports, UC/DFD/WF | Normal completed cash and valid future statutory sales need no routine approval | OUT OF SCOPE | Removed from approval semantics by latest decision; optional sales.approved_by is historical metadata, not recognition state. |
| R37 | Inventory adjustments with reason/actor/review; SRF §§5–6, SQL/WF | Manager/Admin independent review, no self-approval, once-only atomic stock/audit | TESTED | Request/approve/reject/replay/competing approvals/negative balance/rollback tests; browser independently approves/rejects. Employee request initiation exists; see D09 role reconciliation. Production gate remains off. |
| R38 | Receipt-linked customer returns/quantity limits; SRF accountability, SQL/DFD/UC | Original sale/item/batch; independent Manager/Admin review; no refund or automatic sellable stock | TESTED | Actual original line linkage, cumulative/concurrent caps, terminal decisions, rejection and audit checks. Pending/rejected/approved requests do not hide paid sales. |
| R39 | Physical receipt and quarantine; B2–B4 | Full physical receipt before controlled disposition | TESTED | Once-only full receipt, quarantine balance, disposition quantity limits; no batch/payment increase at acceptance/receipt. |
| R40 | Partial physical return receipt | No approved partial physical-receipt contract | PARTIAL | Full receipt only. Owner/pharmacist must accept procedure or approve incremental receipt/history before operational use requiring it. |
| R41 | Pharmacist-authorized restock; confirmed owner B2–B3 rules | Separate verified professional authorization, independent decision, suitability and expiry checks | TESTED | Explicit test-only qualified fixture, current authorization/revocation locks, original batch, expiry and once-only posting. Role alone grants no qualification. |
| R42 | Real professional onboarding and disposition SOP | Qualification must be verified; no invented production authorization | BLOCKED | No production authorization created. Evidence verification/onboarding/revocation ownership, staffing and clinical storage/disposition criteria need owner/pharmacist acceptance. |
| R43 | Automatic cash refunds/return revenue reversal; original SQL return-restock comment and WF monetary impact | Confirmed no-refund policy; no automatic sellable restock | OUT OF SCOPE | Returns preserve original cash history and enter quarantine. No cash refund, invented credit or automatic revenue reversal. This exclusion does not remove the required product-exchange workflow (R63). |
| R44 | Unified Approvals; WF MANAGEMENT, B1–B3 | Existing PO/Stock-In plus independently reviewed adjustments/returns/dispositions only | TESTED | Actionable states/history, current RBAC; no ordinary-sale approval queue; approved/rejected history remains readable. |
| R45 | Owner dashboard and daily/weekly/monthly sales; SRF Must Have, UC | Completed reconciled cash recognized immediately; Manager day/week, Admin full | TESTED | Manila filters/cohort and coverage; supported immutable version2 benefit net sales now included alongside regular cash sales. Pending/rejected/accepted returns never erase payments. Discounted profit basis and exchange settlement are separately unresolved. |
| R46 | Transaction-level reporting; WF MANAGEMENT, B5 | Real paid transactions, cashier, original tender/change, discount/VAT snapshots and return counts | TESTED | Admin view/export includes supported scheme/gross/discount/VAT-removed/VAT values from historical snapshots; parsed Excel/PDF totals match. Dedicated receipt-search filter and wireframe item-count column remain missing UI details, not fabricated data. |
| R47 | Best/slow-moving products grouped by medicine category; SRF §5 p2–3, UC/ARCH | Rank by reconciled units in selected period; explicit max-units slow-moving filter | TESTED | Best-selling and slow-moving dense ranks partition by current category, ties preserved, exact category filter, zero-sale slow products, consistent XLSX/PDF and RBAC. This is an explicit unit ranking, not an inferred turnover/profit score; owner acceptance remains pending. |
| R48 | Expiry/stock valuation/basic profit-margin reports; SRF §5, SQL | Basic estimates only; unknown costs withheld | TESTED | Existing report filters and verified receiving-cost evidence; no operating-expense/net-profit, historical inventory valuation or historical immutable cost claim. |
| R49 | Excel/PDF report exports; UC export + latest explicit decision; WF CSV | XLSX and PDF requested, authorized for Owner/Admin | TESTED | Eleven report types support both formats with shared filters/calculations, 10k cap, exact decimals, formula escaping and beneficiary omission. Fresh Chrome parses regular and discounted transaction exports. Not every report/format combination is a separate browser journey. CSV not required. |
| R50 | Accountability and Admin audit review; SRF §§5–6, SQL/UC/WF | Preserve actor/event/history and transaction audit atomicity | TESTED | Read-only searchable Admin audit, supported references, workflow histories, audit-failure rollback; global audit Chrome check. No DB-level tamper-proof certification or historical username snapshots. |
| R51 | Secure central database/controlled access; SRF §4, ARCH/DEP | Existing Express/Neon architecture, verified TLS, no production QA access | TESTED | Local TLS/IP/attestation checks, no production fallback, RBAC/CSRF; hosted TLS/network/proxy is separate and unverified. |
| R52 | Additive migrations/compatibility/rollback; SQL/ERDs, B2–B10 | Preserve 001/002/004; never production-apply without approval | PARTIAL | 001/002/004/003/007/008/009/011 pass disposable tests, including populated legacy/version1 preservation and uncommitted 011 rollback. 010 remains unapplied. Canonical 007/008 packaging corrected statically/copied-runtime; actual Docker and production runner/backup/restore rehearsal remain unverified. 011 is test-only, not production activation. |
| R53 | Scheduled backup/restore/hosting/network; SRF §§4,9, ARCH/DEP | Owner-approved topology and operational ownership required | BLOCKED | No host selected/certified by QA; no backup/restore drill performed. Database provider presence is not backup acceptance evidence. |
| R54 | CI/CD, handoffs/version control; SRF §9, PIPE | Preserve repo; no push/commit/deploy in this batch | PARTIAL | Local main and cached origin/main both at 43b3211; existing CI definition skips DB suites, no new hosted run or CD/deployment. Jira, peer-review/handoff and training completion not evidenced. |
| R55 | Production runtime/container packaging | Node >=24; one long-running API under one HTTPS origin | PARTIAL | Canonical 007/008 files narrowly included; copied runtime code passes real local schema checks and rejects missing/stale resources. Docker unavailable, so no actual Linux image/runtime certification. QA uses Node 24.22.3; shell default 22 remains unsupported. |
| R56 | Owner/pharmacist UAT and training; PIPE, SRF workflow/business value | Actual reviewers must evaluate working journeys and policy | BLOCKED | Automated synthetic Chrome evidence is not client acceptance, staff training or professional signoff. No signature or review session invented. |
| R57 | Reduced losses/time and improved performance; SRF §7 targets | Validate benefits during pilot; do not turn estimates into achieved outcomes | PARTIAL | No real-pharmacy outcome/time-saving study, peak-load benchmark or 1,500-product live performance acceptance conducted. |
| R58 | Product images/external image API | Latest confirmed no product-image requirement | OUT OF SCOPE | Optional existing image code/tests remain disabled; no 006/provider activation or real-provider certification. |
| R59 | Multi-branch, full accounting/payroll/CRM/BI/AI/mobile/legacy integration; SRF §8 | Explicit exclusions preserved | OUT OF SCOPE | No claim to deliver these capabilities. |
| R60 | Admin discount-rule management; SRF §6, UC/SQL/WF | Statutory rules require verified/versioned policy and pharmacy signoff first | BLOCKED | discounts table and prepared calculator exist; no activated Admin rule/classification editor or policy approval/onboarding workflow. A synthetic policy fixture is not an editable live rule. |
| R61 | Structured strength/dosage and additional product fields; WF Dialogs | Do not invent unsupported fields or classifications | PARTIAL | Product name/generic/category/price are supported; no separate strength/dosage column. Owner must accept names containing strength or approve a schema/form extension. |
| R62 | Expired Stock-In versus sellable inventory; WF receiving text, latest Batch 7 direction | Preserve compatible physical receipt recording; expired/today excluded from POS; no fake quarantine | TESTED | Recorded, within-date (expiry-only) and expired/today quantities separate; unknown data stays unknown. Expired receipts cannot be sold. Receiving rejection/clinical segregation SOP still needs owner/pharmacist acceptance; no new supplier quarantine lifecycle is claimed. |
| R63 | Product exchange fulfillment; explicit Batch 11 client no-refund/product-exchange-only policy | A returned product may require an approved replacement, without an automatic cash refund or automatic restocking | MISSING | Returns/decisions/quarantine exist, but no exchange-to-replacement sale/item/batch links, settlement ledger, equal/higher/lower-value rules, exchange idempotency, replacement FEFO posting or exchange financial reports. Do not approximate an exchange with an unrelated fully paid sale. Owner/accountant/pharmacist must approve settlement/benefit/quantity rules before additive implementation. |

## Decision reconciliation

| ID | Original/document position | Latest owner decision and current result |
|---|---|---|
| D01 | SRF names two desktop applications | One role-based web application confirmed; ARCH/DEP agree. No native deliverables required. |
| D02 | SQL sales comment and ARCH/DEP treat approved_by NULL as pending/excluded | Reconciled completed regular and supported version2 benefit cash sales recognized immediately. approved_by remains optional historical review; no fake approvals. Production benefit activation still blocked. |
| D03 | UC/DFD/WF show discount approval | Valid statutory checkout requires no routine approval; local benefit sales follow this rule. Exceptional review needs a separately defined workflow; production statutory activation remains blocked. |
| D04 | SQL says an approved return adds quantity back | Accepted return does not alter cash or sellable stock. Physical quarantine and separate professionally authorized disposition replace that unsafe automatic behavior. |
| D05 | WF includes Cash/GCash/Card | Cash only confirmed by owner and SQL/DEP; additional methods out of scope. |
| D06 | WF says 90 days and 90/60/30 reminders | Three calendar months in Manila implemented; configurable notification reminders remain a separate partial feature. |
| D07 | WF includes critical level, default values and percentage comparisons | Explicit reorder_level only; unset/zero preserved. No invented critical formula or trend comparison. |
| D08 | Role titles Manager/Pharmacist | Application role is not proof of verified professional qualification; separate authorization required for restocking. |
| D09 | SRF §6 bars Employee access to inventory adjustments; DFD associates stock adjustments with Manager | Accepted Batch 3 implementation allows authenticated Employee **requests**, with no approval/posting power. Owner must explicitly accept this operational distinction during UAT or authorize role restriction. No QA permission change was made. |
| D10 | General review wording may suggest universal two-person approvals | New adjustment/return/disposition decisions forbid self-approval; current PO/Stock-In self-approval remains as explicitly preserved. Adequate independent management staffing is an activation gate. |
| D11 | WF CSV export and net-after-discount/return cards | XLSX/PDF delivered per latest request. Original cash sales and separate return quantities shown; no invented refunds/credits/net revenue or unsupported accounting claims. |
| D12 | Original schema has only ID/discount flag and simple rates | Versioned scheme-specific eligibility, independent tax evidence, customer name/ID, pricing basis and immutable financial snapshots prepared via 009. None are inferred from every medicine being VATable/eligible. |
| D13 | ARCH/DEP show linked PO received states and backups | Current independent PO/Stock-In flow and operational backup plan do not fully implement those diagrams; remain partial/blocked rather than silently waived. |
| D14 | Receiving wireframe says expired stock cannot be received | Batch 7 implements clearly distinguished recorded physical stock and expiry-only availability, preserving POS/restock exclusion without inventing supplier quarantine or historical balances. Receiving SOP acceptance remains pending. |
| D15 | Earlier matrices grouped exchange accounting with excluded automatic refunds | Batch 11 explicitly confirms product exchange only. Cash refunds remain prohibited; exchange fulfillment is required and missing (R63), with settlement details unspecified. Existing return acceptance is not an exchange. |

## Nine clickable-reference findings

All nine images were reviewed qualitatively against source and actual Chrome evidence, not via a pixel-diff or owner visual signoff.

| Reference | Alignment | Intentional differences or open gaps |
|---|---|---|
| Access.png | Branding, split sign-in and real login tested | Role assigned by account, not selected to grant access. |
| OVERVIEW.png | Sidebar, dashboard cards/chart, alert/activity/product sections | No fake trends/critical metrics; real role-filtered data; three calendar months. Financial meanings differ as D02/D11. |
| OPERATIONS.png | Manual POS, receipt-linked returns, alerts and local-only Senior/PWD breakdown work | Production statutory checkout unavailable; no scanner/GCash/card/F2/F8 or product exchange. Local documentary fields and quarantine/history add workflow density. Product/batch search presentation differs. |
| INVENTORY.png | Product/batch/supplier/PO/stock-in/adjustment functions exist; searchable batch picker added | Product and batch views separate; supplier extra fields and complete received/partial-delivery PO lifecycle absent. Signed quantity retained with explicit help; expiry-only and recorded stock separated. |
| MANAGEMENT.png | Consolidated actionable approvals, date/export views and within-category best/slow rankings | Detail review replaces inline row dialogs; no routine sales/discount queue or fabricated return money impact. Current categories and explicit unit ranking are labeled. |
| ADMINISTRATION.png | Accounts, thresholds, audit and browser-local Admin reminder preferences work | No last-active/edit-role fields, critical level, active discount-rule editor or durable/global notification settings. Pharmacist qualification is separate from role. |
| cards.png | Real metric cards | Fixed 90-day, critical-stock and sample comparison values deliberately not copied. |
| Dialogs.png | Real forms/details/confirmations and historical discount/VAT receipt modal | Internal transaction confirmation only; some forms inline; no registered fiscal print layout, expected delivery/PO notes, role editor or discount-rule editor; F2/F8 shortcuts absent. |
| TGP Clickable Wireframe.png | Combined navigation/visual direction retained | Composite reference inherits the differences above; its sample transactions and identities are not production data requirements. |

## Release disposition

Ready for a **reviewed local checkpoint proposal and guarded synthetic owner/pharmacist/accountant UAT**. **Not ready for the full client-required live-pharmacy release**: exchange fulfillment is missing, statutory/fiscal production work and external approvals remain, and host/backup/restore/container acceptance is unverified. See [Batch 11 audit](BATCH11_RESULTS.md), [release gates](RELEASE_CHECKLIST.md) and [current unsigned walkthrough](BATCH11_UAT_WALKTHROUGH.md). No local commit or staging has been performed; owner approval is required before the proposed checkpoint.

