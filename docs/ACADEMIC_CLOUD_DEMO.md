# Full-feature academic cloud runtime

Implementation is local preparation, not authorization to create resources,
connect to Neon, initialize remotely, deploy or change billing. The existing
professor demo and normal `src/server.js` entry point remain separate.

## Scope and trust boundary

The dedicated `src/academic-server.js` serves production React and Express on
one HTTPS origin with Node 24. It supplies benefits, supported exchanges,
linked receiving, preferences and protected return/adjustment/disposition
services only after a signed target and database handshake. Normal production
does not acquire these capabilities by setting a workflow flag.

Every page and internal receipt displays:

**ACADEMIC DEMO — SYNTHETIC DATA ONLY — NOT FOR REAL PHARMACY OPERATIONS**

Cloud report downloads carry the same notice. Existing normal/local reports
remain unchanged. Synthetic benefit customer names must start `SYNTHETIC ` and
IDs `SYNTHETIC-`. No identity-document upload is added. These restrictions cannot
prove that every free-text value is synthetic: distribute credentials privately,
use synthetic entries only, and never share an anonymous Admin login.

No fiscal invoice, professional qualification or statutory compliance is
certified. Lower-value/statutory/discounted/prescription exchanges and returns of
replacement items remain unsupported. The separately qualified test pharmacist
is one explicitly seeded fixture, not every Manager. Returns never automatically
refund cash or restore stock. Independent review and once-only posting remain.

## Dedicated database and credentials: future provisioning prerequisites

Obtain separate authorization before provisioning. Use a NEW EMPTY Neon Free
project, not a branch cloned from operational data, with a dedicated
`tgp_demo_*` database. The signed project ID is operator evidence: ordinary SQL
cannot independently prove a Neon control-plane project ID. The operator must
verify that the actual endpoint belongs to that new project before signing.

Use two credentials: an owner/operator and a runtime role named
`demo_runtime_*`, or the exact approved names `tgp_academic_runtime` and
`tgp_academic_runtime_sql`. Both exact names require `tgp_academic_operator`
for inspection and operator init/seed actions. Other `tgp_*` role
names are not accepted. Create the runtime role separately in the new project with
login but NO superuser, CREATEDB, CREATEROLE, BYPASSRLS or owner membership.
Do not use the default Neon owner/administrative role as the application role.
The runtime must have no role memberships, replication, schema-creation or temporary-table
privileges. Signed catalog verification includes database/schema/table/column
ACLs, so subsequent grant drift also invalidates the authorization.
The operator tool checks the connected database owner and later verifies the
actual runtime grants. No operational URL/password is needed on Railway.

The target manifest binds protocol, setup/ready phase, demo/seed IDs, project ID,
an exact endpoint allowlist, database, role, public schema, migration and catalog
digests, synthetic exchange policy and validity dates (maximum seven days).
Ed25519 signing private keys remain operator-only. A signed database comment is
published by its owner; the runtime role must not own the database or be able to
change that comment. This mechanism must be confirmed on the future Neon target.
Do not replace a failed permission check with an owner runtime credential.

URL host aliases/redirecting query parameters and generic DATABASE_URL fallback
are refused before connecting. TLS certificate and hostname checks remain on.
The pool has a maximum of three connections and verifies role, marker, ledger,
functions, triggers, constraints, indexes and columns on connection checkout.
All initial inspection is READ ONLY. Changed or expired authorization fails
closed. No web setup/seed/reset endpoint exists.

## Operator preparation and explicit actions

These commands are documentation, NOT permission to execute remote writes.
Run with Node 24 from `server`. First create an owner-private directory at
`server/academic/private/`. Protect its Windows ACL or POSIX permissions.
`private.json` and `.env.*` are ignored; operator material is excluded from Docker.

```powershell
rtk proxy <NODE24> academic/operator.mjs prepare academic/private/private.json
```

`prepare` performs no network operation. It exclusively creates a new private
JSON template with distinct random synthetic account passwords, JWT material
and an Ed25519 key pair. It refuses overwrite and nonignored destinations.
Privately fill its new-project ID/endpoint allowlist, operator/runtime URLs,
exact public HTTPS origin and short presentation validity window. Do not alter
existing `.env`, `.env.demo`, local UAT manifests or credentials. Direct Neon
endpoints are the initial supported deployment path; pooling requires a separate
verified allowlist entry and compatibility test.

After explicit target/provisioning approval:

