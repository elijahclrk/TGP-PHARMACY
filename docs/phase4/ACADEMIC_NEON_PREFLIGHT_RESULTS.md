# Neon academic role compatibility and read-only preflight

22 November 2026, Asia/Manila. Local implementation only, based on
`7662431de92044bda7b0a4fec22f874df3d47d3c` on `academic-cloud-demo`.

## A. Changes

The manifest accepts the exact additional runtime role `tgp_academic_runtime`;
the original `demo_runtime_*` family remains supported. Other `tgp_*` names,
wrong URL users and tampered signed identities remain rejected. For this exact
approved runtime, empty-target inspection requires operator URL identity
`tgp_academic_operator`. SQL current_user and session_user must match the
explicit configured identities. No default owner substitution is permitted.

New operator-only `academic/preflight.mjs` implements comprehensive empty-target
inspection. `operator.mjs inspect` delegates to it before opening any other
connection. The inspector creates no capability and never grants/revokes or
repairs. Seed imports are deferred until the explicit seed path, avoiding
ordinary application dotenv loading during inspection. No operator secrets or
private configuration were generated or read during this implementation.

Replication privilege is now explicitly rejected by both startup verification
and the existing initializer's runtime-role safety check. The operator tooling
remains excluded from Docker; the normal production entry point is unchanged.

## B. Read-only coverage

Both explicit connections require authorized TLS and certificate hostname
matching. Each inspection transaction uses BEGIN READ ONLY and ends with
ROLLBACK, including rejection/error cleanup. Sessions must report UTC/GMT,
read-only mode, public schema and the correct database/current/session role.

The operator needs usable database-owner and public-schema-owner privileges,
CONNECT, database CREATE, schema USAGE and CREATE. Runtime needs login/CONNECT,
no memberships, no elevated/replication flags, no database ownership, no
database/schema CREATE or TEMP, and no CONNECT to other non-template databases.

Any existing database comment, relation, routine, type, non-public user schema,
non-plpgsql extension, event trigger, publication, user operator/collation/
conversion or text-search object causes rejection. Inspection reads catalogs,
not pharmacy records. No existing schema/marker is reused or silently reset.

Success prints verification booleans and changesApplied:false only. Rejections
use fixed check codes; unexpected transport failures use a generic safe CLI
message. Connection URLs, passwords, keys, SQL result rows and object names are
not printed. The check is point-in-time, not a lock or deployment authorization.

## C. Fresh local validation

Runtime: Node 24.22.3.

| Validation | Result |
|---|---|
| Complete backend discovery, database integration explicitly disabled | 197 passed, 0 failed, 14 skipped; 211 reported entries total |
| Frontend full regression | 132 passed in 20 files |
| Frontend ESLint | Passed |
| Production Vite build | Passed; 83 modules |
| Protected 001/002/004 checksum verification | Passed |
| Whitespace and changed-file security review | Passed; no staged files |
| Actual PostgreSQL execution of new preflight SQL | Not run; database activity was not authorized |
| Neon/Railway connection, provisioning, grants, migrations, seeds, deployment | Not performed |
| Browser rehearsal | Not rerun; no frontend behavior changed |

Backend tests use isolated in-memory SQL/TLS fixtures for new checks, including
wrong role/host/database/session, signature mismatch, ownership/privilege and
membership conflicts, every unexpected-object category, existing comments,
UTC/read-only failures, invalid TLS for either actor, rollback/connection cleanup,
and operator import without private dotenv loading. The full backend run
explicitly disabled every PostgreSQL integration flag, cleared database URLs,
and suppressed ordinary dotenv loading. Mock TLS/catalog results do not certify
the actual Neon database or the SQL against its PostgreSQL version.

## D. Remaining external blockers

The supplied Neon project/database/role identities are client-provided. Their
actual SQL privileges, memberships, endpoint ownership, emptiness and TLS have
not been verified. A Console-created elevated role or default PUBLIC privileges
may fail inspection. Password rotation alone does not establish least privilege.
Any required permission correction needs separate review and authorization;
the inspector will not perform it. Unexpected Neon-managed objects also stop for
review rather than being automatically exempted.

The actual project ID/endpoint and new-project provenance must be checked in the
client console; ordinary SQL cannot establish control-plane project ownership.
The input needs an exact valid HTTPS origin and an unexpired signed window of at
most seven days. Operator permissions for future DDL still require separate
validation; inspection does not execute speculative DDL to test them.

## E. Next approved read-only phase

Do not execute until connection approval. Privately configure the existing
Git-ignored `server/academic/private/private.json`, using the new project only.
Set target.role to `tgp_academic_runtime`; use `tgp_academic_operator` in the
operator URL. Do not read/reuse server/.env, overwrite existing private material,
or put secrets in chat, arguments or terminal output. Verify Windows ACL and
OneDrive privacy independently of Gitignore.

```powershell
Set-Location 'C:\Users\spori\OneDrive\Documents\TGP_Pharmacy\server'
$Node24 = 'C:\Users\spori\AppData\Local\Temp\tgp-node24-qZh55x\node.exe'
rtk proxy $Node24 --version
rtk proxy git check-ignore -- academic/private/private.json
rtk proxy $Node24 academic/operator.mjs inspect academic/private/private.json
```

Revalidate the temporary Node path before use. On any refusal, preserve state
and report only the sanitized check code. Stop after inspection; neither success
nor this report authorizes init, seed, permission changes or deployment. The
unchanged future migration order is
001/002/004/003/007/008/009/011/012/010/013.

## Exact changed paths

```text
docs/ACADEMIC_CLOUD_DEMO.md
docs/phase4/ACADEMIC_NEON_PREFLIGHT_RESULTS.md
server/academic/operator.mjs
server/academic/preflight.mjs
server/src/academic/capabilities.js
server/src/academic/manifest.js
server/test/academic-preflight.test.js
server/test/support/academic-fixture.js
```

No source work from previous batches was discarded. No private environment file,
retained professor demo record, role or credential was changed. No database was
connected, migrated or seeded. No production Neon, external service, paid
resource, commit, push or deployment was accessed or performed for this task.
