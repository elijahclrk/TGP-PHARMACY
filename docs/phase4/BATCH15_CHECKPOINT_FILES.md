# Batch 15 — exact proposed local checkpoint

Owner approval pending. Nothing staged or committed. Base: `d4c289edabb553ed54dfde507dc84af479cc99d8` on main.

**83 paths: 47 modified tracked, 36 new.** Accumulated Batches 12–15 only.

Proposed subject: `feat: checkpoint local exchanges, operational completion and MVP handoff`.

The companion SHA-256 manifest covers raw working-tree bytes; Git may normalize line endings. Its self-entry is intentionally unhashed. Any changed content or extra/missing path invalidates this reviewed inventory. See BATCH15_RESULTS.md for scan findings, exclusions and unresolved release gates. This list authorizes no staging, commit, push, migration or activation.

Excluded: environment/academic credentials, original private request PDF, real identities, temporary PostgreSQL data, private manifests, keys/certificates and generated browser/build/export artifacts. Explicit synthetic fixture recipes are intentional source.

| Status | Reviewed path |
|---|---|
| Modified | `.dockerignore` |
| Modified | `Dockerfile` |
| Modified | `client/src/accounts/AccountDetails.jsx` |
| New | `client/src/accounts/AccountEdit.jsx` |
| Modified | `client/src/index.css` |
| Modified | `client/src/inventory/ProductForm.jsx` |
| Modified | `client/src/inventory/inventory.test.jsx` |
| New | `client/src/inventory/useOperations.js` |
| Modified | `client/src/notifications/preferences.js` |
| Modified | `client/src/pages/Approvals.jsx` |
| Modified | `client/src/pages/ControlledWorkflows.jsx` |
| Modified | `client/src/pages/Notifications.jsx` |
| Modified | `client/src/pages/Pos.jsx` |
| Modified | `client/src/pages/Products.jsx` |
| Modified | `client/src/pages/Purchasing.jsx` |
| Modified | `client/src/pages/Users.jsx` |
| New | `client/src/purchasing/LinkedReceiving.jsx` |
| New | `client/src/purchasing/OrderOperations.jsx` |
| Modified | `client/src/purchasing/PurchasingForm.jsx` |
| New | `client/src/purchasing/operations.test.jsx` |
| Modified | `client/src/purchasing/purchasing.test.jsx` |
| New | `client/src/reports/HistoricalTransaction.jsx` |
| Modified | `client/src/reports/ReportPanel.jsx` |
| New | `client/src/workflows/Exchanges.jsx` |
| New | `client/src/workflows/Exchanges.test.jsx` |
| New | `docs/phase4/BATCH12_EXCHANGE_RESEARCH.md` |
| New | `docs/phase4/BATCH12_EXCHANGE_TECHNICAL_SPEC.md` |
| New | `docs/phase4/BATCH12_EXCHANGE_VALIDATION_CHECKLIST.md` |
| New | `docs/phase4/BATCH13_RESULTS.md` |
| New | `docs/phase4/BATCH14_RESULTS.md` |
| New | `docs/phase4/BATCH15_ACCEPTANCE_CHECKLIST.md` |
| New | `docs/phase4/BATCH15_CHECKPOINT_FILES.md` |
| New | `docs/phase4/BATCH15_CHECKPOINT_MANIFEST.json` |
| New | `docs/phase4/BATCH15_RELEASE_PLAN.md` |
| New | `docs/phase4/BATCH15_RESULTS.md` |
| Modified | `docs/phase4/FINAL_REQUIREMENTS_MATRIX.md` |
| Modified | `docs/phase4/RELEASE_CHECKLIST.md` |
| Modified | `docs/phase4/UAT_CHECKLIST.md` |
| New | `server/database/migrations/proposed/batch13/012_local_product_exchanges.sql` |
| New | `server/database/migrations/proposed/batch14/013_operational_completion.sql` |
| Modified | `server/src/app.js` |
| Modified | `server/src/middleware/auth.js` |
| Modified | `server/src/middleware/error-handler.js` |
| Modified | `server/src/repositories/auth.repository.js` |
| New | `server/src/repositories/exchanges.repository.js` |
| Modified | `server/src/repositories/inventory.repository.js` |
| New | `server/src/repositories/operations.repository.js` |
| Modified | `server/src/repositories/pos.repository.js` |
| Modified | `server/src/repositories/purchasing.repository.js` |
| Modified | `server/src/repositories/reports.repository.js` |
| Modified | `server/src/routes/auth.routes.js` |
| New | `server/src/routes/exchanges.routes.js` |
| Modified | `server/src/routes/inventory.routes.js` |
| New | `server/src/routes/operations.routes.js` |
| Modified | `server/src/routes/purchasing.routes.js` |
| Modified | `server/src/routes/reports.routes.js` |
| Modified | `server/src/services/accounts.js` |
| Modified | `server/src/services/auth-validation.js` |
| New | `server/src/services/exchange-validation.js` |
| Modified | `server/src/services/inventory-validation.js` |
| Modified | `server/src/services/prepared-workflows.js` |
| Modified | `server/src/services/purchasing-validation.js` |
| Modified | `server/src/services/report-exports.js` |
| Modified | `server/src/services/report-validation.js` |
| Modified | `server/src/services/sessions.js` |
| Modified | `server/test/auth.integration.test.js` |
| New | `server/test/checkpoint-review.test.js` |
| New | `server/test/exchanges.integration.test.js` |
| New | `server/test/exchanges.test.js` |
| Modified | `server/test/local-demo.test.js` |
| New | `server/test/operations.integration.test.js` |
| New | `server/test/support/exchange-fixture.js` |
| Modified | `server/test/support/packaged-workflow-fixture.js` |
| Modified | `server/test/workflow-design.test.js` |
| New | `server/testing/batch13-browser.mjs` |
| New | `server/testing/batch14-browser.mjs` |
| New | `server/testing/batch15-browser.mjs` |
| Modified | `server/testing/batch4-uat.mjs` |
| Modified | `server/testing/local-demo.mjs` |
| New | `server/testing/local-exchange-runtime.mjs` |
| New | `server/testing/local-operations-runtime.mjs` |
| Modified | `server/testing/local-uat-app.mjs` |
| New | `server/testing/review-checkpoint.mjs` |
