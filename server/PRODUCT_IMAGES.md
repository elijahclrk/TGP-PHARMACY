# Product images: project-owner-approved feature, live migration pending

Authority: [Form B](../docs/phase4/FORM_B_CLOUDINARY_PROPOSAL.md) records project-owner approval from the conversation only. No personal name, signature, approval date, adviser/instructor approval, paid-provider authorization, or deployment approval is inferred. The approved scope is one optional Cloudinary image per product, Manager/Admin management, Employee viewing, and nullable public-ID mapping. POS pricing, FEFO, stock, purchasing, and historical migrations are unchanged.

## Deployment boundary

**Migration 006 is prepared, NOT applied. No live Neon query or mutation was performed for this task.** Existing image-independent product APIs continue unchanged. Images are disabled unless the operator explicitly sets `PRODUCT_IMAGES_ENABLED=true` and supplies provider configuration after migration execution is separately approved. Missing provider configuration returns `enabled:false`; enabled endpoints with no image column return a safe 503. Do not enable against the existing application schema yet.

The project-owner approval allows implementation and migration preparation. It does not approve execution of `database/migrations/proposed/006_product_images.sql`. This file adds only:

- `products.image_public_id VARCHAR(255) NULL`; existing rows remain NULL.
- A CHECK restricting non-NULL references to this application's generated `tgp/product-images/<UUID-v4>` namespace.
- A partial unique index preventing two products from sharing a non-NULL image reference. This supports safe ownership/deletion and single-image mapping.

No new table, FK, data backfill, default image, or changes to prices/quantities are included. Schema relationships and all 15 application tables remain. The file is transactional and uses a five-second lock timeout. It deliberately fails on accidental reapplication rather than silently accepting an unexpected definition. Reapplication should be skipped by checksum-aware tracking in the future approved execution procedure.

Current prepared-file SHA-256: `1ab98fd9108771a172da13d7a62b4a050a6f28e372bbbcd0c68e427b6a721efa`. Recompute against the exact reviewed bytes before any execution, including after Git checkout/line-ending conversion. Baseline 001 retains its expected `beb63ee013b74b7d3bde6e6f1d24adaccf7b2ca01dfa2beab7252e4a5c05ead2` checksum; 002/004 are unchanged. Deferred 003/005 remain unexecuted.

**Do not run the historical apply-baseline/apply-integrity runners for 006.** They are intentionally allowlisted to older initialization migrations. A future approved execution step must verify the current schema/history and checksum, obtain appropriate locks, execute 006 and record `(version,checksum,applied_at)` in `public.tgp_schema_migrations` atomically in a reviewed transaction, then verify the column/check/index and repeat-safe history lookup. Do not run the file and tracking INSERT as separate commits. No new runner or live application command was executed here. Reversal would remove image mappings and needs its own reviewed backup/asset-cleanup plan; no automatic destructive down migration is supplied.

## Conservative implementation defaults

These are engineering defaults selected for this implementation under the owner's instruction, not previously approved or permanent pharmacy business rules. Review before enabling the feature in a shared environment.

| Detail | Default |
| --- | --- |
| Delivery privacy | Explicit opt-in to PUBLIC Cloudinary delivery of non-sensitive package images. Logged-in UI access does not make CDN URLs private. Keep disabled if this is unsuitable. |
| File formats | One JPEG/PNG, maximum 5 MiB input and normalized output. Actual signature and full decode required; MIME/extension alone is insufficient. No SVG, GIF, APNG or multipage images. |
| Decoded dimensions | At most 4096 pixels per side and 16 million pixels. Sharp decoding/re-encoding strips original metadata, rotates using orientation, and emits JPEG at quality 85. Transparency is flattened by JPEG conversion; review suitability for package photography. |
| Resource controls | Two active mutations maximum per API process; ten mutation attempts per authenticated user per fifteen minutes; fifteen-second upload socket/provider idle timeouts, five-second image processing timeout. Existing single-process/session constraints still apply. These are bounded controls, not an absolute end-to-end request deadline. |
| Asset identity | Random server-generated UUID, application namespace, no original filename or personal data. A new asset ID for each upload; no overwrite/shared assets. |
| Display | Product catalog only, 160-pixel bounded Cloudinary thumbnail, accessible description, lazy image loading and absent/broken-image fallback. At most the current paginated product page issues per-product image-status requests. No POS/batch/report thumbnails. |
| Removal | Detach mapping with audit first, then request provider deletion with CDN invalidation. Cached/backup copies may remain; immediate universal erasure is not promised. |

Product photos must be authorized for publication. The decoder validates an image, not its semantic content: it cannot automatically recognize prescriptions, faces, IDs, customer records, or copyrighted content. Operators must not upload these. Ownership/privacy review, account owner, quotas, spend limits, backup/retention policy, and adviser/instructor Week 15 acceptance remain unresolved. No free plan or paid plan is assumed sufficient.

## Configuration and API