```powershell
rtk proxy <NODE24> academic/operator.mjs inspect academic/private/private.json
rtk proxy <NODE24> academic/operator.mjs init academic/private/private.json
rtk proxy <NODE24> academic/operator.mjs seed academic/private/.env.cloud-initialized
rtk proxy <NODE24> academic/operator.mjs verify academic/private/.env.cloud-initialized
```

`inspect` is an EMPTY-target check, not a post-initialization health check. It
does not require the future Railway HTTPS origin. It validates explicit target
identity/URLs and the configured validity window using an unsigned, inspection-
only descriptor. It neither signs a manifest nor issues a runtime capability;
it does not need the JWT or signing key for this action. Missing origin is not
replaced with a fake domain. The operator requires a valid exact HTTPS origin
before signing for `init`, `seed` or `verify`; runtime validation also continues
to require it. No write-capable action inherits this inspection exception.
The inspection descriptor cannot pass runtime signature/capability verification.

It connects first as the configured operator, then as the configured runtime role,
using only explicit private URLs and certificate/hostname verification. Both
sessions use UTC, public search path and `BEGIN READ ONLY`, followed by
`ROLLBACK` and connection closure even on failure. It never imports the seed
module or the ordinary dotenv configuration.

It verifies exact database/current/session roles, operator usable database and
public-schema ownership, CONNECT/CREATE/USAGE rights, and runtime login. It
refuses runtime memberships, elevated/replication attributes, ownership of any
database, CREATE/TEMP access, and CONNECT to other non-template databases.
It also refuses any existing database comment (including an earlier setup
marker), user relations/functions/types, extra schemas/extensions, event
triggers, publications and other user SQL objects. Only the standard public
schema and plpgsql extension are expected. It performs no SELECT on business
records and never grants, revokes, migrates, seeds or repairs.

Neon Console-created role memberships and default PUBLIC CREATE/TEMP/CONNECT
grants may therefore block a new database. A rotated password does not remove
privileges. Stop with the sanitized check code and request a separately
reviewed least-privilege correction; do not replace runtime credentials with
owner credentials. Catalog checks cannot prove Neon project ownership or
the ability to execute every future DDL operation. Independently confirm the
new project's ID/endpoint and operator authority in the client console.
Inspection is a point-in-time observation; repeat it immediately before any
separately approved initialization. Use `verify` after initialization/seed;
do not rerun empty-target `inspect` against a populated database.

### New Neon target: next read-only phase (separate approval)

The client-provided database `tgp_demo_academic_web` and roles
`tgp_academic_operator` / `tgp_academic_runtime_sql` are supported identities, not
evidence that the actual remote grants or isolation have passed. Do not use the
existing `server/.env`, default `neondb_owner` credential or the professor demo
configuration. Do not run `prepare` over an existing private file or rotate
already prepared signing/JWT material. Fill the existing ignored operator JSON
privately; set `target.role` to `tgp_academic_runtime_sql` and use the actual project
ID/endpoint, not just the project display name. Inspection may run while origin
is blank, but the configured window must still be valid (at most seven days;
the private template default is two days). Signed setup/ready authorization
and all subsequent setup/runtime actions still require a valid exact HTTPS
origin. Stop for review if the window expired.

After explicit approval to connect read-only, use PowerShell from the project:

```powershell
Set-Location 'C:\Users\spori\OneDrive\Documents\TGP_Pharmacy\server'
$Node24 = 'C:\Users\spori\AppData\Local\Temp\tgp-node24-qZh55x\node.exe'
rtk proxy $Node24 --version
rtk proxy git check-ignore -- academic/private/private.json
rtk proxy $Node24 academic/operator.mjs inspect academic/private/private.json
```

The Node path is a currently verified temporary installation; revalidate it or
use another verified Node 24 path if unavailable. Do not put credentials in
commands, chat or terminal output. The JSON must stay privately protected;
Gitignore and POSIX mode bits alone do not establish Windows ACL or OneDrive
privacy. The successful result contains only verification booleans, including
`operatorVerified`, `runtimeVerified`, `emptyDatabase`,
`runtimeRoleIsolation`, `readOnly` and `changesApplied:false`.

On rejection the CLI prints a fixed check code such as `runtime_membership`,
`runtime_ownership_or_ddl`, `runtime_other_database_access`,
`operator_permissions` or `unexpected_database_objects`, with no URL/password.
Connection failures produce a generic safe error. Preserve state and request
review; do not proceed to `init`, `seed`, grants or deployment. A passing inspect
does not authorize any of those actions. No remote preflight has been executed
as part of implementing this support. The later origin-independent inspection
and its operator-permission failure are recorded separately in
`phase4/ACADEMIC_NEON_ORIGIN_INSPECTION_RESULTS.md`.

