# Final academic submission and presentation checklist

Finalization evidence: 2026-11-20. **Not fully complete:** current Neon is empty, so a successful authenticated working demonstration is blocked. No seeded/fabricated transactions, new database, new infrastructure or deployment was used to conceal this.

## Prepared deliverables

- [x] Reviewed Phase 1 role/business scope, Phase 3 SQL/ERD, official Phase 4 schedule and current module documentation/source.
- [x] Fixed POS rejected-checkout correction using existing schema/audit/transaction controls; no new financial cancellation/refund policy.
- [x] Local backend: 44 passed, 0 failed, 6 DB suites skipped; frontend: 47 passed; lint/build passed.
- [x] Read-only existing Neon verification: 001/002/004, original baseline checksum, no image column, empty tables; 16 module query checks passed.
- [x] Existing frontend/API startup and unauthenticated/invalid-login behavior checked without production mutation.
- [x] Existing-architecture deployment configuration and 15 production-mode HTTP smoke checks prepared/passed. Docker image not built and deployment not performed.
- [x] [User manual](../USER_MANUAL.md), [bug log](../BUG_LOG.md), [deployment guide](../DEPLOYMENT.md) and updated [readiness audit](../PHASE4_READINESS_AUDIT.md) supplied.
- [x] Secrets remain ignored; original private Phase 1 PDF excluded; Cloudinary and discounts disabled; schema/migrations preserved.

## Evidence still needed before claiming Phase 4 complete

- [ ] Existing approved accounts/data available and a permitted actual login-to-reports walkthrough completed. Current `users=0`; do not run seed/bootstrap or create a new database under finalization.
- [ ] Real PostgreSQL transactional/concurrent closure verification and other six DB integration suites, using only resources/actions subsequently authorized; skipped suites are not passing tests.
- [ ] Actual browser visual/E2E and mobile-width rehearsal, cookie/session/reload behavior, screenshots and UAT. Browser host was unavailable during this task.
- [ ] Instructor/adviser acceptance of documented MVP deviations and Week 15 API evidence. Owner-approved Cloudinary code is disabled; no real-provider demonstration is claimed.
- [ ] Owner-authorized review/commit/push, a new hosted CI result for these changes, and authentic branch/PR contribution evidence. Do not fabricate past collaboration or sign-offs.
- [ ] Approved existing host/domain/HTTPS/proxy settings, container/runtime validation and an authorized deployed prototype URL (Week 16). No new infrastructure provisioned and no deployment performed here.
- [ ] Final defense deck, assigned speaking roles, rehearsal and actual client/instructor acceptance. This checklist is not evidence those events occurred.

## Presentation sequence using only permitted existing records

1. State the implemented regular-price MVP scope and unresolved requirements. Explain React/Vite/Tailwind, Express/JWT RBAC, Neon and single-origin deployment without exposing secrets.
2. Show current test results and existing API/database health. Clearly disclose the current empty-data/login blocker instead of pretending a populated demo exists.
3. If authorized existing accounts/data become available: Employee login -> Overview -> Products -> Inventory; demonstrate restricted navigation/access.
4. Manager: Suppliers/PO -> pending Stock-in -> show approval/history and current quantities. Do not approve/post a record unless its real action is authorized.
5. Cashier: POS search/cart/quote -> confirmed rejection and correction -> saved-reference resolution -> stored receipt only when a legitimate permitted transaction exists. No fabricated purchase/payment for the presentation.
6. Manager/Admin: daily/weekly/monthly and supported inventory reports; distinguish unreviewed paid sales, excluded records and unavailable cost estimates. Empty datasets are valid empty states, not successful sales evidence.
7. Show the bug log, user manual and prepared deployment configuration; distinguish local test evidence from unperformed browser/DB/container/deployment evidence.
8. End with exact remaining blockers and request the appropriate submission scope decision. Do not claim full completion or production readiness.

## Before sharing files or screen

- [ ] Close secret-bearing `.env` tabs, terminals containing credentials, cookies and private request payloads.
- [ ] Review staged/eligible filenames and redacted secret-scan findings; no `.env`, dependency/build/cache directories or private SRF PDF in Git.
- [ ] Use actual screenshots/results only. No invented dates, instructor approval, signatures, test passes or cloud URL.
- [ ] Confirm no pending uncertain checkout is discarded; retain its reference and sign back in as the original cashier for recovery.
- [ ] Retain checkout-closure audit events; no resets, historical transaction edits or migration commands as a presentation shortcut.

Next commands are validation/review only: see [FINALIZATION_RESULTS.md](FINALIZATION_RESULTS.md). No automatic commit, push, database setup, new infrastructure, or deployment is authorized by this checklist.
