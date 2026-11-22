# Temporary local PostgreSQL verification — 2026-11-21

The project owner explicitly authorized downloading and initializing this
temporary instance and executing isolated migration/write/concurrency tests.
Existing Batch 1/2 changes were preserved. Production Neon was not connected or
modified. No migration, account, credential, seed or deployment change was made
to the real system. No commit or push was performed.

## Distribution and retained instance

- PostgreSQL **17.12**, Windows x64, from the EDB binary archive linked by the
  [official PostgreSQL Windows page](https://www.postgresql.org/download/windows/).
- Official-linked download: `https://sbp.enterprisedb.com/getfile.jsp?fileid=1260728`.
- Archive SHA-256: `520c8c6f19abb3b31fa83ec5e486e2f769eedd7593d94e60a7cda8a5bfb4df91`.
  This is the locally computed fingerprint, not a claim of upstream checksum
  comparison. The extracted `postgres.exe` Authenticode signature was **Valid**,
  signed by **EnterpriseDB Corporation**.
- Temporary root: `C:\Users\spori\AppData\Local\Temp\tgp-pg-1795265396785`.
- Binaries: `bin-dist\pgsql\bin`; data: `data`; TLS material: `tls` under that root.
- Listener: **127.0.0.1:58446**, independently confirmed by Windows listener metadata.
  No wildcard/IPv6 listener or permanent Windows PostgreSQL service was created.
- Disposable database: `tgp_disposable_batch2`, with dedicated temporary cluster
  administrator and separate unprivileged test login. The test login has no
  superuser, create-role or create-database privileges.
- Credentials/attestation remain in ACL-restricted `private.json` and `admin.pw`
  under the temporary root. Their contents must not be printed, copied into the
  repository, committed or reused for real accounts. Temporary installation,
  data, successful review schemas and final log are retained for owner review.

## TLS and isolation evidence

The server uses a private seven-day CA and an IP-SAN certificate for 127.0.0.1.
Certificate hostname/chain validation remained enabled. Negotiated **TLS 1.3**;
the configured minimum is TLS 1.2. Non-TLS loopback authentication is rejected
by the temporary cluster's `pg_hba.conf`. No Windows trust store or production
pool/TLS setting was changed. The local CA is supplied explicitly to the setup
client and via `NODE_EXTRA_CA_CERTS` to test children only.

Server certificate validity: 2026-11-21 12:55:04 UTC through
2026-11-28 12:55:04 UTC (2026-11-28 **20:55:04 Asia/Manila** expiry).
Public certificate SHA-256 fingerprint:
`92:08:45:77:13:20:69:47:32:85:C6:E1:F0:8B:9E:68:B9:22:4A:16:00:53:3C:FB:5F:37:58:BF:17:B3:4A:D3`.

Before the first SQL write, the setup client verified its TLS connection,
actual server address/port, current database, random isolation token, temporary
data directory, listener policy and current login. The token was configured
at temporary-cluster initialization, then also at the new database level.
Every test connection repeats the read-only identity/attestation handshake.

Negative checks passed:

- Missing disposable-target approval, missing target, same protected host or
  database, pooled aliases and connection-redirection URL options are refused.
- Unencrypted/unauthorized TLS streams and wrong actual local address/port are
  refused by the shared test harness before writes.
- A real connection with only public CA roots rejects this private certificate.
- Native certificate hostname verification rejects a mismatched hostname.
- A wrong attestation is rejected inside a READ ONLY transaction, then rolled back.

Every test child receives an unusable `DATABASE_URL` sentinel targeting
`production.invalid`, never the actual Neon URL. The separate test URL is
constructed exclusively from the retained local manifest after strict temporary
path, literal loopback, port and database-name checks. An accidental application
pool import therefore cannot fall back to production. No production network
connection was used for this verification.

## Migration results

The disposable public schema contains the unchanged historical **001 → 002 → 004**
baseline and checksum history required by the older integration suites. Tests
verified its counts, constraints and history remained unchanged.

The corrected proposals successfully executed in owned disposable schemas in
this order:

**001 → 002 → 004 → 003 → 007 → 008 → 009**.

003 and 007 therefore precede 008, while 009 remains independent of the return
dependency. Applied production migration files 001/002/004 and original Phase 3
SQL were not edited. No draft was added to a production migration allowlist.
The existing image suite separately exercised proposed 006 only in its rolled-back
local schema; product images remain disabled in the application.

Verified: composite sale/item lineage; pending-only entry; no-self-review and
management review; immutable rejection/terminal states; cumulative sold/returned
and received/disposed limits; full accepted quarantine receipt; current separate
pharmacist authorization; original-batch/quantity/restock pair consistency;
complete cent-exact financial snapshots; mixed eligibility and VAT classifications;
immutable snapshot history and deferred header/line reconciliation. A deliberate
wrong-batch restock failed at COMMIT and rolled back inventory, linked adjustment,
decision and audit together. Deliberately incomplete financial lines failed
deferred reconciliation and rolled back.

The migration contract suite used a rollback-only schema. The real multi-client
workflow suite committed only local fixtures to permit actual locking tests and
retained its review schema. Older suites clean up their owned test schemas;
the temporary instance and retained workflow review schemas were not deleted.

## Exact results and corrected defects

Runtime: existing temporary Node **v24.22.3**, satisfying the declared Node 24
requirement. The default installed Node was not changed.

Initial full run: **156 reported entries, 149 passed, 7 failed, 0 skipped**.
Six workflow subtests and their parent failed because PostgreSQL inferred the
untyped CASE reviewer parameter as text while the reviewer columns are integers
(`42P08`, text versus integer). This real defect was not visible in mocks.
The inactive workflow service now casts that CASE parameter explicitly to
`integer`; no business rule or active endpoint changed. Targeted reruns passed.

Final full run: **158 reported entries, 158 passed, 0 failed, 0 skipped**, exit 0,
**61.7113076 seconds**. The count includes nested subtests, their parent entries,
and two helper-module load entries; it is not 158 independent database scenarios.

| PostgreSQL group | Result |
|---|---|
| Authentication / account RBAC | Parent + 12 subtests passed |
| Product/inventory HTTP | Parent + 10 subtests passed |
| POS / FEFO / checkout recovery | Parent + 11 subtests passed |
| Purchasing / Stock-In approvals | Parent + 10 subtests passed |
| Reporting | Parent + 6 subtests passed |
| Image migration/repository | Standalone database case passed |
| Prepared adjustment/return/disposition services | Parent + 9 subtests passed |
| Corrected workflow/financial SQL contracts | Parent + 3 subtests passed |

Real concurrent cases covered duplicate adjustment requests/approvals, competing
returns sharing one sold line, repeated quarantine receipt, competing dispositions
and competing restocks, pharmacist revocation waiting for the locked approval,
competing FEFO checkout and retry/recovery, and duplicate Stock-In approval.
Audit failures and invalid late posting rolled back atomically. No-self-review,
Employee/inactive review denial, expiry-day restock rejection and revoked
professional authorization were verified. Existing PO/Stock-In self-approval
remained compatible with the approved permissions.

One harness formatting issue was corrected during setup: PostgreSQL's
`inet_server_addr()::text` includes the network mask, so endpoint verification now
uses `host(inet_server_addr())` rather than weakening address comparison.
Privileged cluster settings are checked using the temporary administrator only;
the fixture role was not granted additional server-setting privileges.

Final transcript: `last-test-run.log` under the retained temporary root.
`git -c core.safecrlf=false diff --check` passed. Browser testing was not performed.
Frontend files were unchanged and frontend tests/build were not rerun in this
database-only task. No new failure remains in the executed backend scope.

## Repeating local verification

From the workspace's `server` directory, use the verified Node 24 executable:

```powershell
rtk proxy C:/Users/spori/AppData/Local/Temp/tgp-node24-qZh55x/node.exe testing/local-postgres.mjs verify C:/Users/spori/AppData/Local/Temp/tgp-pg-1795265396785
rtk proxy C:/Users/spori/AppData/Local/Temp/tgp-node24-qZh55x/node.exe testing/local-postgres.mjs test C:/Users/spori/AppData/Local/Temp/tgp-pg-1795265396785
```

The tool performs its safety handshake before tests, injects test settings only
into child-process environment, and retains the transcript. It never changes
project `.env` files. `bootstrap` is an initialization action and refuses an
already-populated baseline; do not rerun it against the prepared instance.
After certificate expiry or a stopped server, verification must succeed again
before any new write run. Do not disable TLS checks to restore access. Retain
the instance until owner review and separate cleanup instructions.

## Exact repository files changed in this task

1. `server/test/support/disposable-database.js` — require verified TLS and actual
   local endpoint; use PostgreSQL host-address formatting.
2. `server/test/disposable-database.test.js` — TLS/address/port refusal tests and
   updated secure mock connection fixtures.
3. `server/src/services/prepared-workflows.js` — explicit integer reviewer cast.
4. `server/test/prepared-workflows.integration.test.js` — new real transactional,
   concurrent workflow and financial snapshot verification; retain review schema.
5. `server/testing/local-postgres.mjs` — new explicit local-only bootstrap,
   verification and test runner with private manifest and no production fallback.
6. `server/database/README.md` — link this completed isolated verification.
7. `docs/phase4/BATCH2_PREPARATION.md` — preserve prior results and link the
   subsequent real PostgreSQL verification.
8. `docs/phase4/LOCAL_POSTGRES_TEST_RESULTS.md` — this report.

## Remaining activation gates

Passing local tests does not authorize production migration or feature activation.
Original production-data preconditions and a reviewed populated-database runner,
backup/restore/cutover planning, protected routes/UI/recovery, report qualification
before the first return or discounted sale, actual independent reviewers,
pharmacist evidence/clinical disposition procedures, and statutory/accounting
approval remain required. Discount rates and identities in tests are synthetic;
this is not a legal-compliance certification. Discounted checkout remains disabled,
and prepared returns still fail closed for discounted original receipts pending
the versioned qualification extension. Production Neon was untouched.
