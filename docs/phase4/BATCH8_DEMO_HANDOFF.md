# Batch 8 local demonstration handoff

Date: 2026-11-22 Asia/Manila. **Ready for local synthetic demonstration; not approved for live pharmacy use.**

Read [results and changed files](BATCH8_RESULTS.md), the [client walkthrough](BATCH8_CLIENT_WALKTHROUGH.md), [requirements matrix](FINAL_REQUIREMENTS_MATRIX.md) and [release gates](RELEASE_CHECKLIST.md). Owner/pharmacist acceptance is pending.

## Verified local environment

- Existing temporary PostgreSQL 17.12: `127.0.0.1:58446`, database `tgp_disposable_batch2`.
- Instance directory: `C:\Users\spori\AppData\Local\Temp\tgp-pg-1795265396785`.
- Node used: `C:\Users\spori\AppData\Local\Temp\tgp-node24-qZh55x\node.exe` (24.22.3). Default shell Node 22.23.4 does not satisfy the declared Node 24 requirement.
- TLS certificate validation, literal-IP identity, isolation attestation, unprivileged test role and baseline checks must pass before fixture writes. No insecure TLS option is needed or permitted.
- This temporary certificate expires **2026-11-28 20:55:04 Asia/Manila**. After expiration, stop and arrange separately authorized local certificate renewal; do not bypass validation.
- Existing temporary Chrome/Playwright tooling is required. Missing runtime, browser, certificate, private manifest or attestation is a blocker, not permission to use a different database.

## Start, reset and stop

Run these from `server/`. Do not load a production environment, use the academic-accounts environment, or substitute a database URL. Commands take only the existing attested instance directory; they never take credentials.

Read-only preflight:

```powershell
rtk proxy "C:\Users\spori\AppData\Local\Temp\tgp-node24-qZh55x\node.exe" testing/local-demo.mjs verify "C:\Users\spori\AppData\Local\Temp\tgp-pg-1795265396785"
```

Start a fresh synthetic scenario, build the production frontend, run the 17 browser groups, then hold the local UI/API open for review:

```powershell
rtk proxy "C:\Users\spori\AppData\Local\Temp\tgp-node24-qZh55x\node.exe" testing/local-demo.mjs start "C:\Users\spori\AppData\Local\Temp\tgp-pg-1795265396785"
```

Open the **new loopback origin printed by this run**, not a saved port. The origin changes. The automated browser closes after verification; open your own browser for hands-on review. Use the synthetic credentials from that run's ACL-protected `private-uat.json` locally, without copying them into reports, chat, repository files or screenshots. Employee, Manager, Admin and a separately qualified test-only professional fixture are distinct accounts. A Manager is not automatically a pharmacist.

Press **Enter** in the launcher terminal to stop the local UI/API. The existing PostgreSQL instance, synthetic schemas, screenshots, exports and private manifests remain. Start/HTTP 200/Enter/clean exit and closed HTTP listener were verified in Batch 8. Do not close the terminal abruptly when a clean stop is available.

Repeatable reset/reseed, including browser verification but without holding servers open:

```powershell
rtk proxy "C:\Users\spori\AppData\Local\Temp\tgp-node24-qZh55x\node.exe" testing/local-demo.mjs reset "C:\Users\spori\AppData\Local\Temp\tgp-pg-1795265396785"
```

**Reset means a fresh uniquely owned `tgp_uat_<uuid>` schema with deterministic synthetic seed values. It never deletes, resets or reseeds previous schemas.** IDs, timestamps, ports and receipt numbers vary. Automated journeys execute before hands-on review, so their approved/rejected records are already present. This preserves all previous work/evidence and prevents accidental destructive reset.

If this existing instance is stopped, first inspect its status and start only that same cluster (no initialization or Windows service):

