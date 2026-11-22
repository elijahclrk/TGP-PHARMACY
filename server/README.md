# TGP Pharmacy API

Express REST API using Node.js ES modules. Run commands from `server`.

```powershell
npm.cmd install
# Only if .env is missing:
Copy-Item .env.example .env
npm.cmd run dev
```

Use `npm.cmd start` for startup without nodemon. The `.cmd` suffix avoids
PowerShell script-policy issues on Windows; other shells can use `npm`.
Set `NODE_ENV=production` in the deployment environment for production.

## Configuration

- `PORT`: API port, default `5000`.
- `CLIENT_ORIGIN`: allowed browser origin, default `http://localhost:5173`.
  Use the exact frontend origin without a trailing slash. Restart after changes.
- `DATABASE_URL`: Neon PostgreSQL connection string, read from `server/.env`.
  Existing process environment variables take precedence. Save the file and
  restart the server after changing it. The pool enforces TLS certificate and
  hostname verification using Node's trusted certificate authorities. URL SSL
  options are removed in memory so they cannot override that policy; the file
  itself is not rewritten. Channel binding is enabled when the server supports it.
  Never commit real credentials; `.env` and environment variants are ignored.

## Health check

```powershell
Invoke-RestMethod http://localhost:5000/api/health
```

Expected HTTP 200 JSON:

```json
{"success":true,"status":"ok","message":"TGP Pharmacy API is running"}
```

This endpoint reports API liveness only. It does not connect to or verify the
database. No tables or business features are implemented.

## Database connectivity

```powershell
npm.cmd run db:check
Invoke-RestMethod http://localhost:5000/api/health/db
```

Both checks execute only `SELECT 1 AS connected` through the shared `pg` pool.
They do not read application data or create or change tables. The endpoint
returns HTTP 200 with `success: true`, `status: "ok"`, and
`message: "Database connection successful"` only after the query succeeds.
Failures return HTTP 503 with a generic message; connection details and raw
database errors are never included. Responses are not cached. Connection and
query timeouts are 10 seconds each.

Run `npm.cmd test` for automated TLS configuration and HTTP response checks.
These tests mock database queries; use `db:check` for a real Neon connection test.

## Structure

- `src/app.js`: Express middleware and routes.
- `src/server.js`: HTTP startup and shutdown.
- `src/config/`: environment validation and lazy PostgreSQL pool.
- `src/routes/`: URL mapping.
- `src/controllers/`: HTTP request handlers.
- `src/middleware/`: JSON error and missing-route responses.
- `src/services/`: reserved for business logic.
- `src/repositories/`: database connectivity query.
- `src/scripts/`: standalone database connectivity test.

CORS controls browser access to responses; it is not authentication.

## Authentication

See [authentication setup and security notes](AUTHENTICATION.md) for API routes,
SRF role mapping, JWT configuration, one-time admin bootstrap and test commands.
No default user/password exists. Sessions currently require a single API process.
