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
`demo_runtime_*`. Create the runtime role separately in the new project with
login but NO superuser, CREATEDB, CREATEROLE, BYPASSRLS or owner membership.
Do not use the default Neon owner/administrative role as the application role.
The runtime must have no role memberships, schema-creation or temporary-table
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

`inspect` verifies configuration and connected identity read-only. `init` refuses
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
