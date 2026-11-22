# Proposed Form B: Cloudinary Product-Image Integration

**PROJECT-OWNER APPROVAL RECORDED - IMPLEMENTATION AUTHORIZED; LIVE MIGRATION NOT AUTHORIZED**

The project owner approved this functional scope in the conversation: one optional product image; Manager/Admin upload, replace and remove; Employee viewing; Cloudinary hosting; nullable public-ID mapping on products; no POS pricing, FEFO, stock, or purchasing changes. This approval supersedes the original proposal wording below only for that scope. No adviser/instructor approval, signature, personal name, approval date, provider spending, migration execution, or deployment permission is inferred. Unspecified security/operational choices are conservative implementation defaults documented in `server/PRODUCT_IMAGES.md`, not previously approved business rules.

Draft prepared: 2026-11-20. Project: TGP Pharmacy Inventory and Sales Management System.

This is a proposed Form B document, not an official institutional template. No approved institutional template or prior completed approval was found when it was drafted. Transfer it to the official form if one is supplied. Project-owner implementation authorization is now recorded above and in Section 11. Blank names, dates, signatures, and other authority fields remain intentionally unfilled; they do not cancel or expand the expressly recorded owner approval. Provider spending, live migration execution, and deployment remain unauthorized.

## 1. Title, purpose, and justification

**Change title:** Optional product images through the Cloudinary external API.

Propose a small product-catalog enhancement that demonstrates an actual external API interaction for Phase 4 Week 15. Authorized staff could upload a product photograph and authenticated staff could view it beside product information. Images may help visual identification, but no measured business benefit or client demand is asserted. Names, prices, batches, and stock records remain authoritative; a photograph must not be used to infer medicine suitability, price, batch identity, or availability.

The official Week 15 schedule covers external API integration and Change Requests (Form B). Maps, SMS, and Payment are examples, not three mandatory integrations. Cloudinary was named in the user-specified technology stack, making it a reasonable candidate; acceptance as the Week 15 deliverable remains subject to instructor/client review.

## 2. Evidence and existing scope

| Source | Relevant finding |
| --- | --- |
| [Phase 1 System Request Form](../phase1/TGP_SystemRequestForm.pdf), Sections 5, 6, and 8 | Defines product/batch inventory, pricing, stock availability, and Employee/Manager/Admin permissions. Does not explicitly require product photographs. The original PDF is intentionally Git-ignored because it contains personal information; this link is available only where the local document exists. Do not attach or republish it as approval evidence without authorization. |
| [Phase 3 SQL](../phase3/tgp_database.sql) and [ERD](../phase3/TGP_ERD.png) | `products` has `product_id`, `name`, `generic_name`, `category`, `unit_price`, and `reorder_level`. No image field, image table, or image relationship is approved. |
| [Readiness audit](../PHASE4_READINESS_AUDIT.md) | Recommends considering Cloudinary and explicitly requires a mapping/scope decision. Its older Git/CI findings are historical; the user subsequently reported the first CI run passed. This proposal does not independently verify that hosted run. |
| [Official Phase 4 schedule](Screenshot%202026-11-20%20163015.png) | Week 15: external API integration and Form B. Week 16: CI/CD and cloud deployment; Week 17: QA, bug log, and user manual; Week 18: final defense/prototype presentation. |
| [Inventory documentation](../../server/INVENTORY.md), [RBAC documentation](../../server/AUTHENTICATION.md), and current source | Existing product forms, product APIs, parameterized repositories, active-account checks, trusted-request checks, and audit logging provide integration points. Module READMEs describe their original implementation phases; current POS and purchasing workflows already exist. |

**Existing approved scope:** catalog and batch management, documented role permissions, and existing stock/sales workflows.

**Changes proposed here:** product photographs, one-image cardinality, image-specific permissions, provider storage/mapping, lifecycle behavior, and upload limits. Existing product-management permission does not constitute prior approval for this enhancement.

This proposal excludes image galleries, batch images, customer/prescription/identity-document uploads, public registration, POS redesign, stock changes, payment changes, discounts, and a new approval workflow. It does not resolve other production blockers in the readiness audit.

## 3. Proposed integration and permissions

Propose **zero or one active image per existing product**. Images remain optional: creating, searching, receiving, or selling a product must not require one. Manage images after the product has been created, so an upload failure cannot roll back product creation or stock operations.

