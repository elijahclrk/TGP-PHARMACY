# Continuous integration

`.github/workflows/ci.yml` runs on pushes to `main` and pull requests targeting `main`. Two Ubuntu jobs use Node.js 24 LTS and separate `npm ci` installs from the existing lockfiles. Backend runs `npm test`; frontend runs `npm test`, `npm run lint`, and `npm run build`. Any required command failure fails its job. Subsequent steps in that job stop after failure; the other job runs independently.

Only GitHub-maintained checkout/setup-node actions are used. The token has `contents: read`, checkout does not persist credentials, npm's download cache is keyed by each lockfile, and jobs have time limits. No deployment, migration, bootstrap, application secret, or database secret is configured. The backend generates a temporary random JWT signing key for tests; it is never printed or reused by the application. Environment files remain ignored.

Node support: [official release schedule](https://nodejs.org/en/about/previous-releases). Action usage: [checkout](https://github.com/actions/checkout), [setup-node](https://github.com/actions/setup-node).

## Database coverage: explicitly skipped

These existing suites require `DATABASE_URL` and their respective opt-in flag set to `1`:

| Suite | Flag |
| --- | --- |
| `server/test/auth.integration.test.js` | `RUN_AUTH_DB_TESTS` |
| `server/test/inventory.integration.test.js` | `RUN_INVENTORY_DB_TESTS` |
| `server/test/purchasing.integration.test.js` | `RUN_PURCHASING_DB_TESTS` |
| `server/test/pos.integration.test.js` | `RUN_POS_DB_TESTS` |
| `server/test/reports.integration.test.js` | `RUN_REPORTS_DB_TESTS` |

CI explicitly sets all five flags to `0` and `DATABASE_URL` empty. Node's test output marks these suites skipped, and the backend job summary repeats the coverage gap. `database.test.js` uses fake localhost credentials and mocks queries; its passing health tests do not establish a real database connection.

A plain PostgreSQL service is insufficient: the connection configuration requires certificate-verified TLS, and the integration suites inspect the public Phase 3 tables and `tgp_schema_migrations` baseline checksum before creating isolated fixture schemas. Provisioning a compatible TLS service and reference migration history needs a separate reviewed CI setup. Do not disable certificate verification or point CI at the operational Neon database as a shortcut.

Future integration enablement requires an independently provisioned disposable test database/Neon branch, verified TLS, approved 001/002/004 reference schema and migration history, and permission to create/drop only test-owned schemas. The suites use rollback or cleanup of their unique schemas; interrupted committed-schema tests can leave fixture schemas, so dispose of the test database after runs. Deferred migrations 003/005 must remain disabled. This workflow intentionally has no database-secret input; adding one and enabling flags requires review. Never copy `server/.env` or production connection values into GitHub.

## Viewing results and troubleshooting

After the owner commits and pushes these files, open the repository's **Actions > CI**, select the run, then inspect the backend/frontend job and failing step. Pull requests also show status under **Checks**. Confirm the PostgreSQL skipped summary when interpreting a green run. No GitHub-hosted execution is claimed until a run actually completes.

- No run: confirm Actions is enabled, the workflow is committed, and the push/PR targets `main`. The first run requires owner-authorized commit/push; this task does neither.
- Install failure: use Node 24 and run `npm ci` in the affected folder. Commit both manifest and matching lockfile when intentionally changing dependencies; do not replace CI with `npm install` to hide lockfile mismatch. Check registry connectivity or native Argon2 installation errors without printing credentials.
- Backend configuration failure: check the workflow's throwaway signing-key step and environment overrides. No real database URL is needed for enabled checks.
- Test/lint/build failure: reproduce the exact npm command in the relevant directory, fix the reported source issue, and rerun. Failed or skipped checks are not passing evidence.
- Runner/action failure: use GitHub-hosted runners or verify current Node-action runner compatibility before choosing self-hosted runners.

Owners may configure branch protection/rulesets requiring both job checks after the first successful run; account permissions and feature availability must be checked on GitHub. Never bypass failures or fabricate prior CI evidence. Browser E2E, real PostgreSQL coverage, and deployment verification remain separate gaps.

## Local validation (2026-11-20)

- Backend `npm test`: 18 tests reported, 13 passed, 0 failed, 5 PostgreSQL integration suites skipped. All five opt-in flags were explicitly disabled; a throwaway signing key and empty database URL overrode local configuration. No real database query was performed.
- Frontend `npm test`: 5 test files passed, 35 tests passed, 0 failed.
- Frontend `npm run lint` and `npm run build`: exit code 0.
- Client/server manifest dependency declarations match their existing lockfiles. Existing npm scripts were used unchanged.
- Workflow statically reviewed for triggers, indentation, job working directories, lockfile paths, command failure propagation, permissions, and secret isolation. No local YAML parser/actionlint is installed; full GitHub workflow validation and Linux `npm ci` execution remain pending the first hosted run. Local checks used the installed dependencies, not a clean CI runner.

Only the workflow and this guide were added. Application code, schema, migration history, environment files, and business workflows were unchanged. No commit, push, or deployment was performed.
