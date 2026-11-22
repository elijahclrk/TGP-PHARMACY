// Explicitly read-only verification. No migration/seed/bootstrap or writer is
// imported or invoked. Safe output: counts, test labels and TLS booleans only.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { getPool, closePool } from '../config/database.js';
import { createInventoryRepository } from '../repositories/inventory.repository.js';
import { createPurchasingRepository } from '../repositories/purchasing.repository.js';
import { createPosRepository } from '../repositories/pos.repository.js';
import { createReportsRepository } from '../repositories/reports.repository.js';
import { createAuthRepository } from '../repositories/auth.repository.js';
import { createAuditRepository } from '../repositories/audit.repository.js';
import { manilaBusinessDate, threeMonthsAfter } from '../services/expiry-policy.js';

let client;
try {
  client = await getPool().connect();
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  assert.equal((await client.query('SHOW transaction_read_only')).rows[0].transaction_read_only, 'on');
  assert(client.connection.stream.encrypted && client.connection.stream.authorized);
  const baseline = await readFile(new URL('../../database/migrations/001_phase3_baseline.sql', import.meta.url));
  const original = await readFile(new URL('../../../docs/phase3/tgp_database.sql', import.meta.url));
  assert(baseline.equals(original));
  const tables = [...baseline.toString().matchAll(/CREATE TABLE (\w+)/g)].map(match => match[1]);
  assert.equal(tables.length, 15);
  const counts = {};
  for (const table of tables) counts[table] = (await client.query('SELECT count(*)::int AS n FROM ' + table)).rows[0].n;
  const history = (await client.query('SELECT version,checksum FROM tgp_schema_migrations ORDER BY version')).rows;
  const files = ['001_phase3_baseline.sql', 'proposed/002_supported_integrity.sql', 'proposed/004_lookup_indexes.sql'];
  assert.equal(history.length, files.length);
  for (let index = 0; index < files.length; index++) {
    const bytes = await readFile(new URL('../../database/migrations/' + files[index], import.meta.url));
    assert.equal(history[index].version, files[index].split('/').at(-1));
    assert.equal(history[index].checksum, createHash('sha256').update(bytes).digest('hex'));
  }
  const provider = () => client, inventory = createInventoryRepository(provider), purchasing = createPurchasingRepository(provider);
  const pos = createPosRepository(provider), reports = createReportsRepository(provider);
  const query = { q: '', page: 1, limit: 5 }, range = { from: manilaBusinessDate(), to: manilaBusinessDate() };
  const checks = [
    ['products', () => inventory.products({ ...query, category: '', stock: 'all' })],
    ['low-stock', () => inventory.products({ ...query, category: '', stock: 'low' })],
    ...['all', 'near_expiry', 'expiring_today', 'expired'].map(status => ['batches-' + status, () => inventory.batches({ ...query, status }, false)]),
    ['batches-management', () => inventory.batches({ ...query, status: 'all' }, true)],
    ['suppliers', () => purchasing.list('suppliers', query)],
    ...['orders', 'receiving'].flatMap(type => ['all', 'pending', 'approved'].map(status => [type + '-' + status, () => purchasing.list(type, { ...query, status })])),
    ['pos-search', () => pos.products(query)],
    ...['day', 'week', 'month'].map(period => ['sales-' + period, () => reports.sales({ ...range, period })]),
    ['product-report', () => reports.products({ ...range, page: 1, limit: 5 })],
    ['profit', () => reports.profit(range)], ['valuation', () => reports.valuation()],
    ['accounts', () => createAuthRepository(provider).listUsers(query)],
    ['audit', () => createAuditRepository(provider).list({ ...query, module: '' })],
  ];
  for (const [label, read] of checks) {
    const result = await read();
    if (label.startsWith('batches-')) assert.equal(result.near_expiry_through, threeMonthsAfter(result.business_date));
  }
  const dates = ['2026-01-31', '2025-11-30', '2023-11-30', '2026-11-21', '2026-12-31'];
  for (const date of dates) {
    const result = await client.query("SELECT to_char(($1::date + interval '3 months')::date,'YYYY-MM-DD') AS boundary", [date]);
    assert.equal(result.rows[0].boundary, threeMonthsAfter(date));
  }
  const midnight = await client.query("SELECT to_char(($1::timestamptz AT TIME ZONE 'Asia/Manila')::date,'YYYY-MM-DD') AS day", ['2026-11-20T16:00:00Z']);
  assert.equal(midnight.rows[0].day, '2026-11-21');
  await client.query('ROLLBACK');
  console.log(JSON.stringify({ transaction_read_only: true, client_tls_verified: true, counts,
    original_schema_unchanged: true, migration_checksums_match: true,
    migrations: history.map(row => row.version), repository_reads_passed: checks.length, postgres_date_checks_passed: dates.length + 1 }));
} catch {
  console.error('Read-only batch verification failed; private connection/error details suppressed.');
  process.exitCode = 1;
} finally {
  if (client) { await client.query('ROLLBACK').catch(() => {}); client.release(); }
  await closePool();
}
