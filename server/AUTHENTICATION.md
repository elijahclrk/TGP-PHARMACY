# Authentication and access control

Implemented scope: login, authenticated user, logout/revocation, admin-created
staff accounts, account deactivation and role dashboard placeholders. Inventory,
POS, reporting, pricing and approval operations are not implemented.

## Requirements and roles

Sources: `docs/phase1/TGP_SystemRequestForm.pdf` Sections 5-6 (page 3), and
`docs/phase3/tgp_database.sql`. Employee = Pharmacy Assistant, Manager =
Pharmacist, Admin = Owner/Pharmacist-in-Charge. Managers inherit employee access;
admins inherit both. Section 6 assigns employee/manager account management to
admins. Accordingly, the public-facing account API cannot create or deactivate
admin accounts. The initial admin is created only through the bootstrap CLI.
No public registration or password-reset/setup endpoint exists.

| Endpoint | Access |
| --- | --- |
| POST `/api/auth/login` | Valid assigned credentials and trusted origin |
| GET `/api/auth/me` | Active authenticated account |
| POST `/api/auth/logout` | Trusted origin; revokes current session, clears cookie |
| GET `/api/auth/dashboard/admin` | Admin |
| GET `/api/auth/dashboard/manager` | Admin or manager |
| GET `/api/auth/dashboard/employee` | Any of the three roles |
| POST `/api/auth/users` | Admin; creates employee or manager only |
| POST `/api/auth/users/:id/deactivate` | Admin; employee/manager targets only |

Create body: `username`, `password`, `role`, optional `full_name`. No client ID,
status or hash is accepted. Login body: `username`, `password`. Logout and
deactivate body: `{}`. Unknown fields are rejected. Usernames are case-sensitive,
1-64 ASCII letters, digits, underscore, dot or hyphen; creation passwords are
12-128 characters (not trimmed); names are 1-120 trimmed characters if supplied.
These are technical input limits, not additional pharmacy workflow requirements.

## Security and schema preservation

- Argon2id: 19 MiB memory, 2 iterations, parallelism 1; unique salts from library.
- JWT: HS256 only; fixed issuer/audience; 15-minute expiry by default, no refresh
  token. JWT includes subject/session ID, not user details, password or role.
- Cookie: HttpOnly, SameSite=Strict, host-only, path `/api`; Secure and a
  `__Secure-` name in production. React stores user display state in memory only.
  Tokens are never returned in JSON or stored in localStorage/sessionStorage.
- Each protected request verifies JWT plus server allowlist and re-reads active
  status and current role from PostgreSQL. Unknown/null status fails closed.
- Logout removes the session from the allowlist. Deactivation removes that
  user's sessions. Expired sessions are pruned; registry capacity is bounded.
- The registry and login limiter are process-local. Run ONE API process. Restart
  revokes all sessions. Multi-instance deployments require a reviewed shared
  session/revocation and limiter store before scaling; sticky sessions alone
  are insufficient. No auth table or schema migration was introduced.
- Browser mutations require exact `CLIENT_ORIGIN` and `X-TGP-Request: 1`.
  CORS allows only that configured origin and credentials. This includes login
  and logout to prevent login CSRF. Postman must send these headers too.
- Login limit: 10 attempts per IP per 15 minutes, including successful attempts.
  Unknown usernames still incur Argon2 verification; invalid and inactive
  credentials receive the same generic 401 message. Reverse-proxy trust is not
  enabled blindly; review trusted hops and client-IP behavior before deployment.
- Parameterized SQL; safe response projections exclude password hashes.
- Account changes recheck the acting admin within a serialized transaction.
  Audit failure rolls back account creation/deactivation. Self-deactivation and
  admin-target deactivation are rejected to preserve initial admin access.
- Existing integer PKs are assigned by cryptographic random generation with
  bounded collision retries. No sequence, MAX(id)+1, table or column was added.
- Successful login/logout, bootstrap, creation and deactivation use the existing
  activity_logs table. Actions contain event names and target numeric IDs only.
  Unknown-user login attempts cannot truthfully supply its required user FK;
  they are throttled, not attached to a fabricated account. No token, credential,
  password hash, or attempted password is written to logs.

## Environment and running locally

Existing DATABASE_URL and TLS settings are unchanged. A random local JWT_SECRET
was generated directly into ignored `server/.env` without printing it. Production
must supply its own random secret (at least 32 bytes), `NODE_ENV=production`,
HTTPS, and the exact frontend `CLIENT_ORIGIN`. Secret rotation revokes JWTs.
JWT_TTL_SECONDS defaults to 900 and is limited to 60-3600.

The frontend uses relative `/api` requests. Vite proxies them to localhost:5000.
For deployment, serve the frontend and API under one origin, with `/api` reverse
proxied to Express and SPA fallback for dashboard routes. Do not deploy with
development HTTP cookie settings. No secret uses a VITE_ environment variable.

## One-time admin bootstrap

1. Supply BOOTSTRAP_ADMIN_USERNAME, BOOTSTRAP_ADMIN_PASSWORD and optionally
   BOOTSTRAP_ADMIN_NAME in the process environment or ignored `server/.env`.
   Choose a unique strong password meeting the limit above; no default exists.
   Do not put secrets in command arguments, shared shell history or chat.
2. From `server`, run `npm.cmd run admin:bootstrap`.
3. Remove the bootstrap variables immediately, then sign in through the UI.

The CLI forces role admin and active status, hashes the password, locks/rechecks
that users is empty, and inserts the account and audit entry in one transaction.
It refuses if ANY account already exists. No real admin or default credentials
were created by this implementation task. Initial users must be bootstrapped by
the operator with their own credentials.

## Verification

`npm.cmd test` runs offline backend password/JWT/cookie/CSRF/rate-limit tests and
mocked health checks. The real PostgreSQL suite is explicitly opt-in:

```powershell
$env:RUN_AUTH_DB_TESTS = '1'
npm.cmd run test:auth:db
Remove-Item Env:RUN_AUTH_DB_TESTS
```

It creates a unique test schema inside an outer transaction, applies isolated
copies of 001/002/004, exercises HTTP endpoints with real PostgreSQL repositories
and Argon2, and rolls everything back. Fixtures never go into public. It verifies
public row counts and migration history are unchanged. Neither 003 nor 005 runs.
Do not run the isolated suite concurrently with real schema/data administration.

From `client`, run `npm.cmd test`, `npm.cmd run lint`, and `npm.cmd run build`.
React tests use jsdom and mocked HTTP responses; they are not a visual browser or
end-to-end browser test. Browser automation was unavailable during this task.

The historical database initialization runners deliberately require empty
application tables and will stop after bootstrapping. Do not use them to reset
accounts or rerun the baseline. The schema's deferred inventory rules remain
outside authentication scope.