### Restricted SQL-role transition (no automatic database changes)

The owner reports that the existing Console-created `tgp_academic_runtime` has
administrative attributes and neon_superuser membership. Name compatibility does
not authorize those privileges: runtime/preflight still reject them. Do not use
that credential in the hosted service or silently demote, rename or drop it.
The newly approved identity is exactly `tgp_academic_runtime_sql`; suffix variants
and arbitrary tgp_* names remain rejected. Its SQL creation and grants require
separate authorization and verification.

After the restricted role exists, has a privately assigned password and can log
in, the owner must privately change only these fields in the EXISTING ignored
`academic/private/private.json`:

| Field | Required transition |
|---|---|
| target.role | tgp_academic_runtime_sql |
| runtimeUrl | New restricted role's complete direct URL, same approved endpoint/database and required TLS parameters |

Keep `target.database=tgp_demo_academic_web`, the approved host/project identity,
and `operatorUrl` for tgp_academic_operator. Do not mechanically replace the old
URL username while retaining the old administrative password. Preserve signing
keys, JWT secret, demo/seed IDs and synthetic account passwords; do not rerun
prepare. Check the inspection window and stop for review if expired. Origin may
remain blank for inspect only; subsequent signed/setup/runtime actions still
require the real exact HTTPS origin.

No ready authorization has been published for this transition. Future authorized
init/seed must derive the target role from the updated configuration. Never
hand-edit an already signed manifest, marker or generated runtime checkpoint to
change identities. If initialized/ready state exists, stop for a separate
transition plan rather than applying these fresh-target instructions.

The earlier proposed ownership-transfer SQL used tgp_academic_runtime in its
runtime-isolation guard. Review that guard to use tgp_academic_runtime_sql before
any approval; database/public ownership must still go to the OPERATOR, never
to the runtime. No transfer SQL has been executed or added to application
startup. Verify actual owners, schema ACLs, and neondb_owner's existing CREATEDB
and SET ROLE authority separately. Membership in the same administrative group
does not establish role-to-role ownership-transfer authority.

The initializer's grants and runtime capability checks already use the
manifest's exact role dynamically. They require no migration or identity
substitution. The operator pairing is shared by inspection and init/seed so an
owner-credential substitution cannot bypass it. Privilege/membership, CREATE,
TEMP, cross-database CONNECT, TLS, catalog and attestation checks are unchanged.
PUBLIC privileges can still block a fresh SQL-created role; correcting those
requires a separately scoped ACL plan, not weakening the inspector.

`init` refuses
any nonempty user database, uses a transaction/advisory lock and applies exactly:

**001 / 002 / 004 / 003 / 007 / 008 / 009 / 011 / 012 / 010 / 013**.

Protected migration bytes are unchanged. The business DDL/ledger is committed
atomically. The subsequent explicit grant/attestation phase installs a small
academic-only evidence guard on discounts and pharmacist authorizations. This
is additive operator hardening, not a rewrite of historical migrations. Its
function/trigger definitions are included in the signed catalog digest.

PostgreSQL row locks require UPDATE permission. Only immutable ID-column grants
are added for locked evidence/financial tables. Existing snapshot/policy triggers
and the academic evidence guard reject actual prohibited writes. Runtime cannot
change policy payloads, grant qualifications, create schema or modify the ledger.
The owner retains controlled evidence revocation. The initializer writes a NEW
ignored `.env.cloud-initialized` checkpoint containing the catalog digest; use
that checkpoint for seed/verify. It does not overwrite the input credentials.

`seed` refuses existing accounts, creates labeled synthetic master/policy/role
fixtures, and uses existing transaction services for actual receiving, linked
partial/full deliveries, regular/mixed Senior/PWD sales, return/quarantine,
equal/higher exchange examples, independent adjustments and qualified restock.
All approval/audit records describe real synthetic fixture operations. Setup
capabilities can drive those services but cannot serve the public application.

Only after successful scenarios and reconciliation does the owner publish the
ready signature/completion marker. A NEW ignored `.env.railway` then contains the
runtime configuration. `verify` checks ready state read-only; it does not log in.
Runtime JWT/signing material remains stable between seed and hosting so paid
checkout recovery survives process changes. Do not rotate it casually mid-demo.

Initialization, grants, foundation and scenario services have separate commits.
An interrupted step can leave partial setup. Preserve it; do not rerun seed,
reset, truncate or invent an acknowledgement. If output-file creation fails
after SQL commit, inspect privately before recovery. There is no automatic
partial resume or destructive reset. If authorizations expire, stop for an
explicit reviewed renewal; immutable financial/policy history is not rewritten.

