# Same-day academic demo checklist

Verification: 2026-11-20, Asia/Manila. **Current decision: local services work, but a full interactive demonstration is blocked by an empty database.** No production/application data or schema was changed. Images stayed disabled; migration 006 was not applied.

## Actual results

| Check | Result |
| --- | --- |
| Local frontend | Running at `http://localhost:5173/`; root, login and product deep-link return HTTP 200. HTTP delivery is not a browser-render certification. |
| Local backend | Running at `http://localhost:5000/`; `/api/health` HTTP 200. |
| Neon / proxy | `/api/health/db` and Vite-proxied `/api/health/db` HTTP 200 after actual `SELECT 1`. |
| Current Neon schema | Read-only verification: 15 application tables, 24 FKs, only migrations 001/002/004 recorded, original baseline checksum matches, no `products.image_public_id` column. Database timezone is GMT. |
| Data readiness | All 15 application tables empty, including `users`, `products`, `batches`, `sales`, and `activity_logs`. No login account, supplier, stock, sale, or stored receipt is available for a normal interactive demonstration. |
| Running app authentication | Unauthenticated session/product requests HTTP 401; one nonexistent-user login returned HTTP 401 and a generic error. No successful real-account login was possible or attempted. |
| Read-only HTTP harness | 36 checks passed against the existing route/repository code and current Neon schema, with temporary in-memory accounts/sessions/audit events. Successful logins, three role dashboards, catalog/inventory, supplier/PO/stock-in listing, POS product search/status lookup, daily/weekly/monthly and inventory/profit report queries, logout and role denials passed. All real SQL ran inside `READ ONLY`; no paid checkout, receiving approval, or stock posting occurred. This harness is not an alternative production login or a demo account provisioner. |
| Images disabled / no 006 | Disabled image status returned `enabled:false` without accessing the image repository/column. Existing inventory, purchasing, POS and reporting queries succeeded without 006. |
| Backend tests | `npm test`: **28 passed, 0 failed, 6 skipped**, 34 total. |
| Frontend tests | `npm test`: **41 passed across 7 files**, 0 failed. Covers auth/routes, inventory, purchasing, POS recovery, reports, images and multipart requests using jsdom/mocked API responses. |
| Lint / build | `npm run lint` and `npm run build`: passed, exit code 0. Ignored `client/dist` regenerated. |
| Browser QA | Browser access host unavailable on both connection attempts. No real-browser visual/E2E pass is claimed. |

The six skipped PostgreSQL suites are authentication, inventory, purchasing, POS/FEFO, reporting, and product images. Docker's daemon was unavailable and no disposable test database was supplied. Schema-creating fixtures were not run against operational Neon. Read-only smoke checks do not replace transactional integration tests with populated synthetic fixtures.

Successful real login/logout intentionally writes activity logs. Paid checkout, PO/receiving creation and approvals write business records. These operations were not performed against the operational database under the no-record-changes instruction. The HTTP harness used memory-only login accounts/auditing and an enforced read-only PostgreSQL transaction; no account, password, token or database URL is published here.

## Launch commands (two PowerShell terminals)

The services were left running for local inspection. Do not start duplicate servers if ports 5000/5173 are already occupied. Ctrl+C in the owning terminal stops a server; API restart invalidates existing sessions. These commands set local process variables only, without editing `.env`.

Terminal 1 - backend:

```powershell
Set-Location 'C:\Users\USER\Desktop\TGP_Pharmacy\server'
$env:PRODUCT_IMAGES_ENABLED = 'false'
$env:NODE_ENV = 'development'
$env:PORT = '5000'
$env:CLIENT_ORIGIN = 'http://localhost:5173'
npm.cmd run dev
```

Terminal 2 - frontend:

```powershell
Set-Location 'C:\Users\USER\Desktop\TGP_Pharmacy\client'
npm.cmd run dev -- --host localhost --strictPort
```

Open `http://localhost:5173/` (use this exact origin consistently). Existing ignored server configuration must supply a valid database URL and JWT secret. Do not paste these into chat or slides. Dependencies are already installed; on a separate authorized checkout use `npm.cmd ci` in each folder first. Missing native Sharp/Argon2 dependencies can prevent API startup even while images are disabled.

## Presentation sequence and gates