Placeholder keys are in `.env.example`; the actual `.env` was not edited. Required server-only settings after separate authorization: `PRODUCT_IMAGES_ENABLED=true`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`. Cloud name/key are identifiers; the API secret is confidential. Never put credentials in `VITE_*`, Git, source, responses, test fixtures, logs, or screenshots. Prefer a dedicated test Cloudinary environment before live use. Native Sharp dependencies must install successfully on the deployment OS.

All paths are under `/api`. Existing cookie authentication, active-account checks, trusted Origin and `X-TGP-Request: 1` apply. Employee can GET only; Manager/Admin can mutate. Body parsing/upload happens after authorization and rate/concurrency checks.

| Method | Path | Body / result |
| --- | --- | --- |
| GET | `/products/:id/image` | `{success:true,data:{enabled,image}}`; `image` is NULL or `{public_id,url}`. |
| PUT | `/products/:id/image` | Multipart: one `image` file and exactly one `expected_image` text field (empty for no current image, otherwise current public ID). Returns the current image and `cleanup_pending`. |
| DELETE | `/products/:id/image` | JSON: exactly `{expected_image:"..."}`; empty for no image. Removes only that product's current mapping; returns NULL image and `cleanup_pending`. |

Never submit arbitrary asset IDs as upload destinations/deletion targets. `expected_image` is only a concurrency precondition: deletion uses the server-read product reference. Invalid/stale fields return 400/409; RBAC returns 401/403; missing products 404; rate limiting 429; provider failures 502; unavailable schema/configuration or uncertain DB outcomes 503. Errors omit raw provider, connection and file details. On uncertainty the UI hides mutation controls until the cashier/operator reloads image status. Provider downtime does not affect other product/stock APIs.

React's shared HTTP helper now supports FormData without forcing a JSON Content-Type, while preserving CSRF/cookie handling. Express CSP allows the Cloudinary delivery host in `img-src`; any future host serving `client/dist` must apply compatible document CSP as well. No frontend secrets or unsigned public upload preset are used.

## Transactions, concurrency, and recovery

The existing transaction/advisory-lock mechanism and product-row locking serialize reference checks/updates; provider calls occur outside those locks. Before upload, an intent event is durably written to existing `activity_logs` with actor, product, server asset ID and timestamp. Save/remove mapping and their audit event commit together. The endpoint rechecks account status/role after the potentially slow upload. A stale expected reference fails rather than overwriting someone else's image.

After a known reference-save failure, compensation waits for the shared transaction lock and rereads the mapping under a row lock before removing a detached new asset. If COMMIT may have succeeded, the referenced image is never automatically destroyed. If database state cannot be established, leave the asset for reconciliation. Provider upload timeout can likewise mean an asset exists: preserve the intent instead of assuming nothing was uploaded.

Old-asset deletion failure does not undo the committed mapping. The response explicitly sets `cleanup_pending:true`; intent/save/remove audit events retain the IDs needed for follow-up. There is no distributed transaction and no background cleanup queue/table. A process crash can leave an orphan or cleanup pending without a browser response.

**Operator reconciliation (not an implemented automatic worker):** use authorized audit access/database read-only tooling to identify image intents and changed references. Cross-check against all current product references and the dedicated provider environment before touching an asset. Never delete a currently referenced asset or one outside this task's namespace; an unmatched intent alone is not proof that a delayed upload/transaction has finished. Confirm outstanding operations have settled, then use approved provider tooling to retry cleanup of detached assets and record redacted maintenance evidence. Ambiguous states require operator investigation. Do not invent an account, sample business record, or application cleanup table. Durable automated cleanup/retention needs a separately reviewed design if required.

## Validation and remaining gaps

Actual local validation for this implementation:

- Backend: **28 passed, 0 failed, 6 PostgreSQL integration suites skipped**, 34 total reported tests. Includes 15 new image decoder/provider-boundary/API/repository tests using real local HTTP, real Sharp decoding, and injected provider/database doubles.
- Image scenarios: auth/inactive/RBAC/CSRF; upload/replace/remove; invalid files and dimensions; metadata stripping; forged/extra fields/multiple files; provider failure; audit rollback; stale concurrent replacement; deactivation during upload; lost COMMIT acknowledgement; cleanup warning; rate limit; absent migration.
- Frontend: **41 passed across 7 files**, 0 failed. Includes six new image UI/multipart tests and the existing module regressions. Frontend lint and production build passed.
- Real Cloudinary upload/delivery/deletion **not run**: no approved sandbox credentials, account ownership, or spending authorization was provided. Provider lifecycle tests use doubles, not live provider evidence. Week 15 external API demonstration remains incomplete until that verification.
- Real PostgreSQL **not run**: Docker daemon is unavailable; no independently provisioned disposable TLS test database was supplied. The five historical suites and new image migration suite were explicitly disabled. Unit doubles do not establish PostgreSQL locking, constraint or transactional correctness.
- `test/product-images.integration.test.js` is a new opt-in rollback-only isolated-schema suite for baseline + 006, nullable mapping, uniqueness/format rejection, stale edits, reapplication rejection and audit rollback. It requires `RUN_IMAGE_DB_TESTS=1`, `IMAGE_TEST_DATABASE_APPROVED=true`, and `IMAGE_TEST_DATABASE_URL`; it NEVER falls back to operational `DATABASE_URL`. SQL runtime validation remains pending. Historical suites remain compatible because their code/schema paths were unchanged.
- No real-browser visual/E2E or semantic-content moderation certification is claimed. CI was updated to explicitly skip the sixth DB suite; a hosted run for these new changes has not been performed.

The SQL received static review only. Before activation, run the new suite against a genuinely disposable TLS database, run the historical database regressions on an appropriately initialized isolated test database, complete real-provider sandbox tests and browser QA, confirm operational defaults, and obtain separate approval for live migration execution. No production-ready or completed Week 15 claim is made.
