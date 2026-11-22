# Batch 11  exact proposed local Git checkpoint

Date: 22 November 2026, Asia/Manila. **OWNER APPROVAL PENDING. Nothing staged or committed.**

Base HEAD: 43b321101d04775ee27394e21773b279b45856b4 on main. Proposed contents: **159 paths (59 modified tracked; 100 new/untracked)**. This list covers accumulated Batches 110 plus the nine Batch 11 audit/ignore artifacts, not just newly implemented code.

Recommended subject: `feat: checkpoint protected pharmacy workflows and local benefit checkout`.

The [manifest](BATCH11_CHECKPOINT_MANIFEST.json) records raw working-tree SHA-256 values; its own hash is intentionally omitted. Git may normalize LF/CRLF. Approval applies only to this exact reviewed content. If any path/content changes, refresh the inventory, review and hashes first. No blanket staging, commit, push or deployment command is executed here.

Excluded: local .env/academic accounts, original personal request PDF, private test credentials/manifests, PG cluster/data/TLS files, dependencies, generated build/browser screenshots/logs/downloads and ignored tmp evidence. Test fixture recipes (explicit synthetic inputs) are retained as reviewed source, not exported rows or actual customer data. The Noto Sans font and OFL/provenance are deliberately included for offline PDF generation.

## Exact path list

