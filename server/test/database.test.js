import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import {listenForFetch} from '../testing/local-http.mjs';
import pg from 'pg';

// Fake credentials ensure automated tests never contact the real database.
process.env.DATABASE_URL = 'postgresql://test:fake-password@localhost/test';
const { createPoolConfig, getPool, closePool } = await import('../src/config/database.js');
const { default: app } = await import('../src/app.js');

let server;
let baseUrl;

before(async () => {
  server = await listenForFetch(app);
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  await closePool();
});

test('URL SSL options cannot disable certificate or hostname verification', () => {
  for (const mode of ['require', 'disable', 'no-verify', 'verify-ca', 'verify-full']) {
    const config = createPoolConfig(`${process.env.DATABASE_URL}?sslmode=${mode}&ssl=0&uselibpqcompat=true`);
    const client = new pg.Client(config);
    assert.equal(client.ssl.rejectUnauthorized, true);
    assert.equal(client.ssl.checkServerIdentity, undefined);
    assert.equal(config.enableChannelBinding, true);
  }
});

test('missing and malformed URLs produce safe errors', () => {
  assert.throws(() => createPoolConfig(''), /^Error: DATABASE_URL must be configured/);
  assert.throws(() => createPoolConfig('not-a-url fake-password'), {
    message: 'DATABASE_URL must be a valid PostgreSQL connection URL.',
  });
});

test('database health returns 200 only after a successful SELECT 1', async t => {
  const query = t.mock.method(getPool(), 'query', async sql => {
    assert.equal(sql, 'SELECT 1 AS connected');
    return { rows: [{ connected: 1 }] };
  });
  const response = await fetch(`${baseUrl}/api/health/db`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), {
    success: true, status: 'ok', message: 'Database connection successful',
  });
  assert.equal(query.mock.callCount(), 1);
});

test('database failures return safe 503 JSON and keep API liveness available', async t => {
  t.mock.method(getPool(), 'query', async () => {
    throw new Error('password=fake-password host=private-host');
  });
  const response = await fetch(`${baseUrl}/api/health/db`);
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), {
    success: false, status: 'unavailable', message: 'Database connection unavailable',
  });
  const health = await fetch(`${baseUrl}/api/health`);
  assert.equal(health.status, 200);
  assert.equal((await health.json()).success, true);
});

test('unexpected query results are not reported as healthy', async t => {
  t.mock.method(getPool(), 'query', async () => ({ rows: [] }));
  const response = await fetch(`${baseUrl}/api/health/db`);
  assert.equal(response.status, 503);
  assert.equal((await response.json()).success, false);
});