| Actor | Proposed image permissions |
| --- | --- |
| Active Employee | View the image alongside permitted product information; no upload, replacement, or removal. |
| Active Manager | View, upload, replace, and remove product images. |
| Active Admin | Same image permissions as Manager, with existing administrative/audit access retained. |
| Anonymous or inactive account | No image-management API access or product-page access. CDN delivery privacy is a separate decision below. |

These image permissions require explicit acceptance. No separate image-approval step is proposed. Server authorization remains authoritative even when controls are hidden in React.

Recommended flow: React sends a bounded multipart file to Express; Express validates the user, product, and file, then uploads it over HTTPS through the Cloudinary Node SDK. React receives only approved display information. Do not use an unrestricted unsigned browser upload preset or accept arbitrary remote image URLs as input.

## 4. Proposed image-reference mapping and database impact

**Preferred additive option, pending schema approval:** add one nullable `VARCHAR` product field, provisionally named `image_public_id`, holding the server-accepted Cloudinary public ID. Generate distinct asset IDs for uploads; do not intentionally share an asset across products. Derive the HTTPS delivery URL server-side from trusted provider configuration and the stored reference. Any need to store version, asset ID, or additional metadata must be justified in the migration review rather than silently added.

Effects if approved:

- Existing products have no image (`NULL`); no backfill or mandatory image is required.
- All 15 existing application tables, primary keys, foreign keys, and stock/financial relationships remain intact. No new table is proposed for the single-image scope.
- The column is nevertheless a change to the approved Phase 3 design. Use a separately reviewed, newly numbered migration after checking current history; do not edit baseline 001, its checksum, applied 002/004, or enable deferred 003/005.
- Review type, length, uniqueness/asset-ownership enforcement, rollback, and test-fixture changes before drafting the executable migration. The existing integration fixtures reconstruct the approved schema, so future tests must deliberately include the newly approved migration.
- Do not put references in `category`, product names, batch fields, or audit-log text as a substitute for the mapping. No binaries or credentials belong in PostgreSQL.

**No-schema-change possibility:** a server-controlled external public-ID convention tied to product IDs could map assets without a database column. This still creates a new relationship and lifecycle policy requiring approval. It complicates absence detection, stale cache handling, renames, reconciliation, and environment separation. It is not an approved workaround and is not the preferred explicit mapping.

The proposal alone created no migration. Following project-owner implementation approval, `server/database/migrations/proposed/006_product_images.sql` was prepared separately; it remains unapplied. See `server/PRODUCT_IMAGES.md` for the implementation defaults, migration review boundary, and actual validation results.

## 5. Proposed upload, replacement, removal, and display behavior

All behavior in this section is proposed, not established pharmacy policy.

1. **Upload:** authorize first, verify the product exists, validate one file, and upload a new asset. Persist its reference and the actor/product/action/timestamp audit event together in PostgreSQL. If saving or auditing fails, retain the previous reference and attempt cleanup of the newly uploaded orphan. Report failure safely.
2. **Replacement:** upload/validate a new distinct asset before changing the current reference. Use a brief database transaction and product-row lock with an expected-current-reference check to reject stale concurrent edits. Commit the reference and audit event, then clean up the previous asset. Provider latency must not hold stock locks or the existing global write lock for the duration of the upload.
3. **Removal:** propose clearing only the image reference with an audit event, leaving the product and its transactions untouched, then requesting deletion of the detached asset. The UI distinguishes removal from the product from confirmed provider cleanup. A cleanup failure is a recoverable operational issue, not permission to delete unrelated assets. Final retention/deletion policy needs approval.
4. **Failure recovery:** PostgreSQL and Cloudinary cannot commit atomically together. Define compensating cleanup, repeat-safe operations, bounded timeouts, and an operator reconciliation procedure. No new cleanup queue/table is assumed. If a durable cleanup mechanism is later necessary, return for design approval.
5. **Display:** initially propose thumbnails on the product catalog/editor only; no POS, report, or batch-screen expansion. Use accessible text and a neutral fallback for absent/broken images. Upload/removal states must be clear and image failures must not disable existing product/stock workflows.
6. **Deletion limitations:** removal must account for CDN caching and any provider backups. Do not promise immediate universal erasure. Decide cache invalidation and retention before implementation.

## 6. Security, privacy, credentials, validation, and cost