- [x] Keep `PRODUCT_IMAGES_ENABLED=false`; do not run migration 006 or deferred 003/005.
- [x] Show API/database health and explain baseline/schema compatibility.
- [x] Keep current business tables unchanged; do not bootstrap users, approve deliveries, or submit sales on operational Neon for this verification.
- [ ] **Blocking:** obtain an independently provisioned demo database/environment and authorization for synthetic demo accounts, products, supplier and batch fixtures. Use approved baseline 001/002/004 only; no image migration is needed for this demo.
- [ ] Bootstrap an admin securely in that isolated demo environment, then provision named Manager/Employee demo accounts through authorized flows. Never create a shared/default password or hardcode credentials.
- [ ] Rehearse Employee login -> cashier dashboard -> product search -> batch/expiry view; demonstrate denied supplier/report access.
- [ ] Rehearse Manager login -> suppliers -> PO -> pending receiving -> approve once -> inventory increase. Verify no increase before approval; use synthetic data only.
- [ ] On the isolated environment, show a regular-price cash checkout/receipt, FEFO allocation and report reconciliation; record exact starting/ending stock. This was not performed against current Neon.
- [ ] Rehearse saved-checkout refresh/status/retry with the same reference. Never clear browser recovery storage, switch cashier, or create a replacement transaction while an outcome is uncertain. Browser recovery behavior was tested in jsdom, not certified in an actual browser today.
- [ ] Show Manager daily/weekly reports; Admin monthly/product/valuation/profit views. Label approval status separately and explain empty/unverified-cost states accurately.
- [ ] Perform real-browser desktop/mobile-width QA and check refresh/deep-link routing before presenting any shareable environment.
- [ ] Have the local test summary and screenshots/video from the isolated rehearsal as fallback evidence. Current tests are evidence of specific checks, not a substitute for an unperformed live workflow demonstration.

**Current fallback:** show the login screen, read-only health checks and automated test evidence. Do not claim the existing empty Neon setup supports a completed login/receiving/paid-sale walkthrough. No authentication bypass or fake dashboard was added.

## Unavailable features and cautions

- Cloudinary: implemented in code but disabled; 006 unapplied; no real-provider demonstration completed.
- Senior/PWD discounted checkout: explicitly unavailable pending validated legal/VAT/eligibility/approval requirements; production release blocker.
- Partial payments, voids, returns and adjustment workflows are not provided by this demo scope. No invented policy should be presented as complete.
- POS rejected-attempt correction was subsequently fixed during finalization: committed closure unlocks editing, and **Resolve for editing** either returns an existing receipt or closes the unused reference before correction. Do not improvise clearing uncertain checkout storage. Updated DB/browser verification is still pending; see the finalization report.
- Sessions and throttling are process-local; API restart logs users out. Multiple API instances are not supported by the current session design.
- No new real PostgreSQL transaction/concurrency test pass, real-browser E2E certification, or production-readiness approval is claimed.

## Shortest safe path to a shareable demo URL (recommendation only)

1. Resolve the account/data blocker in an isolated academic demo database, never by populating operational Neon under this task. Authorize synthetic fixtures and keep images disabled/006 absent.
2. Select and authorize a host capable of one long-running Node 24 process plus static assets/reverse proxy. No hosting provider is mandated or selected by this document. The existing Express app does not serve `client/dist` or provide SPA fallback, so those routes must be configured and tested first.
3. Serve compiled `client/dist` and `/api` on one HTTPS origin; configure SPA fallback only for frontend paths. Keep `DATABASE_URL`/`JWT_SECRET` server-side, set production cookie mode and exact public `CLIENT_ORIGIN`, and restrict access to the academic demo audience. Use one API instance and verify TLS/native dependencies.
4. Run isolated DB regressions and browser smoke checks, then obtain explicit deployment authorization. Include login/logout, protected deep links, role denials, receiving/checkout recovery and reports in that rehearsal. A static-only frontend URL does not make the Express-backed system usable.

The fastest immediate presentation is local screen sharing with clear limitations. A public link alone does not resolve missing accounts/data. Do not expose the current development server/operational database just to meet a same-day deadline. Vite's `preview` server is for local preview, not production hosting: [official Vite guidance](https://vite.dev/guide/static-deploy.html). Node 24 is an LTS line: [official Node releases](https://nodejs.org/en/about/previous-releases).

No hosting, tunnel, deployment, commit, push, migration, account provisioning, or production mutation was performed. Only this checklist was added for the same-day assessment; pre-existing Cloudinary implementation changes remain uncommitted and unchanged by this task.
