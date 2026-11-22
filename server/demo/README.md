# Isolated academic demo setup

**Prepared, not initialized or seeded.** No isolated database is available in the current workspace. Docker is installed but its daemon is not running; `initdb`, `pg_ctl`, and `psql` are not on PATH. No demo database URL was provided. No database connection, schema change, account creation, or business-data change was performed by this setup task against the existing Neon database.

`npm run demo:config` was run successfully. It generated random passwords/signing material in ignored `server/.env.demo`, with a blank URL and isolation confirmation false. `npm run demo:init` then safely stopped with `ISOLATION_NOT_CONFIRMED` before creating a connection. The accounts below are **planned**, not created. Full workflow/SQL verification is pending a genuinely isolated PostgreSQL database; do not treat passing safety tests as a successful seeded demonstration.

## Prerequisites and isolation contract

1. Provision a NEW EMPTY PostgreSQL database named `tgp_demo_academic` (or another lowercase `tgp_demo_*` name). Prefer a separate demo instance/project and credentials that cannot access operational data. No cloud project/branch/database is provisioned automatically by these scripts, and no paid resources are authorized.
2. Use verified TLS compatible with the existing `pg` connection policy. Do not disable certificate verification. A plain PostgreSQL Docker image without TLS is not sufficient. A direct Neon endpoint is recommended for initial setup if pooling/startup-options compatibility is uncertain. The role must own/can create objects in the new database's public schema and read catalogs.
3. With Neon, create a new empty named database in an independently isolated environment. Do not point at the default `neondb` or a copied operational database. Branches can copy parent databases; a branch label alone is not a safety guarantee. See [Neon database management](https://neon.com/docs/manage/databases).
4. Node 24 and installed client/server dependencies are required. Existing lockfiles remain in use; on a fresh checkout run `npm.cmd ci` separately in `server` and `client`.
5. Keep the operational `server/.env` unchanged. Never copy its DATABASE_URL into the demo file. The demo scripts do not fall back to `DATABASE_URL`; they compare protected connection identities locally, without connecting to the protected database. A known protected database name is rejected even on another host as an extra conservative guard.

The initializer refuses nonempty/unowned databases. It creates a schema comment marking ownership only after an empty-database preflight, and creates only the original 15 tables plus existing-format migration tracking. Subsequent seed/start/verify commands require that marker and exact 001/002/004 checksums, original key counts, and no image column. Naming/marker checks supplement, not replace, the operator's responsibility to supply the correct isolated URL and a least-privileged account.

Only ordinary PostgreSQL URLs with `sslmode`/`channel_binding` parameters are allowed; redirecting connection parameters or search-path overrides in the URL are refused. Never weaken TLS to fix a connection error. UTC sessions are required for existing TIMESTAMP/report semantics.

## Configure privately (already generated locally)

In PowerShell:

```powershell
Set-Location 'C:\Users\USER\Desktop\TGP_Pharmacy\server'
# Run only if server/.env.demo does not exist:
npm.cmd run demo:config
```

This command uses exclusive creation: rerunning refuses to overwrite existing credentials. It first verifies Git ignores the exact file. On POSIX it requests mode 0600; on Windows, protect the file using the local user account's ACLs and review inherited access if the workspace is shared. Do not display it on a projector or include it in screenshots/logs.

Open **server/.env.demo privately in the editor**, supply `DEMO_DATABASE_URL` for the newly provisioned database, then set `DEMO_ISOLATION_CONFIRMED=true` only after checking the target. Leave generated signing material and the three distinct random passwords intact. Do not paste secrets into terminal commands or chat. `demo/.env.example` is a blank documentation template, not an alternative source of working credentials.

Never export a generic `DATABASE_URL` for these commands. The launcher sets all needed process variables after isolation passes and before importing the application; it does not edit `.env` or an existing API process. Cloudinary is forcibly disabled. JWT keys are separate from the operational configuration.

## Initialize, seed, verify

After a valid isolated URL and confirmation are saved:

```powershell
Set-Location 'C:\Users\USER\Desktop\TGP_Pharmacy\server'
npm.cmd run demo:init
if ($LASTEXITCODE -ne 0) { throw 'Demo initialization stopped; inspect the safe error label.' }
npm.cmd run demo:seed
if ($LASTEXITCODE -ne 0) { throw 'Demo seeding stopped; do not blindly retry a partial setup.' }
npm.cmd run demo:verify
```

- **init:** verifies approved local migration hashes, checks the connected database identity, uses an advisory transaction lock and an empty-object preflight, applies 001/002/004 and tracking rows atomically, marks the isolated schema, and verifies it. Does not read/apply 003/005/006. An existing matching owned demo is verified and skipped; unexpected schemas/history are refused. Original migration files/runners are unchanged.
- **seed:** accepts only empty application tables on its first run. Uses the existing secure admin-bootstrap service (Argon2id) and authenticated account/product/purchasing/POS APIs through a temporary loopback HTTP server. Audit logs are real records in the DEMO database, not stubs. Provider images stay disabled. It does not send requests to the operational API on port 5000.
- **verify:** performs real account login, role dashboards, product/batch/purchasing/report reads, role denials, receipt/status lookup, password-hash verification, and SQL inventory/payment consistency checks in the demo database. Successful authentication/logout creates normal demo audit records. It never creates a new sale or posts new stock.

Session orchestration uses a transaction-local advisory lock so no session-level lock is left behind through transaction pooling. Direct verification queries run in a READ ONLY transaction; API business writes use their own existing transactions. No DROP/TRUNCATE/reset command is supplied.

### Repeat and interrupted-run behavior

A successful seed writes an existing-table audit completion marker only after verification. Repeated `demo:seed` verifies the existing fixture through login/read APIs instead of creating products, receiving, payments or stock deductions again; only normal authentication audit records may grow. Repeated initialization does not erase or reseed data.

Business API operations commit separately; the whole seed is **not** one distributed transaction. If setup is interrupted before its completion marker, a retry refuses `NONEMPTY_OR_PARTIAL_DEMO_SETUP_REQUIRES_REVIEW` rather than guessing, resetting records, approving twice, or creating a replacement checkout. Inspect the isolated records with authorized tooling, or provision a fresh EMPTY demo database with a new `tgp_demo_*` name and rerun. Do not delete operational records or run an automatic reset. A timed-out checkout might have committed; its receipt reference is stored in `sales.receipt_no` and must be checked before any manual recovery. Partial automatic resume is not implemented.

Date-dependent fixtures age: if the seeded batches expire before a later presentation, do not alter old stock/expiry history merely to force checkout. Use an independently fresh demo database and normal receiving workflows.

## Expected sample data and checks (not yet executed)

Accounts use configured private credentials; default synthetic usernames are `demo_admin`, `demo_manager`, and `demo_employee`. There is no default/shared password. All account names and records are plainly labeled DEMO ONLY. Categories stay NULL; no pharmacy categories, discount rates or new approval/payment rules are invented.

| Fixture | Expected behavior after successful seed |
| --- | --- |
| Sample Tablet A | Official price PHP 10.00, reorder level 5. Receive 3 early-expiry units (+10 Manila days) and 7 later-expiry units (+20 days), both initially zero, then approve stock-in once. |
| Sample Capsule B | Official price PHP 25.00, reorder level 3. Receive/approve 5 units. |
| Empty Stock Sample | Price PHP 5.00, zero units, reorder level 1; useful low-stock example. |
| Academic Supplier | Synthetic name/address; no real phone/contact information. |
| Purchase order | Two product lines, independently approved. It is NOT automatically marked received by stock-in. |
| Initial stock-in | Three batch lines; zero before approval, quantities increase only via existing approved posting. Duplicate approval returns 409 without another increase. |
| Pending presentation stock-in | Four Capsule B units in a separate new zero-stock batch; remains pending and contributes no available stock until the presenter approves it. |
| Extra metadata batch | `DEMO-ZERO-METADATA`, quantity zero; created through the existing batch API, never directly increased. |
| Sample cash sale | Employee buys 5 Tablet A units: PHP 50.00 total, PHP 100.00 tendered, PHP 50.00 change. FEFO allocations: early batch 3, later batch 2. One sale/payment; `approved_by` remains NULL per existing POS policy. |
| Expected stock after sample sale | Tablet A: early 0, later 5. Capsule B approved batch 5, pending batch 0, metadata batch 0. Empty Stock Sample 0. |
| Checkout reliability | Same request retried once: receipt replay and no duplicate stock deduction. Employee status lookup succeeds; another cashier's lookup cannot retrieve it. |
| Inventory safety | Direct quantity PATCH is rejected. Every batch balance reconciles to approved receiving minus stored sale-item deductions. No quantity UPDATE/stock INSERT is executed directly by the seed script. |
| Reports / roles | Completed fully paid sale appears in reports as unreviewed, not approved. Employee denied suppliers/reports/product writes; Manager denied monthly reports; Employee batch costs omitted. |

Manager self-approval and independent POs/stock-in follow the previously accepted MVP assumptions; they are not new permanent pharmacy policies. No discounts, partial payments, returns, voids, or adjustment posting are introduced.

## Launch the isolated demo (separate terminals)

Backend:

```powershell
Set-Location 'C:\Users\USER\Desktop\TGP_Pharmacy\server'
npm.cmd run demo:start
```

Frontend:

```powershell
Set-Location 'C:\Users\USER\Desktop\TGP_Pharmacy\client'
npm.cmd run dev:demo
```

Open **http://127.0.0.1:5174/**, not localhost:5173 or localhost:5174. The demo API binds loopback port 5001; the dedicated Vite config proxies only to 127.0.0.1:5001. Using the IP origin also keeps its cookie separate from the operational app's localhost cookie. Original Vite config/dev script, operational ports, `.env`, database connection implementation, schema/migration history, and business logic are unchanged. Do not put demo passwords or tokens in localStorage.

Use Ctrl+C in each owning terminal to stop. API restart revokes sessions; log in again. A saved uncertain checkout must be recovered under the original cashier, not replaced blindly.

## Presentation flow

1. Employee: login -> cashier dashboard -> Products -> Inventory; show quantities, expiry, low-stock state and denied supplier/report access.
2. Manager: login -> Suppliers -> existing approved PO -> pending Stock-In. Show its new batch at zero before approval, then approve **once in the isolated demo only**; Capsule B rises from 5 to 9 overall.
3. Employee: login -> POS -> select an eligible sample product -> review total -> tender exact/sufficient cash -> checkout -> stored receipt. Explain the seeded two-batch FEFO sale and use current quantities for new sales; do not promise the original seed balances after manual transactions.
4. Demonstrate refresh/recovery only with a rehearsed synthetic transaction; check the saved reference and retry the same request when uncertain. Never clear recovery storage to escape an unknown outcome.
5. Manager: daily/weekly reports. Admin: monthly/product/valuation/profit estimates and approval-status distinction. Show completed seed sale without calling it approved.

Cloudinary, Senior/PWD discounts, partial payments, voids, returns and unimplemented adjustment workflows remain unavailable. Existing POS rejected-attempt correction limitations and session restart behavior remain. Browser visual/E2E rehearsal is required once data setup succeeds; this task did not fabricate a browser verification pass.

## Actual validation in this task

- Seven new offline safety tests passed: missing-config refusal, dedicated target/protected-DB refusal, URL-option and account validation, TLS-URL identity handling, demo process isolation, migration allowlist/checksums, and date offsets.
- Full backend suite: **35 passed, 0 failed, 6 database suites skipped** (41 reported tests).
- Frontend suite: **41 passed across 7 files**, lint and production build passed.
- Git confirms `.env.demo` is ignored; the generated passwords were checked only for presence/length without printing values. Manifest dependencies still match lockfiles; script-only manifest changes need no dependency lock regeneration.
- End-to-end initialization/seed/verification **NOT RUN** against PostgreSQL. Exact blocker: no isolated URL/confirmation, unavailable Docker daemon, no PostgreSQL server tools on PATH. `demo:init` stopped before any connection. No protected Neon query was made by these new scripts during this task.

The scripts are prepared and safety-tested, not certified as a completed seeded environment. Next requirement: provision the independent empty TLS database, configure the ignored file privately, then run init/seed/verify and inspect actual results before claiming a working presentation. No commit, push, deployment, production reset, 006 application, or Cloudinary activation was performed.
