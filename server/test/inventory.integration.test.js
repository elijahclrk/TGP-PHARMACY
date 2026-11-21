import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import {listenForFetch} from '../testing/local-http.mjs';
import express from 'express';
import cookieParser from 'cookie-parser';
import { getPool, closePool } from './support/disposable-database.js';
import { createAuthRepository } from '../src/repositories/auth.repository.js';
import { createInventoryRepository } from '../src/repositories/inventory.repository.js';
import { createSessions } from '../src/services/sessions.js';
import { createInventoryRouter } from '../src/routes/inventory.routes.js';
import { errorHandler } from '../src/middleware/error-handler.js';

test('isolated PostgreSQL product and inventory HTTP integration', { skip: process.env.RUN_INVENTORY_DB_TESTS !== '1' }, async t => {
  let client, server;
  const schema = 'tgp_inventory_test_' + randomUUID().replaceAll('-', '');
  const config = { secret: randomBytes(48).toString('hex'), ttl: 900, secure: false, origin: 'http://localhost:5173' };
  const sessions = createSessions(config);
  const cookies = Object.fromEntries(['admin', 'manager', 'employee'].map((role, i) => [role, 'tgp_session=' + sessions.issue(i + 1).token]));
  let url, productId, batchId;
  const request = async (path, { role = 'admin', method = 'GET', body, origin = config.origin } = {}) => {
    const response = await fetch(url + path, { method,
      headers: { 'Content-Type': 'application/json', Origin: origin, 'X-TGP-Request': '1', ...(role ? { Cookie: cookies[role] } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, body: await response.json() };
  };
  const product = { name: 'Fixture Alpha', generic_name: 'Fixture Generic', category: 'Fixture Category', unit_price: '12.34567890123456789' };
  const batch = { batch_no: 'Fixture Batch', expiry_date: '2099-01-01', cost_price: '5.25', selling_price: '10.50' };
  try {
    client = await getPool().connect();
    const baseline = await readFile(new URL('../database/migrations/001_phase3_baseline.sql', import.meta.url));
    const tables = [...baseline.toString().matchAll(/CREATE TABLE (\w+)/g)].map(m => m[1]);
    const publicSnapshot = async () => {
      const history = (await client.query('SELECT version,checksum,applied_at FROM public.tgp_schema_migrations ORDER BY version')).rows;
      const counts = []; for (const table of tables) counts.push((await client.query('SELECT count(*)::int AS n FROM public.' + table)).rows[0].n);
      const constraints = (await client.query("SELECT c.relname,k.conname,pg_get_constraintdef(k.oid) AS definition FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' ORDER BY c.relname,k.conname")).rows;
      return { history, counts, constraints };
    };
    const before = await publicSnapshot();
    assert.equal(before.history[0].checksum, createHash('sha256').update(baseline).digest('hex'));
    await client.query('BEGIN'); await client.query('CREATE SCHEMA ' + schema); await client.query('SET LOCAL search_path TO ' + schema);
    await client.query(baseline.toString());
    for (const file of ['002_supported_integrity.sql', '004_lookup_indexes.sql']) {
      let sql = (await readFile(new URL('../database/migrations/proposed/' + file, import.meta.url), 'utf8')).replace(/--[^\n]*/g, '').trim();
      assert(sql.startsWith('BEGIN;') && sql.endsWith('COMMIT;'));
      sql = sql.slice(6, -7).replace(/^\s*SET LOCAL search_path = public;/, '');
      assert(!/\b(public|COMMIT|ROLLBACK|DROP)\b/i.test(sql)); await client.query(sql);
    }
    await client.query("INSERT INTO users(user_id,username,password_hash,role,status) VALUES(1,'admin_fixture','not-a-credential','admin','active'),(2,'manager_fixture','not-a-credential','manager','active'),(3,'employee_fixture','not-a-credential','employee','active')");
    const query = async (sql, values) => {
      if (sql === 'BEGIN') return client.query('SAVEPOINT inventory_operation');
      if (sql === 'COMMIT') return client.query('RELEASE SAVEPOINT inventory_operation');
      if (sql === 'ROLLBACK') { await client.query('ROLLBACK TO SAVEPOINT inventory_operation'); return client.query('RELEASE SAVEPOINT inventory_operation'); }
      return client.query(sql, values);
    };
    const provider = () => ({ query, connect: async () => ({ query, release() {} }) });
    const authRepository = createAuthRepository(provider);
    const app = express(); app.use(express.json()); app.use(cookieParser());
    app.use(createInventoryRouter({ config, sessions, authRepository, repository: createInventoryRepository(provider) }));
    app.use(errorHandler);
    server = await listenForFetch(app); url = 'http://127.0.0.1:' + server.address().port;

    await t.test('authentication, role restrictions and CSRF remain enforced', async () => {
      assert.equal((await request('/products', { role: null })).status, 401);
      assert.equal((await request('/products', { role: 'employee', method: 'POST', body: product })).status, 403);
      assert.equal((await request('/products', { method: 'POST', body: product, origin: 'https://untrusted.invalid' })).status, 403);
      assert.equal((await request('/inventory/batches')).status, 200);
    });
    await t.test('manager creates product; admin alone controls reorder threshold; decimals preserved', async () => {
      const created = await request('/products', { role: 'manager', method: 'POST', body: product });
      assert.equal(created.status, 201); productId = created.body.data.product_id;
      assert.equal(created.body.data.unit_price, product.unit_price); assert.equal(created.body.data.reorder_level, null);
      assert.equal((await request('/products/' + productId, { role: 'manager', method: 'PATCH', body: { reorder_level: 5 } })).status, 403);
      assert.equal((await request('/products', { role: 'manager', method: 'POST', body: { ...product, reorder_level: 5 } })).status, 403);
      assert.equal((await request('/products/' + productId, { method: 'PATCH', body: { reorder_level: 5 } })).status, 200);
    });
    await t.test('search, category, empty results and pagination', async () => {
      await request('/products', { method: 'POST', body: { name: 'Fixture Beta', unit_price: '0', reorder_level: 0 } });
      const listed = await request('/products?limit=1&page=1'); assert.equal(listed.body.total, 2); assert.equal(listed.body.data.length, 1);
      assert.equal((await request('/products?limit=1&page=2')).body.data.length, 1);
      assert.equal((await request('/products?limit=1&page=3')).body.total, 2);
      assert.deepEqual((await request('/products?limit=1&page=3')).body.data, []);
      for (const q of ['alpha', 'GENERIC']) assert.equal((await request('/products?q=' + q)).body.data[0].product_id, productId);
      assert.equal((await request('/products?category=Fixture%20Category')).body.total, 1);
      assert.equal((await request('/products?q=missing')).body.total, 0);
    });
    await t.test('batch creation fixed at zero; metadata edits preserve quantity', async () => {
      const created = await request('/products/' + productId + '/batches', { role: 'manager', method: 'POST', body: batch });
      assert.equal(created.status, 201); batchId = created.body.data.batch_id; assert.equal(created.body.data.qty_on_hand, 0);
      assert.equal((await request('/inventory/batches/' + batchId, { role: 'manager', method: 'PATCH', body: { batch_no: 'Edited fixture' } })).status, 200);
      for (const role of ['admin', 'manager']) {
        for (const qty_on_hand of [-1, 0, 100, null]) {
          assert.equal((await request('/inventory/batches/' + batchId, { role, method: 'PATCH', body: { qty_on_hand } })).status, 400);
          assert.equal((await request('/inventory/batches/' + batchId, { role, method: 'PATCH', body: { batch_no: 'Forbidden mixed update', qty_on_hand } })).status, 400);
        }
      }
      for (const qty_on_hand of [-1, 1, null]) assert.equal((await request('/products/' + productId + '/batches', { method: 'POST', body: { ...batch, qty_on_hand } })).status, 400);
      assert.equal((await client.query('SELECT qty_on_hand FROM batches WHERE batch_id=$1', [batchId])).rows[0].qty_on_hand, 0);
    });
    await t.test('employee cost protection and metadata write prohibition', async () => {
      for (const role of ['admin', 'manager', 'employee']) {
        const result = await request('/inventory/batches?product_id=' + productId, { role });
        assert.equal(result.status, 200); assert.equal(Object.hasOwn(result.body.data[0], 'cost_price'), role !== 'employee');
      }
      assert.equal((await request('/inventory/batches/' + batchId, { role: 'employee', method: 'PATCH', body: { selling_price: '1' } })).status, 403);
      assert.equal((await request('/products/' + productId + '/batches', { role: 'employee', method: 'POST', body: batch })).status, 403);
      assert.equal((await request('/products/' + productId, { role: 'employee', method: 'PATCH', body: { name: 'unauthorized' } })).status, 403);
      assert.equal((await request('/inventory/batches?includeCost=true', { role: 'employee' })).status, 400);
    });
    await t.test('invalid values, IDs, dates and SQL injection resistance', async () => {
      for (const body of [{ name: ' ', unit_price: '1' }, { ...product, unit_price: '-1' }, { ...product, unit_price: 'NaN' }, { ...product, reorder_level: -1 }, { ...product, qty_on_hand: 100 }]) assert.equal((await request('/products', { method: 'POST', body })).status, 400);
      assert.equal((await request('/products/' + productId + '/batches', { method: 'POST', body: { ...batch, expiry_date: '2027-02-29' } })).status, 400);
      for (const query of ['page=0', 'limit=101', 'page=1&page=2']) assert.equal((await request('/products?' + query)).status, 400);
      assert.equal((await request('/products/1%20OR%201=1')).status, 400);
      assert.equal((await request('/products/2147483647')).status, 404);
      assert.equal((await request('/products?q=' + encodeURIComponent("'; DROP TABLE products;--"))).body.total, 0);
      assert.equal((await request('/products?q=%25')).body.total, 0);
      assert.equal((await request('/products?q=_')).body.total, 0);
      assert.equal((await request('/products')).body.total, 2);
    });
    await t.test('low-stock boundary sums multiple batches, handles zero and unknown quantities', async () => {
      // Fixture quantities exist only in the rollback-only test schema.
      await client.query('UPDATE batches SET qty_on_hand=2 WHERE batch_id=$1', [batchId]);
      await client.query("INSERT INTO batches(batch_id,product_id,batch_no,expiry_date,qty_on_hand,cost_price,selling_price) VALUES(100,$1,'second',CURRENT_DATE,3,1,2)", [productId]);
      let row = (await request('/products/' + productId)).body.data;
      assert.equal(row.qty_on_hand, '5'); assert.equal(row.low_stock, true); assert.equal(row.batch_count, 2);
      assert.equal((await request('/inventory/low-stock')).body.total, 2);
      await client.query('UPDATE batches SET qty_on_hand=4 WHERE batch_id=100');
      assert.equal((await request('/products/' + productId)).body.data.low_stock, false);
      await client.query('UPDATE batches SET qty_on_hand=NULL WHERE batch_id=100');
      row = (await request('/products/' + productId)).body.data;
      assert.equal(row.qty_on_hand, null); assert.equal(row.low_stock, null);
      assert.equal((await request('/inventory/low-stock')).body.total, 1);
    });
    await t.test('near-expiry window boundaries and expired/zero/unknown exclusions', async () => {
      await client.query('UPDATE batches SET qty_on_hand=0');
      for (const [id, days, qty] of [[201,-1,1],[202,0,1],[203,30,1],[204,31,1],[205,1,0]]) await client.query("INSERT INTO batches(batch_id,product_id,batch_no,expiry_date,qty_on_hand,cost_price,selling_price) VALUES($1,$2,$3,(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila')::date+$4::int,$5,1,2)", [id, productId, 'expiry-fixture-' + id, days, qty]);
      const near = await request('/inventory/near-expiry', { role: 'employee' });
      assert.equal(near.status, 200); assert.deepEqual(near.body.data.map(r=>r.batch_id), [203,204]);
      assert(near.body.data.every(r=>!Object.hasOwn(r,'cost_price')));
      assert.equal((await request('/inventory/batches?status=expiring_today')).body.total, 1);
      assert.equal((await request('/inventory/batches?status=expired')).body.data[0].batch_id, 201);
      assert.equal((await request('/inventory/near-expiry')).status, 200);
      assert.equal((await request('/inventory/near-expiry?days=366')).status, 400);
    });
    await t.test('historical batch cost guard and audited transactional rollback', async () => {
      await client.query('INSERT INTO sales(sale_id,user_id,total_amount) VALUES(1,1,10)');
      await client.query('INSERT INTO sale_items(sale_item_id,sale_id,batch_id,quantity,unit_price) VALUES(1,1,$1,1,10)', [batchId]);
      assert.equal((await request('/inventory/batches/' + batchId, { method: 'PATCH', body: { cost_price: '99' } })).status, 409);
      const previousAudit = authRepository.audit;
      authRepository.audit = async () => { throw new Error('Simulated failure'); };
      try { assert.equal((await request('/products', { method: 'POST', body: { name: 'Rollback fixture', unit_price: '1' } })).status, 500); }
      finally { authRepository.audit = previousAudit; }
      assert.equal((await request('/products?q=Rollback')).body.total, 0);
      const actions = (await client.query('SELECT action,module,logged_at FROM activity_logs')).rows;
      for (const prefix of ['product.created:', 'product.updated:', 'batch.created_zero_stock:', 'batch.metadata_updated:']) assert(actions.some(row => row.action.startsWith(prefix)));
      assert(actions.every(row => ['products','inventory'].includes(row.module) && row.logged_at));
    });
    await t.test('recorded expired/today receipts are separate from within-date stock and unknown expiry never implies eligibility',async()=>{
      await client.query("INSERT INTO products(product_id,name,unit_price) VALUES(9000,'Expiry-only fixture',1)");
      await client.query(`INSERT INTO batches(batch_id,product_id,batch_no,expiry_date,qty_on_hand,cost_price) VALUES
        (9001,9000,'future',(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila')::date+1,7,1),
        (9002,9000,'today',(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila')::date,3,1),
        (9003,9000,'expired',(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila')::date-1,4,1)`);
      let row=(await request('/products?q=Expiry-only')).body.data[0];
      assert.equal(row.qty_on_hand,'14');assert.equal(row.within_date_qty,'7');assert.equal(row.expired_or_today_qty,'7');
      await client.query("INSERT INTO batches(batch_id,product_id,batch_no,expiry_date,qty_on_hand,cost_price) VALUES(9004,9000,'unknown',NULL,5,1)");
      row=(await request('/products?q=Expiry-only')).body.data[0];assert.equal(row.qty_on_hand,'19');assert.equal(row.within_date_qty,null);
    });
    await t.test('deactivated accounts lose access immediately', async () => {
      await client.query("UPDATE users SET status='inactive' WHERE user_id=2");
      assert.equal((await request('/products', { role: 'manager' })).status, 401);
    });
    await new Promise(resolve => server.close(resolve)); server = null;
    await client.query('ROLLBACK');
    assert.equal((await client.query('SELECT count(*)::int AS n FROM pg_namespace WHERE nspname=$1', [schema])).rows[0].n, 0);
    assert.deepEqual(await publicSnapshot(), before);
    console.log('PASS isolated inventory fixtures removed; public constraints, row counts and migration history unchanged.');
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    if (client) { await client.query('ROLLBACK').catch(() => {}); client.release(); }
    await closePool();
  }
});
