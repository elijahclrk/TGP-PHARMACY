import pg from 'pg';
import { env } from './env.js';

let pool;

export function createPoolConfig(connectionString) {
  if (!connectionString) {
    throw new Error('DATABASE_URL must be configured before using the database.');
  }

  let url;
  try {
    url = new URL(connectionString);
    if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname) {
      throw new Error();
    }
  } catch {
    // URL parsing errors may contain credentials; never pass them through.
    throw new Error('DATABASE_URL must be a valid PostgreSQL connection URL.');
  }

  // pg lets URL SSL options replace the ssl object. Keep TLS policy here so
  // even sslmode=require/no-verify/disable cannot weaken verification.
  for (const key of ['ssl', 'sslmode', 'sslcert', 'sslkey', 'sslrootcert', 'uselibpqcompat']) {
    url.searchParams.delete(key);
  }

  return {
    connectionString: url.toString(),
    ssl: { rejectUnauthorized: true },
    enableChannelBinding: true,
    connectionTimeoutMillis: 10000,
    query_timeout: 10000,
    statement_timeout: 10000,
    idleTimeoutMillis: 30000,
    max: 10,
  };
}

// Create one reusable pool only when a repository needs the database.
export function getPool() {
  if (!pool) {
    pool = new pg.Pool(createPoolConfig(env.databaseUrl));
    pool.on('error', () => {
      console.error('An idle PostgreSQL connection failed.');
    });
  }

  return pool;
}

export async function closePool() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}
