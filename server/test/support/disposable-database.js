// Test-only. Never import from application code. No production URL fallback.
import pg from 'pg';
import { createPoolConfig } from '../../src/config/database.js';
import { env as applicationEnv } from '../../src/config/env.js';

const refuse = () => { throw new Error('Write tests refused: a separately authorized, attested disposable PostgreSQL target is required.'); };
function identity(value) {
  try {
    const url = new URL(value);
    if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname || !url.pathname.slice(1)) refuse();
    if ([...url.searchParams.keys()].some(key => !['sslmode','channel_binding'].includes(key))) refuse();
    // Ignore credentials, SSL options and Neon pooler spelling when comparing.
    return { host: url.hostname.toLowerCase().replace('-pooler.', '.'), port: url.port || '5432', database: decodeURIComponent(url.pathname.slice(1)) };
  } catch { refuse(); }
}
export function disposableConfig(settings, productionUrl) {
  if (settings.TEST_DATABASE_DISPOSABLE !== 'true' || !settings.TEST_DATABASE_URL || !productionUrl) refuse();
  const target = identity(settings.TEST_DATABASE_URL), production = identity(productionUrl);
  // Conservative: require a distinct host AND a distinct database name.
  // Separate schemas/users, query options, port changes and aliases are insufficient.
  if (target.host === production.host || target.database === production.database) refuse();
  if (settings.TEST_DATABASE_EXPECTED_HOST !== target.host || settings.TEST_DATABASE_EXPECTED_NAME !== target.database
    || !/^[a-zA-Z0-9_-]{24,128}$/.test(settings.TEST_DATABASE_ATTESTATION || '')) refuse();
  return { config: createPoolConfig(settings.TEST_DATABASE_URL), target, attestation: settings.TEST_DATABASE_ATTESTATION };
}
export async function verifyDisposableClient(client, approved) {
  if (!client.connection?.stream?.encrypted || client.connection.stream.authorized !== true) refuse();
  // First connection is READ ONLY; external provisioning must set this DB-level
  // marker and communicate the random token. This helper never creates a marker.
  await client.query('BEGIN READ ONLY');
  try {
    const row = (await client.query("SELECT current_database() AS database, current_setting('tgp.disposable_test_token',true) AS token, host(inet_server_addr()) AS address, inet_server_port() AS port, (SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()) AS ssl")).rows[0];
    if (row?.database !== approved.target.database || row?.token !== approved.attestation) refuse();
    if (row.ssl !== true || (approved.target.host === '127.0.0.1'
      && (row.address !== '127.0.0.1' || row.port !== Number(approved.target.port)))) refuse();
  } finally { await client.query('ROLLBACK'); }
}
let pool, approval;
export function getPool() {
  approval ??= disposableConfig(process.env, applicationEnv.databaseUrl);
  pool ??= new pg.Pool(approval.config);
  return {
    async connect() {
      const client = await pool.connect();
      try { await verifyDisposableClient(client, approval); return client; }
      catch (error) { client.release(); throw error; }
    },
    async query(...args) {
      const client = await this.connect();
      try { return await client.query(...args); } finally { client.release(); }
    },
  };
}
export async function closePool() { if (pool) await pool.end(); pool = undefined; approval = undefined; }
