# Origin-independent inspection and first Neon read-only result

22 November 2026, Asia/Manila. No commit, push or deployment performed.

## Local correction

The operator's inspect action now returns through an unsigned, inspection-only
configuration before the signature/setup/runtime configuration path. It needs
no Railway origin, JWT or signing key and does not invent an HTTPS domain.
The descriptor cannot pass signed runtime authorization or acquire a capability.

Target and URL validation are shared with the ordinary signed manifest checks:
dedicated database/runtime role, project-ID shape, exact endpoint allowlist,
database/user/port matching and rejection of redirecting URL parameters.
The configured inspection validity window is still enforced. Existing TLS,
SQL identity, privileges, role isolation, UTC/read-only, comments and empty-target
checks remain unchanged.

For init, seed and verify, an exact HTTPS origin is now checked before operator
signing. Runtime configuration retains its required HTTPS-origin validation.
No write-capable action accepts an inspection-only configuration. Operator-only
tools are still excluded from the runtime image and normal production defaults
are unchanged. Existing private configuration was read only, not edited.

## Fresh local tests

Node 24.22.3:

| Run | Result |
|---|---|
| Targeted preflight + academic runtime tests | 80 passed, 0 failed, 0 skipped |
| Complete backend regression with SQL integration explicitly disabled | 207 passed, 0 failed, 14 skipped; 221 reported entries |
| Git whitespace check | Passed; line-ending advisories only |
| Canonical/protected migration checks | Passed in academic/packaging regression |

The targeted run is a subset of the full run, not an additional combined total.
New tests exercise origin-free inspection, inability to authorize runtime,
wrong database/role/host/redirects and expired/future windows. Actual CLI
dispatch is tested with isolated ignored synthetic files and a network-denying
spy: init/seed/verify reject absent, HTTP, trailing-slash and path-containing
origins before signing or connecting. Earlier TLS, permission, membership,
empty-object and cleanup negatives also passed.

No frontend changes were made; frontend/lint/build/browser were not rerun in
this narrowly scoped correction. SQL mutation suites remained disabled and no
retained local demo dataset was touched.

## Actual Neon read-only result: FAIL (operator permissions)

The client explicitly authorized read-only connections to the NEW academic
target. The existing ignored private configuration was used as the actual
Windows user. Additional exact database and operator/runtime name pinning was
checked before invoking the same inspector. No connection URL, endpoint,
password, signing key, database comment or raw SQL result was logged.

Exactly one operator connection was opened. Strict certificate/hostname checks
passed before the transaction. Catalog inspection used BEGIN READ ONLY and
ROLLBACK; the connection was closed on rejection.

| Actual check | Result |
|---|---|
| Explicit local target validation | PASS |
| Operator TLS certificate and hostname | PASS |
| Exact database/current/session role and public schema | PASS |
| UTC session and transaction read-only mode | PASS |
| Operator login and CONNECT | PASS |
| No existing database comment/marker | PASS |
| Operator database-owner membership | FAIL |
| Operator usable database-owner rights | FAIL |
| Operator usable public-schema ownership | FAIL |
| Operator database CREATE privilege | PASS |
| Operator public-schema USAGE | PASS |
| Operator public-schema CREATE | FAIL |
| Runtime connection, memberships, elevated privileges and isolation | NOT REACHED |
| User catalog/schema emptiness | NOT REACHED |

Sanitized refusal: operator_permissions. No migration, grant/revoke, schema or
data mutation, seed, attestation write or reset was attempted. This result does
not establish that the database is empty or that runtime permissions are safe.

## Remaining blockers and safest next action

The new database's owner must review the operator's database and public-schema
authority. Prepare the minimum correction for separate review/authorization;
do not automatically grant owner-role membership or use owner credentials as
the runtime account. No such correction is executed or authorized by this report.
After an approved correction, repeat read-only inspect to reach runtime and
empty-catalog checks. Those may reveal additional blockers.

The future exact Railway HTTPS origin remains required before init, setup/ready
signing, seeding, final verify or deployment. No future database setup is
authorized by a passing connection test.

Current implementation touches operator.mjs, preflight.mjs, manifest.js,
academic-preflight.test.js and the cloud guide, plus this evidence document;
all earlier uncommitted role/preflight work is preserved. The old server/.env
database was never read or connected, private configuration was not overwritten,
and no professor demo, external resource, role or credential was changed.
