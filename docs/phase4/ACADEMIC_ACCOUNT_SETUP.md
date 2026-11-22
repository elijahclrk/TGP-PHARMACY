# Owner-authorized academic login setup

Verified 2026-11-20. This subsequent account setup was explicitly authorized by the project owner for the EXISTING Neon `neondb`. It supersedes earlier reports that the users table was empty. It does not imply instructor/adviser approval, permission to seed business data, or deployment approval.

- Before writes: configured Neon endpoint matched, certificate-verified TLS active, server reported `neondb` and exposed its Neon project identifier; endpoint fingerprint `312f53fe78f6b234`, provider-project fingerprint `ac11111ed352bead`. No connection string or raw credentials are published.
- Initial user count: zero. Migration history/checksums matched original 001/002/004. No existing account was overwritten or duplicated.
- Created exactly one active Admin using the unchanged `src/scripts/bootstrap-admin.js` CLI with credentials passed privately through its process environment.
- Created exactly one active Employee through the existing `createAccount` service, with the Admin actor and a transactional existing-state recheck. Both account creations have existing-table audit events.
- Both passwords were independently generated with cryptographic randomness, stored privately before account writes, and verified against Argon2id hashes. No default/shared password, token, password hash or database URL was printed.
- **18 actual HTTP checks passed** through the local frontend proxy: successful login for both roles, profile/dashboard and permitted reads, Employee supplier/report denial, logout and revoked-session rejection. No password hashes were returned by login responses. Normal authentication audits were recorded.
- Migration history and business records remain unchanged. No Manager, product, supplier, receiving, sale, payment, stock deduction, schema change, migration 006, Cloudinary activation, new database, commit, push or deployment was performed.

## Retrieve credentials privately

Open `server/.env.academic-accounts` in VS Code on a private screen. It contains `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `EMPLOYEE_USERNAME` and `EMPLOYEE_PASSWORD`. Do not paste its contents into chat, terminals, screenshots or tracked documentation. Git ignores the exact file; Windows inheritance is disabled and one explicit current-user full-control ACL protects it. Privileged system administrators can still take ownership as with other local files.

Open **http://localhost:5173/** and use the corresponding username/password fields. Login sessions used for verification were signed out; sign in normally in your browser. No new account setup command is needed, and the bootstrap must not be rerun against the now-populated users table.

Business tables are still empty, so account/dashboard/catalog access works with empty states. There is still no stock, supplier, paid sale or populated report to demonstrate. This authorization covered accounts only; do not generate business transactions just to make the demonstration appear complete. Current-role permissions remain unchanged, and no Manager account was requested or created.

No application source or `.env` connection setting was edited for this setup. The temporary one-time orchestration script was removed; retain the private credential file and this redacted record.
