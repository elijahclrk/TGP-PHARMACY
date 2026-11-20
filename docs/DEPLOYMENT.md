# Existing-architecture deployment configuration

Prepared for academic submission, 2026-11-20. **No deployment, cloud resource, database, account or data was created.** No provider/domain is selected by this document. The existing React + Express + Neon architecture is retained: one long-running Express process serves both `client/dist` and relative `/api` requests on one HTTPS origin. No additional service, schema, migration or alternate auth architecture is introduced.

## Configuration supplied

- Root `Dockerfile`: Node 24 multi-stage client build, production-only server dependencies, runtime as non-root `node`, dynamic PORT and liveness health check. No migrate/seed/bootstrap command runs at startup. Migration/demo/test files and secrets are not copied into the runtime image.
- `.dockerignore`: excludes environment files, credentials, Git/local caches, generated outputs, tests/demo/database directories and private documents from the build context as applicable.
- `deploy/.env.example`: blank secret placeholders and image-disabled production defaults. Put actual values in the existing host's secret store, never in the repository or client build.
- `server/src/middleware/frontend.js`: production static hosting, immutable hashed assets, uncached SPA entry/deep links, hidden-file denial and API/missing-asset boundaries. `app.js` enables it only for `NODE_ENV=production`; development Vite remains unchanged.

Built-in [Express static hosting](https://expressjs.com/en/starter/static-files/) is used. Vite's `preview` is a local preview server, not the production plan: [Vite guidance](https://vite.dev/guide/static-deploy.html).

## Required runtime values

| Setting | Requirement |
| --- | --- |
| `NODE_ENV` | `production` for the shareable HTTPS environment. |
| `PORT` | Valid host-provided port; default 5000. |
| `CLIENT_ORIGIN` | Exact public HTTPS origin, no path/trailing slash, matching the browser URL. |
| `DATABASE_URL` | Existing approved Neon resource supplied privately. Verified TLS stays enabled. No new database or demo seed is authorized by finalization. |
| `JWT_SECRET` | Private high-entropy key of at least 32 bytes; never a placeholder. |
| `JWT_TTL_SECONDS` | Existing 60-3600-second bound; default 900. |
| `PRODUCT_IMAGES_ENABLED` | `false`. No migration 006 or provider activation. |

Frontend API calls are relative; no secret or separate public API URL is required in `VITE_*`. Missing JWT configuration fails startup. Missing `client/dist/index.html` fails production startup with a clear error. Native Argon2/Sharp packages must load on the target OS; the Docker build uses matching base OS/runtime across dependency and runtime stages.

## Build commands (not deployment authorization)

From a reviewable existing checkout:

```powershell
Set-Location 'C:\Users\USER\Desktop\TGP_Pharmacy\server'
npm.cmd ci
Set-Location '..\client'
npm.cmd ci
npm.cmd test
npm.cmd run lint
npm.cmd run build
```

For a native host, preserve the layout `server/src` beside `client/dist`; configure runtime secrets and production variables privately, then run `npm start` from `server`. Use one process. Do not copy the local `.env` to another system or place passwords in command-line arguments.

The optional image build command is:

```powershell
Set-Location 'C:\Users\USER\Desktop\TGP_Pharmacy'
docker build -t tgp-pharmacy:submission .
```

This command was **not executed**: Docker's daemon is unavailable. The Dockerfile received static review; Linux dependency installation and the final container image are not certified by the Windows local checks. No container was launched, registered, uploaded, or deployed.

## Activation checks for the approved existing host

1. Review the exact revision and local test evidence; obtain authorization before commit/push/deployment. Earlier green GitHub CI was reported by the user; new changes have not had a hosted run. No CD job was added.
2. Confirm the host/domain/TLS arrangement already approved by the owner and configure secrets privately. Do not provision new infrastructure under this task. Keep one API process: sessions and login rate limiting are process-local; restart revokes sessions.
3. Serve `/api` and SPA under the same HTTPS origin. Confirm trusted reverse-proxy topology/client-IP handling before exposure. No blanket `trust proxy=true` was added; without a reviewed proxy setup, login limits may be shared across clients behind that proxy. Do not solve this by weakening auth or Secure cookies.
4. Verify only existing schema/history using read-only checks. Original 001/002/004 stay unchanged; do not run initialization runners, migrate, seed, bootstrap, reset or apply 003/005/006. Retain `POS_checkout` terminal-reference audit events; deleting them can reopen old rejected checkout references. External writers must not bypass the existing checkout lock/protocol.
5. Smoke-check `/`, direct `/products`/`pos`/`reports`, hashed assets, API JSON/error boundaries, `/api/health` and actual `/api/health/db`. The Docker health check is liveness only, not proof of database availability or complete workflows.
6. Confirm authorized existing users/data are actually available before promising a presentation. **Current existing Neon has zero users and zero business rows.** Do not use seed scripts or create another database for this finalization. Owner authorization for any legitimate future account/data setup is separate from this config.
7. Rehearse successful HTTPS login/logout, all roles, saved-checkout refresh/closure/correction, receiving and reporting using only permitted existing records. Current authenticated end-to-end demonstration remains blocked by missing accounts/data and unavailable browser access. Do not post transactions merely to make a demo appear complete.
8. Confirm existing-host rollback/backup ownership and operational monitoring. Roll back code/build only if approved; do not restore/alter historical transactions or delete audit closures as an application rollback shortcut. Browser state and receipts must be reconciled before switching API versions mid-checkout.

## Actual readiness evidence

- Full local backend suite: 44 passed, 0 failed, 6 database suites skipped. Full frontend suite: 47 passed, lint/build passed.
- Two static-serving tests exercise SPA refresh, assets/cache, API separation, hidden files and missing-build refusal.
- Production-mode HTTP smoke on the real compiled frontend: 15 checks passed with database access disabled and a throwaway signing key. This is not HTTPS-cookie/browser or deployed-host verification.
- Current Neon was queried read-only: original migrations, no image column, empty tables. Sixteen actual read-only repository checks covered inventory, purchasing, POS lookup and reports. No schema/data changes were made.
- Not verified: Docker image build/runtime, host-specific proxy/TLS/network rules, real-account login/transactions, updated PostgreSQL transactional integration, real-browser E2E, or deployment URL.

**Readiness:** configuration is prepared, not deployed or release-certified. A working authenticated demonstration is still blocked by approved-account/data availability. Senior/PWD compliance also blocks live pharmacy production; Cloudinary remains unavailable and Week 15 real-provider evidence remains incomplete.
