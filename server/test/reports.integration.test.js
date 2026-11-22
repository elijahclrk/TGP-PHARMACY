import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import {listenForFetch} from '../testing/local-http.mjs';
import express from 'express';
import cookieParser from 'cookie-parser';
import { getPool, closePool } from './support/disposable-database.js';
import { createAuthRepository } from '../src/repositories/auth.repository.js';
import { createPosRepository } from '../src/repositories/pos.repository.js';
import { createSessions } from '../src/services/sessions.js';
import { createReportsRouter } from '../src/routes/reports.routes.js';
import { createReportsRepository } from '../src/repositories/reports.repository.js';
import { createInventoryRepository } from '../src/repositories/inventory.repository.js';
import { errorHandler } from '../src/middleware/error-handler.js';
import ExcelJS from 'exceljs';

test('isolated PostgreSQL read-only reporting', { skip: process.env.RUN_REPORTS_DB_TESTS !== '1' }, async t => {
  // Committed isolated schema is necessary for genuine multi-connection locking tests.
  // Never set public as a fallback search_path; all writes use our owned schema.
  const schema = 'tgp_reports_test_' + randomUUID().replaceAll('-', '');
  assert.match(schema, /^tgp_reports_test_[a-f0-9]{32}$/);
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
    await db.query("INSERT INTO users(user_id,username,password_hash,role,status) VALUES(1,'admin','fixture','admin','active'),(2,'manager','fixture','manager','active'),(3,'employee','fixture','employee','active')");
    await db.query("INSERT INTO products(product_id,name,category,unit_price,reorder_level) VALUES(1,'Medicine','Confirmed fixture',1.005,10),(2,'Precise',NULL,9007199254740993.01,0)");
    await db.query("INSERT INTO suppliers(supplier_id,name) VALUES(1,'Fixture'); INSERT INTO stock_ins(stock_in_id,supplier_id,received_by,approved_by) VALUES(1,1,2,1)");
    await db.query("INSERT INTO batches(batch_id,product_id,batch_no,expiry_date,qty_on_hand,cost_price) VALUES(1,1,'A',CURRENT_DATE+20,5,0.25),(2,1,'B',CURRENT_DATE+30,5,0.25),(3,2,'C',CURRENT_DATE+30,2,1)");
    await db.query("INSERT INTO stock_in_items(item_id,stock_in_id,batch_id,quantity,unit_cost) VALUES(1,1,1,5,0.25),(2,1,2,5,0.25),(3,1,3,2,1)");
    const auth=createAuthRepository(provider),pos=createPosRepository(provider);
    const actor={user_id:3,role:'employee',status:'active'};
    const sale=async(items,paid)=>auth.transaction(async client=>{
      const data={items,amount_paid:paid,request_id:randomUUID()};
      const quote=await pos.quote(client,data);
      return pos.checkout(client,actor,data,auth.audit,quote.fingerprint);
    });
    const first=(await sale([{product_id:1,quantity:6}],'10')).receipt;
    const second=(await sale([{product_id:1,quantity:1}],'2')).receipt;
    const huge=(await sale([{product_id:2,quantity:1}],'9007199254740994')).receipt;
    // Only isolated fixtures are moved to deterministic boundary dates.
    await db.query("UPDATE sales SET sale_date='2026-01-04 15:59:59' WHERE sale_id=$1",[first.sale_id]);
    await db.query("UPDATE sales SET sale_date='2026-01-04 16:00:00',approved_by=1 WHERE sale_id=$1",[second.sale_id]);
    await db.query("UPDATE sales SET sale_date='2026-02-01 00:00:00' WHERE sale_id=$1",[huge.sale_id]);
    await db.query("INSERT INTO sales(sale_id,user_id,sale_date,total_amount) VALUES(100,3,'2026-01-04 10:00:00',99)");
    const config={secret:randomBytes(48).toString('hex'),ttl:900,secure:false,origin:'http://localhost:5173'};
    const sessions=createSessions(config),cookies=Object.fromEntries(['admin','manager','employee'].map((role,i)=>[role,'tgp_session='+sessions.issue(i+1).token]));
    const app=express();app.use(cookieParser());app.use(createReportsRouter({config,sessions,authRepository:auth,repository:createReportsRepository(provider),inventoryRepository:createInventoryRepository(provider)}));app.use(errorHandler);
    server=await listenForFetch(app);
    const get=async(path,role='admin')=>{const r=await fetch(`http://127.0.0.1:${server.address().port}${path}`,{headers:role?{Cookie:cookies[role]}:{}});return {status:r.status,body:await r.json()}};
    const range='from=2026-01-04&to=2026-01-05';
    const fixtureSnapshot=async()=>{const rows=[];for(const table of tables) rows.push((await db.query(`SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]'::jsonb) AS rows FROM ${table} t`)).rows[0].rows);return rows};
    const unchanged=await fixtureSnapshot();
    await t.test('fully paid actual POS sales included regardless of approval; unpaid excluded without join multiplication',async()=>{
      const r=await get('/sales?'+range);assert.equal(r.status,200);assert.equal(r.body.sales_amount,'7.07');assert.equal(r.body.transactions,2);assert.equal(r.body.reviewed,1);assert.equal(r.body.unreviewed,1);assert.equal(r.body.excluded_records,1);
      assert.equal(r.body.data[0].sales_amount,'6.06');assert.equal(r.body.data[1].sales_amount,'1.01');
      const p=await get('/products?'+range);assert.equal(p.body.data[0].units,'7');assert.equal(p.body.data[0].sales_amount,'7.07');assert.equal(p.body.data[0].transactions,2);
    });
    await t.test('Manila midnight, Monday week and calendar month grouping',async()=>{
      const day=await get('/sales?from=2026-01-05&to=2026-01-05');assert.equal(day.body.sales_amount,'1.01');
      const week=await get('/sales?'+range+'&period=week');assert.deepEqual(week.body.data.map(row=>row.period_start),['2025-12-29','2026-01-05']);
      const month=await get('/sales?from=2026-01-01&to=2026-02-28&period=month');assert.deepEqual(month.body.data.map(row=>row.period_start),['2026-01-01','2026-02-01']);assert.equal(month.body.sales_amount,'9007199254741000.08');
    });
    await t.test('RBAC blocks employee reports and manager financial detail/monthly access',async()=>{
      for(const path of ['/sales?'+range,'/products?'+range,'/profit?'+range,'/valuation','/low-stock','/near-expiry'])assert.equal((await get(path,'employee')).status,403);
      assert.equal((await get('/sales?'+range,null)).status,401);
      assert.equal((await get('/sales?'+range,'manager')).status,200);
      assert.equal((await get('/sales?'+range+'&period=week','manager')).status,200);
      for(const path of ['/sales?'+range+'&period=month','/products?'+range,'/profit?'+range,'/valuation'])assert.equal((await get(path,'manager')).status,403);
    });
    await t.test('strict bounded date filters, pagination and empty datasets',async()=>{
      for(const query of ['from=2026-02-30&to=2026-03-01','from=2026-01-05&to=2026-01-04','from=2024-01-01&to=2026-01-01',range+'&from=2026-01-01',range+'&period=quarter',range+'&approved=true'])assert.equal((await get('/sales?'+query)).status,400);
      const empty=await get('/sales?from=2025-01-01&to=2025-01-02');assert.equal(empty.body.sales_amount,'0.00');assert.deepEqual(empty.body.data,[]);
      assert.equal((await get('/products?'+range+'&limit=101')).status,400);
      assert.deepEqual((await get('/products?'+range+'&page=2&limit=1')).body.data,[]);
    });
    await t.test('inventory and verified cost estimates retain exact arithmetic',async()=>{
      const low=await get('/low-stock','manager');assert.equal(low.body.total,1);assert.equal(low.body.data[0].qty_on_hand,'3');
      const near=await get('/near-expiry','manager');assert.equal(near.body.total,2);assert(near.body.data.every(row=>!Object.hasOwn(row,'cost_price')));
      const value=await get('/valuation');assert.equal(value.body.cost_value,'1.75');assert.equal(value.body.unverified_batches,0);
      const profit=await get('/profit?'+range);assert.equal(profit.body.cost_amount,'1.75');assert.equal(profit.body.gross_profit,'5.32');assert.equal(profit.body.gross_margin_percent,'75.25');
      assert.deepEqual(await fixtureSnapshot(),unchanged);
    });
    await t.test('transaction/category/slow-moving views reconcile and enforce Admin filters',async()=>{
      const transactions=await get('/transactions?'+range);assert.equal(transactions.status,200);assert.equal(transactions.body.total,2);assert.deepEqual(transactions.body.data.map(x=>x.sales_amount),['6.06','1.01']);
      const categories=await get('/categories?'+range);assert.equal(categories.body.data[0].sales_amount,'7.07');
      const slow=await get('/slow-moving?'+range+'&max_units=0');assert.equal(slow.body.data.length,1);assert.equal(slow.body.data[0].product_id,2);assert.equal(slow.body.data[0].units,'0');
      for(const kind of ['transactions','categories','slow-moving','returns']){
        assert.equal((await get('/'+kind+'?'+range,'manager')).status,403);
        assert.equal((await get('/'+kind+'?'+range,'employee')).status,403);
      }
      assert.equal((await get('/slow-moving?'+range+'&max_units=-1')).status,400);
      assert.deepEqual(await fixtureSnapshot(),unchanged);
    });
    await t.test('exports enforce Admin RBAC, filters and actual readable Excel/PDF bytes',async()=>{
      for(const kind of ['sales','transactions','products','categories','best-selling','slow-moving','returns','profit','valuation','low-stock','near-expiry'])for(const format of ['xlsx','pdf']){
        const path='/'+kind+'/export?'+(['valuation','low-stock','near-expiry'].includes(kind)?'':range+'&')+'format='+format;
        for(const role of ['manager','employee'])assert.equal((await get(path,role)).status,403);
        const response=await fetch(`http://127.0.0.1:${server.address().port}`+path,{headers:{Cookie:cookies.admin}});
        assert.equal(response.status,200);const bytes=Buffer.from(await response.arrayBuffer());
        assert.equal(bytes.subarray(0,format==='pdf'?4:2).toString(),format==='pdf'?'%PDF':'PK');
      }
      assert.equal((await get('/sales/export?'+range+'&format=csv')).status,400);
      assert.equal((await get('/products/export?'+range+'&format=xlsx&page=2')).status,400);
      assert.deepEqual(await fixtureSnapshot(),unchanged);
    });
    await t.test('legacy return rows are reported separately and never erase paid transactions',async()=>{
      await db.query("INSERT INTO sale_returns(return_id,sale_id,processed_by,quantity,reason,return_date) VALUES(77,$1,3,1,'Synthetic legacy','2026-01-05')",[first.sale_id]);
      const returns=await get('/returns?'+range);assert.equal(returns.body.data[0].decision_state,'legacy_unclassified');
      assert.equal((await get('/sales?'+range)).body.sales_amount,'7.07');
      assert.equal((await get('/transactions?'+range)).body.data[0].return_requests,1);
    });
    await t.test('missing costs withhold complete estimates instead of silently understating costs',async()=>{
      await db.query('UPDATE batches SET cost_price=NULL WHERE batch_id=2');
      const value=await get('/valuation');assert.equal(value.body.cost_value,null);assert.equal(value.body.unverified_batches,1);
      const profit=await get('/profit?'+range);assert.equal(profit.body.gross_profit,null);assert.equal(profit.body.gross_margin_percent,null);assert.equal(profit.body.unverified_lines,2);
    });
    await t.test('within-category dense rankings preserve exact sales, ties, zero-sale products, filters, RBAC and Excel data',async()=>{
      await db.query("INSERT INTO products(product_id,name,category,unit_price) VALUES(3,'Tie','Confirmed fixture',2),(4,'Lower','Confirmed fixture',2),(5,'Other sold','Other fixture',2),(6,'Other zero','Other fixture',2),(7,'Category zero','Confirmed fixture',2)");
      await db.query("INSERT INTO batches(batch_id,product_id,batch_no,expiry_date,qty_on_hand,cost_price) VALUES(103,3,'RANK3','2099-01-01',7,1),(104,4,'RANK4','2099-01-01',2,1),(105,5,'RANK5','2099-01-01',3,1)");
      for(const [product_id,quantity,paid]of [[3,7,'14'],[4,2,'4'],[5,3,'6']]){
        const receipt=(await sale([{product_id,quantity}],paid)).receipt;
        await db.query("UPDATE sales SET sale_date='2026-01-05 00:00:00' WHERE sale_id=$1",[receipt.sale_id]);
      }
      const best=(await get('/best-selling?'+range)).body.data;
      assert.deepEqual(best.map(row=>[row.product_id,row.category_rank,row.units]),[[1,1,'7'],[3,1,'7'],[4,2,'2'],[5,1,'3']]);
      const slow=(await get('/slow-moving?'+range+'&max_units=7&category=Confirmed%20fixture')).body.data;
      assert.deepEqual(slow.map(row=>[row.product_id,row.category_rank]),[[7,1],[4,2],[1,3],[3,3]]);
      assert.equal((await get('/slow-moving?'+range)).body.data.find(row=>row.product_id===2).current_category,null);
      assert.deepEqual((await get('/best-selling?'+range+'&category=No%20such%20category')).body.data,[]);
      for(const role of ['manager','employee'])assert.equal((await get('/best-selling?'+range,role)).status,403);
      assert.equal((await get('/transactions?'+range+'&category=Other')).status,400);
      const response=await fetch(`http://127.0.0.1:${server.address().port}/best-selling/export?${range}&format=xlsx`,{headers:{Cookie:cookies.admin}});
      assert.equal(response.status,200);const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(Buffer.from(await response.arrayBuffer()));
      const values=[];workbook.getWorksheet('Report').eachRow(row=>values.push(row.values.slice(1)));
      assert(values.some(row=>row[0]==='Confirmed fixture'&&row[1]==='1'&&row[3]==='Medicine'&&row[5]==='7.07'));
      assert(values.some(row=>row[0]==='Other fixture'&&row[3]==='Other sold'&&row[5]==='6.00'));
      assert.equal((await get('/sales?'+range)).body.sales_amount,'31.07');
    });
  } finally {
    if(server)await new Promise(resolve=>server.close(resolve));
    if(owned){await pool.query(`DROP SCHEMA ${schema} CASCADE`);assert.equal((await pool.query('SELECT count(*)::int AS n FROM pg_namespace WHERE nspname=$1',[schema])).rows[0].n,0)}
    try{assert.deepEqual(await snapshot(),before);console.log('Reporting fixtures removed; public counts, constraints and migration history unchanged.')}finally{await closePool()}
  }
});
