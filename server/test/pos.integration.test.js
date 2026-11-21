import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { listenForFetch } from '../testing/local-http.mjs';
import express from 'express';
import cookieParser from 'cookie-parser';
import { getPool, closePool } from './support/disposable-database.js';
import { createAuthRepository } from '../src/repositories/auth.repository.js';
import { createPosRepository } from '../src/repositories/pos.repository.js';
import { createSessions } from '../src/services/sessions.js';
import { createPosRouter } from '../src/routes/pos.routes.js';
import { errorHandler } from '../src/middleware/error-handler.js';

test('isolated PostgreSQL POS and FEFO checkout', { skip: process.env.RUN_POS_DB_TESTS !== '1' }, async t => {
  // Committed isolated schema is necessary for genuine multi-connection locking tests.
  // Never set public as a fallback search_path; all writes use our owned schema.
  const schema = 'tgp_pos_test_' + randomUUID().replaceAll('-', '');
  assert.match(schema, /^tgp_pos_test_[a-f0-9]{32}$/);
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
    await db.query("INSERT INTO users(user_id,username,password_hash,role,status) VALUES(1,'admin','fixture','admin','active'),(2,'manager','fixture','manager','active'),(3,'employee','fixture','employee','active'),(4,'other','fixture','employee','active')");
    await db.query("INSERT INTO products(product_id,name,unit_price) VALUES(1,'Rounded medicine',1.005),(2,'Second medicine',2.004),(3,'No stock',5),(4,'Concurrent medicine',10),(5,'Huge exact price',9007199254740993.005)");
    const addBatch = (id,product,days,qty) => db.query("INSERT INTO batches(batch_id,product_id,batch_no,expiry_date,qty_on_hand,cost_price,selling_price) VALUES($1,$2,$3,(clock_timestamp() AT TIME ZONE 'Asia/Manila')::date+$4::int,$5,0.50,99)", [id,product,'B'+id,days,qty]);
    await addBatch(11,1,-1,100); await addBatch(12,1,0,100); await addBatch(13,1,1,2); await addBatch(14,1,2,4); await addBatch(15,1,2,3);
    await addBatch(21,2,10,100); await addBatch(41,4,5,5); await addBatch(51,5,5,3);
    await db.query("INSERT INTO batches(batch_id,product_id,batch_no,expiry_date,qty_on_hand) VALUES(16,1,'Unknown expiry',NULL,100),(17,1,'Unknown qty',CURRENT_DATE+10,NULL)");
    const config = { secret: randomBytes(48).toString('hex'), ttl:900,secure:false,origin:'http://localhost:5173' };
    const sessions = createSessions(config);
    const cookies = Object.fromEntries(['admin','manager','employee','other'].map((role,index) => [role,'tgp_session='+sessions.issue(index+1).token]));
    const auth = createAuthRepository(provider), repo = createPosRepository(provider);
    const app = express(); app.use(express.json()); app.use(cookieParser());
    app.use(createPosRouter({ config,sessions,authRepository:auth,repository:repo })); app.use(errorHandler);
    server = await listenForFetch(app);
    const request = async (path,{ role='employee',method='GET',body,origin=config.origin }={}) => {
      const response = await fetch(`http://127.0.0.1:${server.address().port}${path}`,{ method,headers:{ 'Content-Type':'application/json',Origin:origin,'X-TGP-Request':'1',...(role ? { Cookie:cookies[role] } : {}) },...(body ? {body:JSON.stringify(body)} : {}) });
      return { status:response.status,body:await response.json() };
    };
    const checkout = (items,paid,extra={}) => ({ request_id:randomUUID(),items,amount_paid:paid,...extra });
    const post = async (body,role='employee') => {
      if (!Object.hasOwn(body,'quote_token')) body.quote_token=(await request('/quote',{role,method:'POST',body:{items:body.items}})).body.data?.quote_token;
      return request('/checkout',{ role,method:'POST',body });
    };
    const quantity = async id => (await db.query('SELECT qty_on_hand FROM batches WHERE batch_id=$1',[id])).rows[0].qty_on_hand;
    let saleId;
    await t.test('authentication, CSRF and all cashier roles; own-receipt access', async () => {
      assert.equal((await request('/products',{ role:null })).status,401);
      assert.equal((await request('/checkout',{ method:'POST',body:{},origin:'https://invalid.example' })).status,403);
      for (const role of ['admin','manager','employee']) {
        const result = await post(checkout([{product_id:2,quantity:1}],'5.00'),role);
        assert.equal(result.status,201); assert.equal(result.body.data.receipt.total_amount,'2.00');
        assert.equal(result.body.data.receipt.payments[0].change_due,'3.00');
        if (role === 'employee') saleId=result.body.data.receipt.sale_id;
      }
      assert.equal((await request('/sales/'+saleId,{role:'other'})).status,404);
      assert.equal((await request('/sales/'+saleId,{role:'admin'})).status,200);
    });
    await t.test('FEFO eligibility excludes expired, today, null expiry and unknown stock', async () => {
      const products = await request('/products?q=Rounded'); assert.equal(products.status,200);
      assert.equal(products.body.data[0].available,'9'); assert.equal(products.body.data[0].unit_price,'1.01');
      const quote = await request('/quote',{method:'POST',body:{items:[{product_id:1,quantity:7}]}});
      assert.equal(quote.status,200); assert.equal(quote.body.data.total,'7.07');
      assert.equal(await quantity(13),2);
      const response = await post(checkout([{product_id:1,quantity:7}],'10'));
      assert.equal(response.status,201);
      const receipt = response.body.data.receipt;
      assert.deepEqual(receipt.items.map(item => [item.batch_id,item.quantity,item.unit_price]),[[13,2,'1.01'],[14,4,'1.01'],[15,1,'1.01']]);
      assert.equal(receipt.total_amount,'7.07'); assert.equal(receipt.payments[0].change_due,'2.93');
      assert.equal(receipt.approved_by,null);
      for (const id of [11,12,16]) assert.equal(await quantity(id),100);
      assert.equal(await quantity(13),0); assert.equal(await quantity(14),0); assert.equal(await quantity(15),2);
      const stored=(await request('/sales/'+receipt.sale_id)).body.data;
      assert.deepEqual(stored,receipt);
    });
    await t.test('insufficient stock and underpayment reject without partial writes', async () => {
      const beforeQty=await quantity(21);
      assert.equal((await post(checkout([{product_id:2,quantity:1},{product_id:3,quantity:1}],'100'))).status,409);
      assert.equal((await post(checkout([{product_id:1,quantity:3}],'100'))).status,409);
      assert.equal((await post(checkout([{product_id:2,quantity:2}],'3.99'))).status,422);
      assert.equal(await quantity(21),beforeQty);
    });
    await t.test('rejected references remain closed across correction and later retries',async()=>{
      const rejected=checkout([{product_id:2,quantity:1}],'0.01'),before=await quantity(21);
      const failure=await post(rejected);assert.equal(failure.status,422);assert.equal(failure.body.checkout_state,'closed');
      assert.equal((await request('/checkouts/'+rejected.request_id)).body.data.status,'closed');
      const corrected=checkout([{product_id:2,quantity:1}],'10');assert.equal((await post(corrected)).status,201);
      assert.equal((await post({...rejected,amount_paid:'10'})).status,409);assert.equal(await quantity(21),before-1);
      const unused=randomUUID();const resolution=await request('/checkouts/'+unused+'/resolve',{method:'POST',body:{}});
      assert.equal(resolution.body.data.status,'closed');assert.equal((await post({...corrected,request_id:unused})).status,409);
      const paid=await request('/checkouts/'+corrected.request_id+'/resolve',{method:'POST',body:{}});
      assert.equal(paid.body.data.status,'completed');assert.equal(await quantity(21),before-1);
    });
    await t.test('strict payment/cart inputs and discounts/totals cannot be injected', async () => {
      const base=checkout([{product_id:2,quantity:1}],'2.00');
      for (const amount_paid of ['-1','NaN','Infinity','2.001',2,null,'1e3']) assert.equal((await post({...base,amount_paid})).status,400);
      for (const quantity of [-1,0,1.5,'2',null]) assert.equal((await post({...base,items:[{product_id:2,quantity}]})).status,400);
      for (const extra of [{discount_id:1},{total_amount:'0.01'},{vat_exempt:true},{approved_by:1}]) assert.equal((await post({...base,...extra})).status,400);
      assert.equal((await post({...base,items:[{product_id:2,quantity:1,unit_price:'0.01'}]})).status,400);
      assert.equal((await post({...base,items:[{product_id:2,quantity:1},{product_id:2,quantity:1}]})).status,400);
      assert.equal((await request('/products?q='+encodeURIComponent("'; DROP TABLE sales;--"))).body.total,0);
    });
    await t.test('exact monetary arithmetic exceeds JavaScript safe integer precision', async () => {
      const response=await post(checkout([{product_id:5,quantity:2}],'18014398509481987.00'));
      assert.equal(response.status,201);
      assert.equal(response.body.data.receipt.total_amount,'18014398509481986.02');
      assert.equal(response.body.data.receipt.payments[0].change_due,'0.98');
    });
    await t.test('simultaneous competing checkouts cannot oversell', async () => {
      const responses=await Promise.all(['employee','manager'].map(role => post(checkout([{product_id:4,quantity:4}],'40'),role)));
      assert.deepEqual(responses.map(result=>result.status).sort(),[201,409]);
      assert.equal(await quantity(41),1);
    });
    await t.test('concurrent retry returns the same sale once; changed replay rejected', async () => {
      const body=checkout([{product_id:2,quantity:3}],'10'); const beforeQty=await quantity(21);
      const responses=await Promise.all([post(body),post(body)]);
      assert.deepEqual(responses.map(result=>result.status).sort(),[200,201]);
      assert.equal(responses[0].body.data.receipt.sale_id,responses[1].body.data.receipt.sale_id);
      assert.equal(await quantity(21),beforeQty-3);
      assert.equal((await post({...body,amount_paid:'11'})).status,409);
      assert.equal((await post(body,'manager')).status,409);
    });
    await t.test('lost response and API runtime restart recover durable receipt with fresh authenticated session',async()=>{
      const body=checkout([{product_id:2,quantity:2}],'10');const beforeQty=await quantity(21);
      assert.equal((await post(body)).status,201); // discard the receipt as a lost response
      assert.equal((await request('/checkouts/'+body.request_id,{role:'other'})).body.data.status,'not_found');
      assert.equal((await request('/checkouts/'+body.request_id,{role:'admin'})).body.data.status,'not_found');
      await new Promise(resolve=>server.close(resolve));
      const freshSessions=createSessions(config),freshAuth=createAuthRepository(provider),freshRepo=createPosRepository(provider);
      const freshApp=express();freshApp.use(express.json());freshApp.use(cookieParser());
      freshApp.use(createPosRouter({config,sessions:freshSessions,authRepository:freshAuth,repository:freshRepo}));freshApp.use(errorHandler);
      server=await listenForFetch(freshApp);
      assert.equal((await request('/checkouts/'+body.request_id)).status,401);
      cookies.employee='tgp_session='+freshSessions.issue(3).token;
      const status=await request('/checkouts/'+body.request_id);assert.equal(status.body.data.status,'completed');
      const replay=await post(body);assert.equal(replay.status,200);assert.equal(replay.body.data.receipt.sale_id,status.body.data.receipt.sale_id);
      assert.equal(await quantity(21),beforeQty-2);
      // Restore the original dependency objects for subsequent fault injection.
      await new Promise(resolve=>server.close(resolve));server=await listenForFetch(app);cookies.employee='tgp_session='+sessions.issue(3).token;
    });
    await t.test('audit failure rolls back sale, payment, lines and stock together', async () => {
      const counts=async()=> (await db.query('SELECT (SELECT count(*) FROM sales) AS sales,(SELECT count(*) FROM sale_items) AS items,(SELECT count(*) FROM payments) AS payments,(SELECT count(*) FROM activity_logs) AS logs')).rows[0];
      const beforeCounts=await counts(),beforeQty=await quantity(21),original=auth.audit;
      auth.audit=async()=>{throw new Error('Simulated failure')};
      try { assert.equal((await post(checkout([{product_id:2,quantity:2}],'10'))).status,500) } finally {auth.audit=original}
      assert.deepEqual(await counts(),beforeCounts); assert.equal(await quantity(21),beforeQty);
    });
    await t.test('receipt instants are independent of Node host timezone',async()=>{
      // JSON Date has millisecond precision; PostgreSQL retains microseconds.
      const expected=Math.floor(Number((await db.query("SELECT extract(epoch FROM sale_date AT TIME ZONE 'UTC')*1000 AS millis FROM sales WHERE sale_id=$1",[saleId])).rows[0].millis));
      const prior=process.env.TZ;
      try{for(const zone of ['UTC','Asia/Manila','America/New_York']){process.env.TZ=zone;assert.equal(Date.parse((await request('/sales/'+saleId)).body.data.sale_date),expected);}}
      finally{if(prior===undefined)delete process.env.TZ;else process.env.TZ=prior;}
    });
    await t.test('receipts retain sale-time prices and audit has actor and time', async () => {
      await db.query('UPDATE products SET unit_price=99 WHERE product_id=2');
      assert.equal((await request('/sales/'+saleId)).body.data.items[0].unit_price,'2.00');
      const logs=(await db.query("SELECT action,user_id,logged_at FROM activity_logs WHERE module='POS'")).rows;
      const sales=(await db.query('SELECT sale_id,user_id,discount_id,senior_pwd_id,vat_exempt,approved_by FROM sales')).rows;
      assert.equal(logs.length,sales.length);
      for(const sale of sales) { assert(logs.some(log=>log.action===`sale.paid:${sale.sale_id}` && log.user_id===sale.user_id && log.logged_at)); assert.equal(sale.discount_id,null); assert.equal(sale.approved_by,null); assert.equal(sale.vat_exempt,null) }
      await db.query("UPDATE users SET status='inactive' WHERE user_id=3");
      assert.equal((await request('/products')).status,401);
    });
  } finally {
    if(server) await new Promise(resolve=>server.close(resolve));
    if(owned) { await pool.query(`DROP SCHEMA ${schema} CASCADE`); assert.equal((await pool.query('SELECT count(*)::int AS n FROM pg_namespace WHERE nspname=$1',[schema])).rows[0].n,0) }
    try { assert.deepEqual(await snapshot(),before); console.log('Verified POS test schema removed; public counts, constraints and migration history unchanged.') } finally {await closePool()}
  }
});