## Railway configuration: separate approval required

For a dedicated service reachable publicly only through Railway HTTP ingress,
set `ACADEMIC_DEMO_HTTPS_MODE` to `railway-edge` and leave
`ACADEMIC_DEMO_TRUSTED_PROXY_CIDRS` unset. Railway enforces HTTPS at the public
edge. Express leaves proxy trust disabled and checks the raw Host against the
exact configured Railway HTTPS origin, rejects a supplied foreign Origin,
and retains Secure cookies and route CSRF checks. Keep TCP Proxy disabled and
keep untrusted services out of the Railway environment, since private networking
can reach the container without passing through the public edge. Host alone
does not authenticate the edge. The direct TLS and verified CIDR modes remain
available when Railway edge mode is unset.

For the exact academic database and restricted SQL identity, an optional signed
`target.managedPostgresDigest` permits the reviewed Neon-managed `postgres`
access. Collect the candidate hash with the operator CLI action
`review-managed-postgres` after separately approved role activation and ACL
setup. Review the provider catalog against the audited definitions before
pinning the hash. Never approve a replacement hash solely to clear a failure.
With the hash configured, inspect and runtime startup check the same direct
endpoint over TLS and compare effective grants and object metadata. Without
the hash, the empty-target inspector retains its strict CONNECT rule.

This policy accepts provider PUBLIC CONNECT, TEMP and large-object creation
capabilities in `postgres`. It does not enforce database-wide write isolation
there. The catalog check covers non-system application objects and existing
accessible large objects at inspection and startup. It does not monitor an
already-running process continuously. Keep this project dedicated to synthetic
data and restart/reverify after provider or ACL changes. Keep owner credentials
local. Only the restricted credential and signed runtime authorization belong
in Railway.

Use a single service with repository-root Docker build context. The existing
Dockerfile pins Node 24, builds React and runs nonroot. Override the service start
command to **`node src/academic-server.js`**; the normal default command remains
unchanged. Supply the runtime variables in `deploy/academic-demo.env.example`
privately using the generated runtime checkpoint. Never upload the operator
JSON/private key/password file or supply a generic DATABASE_URL/TEST_DATABASE_URL.
Do not include operator credentials or a Neon management API key in the service.

Railway supplies PORT; use one generated HTTPS domain and its exact origin as
CLIENT_ORIGIN. Configure `/api/health` as the deployment health path. That path
is liveness plus current demo authorization; `/api/health/db` performs the
verified pool checkout and a SELECT. Neither triggers setup or repair.

HTTPS is required for all paths except liveness. Explicitly list only ingress
CIDRs independently verified from the actual Railway topology if TLS terminates
at a proxy. Blank trusts no proxy. Do not guess a hop count, trust all addresses,
disable Secure cookies, or increase login limits to conceal a proxy problem.
Actual Railway ingress verification remains a deployment acceptance gate.

The academic runtime admits at most eight concurrent API requests and one export;
busy requests return controlled 503 errors. Body/report size restrictions and
existing authentication limits remain. Use one API instance: JWT session
allowlisting is process-local and restarts revoke sessions. Preserve saved
checkout references after re-login. No scheduled reset or always-awake traffic.

## Validation and release gates

Local tests must run only through the existing attested disposable harness. New
fixtures own their schemas/databases/roles and never modify the retained professor
schema. The real-role test uses a separate short-lived LOCAL database, validates
actual grants, and disposes only that test database/role. Cloud endpoint/SAN
identity is explicitly simulated; no test connects to Neon.

Chrome uses a test bridge: browser requests at the synthetic HTTPS origin are
fulfilled from the real local HTTPS application with strict CA and hostname
verification. No ignore-certificate option is used. This proves the React/API/
cookie workflows locally, not Railway's ingress or Neon's actual certificate.
Certificates/private test artifacts stay outside Git in temporary directories.

Before provisioning/deployment: review code/diff/secret scan and hashes; rerun
Node 24 frontend/backend/isolated SQL tests, lint/build, real Linux image/runtime,
HTTPS/proxy checks, critical workflows, download reconciliation and idle/restart
recovery. Hosted CI startup failures are not passing release evidence.

No commercial readiness or zero-cost availability is promised. Check actual
Free quotas and memory peaks before a scheduled presentation. Free service sleep
and quota exhaustion can interrupt access. Keep the existing local professor demo
as the fallback; never reset it as part of cloud setup. No paid upgrade, billing
change, production connection, commit/push or deployment is authorized here.