| Git checkpoint status | Path |
| --- | --- |
| Modified | `.dockerignore` |
| Modified | `.gitignore` |
| Modified | `Dockerfile` |
| Modified | `client/src/App.jsx` |
| Modified | `client/src/App.test.jsx` |
| Modified | `client/src/auth/AuthProvider.jsx` |
| Modified | `client/src/auth/api.js` |
| Modified | `client/src/components/Workspace.jsx` |
| Modified | `client/src/components/layout.test.jsx` |
| Modified | `client/src/inventory/inventory.test.jsx` |
| Modified | `client/src/inventory/shared.jsx` |
| New | `client/src/notifications/preferences.js` |
| New | `client/src/notifications/preferences.test.jsx` |
| New | `client/src/pages/Alerts.jsx` |
| New | `client/src/pages/Approvals.jsx` |
| New | `client/src/pages/ControlledWorkflows.jsx` |
| Modified | `client/src/pages/Inventory.jsx` |
| New | `client/src/pages/Notifications.jsx` |
| Modified | `client/src/pages/Pos.jsx` |
| Modified | `client/src/pages/Products.jsx` |
| Modified | `client/src/pages/Purchasing.jsx` |
| New | `client/src/pages/ReorderThresholds.jsx` |
| New | `client/src/pages/core-management.test.jsx` |
| Modified | `client/src/pos.test.jsx` |
| Modified | `client/src/reports/DashboardSummary.jsx` |
| Modified | `client/src/reports/ReportPanel.jsx` |
| Modified | `client/src/reports/reports.test.jsx` |
| New | `client/src/workflows/BatchPicker.jsx` |
| New | `client/src/workflows/BenefitCheckout.jsx` |
| New | `client/src/workflows/BenefitCheckout.test.jsx` |
| New | `client/src/workflows/BenefitPreparation.jsx` |
| New | `client/src/workflows/WorkflowDetails.jsx` |
| New | `client/src/workflows/WorkflowGate.jsx` |
| New | `client/src/workflows/benefit-draft.js` |
| New | `client/src/workflows/time.js` |
| New | `client/src/workflows/time.test.js` |
| New | `client/src/workflows/useWorkflowCapabilities.js` |
| New | `client/src/workflows/workflows.test.jsx` |
| Modified | `docs/BUG_LOG.md` |
| Modified | `docs/DEPLOYMENT.md` |
| Modified | `docs/PHASE4_READINESS_AUDIT.md` |
| Modified | `docs/USER_MANUAL.md` |
| New | `docs/phase4/BATCH10_RESULTS.md` |
| New | `docs/phase4/BATCH11_CHECKPOINT_FILES.md` |
| New | `docs/phase4/BATCH11_CHECKPOINT_MANIFEST.json` |
| New | `docs/phase4/BATCH11_RESULTS.md` |
| New | `docs/phase4/BATCH11_UAT_WALKTHROUGH.md` |
| New | `docs/phase4/BATCH2_PREPARATION.md` |
| New | `docs/phase4/BATCH3_RESULTS.md` |
| New | `docs/phase4/BATCH4_RESULTS.md` |
| New | `docs/phase4/BATCH5_RESULTS.md` |
| New | `docs/phase4/BATCH6_QA_RESULTS.md` |
| New | `docs/phase4/BATCH7_OPERATIONAL_RULES.md` |
| New | `docs/phase4/BATCH7_RESULTS.md` |
| New | `docs/phase4/BATCH7_UAT_WALKTHROUGH.md` |
| New | `docs/phase4/BATCH8_CLIENT_WALKTHROUGH.md` |
| New | `docs/phase4/BATCH8_DEMO_HANDOFF.md` |
| New | `docs/phase4/BATCH8_RESULTS.md` |
| New | `docs/phase4/BATCH9_SENIOR_PWD_RESEARCH.md` |
| New | `docs/phase4/BATCH9_SENIOR_PWD_TECHNICAL_SPEC.md` |
| New | `docs/phase4/BATCH9_VALIDATION_CHECKLIST.md` |
| New | `docs/phase4/DEVELOPMENT_BATCH1_DESIGN.md` |
| New | `docs/phase4/DEVELOPMENT_BATCH1_RESULTS.md` |
| New | `docs/phase4/FINAL_REQUIREMENTS_MATRIX.md` |
| New | `docs/phase4/LOCAL_POSTGRES_TEST_RESULTS.md` |
| New | `docs/phase4/RELEASE_CHECKLIST.md` |
| New | `docs/phase4/UAT_CHECKLIST.md` |
| Modified | `docs/phase4/WIREFRAME_ALIGNMENT.md` |
| Modified | `server/INVENTORY.md` |
| Modified | `server/POS.md` |
| Modified | `server/PURCHASING.md` |
| Modified | `server/REPORTS.md` |
| Modified | `server/database/README.md` |
| Modified | `server/database/migrations/proposed/003_return_sale_item_link.sql` |
| New | `server/database/migrations/proposed/batch1/007_decision_workflows.sql` |
| New | `server/database/migrations/proposed/batch1/008_return_dispositions.sql` |
| New | `server/database/migrations/proposed/batch1/009_discount_financial_snapshots.sql` |
| New | `server/database/migrations/proposed/batch1/workflow-policy.mjs` |
| New | `server/database/migrations/proposed/batch10/011_local_benefit_checkout.sql` |
| New | `server/database/migrations/proposed/batch7/010_in_app_notification_preferences.sql` |
| Modified | `server/database/validate-proposals.mjs` |
| Modified | `server/demo/workflows.mjs` |
| Modified | `server/package-lock.json` |
| Modified | `server/package.json` |
| Modified | `server/src/app.js` |
| New | `server/src/assets/fonts/NotoSans.ttf` |
| New | `server/src/assets/fonts/OFL.txt` |
| New | `server/src/assets/fonts/README.md` |
| Modified | `server/src/repositories/inventory.repository.js` |
| New | `server/src/repositories/local-benefits.repository.js` |
| Modified | `server/src/repositories/pos.repository.js` |
| Modified | `server/src/repositories/purchasing.repository.js` |
| Modified | `server/src/repositories/reports.repository.js` |
| New | `server/src/repositories/workflows.repository.js` |
| Modified | `server/src/routes/pos.routes.js` |
| Modified | `server/src/routes/reports.routes.js` |
| New | `server/src/routes/workflows.routes.js` |
| New | `server/src/scripts/verify-batch1-readonly.js` |
| New | `server/src/services/benefit-preparation.js` |
| New | `server/src/services/expiry-policy.js` |
| Modified | `server/src/services/inventory-validation.js` |
| New | `server/src/services/local-benefit-calculation.js` |
| New | `server/src/services/pos-quotes.js` |
| Modified | `server/src/services/pos-validation.js` |
| New | `server/src/services/prepared-benefits.js` |
| New | `server/src/services/prepared-workflows.js` |
| Modified | `server/src/services/purchasing-validation.js` |
| New | `server/src/services/report-exports.js` |
| Modified | `server/src/services/report-validation.js` |
| New | `server/src/services/verified-benefit-quotes.js` |
| New | `server/src/services/workflow-validation.js` |
| Modified | `server/test/accounts-http.test.js` |
| New | `server/test/approvals-http.test.js` |
| Modified | `server/test/audit.test.js` |
| Modified | `server/test/auth-http.test.js` |
| Modified | `server/test/auth.integration.test.js` |
| New | `server/test/benefit-preparation.test.js` |
| New | `server/test/container-packaging.test.js` |
| Modified | `server/test/database.test.js` |
| New | `server/test/disposable-database.test.js` |
| New | `server/test/expiry-policy.test.js` |
| Modified | `server/test/frontend-serving.test.js` |
| Modified | `server/test/inventory-validation.test.js` |
| Modified | `server/test/inventory.integration.test.js` |
| New | `server/test/local-benefit-calculation.test.js` |
| New | `server/test/local-benefit-migrations.integration.test.js` |
| New | `server/test/local-benefits-http.test.js` |
| New | `server/test/local-benefits.integration.test.js` |
| New | `server/test/local-demo.test.js` |
| New | `server/test/local-http.test.js` |
| Modified | `server/test/pos-recovery.test.js` |
| Modified | `server/test/pos.integration.test.js` |
| New | `server/test/prepared-benefits.test.js` |
| New | `server/test/prepared-workflows.integration.test.js` |
| New | `server/test/prepared-workflows.test.js` |
| Modified | `server/test/product-images.integration.test.js` |
| Modified | `server/test/product-images.test.js` |
| Modified | `server/test/purchasing.integration.test.js` |
| New | `server/test/report-exports.test.js` |
| Modified | `server/test/reports.integration.test.js` |
| New | `server/test/support/benefit-fixture.js` |
| New | `server/test/support/disposable-database.js` |
| New | `server/test/support/packaged-workflow-fixture.js` |
| New | `server/test/support/workflow-fixture.js` |
| New | `server/test/thresholds-http.test.js` |
| New | `server/test/verified-benefit-quotes.test.js` |
| New | `server/test/workflow-design.test.js` |
| New | `server/test/workflow-migrations.integration.test.js` |
| New | `server/test/workflows-http.test.js` |
| New | `server/testing/batch10-browser.mjs` |
| New | `server/testing/batch11-checkpoint.mjs` |
| New | `server/testing/batch4-browser.mjs` |
| New | `server/testing/batch4-uat.mjs` |
| New | `server/testing/local-benefit-runtime.mjs` |
| New | `server/testing/local-demo.mjs` |
| New | `server/testing/local-http.mjs` |
| New | `server/testing/local-postgres.mjs` |
| New | `server/testing/local-uat-app.mjs` |
| New | `server/testing/verify-uat.mjs` |

Review the [consolidated audit](BATCH11_RESULTS.md) for secret-scan dispositions, missing product exchange and separate production/statutory/fiscal/UAT gates. Approval of a local checkpoint grants no production authorization.
