import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import {listenForFetch} from '../testing/local-http.mjs';
import express from 'express';
import cookieParser from 'cookie-parser';
import { getPool, closePool } from './support/disposable-database.js';
import { createAuthRepository } from '../src/repositories/auth.repository.js';
import { createPurchasingRepository } from '../src/repositories/purchasing.repository.js';
import { createInventoryRepository } from '../src/repositories/inventory.repository.js';
import { createSessions } from '../src/services/sessions.js';
import { createPurchasingRouter } from '../src/routes/purchasing.routes.js';
import { errorHandler } from '../src/middleware/error-handler.js';

test('isolated PostgreSQL purchasing and concurrent posting', { skip: process.env.RUN_PURCHASING_DB_TESTS !== '1' }, async t => {
  // Committed isolated schema is necessary for genuine multi-connection locking tests.
  // Never set public as a fallback search_path; all writes use our owned schema.
  const schema = 'tgp_purchasing_test_' + randomUUID().replaceAll('-', '');
  assert.match(schema, /^tgp_purchasing_test_[a-f0-9]{32}$/);
  let owned = false, server;
  const pool = getPool();
  async function connect() {
    const client = await pool.connect();
    let inTransaction = false;
    return {
      release: () => client.release(),
      async query(sql, values) {
        // Neon transaction pooling does not promise session SET persistence.
        // Every test query gets an explicit transaction-local schema.
        if (sql === 'BEGIN') {
          await client.query('BEGIN'); inTransaction = true;
          return client.query(`SET LOCAL search_path TO ${schema}`);
        }
        if (sql === 'COMMIT' || sql === 'ROLLBACK') {
          try { return await client.query(sql); } finally { inTransaction = false; }
        }
        if (inTransaction) return client.query(sql, values);
        try {
          await client.query('BEGIN');
          await client.query(`SET LOCAL search_path TO ${schema}`);
          const result = await client.query(sql, values);
          await client.query('COMMIT'); return result;
        } catch (error) { await client.query('ROLLBACK'); throw error; }
      },
    };
  }
  const provider = () => ({ connect, query: async (sql, values) => {
    const client = await connect();
    try { return await client.query(sql, values); } finally { client.release(); }
  } });
  const db = provider();
  const baseline = await readFile(new URL('../database/migrations/001_phase3_baseline.sql', import.meta.url));
  const tables = [...baseline.toString().matchAll(/CREATE TABLE (\w+)/g)].map(match => match[1]);
  async function snapshot() {
    const client = await pool.connect();
    try {
      // pg_get_constraintdef qualifies names according to search_path. Use the
      // same catalog-only path for both snapshots, regardless of pooled session.
      await client.query('BEGIN');
      await client.query('SET LOCAL search_path TO pg_catalog');
      const counts = []; for (const table of tables) counts.push((await client.query(`SELECT count(*)::int AS n FROM public.${table}`)).rows[0].n);
      const history = (await client.query('SELECT * FROM public.tgp_schema_migrations ORDER BY version')).rows;
      const constraints = (await client.query("SELECT c.relname,k.conname,pg_get_constraintdef(k.oid) AS definition FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' ORDER BY c.relname,k.conname")).rows;
      return { counts, history, constraints };
    } finally { await client.query('ROLLBACK'); client.release(); }
  }
  const before = await snapshot();
  assert.equal(before.history[0].checksum, createHash('sha256').update(baseline).digest('hex'));
  try {
    await pool.query(`CREATE SCHEMA ${schema}`); owned = true;
    await db.query(baseline.toString());
    for (const filename of ['002_supported_integrity.sql', '004_lookup_indexes.sql']) {
      let sql = (await readFile(new URL('../database/migrations/proposed/' + filename, import.meta.url), 'utf8')).replace(/--[^\n]*/g, '').trim();
      assert(sql.startsWith('BEGIN;') && sql.endsWith('COMMIT;'));
      sql = sql.slice(6, -7).replace(/^\s*SET LOCAL search_path = public;/, '');
      assert(!/\b(public|COMMIT|ROLLBACK|DROP)\b/i.test(sql));
      await db.query(sql);
    }
    await db.query("INSERT INTO users(user_id,username,password_hash,role,status) VALUES(1,'test_admin','fixture','admin','active'),(2,'test_manager','fixture','manager','active'),(3,'test_employee','fixture','employee','active')");
    await db.query("INSERT INTO products(product_id,name,unit_price) VALUES(1,'Test medicine',10),(2,'Second medicine',20)");
    const config = { secret: randomBytes(48).toString('hex'), ttl: 900, secure: false, origin: 'http://localhost:5173' };
    const sessions = createSessions(config);
    const cookies = Object.fromEntries(['admin', 'manager', 'employee'].map((role, index) => [role, 'tgp_session=' + sessions.issue(index + 1).token]));
    const auth = createAuthRepository(provider);
    const repo = createPurchasingRepository(provider);
    const app = express(); app.use(express.json()); app.use(cookieParser());
    app.use(createPurchasingRouter({ config, sessions, authRepository: auth, repository: repo }));
    app.use((_req, res) => res.status(404).json({ success: false })); app.use(errorHandler);
    server = await listenForFetch(app);
    const request = async (path, { role = 'manager', method = 'GET', body, origin = config.origin } = {}) => {
      const response = await fetch(`http://127.0.0.1:${server.address().port}${path}`, { method,
        headers: { 'Content-Type': 'application/json', Origin: origin, 'X-TGP-Request': '1', ...(role ? { Cookie: cookies[role] } : {}) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      return { status: response.status, body: await response.json() };
    };
    const post = (path, body, role = 'manager') => request(path, { method: 'POST', body, role });
    const line = { product_id: 1, batch_no: 'TEST-BATCH', expiry_date: '2099-01-01', cost_price: '5.25', selling_price: '10', quantity: 7 };
    let supplierId, poId, stockId, batchId;
    const receipt = () => ({ supplier_id: supplierId, delivery_ref: 'TEST-DELIVERY', items: [{ ...line }] });
    const qty = async id => (await db.query('SELECT qty_on_hand FROM batches WHERE batch_id=$1', [id])).rows[0].qty_on_hand;
    await t.test('employee and anonymous access denied; CSRF enforced', async () => {
      for (const path of ['/suppliers', '/purchase-orders', '/stock-ins']) {
        assert.equal((await request(path, { role: null })).status, 401);
        assert.equal((await request(path, { role: 'employee' })).status, 403);
        assert.equal((await post(path, {}, 'employee')).status, 403);
        assert.equal((await post(path + '/1/approve', {}, 'employee')).status, 403);
      }
      assert.equal((await request('/suppliers', { method: 'POST', body: { name: 'Test' }, origin: 'https://invalid.example' })).status, 403);
    });
    await t.test('supplier add/edit/list/view, strict validation and no deletion', async () => {
      const result = await post('/suppliers', { name: 'Test Supplier', contact_no: '555', address: 'Fixture address' });
      assert.equal(result.status, 201); supplierId = result.body.data.supplier_id;
      assert.equal((await request(`/suppliers/${supplierId}`, { role: 'admin', method: 'PATCH', body: { name: 'Updated Supplier' } })).status, 200);
      assert.equal((await request(`/suppliers/${supplierId}`)).body.data.name, 'Updated Supplier');
      assert.equal((await request('/suppliers?q=updated&limit=1')).body.total, 1);
      assert.equal((await request('/suppliers?page=2&limit=1')).body.data.length, 0);
      assert.equal((await request('/suppliers?q=' + encodeURIComponent("'; DROP TABLE suppliers;--"))).body.total, 0);
      assert.equal((await post('/suppliers', { name: ' ' })).status, 400);
      assert.equal((await request(`/suppliers/${supplierId}`, { method: 'DELETE' })).status, 404);
    });
    await t.test('purchase orders create/view/approve independently without stock changes', async () => {
      const result = await post('/purchase-orders', { supplier_id: supplierId, items: [{ product_id: 1, quantity: 10, unit_cost: '5.123456789' }] });
      assert.equal(result.status, 201); poId = result.body.data.po_id;
      const detail = (await request(`/purchase-orders/${poId}`)).body.data;
      assert.equal(detail.status, 'pending'); assert.equal(detail.items[0].unit_cost, '5.123456789');
      assert.equal((await post(`/purchase-orders/${poId}/approve`, {})).status, 200);
      assert.equal((await post(`/purchase-orders/${poId}/approve`, {}, 'admin')).status, 409);
      assert.equal((await db.query('SELECT count(*)::int AS n FROM batches')).rows[0].n, 0);
    });
    await t.test('receiving creates zero-stock batches and rejects invalid fields/quantities', async () => {
      for (const quantity of [-1, 0, 1.5, null, '5', 2147483648]) {
        assert.equal((await post('/stock-ins', { ...receipt(), items: [{ ...line, quantity }] })).status, 400);
      }
      for (const extra of [{ qty_on_hand: 5 }, { cost_price: '-1' }, { expiry_date: '2027-02-29' }]) {
        assert.equal((await post('/stock-ins', { ...receipt(), items: [{ ...line, ...extra }] })).status, 400);
      }
      assert.equal((await post('/stock-ins', { ...receipt(), approved_by: 1 })).status, 400);
      const result = await post('/stock-ins', receipt()); assert.equal(result.status, 201); stockId = result.body.data.stock_in_id;
      const detail = (await request(`/stock-ins/${stockId}`)).body.data; batchId = detail.items[0].batch_id;
      assert.equal(detail.received_by, 2); assert.equal(detail.approved_by, null); assert(detail.date_received);
      assert.equal(await qty(batchId), 0);
      assert.equal(detail.items[0].unit_cost, '5.25');
      const inv = createInventoryRepository(provider);
      await assert.rejects(auth.transaction(client => inv.editBatch(client, batchId, { expiry_date: '2098-01-01' })), { status: 409 });
      await assert.rejects(auth.transaction(client => inv.editBatch(client, batchId, { cost_price: '6' })), { status: 409 });
    });
    await t.test('self-approval posts once, records actor/time and preserves PO status', async () => {
      assert.equal((await post(`/stock-ins/${stockId}/approve`, {})).status, 200);
      assert.equal(await qty(batchId), 7);
      assert.equal((await post(`/stock-ins/${stockId}/approve`, {}, 'admin')).status, 409);
      assert.equal(await qty(batchId), 7);
      const detail = (await request(`/stock-ins/${stockId}`)).body.data;
      assert.equal(detail.approved_by, 2); assert.equal(detail.history.length, 2);
      assert(detail.history.every(entry => entry.user_id === 2 && entry.logged_at));
      assert.equal((await request(`/purchase-orders/${poId}`)).body.data.status, 'approved');
    });
    await t.test('simultaneous duplicate approval waits on row lock and posts exactly once', async () => {
      const created = (await post('/stock-ins', receipt())).body.data;
      const detail = (await request(`/stock-ins/${created.stock_in_id}`)).body.data;
      const locker = await connect();
      let settled = 0;
      try {
        await locker.query('BEGIN');
        await locker.query('SELECT stock_in_id FROM stock_ins WHERE stock_in_id=$1 FOR UPDATE', [created.stock_in_id]);
        const calls = ['manager', 'admin'].map(role => post(`/stock-ins/${created.stock_in_id}/approve`, {}, role).then(result => { settled++; return result; }));
        await new Promise(resolve => setTimeout(resolve, 250)); assert.equal(settled, 0);
        await locker.query('COMMIT');
        const results = await Promise.all(calls);
        assert.deepEqual(results.map(result => result.status).sort(), [200, 409]);
      } finally { await locker.query('ROLLBACK'); locker.release(); }
      assert.equal(await qty(detail.items[0].batch_id), 7);
      assert.equal((await request(`/stock-ins/${created.stock_in_id}`)).body.data.history.filter(entry => entry.action.includes('.approved:')).length, 1);
    });
    await t.test('concurrent deliveries create independent batches; references not assumed unique', async () => {
      const records = await Promise.all([post('/stock-ins', receipt()), post('/stock-ins', receipt(), 'admin')]);
      assert(records.every(result => result.status === 201));
      const ids = records.map(result => result.body.data.stock_in_id); assert.notEqual(ids[0], ids[1]);
      const approved = await Promise.all(ids.map(id => post(`/stock-ins/${id}/approve`, {})));
      assert(approved.every(result => result.status === 200));
      const details = await Promise.all(ids.map(id => request(`/stock-ins/${id}`)));
      assert.notEqual(details[0].body.data.items[0].batch_id, details[1].body.data.items[0].batch_id);
      assert(details.every(result => result.body.data.items[0].qty_on_hand === 7));
    });
    await t.test('audit failure rolls back receiving creation and approval stock updates', async () => {
      const created = (await post('/stock-ins', receipt())).body.data;
      const detail = (await request(`/stock-ins/${created.stock_in_id}`)).body.data;
      const counts = async () => (await db.query('SELECT (SELECT count(*) FROM stock_ins) AS records,(SELECT count(*) FROM batches) AS batches,(SELECT count(*) FROM activity_logs) AS logs')).rows[0];
      const beforeFailure = await counts();
      const original = auth.audit; auth.audit = async () => { throw new Error('Simulated audit failure'); };
      try {
        assert.equal((await post('/stock-ins', receipt())).status, 500);
        assert.equal((await post(`/stock-ins/${created.stock_in_id}/approve`, {})).status, 500);
      } finally { auth.audit = original; }
      assert.deepEqual(await counts(), beforeFailure);
      assert.equal(await qty(detail.items[0].batch_id), 0);
      assert.equal((await request(`/stock-ins/${created.stock_in_id}`)).body.data.approved_by, null);
      assert.equal((await post(`/stock-ins/${created.stock_in_id}/approve`, {})).status, 200);
    });
    await t.test('multi-line posting rolls back earlier updates when a later batch cannot accept stock', async () => {
      const created = (await post('/stock-ins', { ...receipt(), items: [line, { ...line, product_id: 2 }] })).body.data;
      const detail = (await request(`/stock-ins/${created.stock_in_id}`)).body.data;
      const ids = detail.items.map(item => item.batch_id).sort((a,b) => a-b);
      await db.query('UPDATE batches SET qty_on_hand=2147483647 WHERE batch_id=$1', [ids[1]]);
      assert.equal((await post(`/stock-ins/${created.stock_in_id}/approve`, {})).status, 409);
      assert.equal(await qty(ids[0]), 0); assert.equal(await qty(ids[1]), 2147483647);
      const after = (await request(`/stock-ins/${created.stock_in_id}`)).body.data;
      assert.equal(after.approved_by, null); assert.equal(after.history.length, 1);
    });
    await t.test('purchasing dates and audit history retain UTC instants across Node timezones',async()=>{
      const prior=process.env.TZ;
      try{
        for(const [path,table,pk,date]of [['/purchase-orders','purchase_orders','po_id','order_date'],['/stock-ins','stock_ins','stock_in_id','date_received']]){
          const original=(await db.query(`SELECT ${pk} AS id,extract(epoch FROM ${date} AT TIME ZONE 'UTC')*1000 AS millis FROM ${table} ORDER BY ${pk} DESC LIMIT 1`)).rows[0];
          const logs=(await db.query("SELECT action,extract(epoch FROM logged_at AT TIME ZONE 'UTC')*1000 AS millis FROM activity_logs")).rows;
          for(const zone of ['UTC','Asia/Manila','America/New_York']){
            process.env.TZ=zone;
            const detail=(await request(path+'/'+original.id)).body.data;
            assert.equal(Date.parse(detail[date]),Math.floor(Number(original.millis)));
            const list=(await request(path)).body.data.find(r=>r[pk]===original.id);assert.equal(Date.parse(list[date]),Math.floor(Number(original.millis)));
            for(const h of detail.history)assert.equal(Date.parse(h.logged_at),Math.floor(Number(logs.find(l=>l.action===h.action).millis)));
          }
        }
      }finally{if(prior===undefined)delete process.env.TZ;else process.env.TZ=prior;}
    });
    await t.test('deactivated managers immediately lose access', async () => {
      await db.query("UPDATE users SET status='inactive' WHERE user_id=2");
      assert.equal((await request('/stock-ins')).status, 401);
      assert.equal((await request('/stock-ins', { role: 'admin' })).status, 200);
    });
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    if (owned) {
      // Exact generated identifier, created by this test; never cascade public objects.
      await pool.query(`DROP SCHEMA ${schema} CASCADE`);
      assert.equal((await pool.query('SELECT count(*)::int AS n FROM pg_namespace WHERE nspname=$1', [schema])).rows[0].n, 0);
    }
    try { assert.deepEqual(await snapshot(), before); console.log('Verified owned test schema removed; public row counts, constraints and migration history unchanged.'); }
    finally { await closePool(); }
  }
});