```powershell
rtk proxy "C:\Users\spori\AppData\Local\Temp\tgp-pg-1795265396785\bin-dist\pgsql\bin\pg_ctl.exe" -D "C:\Users\spori\AppData\Local\Temp\tgp-pg-1795265396785\data" status
rtk proxy "C:\Users\spori\AppData\Local\Temp\tgp-pg-1795265396785\bin-dist\pgsql\bin\pg_ctl.exe" -D "C:\Users\spori\AppData\Local\Temp\tgp-pg-1795265396785\data" -l "C:\Users\spori\AppData\Local\Temp\tgp-pg-1795265396785\local-demo-postgres.log" -w -t 30 start
```

Then rerun `verify`. Start is not proof of isolation. Do not initialize another instance or modify shared/production PostgreSQL configuration.

## Isolation and artifact boundaries

The facade verifies before calling the fixture runner and replaces inherited `DATABASE_URL` with a deliberately unusable sentinel. The fixture runner independently validates the local target, creates its own schema, applies **001 → 002 → 004 → 003 → 007 → 008 → 009** there and enables workflows/restocking only in the local API child. Proposal **010 is not applied**. Existing public baseline and earlier schemas are preserved. There is no production fallback.

The frontend is an actual Vite production bundle, served by a loopback preview with a loopback API proxy. React production code is checked in emitted assets. The API remains a test-only development configuration so local HTTP/cookies can be exercised. This does **not** verify production HTTPS, production cookie policy, Docker/Linux runtime or host deployment. Production configurations and flags are unchanged. Compiled files stay under the new run directory, without replacing `client/dist`.

The local HTTP allocator requests ports 16384–65535, binds `127.0.0.1`, retries collisions and refuses after 50 attempts. It does not disable Fetch/browser restricted-port checks. A concurrent process can still occupy a port between reservation and startup; strict-port startup fails instead of selecting an unverified origin.

## Evidence and preservation

Current verified run: `tgp_uat_ca9946bcf4a445eea1b94148446ef768` under the instance directory. Open its `review.html` for the 38-screenshot gallery. `browser-results.json`, `verification.json`, `downloads/` and `built-client/` are retained. **Do not publish the entire run directory:** it also contains private credentials and a browser profile. Share only reviewed synthetic screenshots, redacted results and synthetic exports.

Independent read-only verification, before additional manual transactions alter expected fixture totals:

```powershell
rtk proxy "C:\Users\spori\AppData\Local\Temp\tgp-node24-qZh55x\node.exe" testing/verify-uat.mjs "C:\Users\spori\AppData\Local\Temp\tgp-pg-1795265396785" "C:\Users\spori\AppData\Local\Temp\tgp-pg-1795265396785\tgp_uat_ca9946bcf4a445eea1b94148446ef768"
```

After manual transactions, exact fixture balances may legitimately differ. Preserve that run as manual evidence and use a fresh `reset` run for repeatable assertions; do not overwrite evidence to make checks pass.

No disposal was performed. After results are reviewed and disposal is explicitly approved: stop all owned demo clients, stop only this cluster with `pg_ctl -D <exact data directory> -m fast -w stop`, preserve approved evidence, resolve the exact temporary root, verify every cleanup target remains beneath that root, then remove only approved temporary artifacts. Never use this procedure for a business database, a generic PostgreSQL directory or the project workspace. Until review, retain data and evidence. Temporary files may be removed by Windows cleanup, so this environment is not a permanent handoff installation.

## Future release, separately authorized

Back up and rehearse restore first; inventory actual installed migrations/checksums and data preconditions; preserve 001/002/004 history. Rehearse pending dependency order 003 → 007 → 008 → 009 on a restored isolated copy, with a tracked runner, populated-data validation and flags off. Keep 010 unapplied pending its own review. Use additive forward correction; do not drop populated financial/workflow history as a rollback. Disable gates and restore a compatible application artifact when needed; database restore requires an approved recovery plan. Verify baseline availability and fail-closed schema gates before separately approved workflow activation. No production operation is authorized by this document.