- Reuse cookie authentication, current active-account/role checks, exact trusted-origin/custom-header checks, safe errors, and existing audit logging. Check authorization before reading a large body or contacting the provider; recheck mutation authority when saving the reference.
- Resolve deletion/replacement assets from the server-owned product mapping. Never trust a browser-supplied asset identifier, cloud name, folder, upload options, or destination URL as deletion authority.
- Proposed initial formats: JPEG and PNG only. Provisional engineering limits for review: one file, at most 5 MiB, at most 4096 pixels per side and 16 million decoded pixels. These are candidate resource limits, not approved business rules; confirm before coding. Validate signatures and actual decoding, not just extension/MIME or browser `accept`. Reject SVG, animated/multipage files, malformed payloads, and decompression/resource abuse under this bounded scope.
- Strip unnecessary metadata, particularly location/author information. Do not retain original filenames containing personal information. Use product-package images only with permission/right to publish; reject prescriptions, IDs, faces, receipts, and customer data under this scope.
- Review upload rate/concurrency limits and temporary-file cleanup; bound memory and processing time. Apply necessary image-host CSP changes narrowly without weakening existing security headers broadly.
- Proposed server-only environment keys: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET`. No actual values belong in this proposal, code, examples, Git, client `VITE_*` variables, logs, or screenshots. Cloud name/API key are identifiers; keep the API secret confidential. Use separate development/test provider resources and an approved account/rotation owner. Existing production environment settings are not changed by this document.
- **Privacy decision:** public CDN delivery is simplest only for approved non-sensitive package images. Authenticated UI access does not make public CDN URLs private. If restricted delivery is required, reassess signed/authenticated delivery and its scope before implementation.
- Account ownership, plan, storage, bandwidth, transformation usage, quotas, alerts, and any spending limit must be approved. No free-tier sufficiency, fixed price, or paid subscription authorization is assumed. Real-provider testing can consume quota.
- Audit product ID, actor, action, and timestamp using existing logs; omit file bodies, tokens, credentials, and raw provider errors. Operational cleanup evidence must be redacted.

## 7. Impact and schedule

| Area | Proposed impact |
| --- | --- |
| Frontend | Extend `client/src/pages/Products.jsx` and product editor/components for thumbnail, file selection, progress/loading, success, validation, and failure states. Add multipart request support without breaking the current JSON helper. |
| Backend | Add bounded multipart handling, a Cloudinary service/configuration, protected product-image routes, validation, safe errors, and audit integration. Exact dependency versions and endpoint names require implementation review. |
| Database | Preferred nullable product-reference column only after separate approval; update repository projections and schema documentation. Preserve existing migration history. |
| Tests | Add provider-mocked tests, isolated schema/mapping tests, authorization/lifecycle/concurrency/failure tests, and real-provider sandbox evidence. Preserve authentication, inventory, purchasing, POS/FEFO, and reporting regressions. |
| Documentation | Update API/Postman examples, environment placeholders, ERD/schema amendment notes, module README, manual screenshots, recovery instructions, test evidence, and this decision record. Never publish secrets or the original private SRF. |
| Week 15 | Obtain Form B/scope approval, then separately approve mapping/migration; implement and demonstrate a real external API response plus handled failure. Completion depends on approvals and test-account availability. |
| Weeks 16-18 | Carry approved configuration into later deployment planning; include lifecycle defects in Week 17 bug logging/user manual and accepted API evidence in Week 18 demonstration. This request does not authorize deployment or change the official schedule. |

Effort estimate, owner assignments, target dates, and any schedule trade-off remain blank until the team confirms scope and capacity. Do not displace core pharmacy requirements without explicit prioritization. The existing green CI run does not cover this unimplemented feature; current CI skips the five PostgreSQL integration suites.

## 8. Alternatives

| Alternative | Benefit | Limitation / approval needed |
| --- | --- | --- |
| Preferred single nullable product reference | Explicit optional mapping; no new table; controlled replacement/removal | Requires approved additive migration and lifecycle policy. |
| External deterministic asset naming | Could avoid a product-schema migration | Still needs relationship approval and reconciliation design; not a hidden bypass. |
| Approved SMS or email staff alert service | Could demonstrate an external API using existing low-stock/expiry query data without a product-image schema change | SRF describes email/SMS only if time allows. Confirm recipients, consent, trigger/manual-send scope, duplicate-send controls, cost, credentials, and evidence; durable notification requirements may need further design. Vendor and workflow are not selected here. |
| Defer product images and select another justified external service | Avoids premature schema or photo-management scope | Week 15 deliverable still needs an accepted integration. Maps lacks a documented branch use case; payment integration would expand cash-only POS with unsettled settlement/refund requirements. |

Do not implement all schedule examples merely to demonstrate breadth. No alternative is approved by inclusion in this table.

## 9. Proposed acceptance criteria and verification plan

These are acceptance criteria for the proposed scope if approved. They are not completed tests.

| ID | Acceptance criterion | Planned evidence |
| --- | --- | --- |
| AC-01 | Approved Form B scope, mapping, privacy, limits, permissions, and account/cost decisions exist before coding. Migration execution has its own authorization. | Reviewed decision record; no inferred/backdated approval. |
| AC-02 | Products may have no image or one active image; image absence never blocks existing catalog/stock/POS operations. | UI/component and isolated integration tests. |
| AC-03 | Active Manager/Admin can upload/replace/remove; Employee can only view; anonymous/inactive accounts are denied. Cross-product arbitrary-asset deletion is rejected. | Actual API authorization, CSRF, and tampering tests. |
| AC-04 | Valid files succeed; invalid type/content, oversize/dimensions, multiple files, and malformed uploads fail safely before reference changes. No credentials or private metadata are returned/logged. | Validation and redaction tests using synthetic fixtures. |
| AC-05 | Only the approved product reference changes; reference update and audit write commit/roll back together. Existing tables' stock, prices, sales, and migration checksums remain correct. | Isolated PostgreSQL tests against approved migrations; before/after checks. |
| AC-06 | Upload failure leaves current image intact; database/audit failure after upload triggers orphan cleanup; replacement/removal cleanup failures remain visible and recoverable. | Provider fault injection, rollback, retry, concurrency, and operator-recovery tests. |
| AC-07 | Concurrent stale edits cannot silently replace the wrong current reference or delete the newly selected asset. | Concurrent isolated API/database tests. |
| AC-08 | Display is responsive and accessible, with clear pending/error/empty/success states and broken-image fallback. | React tests plus real-browser visual/E2E checks for all three roles. |
| AC-09 | An approved sandbox account demonstrates real upload, delivery, and deletion API responses plus a handled failure. Evidence is redacted; cached/backup deletion limitations are stated. | Postman or equivalent recorded API evidence and manual reconciliation. No provider calls from untrusted PR CI. |
| AC-10 | Existing backend/frontend regressions, lint, and production build pass. Required database/provider checks actually run in isolated environments or are explicitly reported skipped. | Exact command results, CI links, test environment description, bug/retest log. |

Provider-mocked CI checks must require no real secrets. Run real-provider acceptance separately with approved sandbox credentials and synthetic, non-sensitive package images, then remove only task-owned assets. Do not run fixtures against production Neon. No acceptance result, production readiness, or Week 15 completion is claimed by this document.

## 10. Unresolved decisions and implementation gate

Before implementation, record decisions on: acceptance of Cloudinary as the Week 15 integration; one optional image; permission matrix; nullable-column versus external mapping; final schema constraints and rollback; permitted file limits; public/restricted delivery; photo ownership and metadata; replacement/removal/retention/cache policy; orphan cleanup/reconciliation responsibility; concurrent edit behavior; account/quota/budget ownership; evidence requirements; staffing and schedule.

Current authorized step: implement and test the project-owner-approved functional scope. Migration preparation is authorized; execution against live Neon requires separate confirmation after the migration is reported. Adviser/instructor acceptance of the Week 15 deliverable, provider account/cost ownership, production suitability, and any policy decisions outside that functional scope remain unresolved.

## 11. Approval record - project owner only

| Field | Entry |
| --- | --- |
| Requester | |
| Request date | |
| Reviewer | |
| Reviewer role / authority | |
| Decision (approve / reject / revise) | Project-owner functional implementation approval recorded from conversation. Adviser/instructor decision not supplied. |
| Decision date | |
| Conditions / required revisions | |
| Approved scope and selected mapping | One optional Cloudinary image per product; nullable public-ID mapping; Manager/Admin management and Employee viewing. No pricing, FEFO, stock, or purchasing changes. |
| Migration review / execution authorization reference | |
| Account owner / cost authorization reference | |
| Signature or approval-record reference | |

**Current status: PROJECT-OWNER APPROVAL ONLY. Dates and signatures remain blank. Live migration execution requires separate confirmation.**
