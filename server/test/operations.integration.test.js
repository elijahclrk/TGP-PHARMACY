import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import express from 'express';
import cookieParser from 'cookie-parser';
import ExcelJS from 'exceljs';
import {exchangeFixture} from './support/exchange-fixture.js';
import {closePool} from './support/disposable-database.js';
import {verifiedLocalOperations} from '../testing/local-operations-runtime.mjs';
import {createPurchasingRepository} from '../src/repositories/purchasing.repository.js';
import {createOperationsRouter} from '../src/routes/operations.routes.js';
import {createAuthRouter} from '../src/routes/auth.routes.js';
import {createSessions,accountSessionTag} from '../src/services/sessions.js';
import {createAccount,updateAccount} from '../src/services/accounts.js';
import {errorHandler} from '../src/middleware/error-handler.js';
import {listenForFetch} from '../testing/local-http.mjs';
import {createReportsRepository} from '../src/repositories/reports.repository.js';
import {generateReportExport} from '../src/services/report-exports.js';

test('Batch 14 isolated migrations, receiving, preferences and account lifecycle',{skip:process.env.RUN_WORKFLOW_DB_TESTS!=='1'},async t=>{
 let f,server;try{
  f=await exchangeFixture();
  const c=await f.provider().connect();try{await c.query('BEGIN');for(const file of ['batch7/010_in_app_notification_preferences.sql','batch14/013_operational_completion.sql']){let sql=(await readFile(new URL('../database/migrations/proposed/'+file,import.meta.url),'utf8')).replace(/--[^\n]*/g,'').trim();sql=sql.slice(6,-7).replace(/^\s*SET LOCAL search_path = public;/,'');assert(!/\bpublic\s*\./i.test(sql));await c.query(sql);}await c.query("INSERT INTO suppliers(supplier_id,name) VALUES(100,'SYNTHETIC Batch14 supplier')");await c.query('COMMIT');}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
  const ops=await verifiedLocalOperations(f.provider,{...process.env,NODE_ENV:'test',DATABASE_URL:process.env.TEST_DATABASE_URL}),purchasing=createPurchasingRepository(f.provider,{linkedReady:ops.schemaReady});
  const config={secret:f.secret,ttl:3600,secure:false,origin:'http://127.0.0.1:5173'},sessions=createSessions(config),cookies={};for(const[id,role]of [[1,'employee'],[2,'manager'],[3,'admin']])cookies[role]='tgp_session='+sessions.issue(id).token;
  const app=express();app.use(express.json(),cookieParser());app.use('/ops',createOperationsRouter({config,sessions,authRepository:f.auth,service:ops}));app.use('/off',createOperationsRouter({config,sessions,authRepository:f.auth}));app.use('/auth',createAuthRouter({config,sessions,repository:f.auth,loginLimit:100}));app.use(errorHandler);server=await listenForFetch(app);
  async function req(path,{role='admin',method='GET',body,marker='1',origin=config.origin,cookie}={}){const r=await fetch(`http://127.0.0.1:${server.address().port}${path}`,{method,headers:{Origin:origin,'X-TGP-Request':marker,'Content-Type':'application/json',Cookie:cookie??cookies[role]},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};}
  async function po(quantity=5){const row=await f.auth.transaction(c=>purchasing.createDocument(c,'orders',2,{supplier_id:100,items:[{product_id:1,quantity,unit_cost:'50'}]}));await f.auth.transaction(c=>purchasing.approve(c,'orders',row.po_id,2));return ops.order(2,row.po_id);}
  const delivery=(p,quantity,ref=randomUUID())=>({po_id:p.po_id,request_id:randomUUID(),delivery_ref:ref,items:[{po_item_id:p.items[0].po_item_id,quantity,batch_no:'SYNTHETIC-'+randomUUID(),expiry_date:'2099-01-01',cost_price:'50',selling_price:'112'}]});
  async function approve(id){return f.auth.transaction(async c=>{await purchasing.approve(c,'receiving',id,2);await f.auth.audit(c,2,'receiving.approved:'+id,'stock_in');});}
  await t.test('010/013 installed only in disposable schema, exact capability gates and legacy projections',async()=>{
   assert.equal((await ops.availability(3)).preferences,true);assert.equal((await ops.availability(2)).purchasing,true);assert.equal((await ops.availability(1)).purchasing,false);
   assert.deepEqual((await req('/off/availability')).data.data,{preferences:false,purchasing:false,metadata:false});assert.equal((await req('/off/stock-ins',{method:'POST',body:{}})).status,503);
   await assert.rejects(verifiedLocalOperations(f.provider,{...process.env,TEST_DATABASE_URL:'postgresql://production.invalid/no',DATABASE_URL:'postgresql://production.invalid/no'}));
   await f.provider().query('ALTER TABLE stock_ins DISABLE TRIGGER linked_receiving_guard');assert.equal((await ops.availability(3)).metadata,false);await assert.rejects(ops.order(3,1),{status:503});await f.provider().query('ALTER TABLE stock_ins ENABLE TRIGGER linked_receiving_guard');
  });
  await t.test('Admin own persistent preferences, defaults, revision race, CSRF and RBAC',async()=>{
   assert.deepEqual(await ops.preferences(3),{low_stock_dashboard:true,upcoming_expiry_dashboard:true,revision:0});
   const body={expected_revision:0,low_stock_dashboard:false,upcoming_expiry_dashboard:true};
   for(const role of ['employee','manager'])assert.equal((await req('/ops/notification-preferences',{role,method:'PUT',body})).status,403);
   assert.equal((await req('/ops/notification-preferences',{method:'PUT',body,marker:''})).status,403);assert.equal((await req('/ops/notification-preferences',{method:'PUT',body,origin:'https://other.invalid'})).status,403);
   const r=await Promise.allSettled([ops.savePreferences(3,body),ops.savePreferences(3,body)]);assert.equal(r.filter(x=>x.status==='fulfilled').length,1);assert.equal(r.find(x=>x.status==='rejected').reason.status,409);
   assert.deepEqual(await ops.preferences(3),{low_stock_dashboard:false,upcoming_expiry_dashboard:true,revision:1});assert.equal((await req('/ops/notification-preferences?user_id=2')).status,400);
   await assert.rejects(f.provider().query('INSERT INTO admin_notification_preferences VALUES(2,false,false,1,2,clock_timestamp())'));
   assert.equal((await f.provider().query("SELECT count(*)::int AS n FROM activity_logs WHERE module='notifications'")).rows[0].n,1);
  });
  await t.test('linked partial/full receiving, supplier/batch lineage, idempotency and unchanged legacy approval permission',async()=>{
   const p=await po(),d=delivery(p,2),r=await ops.receive(2,d);assert.equal(r.po_id,p.po_id);assert.equal(r.items[0].qty_on_hand,0);assert.equal((await ops.receive(2,d)).stock_in_id,r.stock_in_id);
   await assert.rejects(ops.receive(2,{...d,delivery_ref:'changed'}),{status:409});await assert.rejects(ops.receive(1,d),{status:403});assert.equal((await req('/ops/stock-ins',{role:'employee',method:'POST',body:d})).status,403);
   await approve(r.stock_in_id);await assert.rejects(approve(r.stock_in_id),{status:409});let state=await ops.order(2,p.po_id);assert.equal(state.status,'partially_received');assert.equal(state.items[0].remaining,3);
   await assert.rejects(ops.receive(2,delivery(p,4)),{status:409});await assert.rejects(ops.receive(2,delivery(p,1,' '+d.delivery_ref.toUpperCase()+' ')),{code:'23505'});
   const end=await ops.receive(2,delivery(p,3));await approve(end.stock_in_id);state=await ops.order(3,p.po_id);assert.equal(state.status,'received');assert.equal(state.items[0].received,5);assert.equal((await purchasing.detail('receiving',r.stock_in_id)).items[0].qty_on_hand,2);
   await assert.rejects(f.provider().query('UPDATE stock_in_items SET quantity=1 WHERE stock_in_id=$1',[r.stock_in_id]));await assert.rejects(f.provider().query('DELETE FROM stock_ins WHERE stock_in_id=$1',[r.stock_in_id]));await assert.rejects(f.provider().query('UPDATE purchase_order_items SET quantity=6 WHERE po_id=$1',[p.po_id]));
  });
  await t.test('competing approvals cannot over-receive; losing stock and audit roll back',async()=>{
   const p=await po(3),a=await ops.receive(2,delivery(p,3)),b=await ops.receive(2,delivery(p,3)),r=await Promise.allSettled([approve(a.stock_in_id),approve(b.stock_in_id)]);assert.equal(r.filter(x=>x.status==='fulfilled').length,1);
   const rows=await Promise.all([purchasing.detail('receiving',a.stock_in_id),purchasing.detail('receiving',b.stock_in_id)]);assert.equal(rows.reduce((n,r)=>n+r.items[0].qty_on_hand,0),3);assert.equal(rows.filter(r=>r.approved_by!==null).length,1);
   const losing=rows.find(r=>r.approved_by===null);assert.equal((await f.provider().query("SELECT count(*)::int AS n FROM activity_logs WHERE action=$1",['receiving.approved:'+losing.stock_in_id])).rows[0].n,0);
  });
  await t.test('uncertain delivery resolution closes absent references and recovers recorded ones',async()=>{
   const p=await po(),d=delivery(p,1);assert.equal((await ops.receivingStatus(2,d.request_id)).status,'closed');await assert.rejects(ops.receive(2,d),{status:409});const r=await ops.receive(2,delivery(p,1));const key=(await f.provider().query('SELECT receiving_request_id FROM stock_ins WHERE stock_in_id=$1',[r.stock_in_id])).rows[0].receiving_request_id;assert.equal((await ops.receivingStatus(2,key)).record.stock_in_id,r.stock_in_id);
   const q=await po(),input=delivery(q,1),[received,resolved]=await Promise.allSettled([ops.receive(2,input),ops.receivingStatus(2,input.request_id)]);assert.equal(resolved.status,'fulfilled');if(resolved.value.status==='recorded'){assert.equal(received.status,'fulfilled');assert.equal(resolved.value.record.stock_in_id,received.value.stock_in_id)}else{assert.equal(resolved.value.status,'closed');assert.equal(received.status,'rejected');assert.equal(received.reason.status,409);assert.equal((await f.provider().query('SELECT count(*)::int AS n FROM stock_ins WHERE receiving_request_id=$1',[input.request_id])).rows[0].n,0)}
  });
  await t.test('linked mismatches, expired receiving, audit rollback and immutable item linkage',async()=>{
   const p=await po(),d=delivery(p,1);d.items[0].expiry_date='2000-01-01';const r=await ops.receive(2,d);await assert.rejects(f.auth.transaction(async c=>{await purchasing.approve(c,'receiving',r.stock_in_id,2);throw Error('synthetic audit outage')}));let detail=await purchasing.detail('receiving',r.stock_in_id);assert.equal(detail.approved_by,null);assert.equal(detail.items[0].qty_on_hand,0);await approve(r.stock_in_id);
   const sold=await f.auth.transaction(async c=>{const data={items:[{product_id:1,quantity:1}],request_id:randomUUID(),amount_paid:'1000'},q=await f.pos.quote(c,data);return f.pos.checkout(c,f.actor,data,f.auth.audit,q.fingerprint)});assert(!sold.receipt.items.some(x=>x.batch_id===r.items[0].batch_id));
   const other=await po();await assert.rejects(ops.receive(2,{...delivery(p,1),items:[{...d.items[0],po_item_id:other.items[0].po_item_id}]}),{status:400});
   await assert.rejects(f.provider().query('UPDATE stock_in_items SET stock_in_id=0 WHERE stock_in_id=$1',[r.stock_in_id]));
  });
  await t.test('010/013 uncommitted DDL rolls back without altering original populated tables',async()=>{
   const c=await f.provider().connect(),schema='tgp_b14_rollback_'+randomUUID().replaceAll('-','');try{await c.query('BEGIN');await c.query('CREATE SCHEMA '+schema);await c.query('SET LOCAL search_path TO '+schema);let baseline=await readFile(new URL('../database/migrations/001_phase3_baseline.sql',import.meta.url),'utf8');await c.query(baseline);await c.query('SAVEPOINT before_proposals');for(const file of ['batch7/010_in_app_notification_preferences.sql','batch14/013_operational_completion.sql']){let sql=(await readFile(new URL('../database/migrations/proposed/'+file,import.meta.url),'utf8')).replace(/--[^\n]*/g,'').trim();await c.query(sql.slice(6,-7).replace(/^\s*SET LOCAL search_path = public;/,''));}await c.query('ROLLBACK TO before_proposals');assert.equal((await c.query("SELECT count(*)::int AS n FROM information_schema.columns WHERE table_schema=$1 AND column_name='strength_dosage'",[schema])).rows[0].n,0);assert.equal((await c.query("SELECT to_regclass('admin_notification_preferences') AS t")).rows[0].t,null);}finally{await c.query('ROLLBACK');c.release();}
  });
  await t.test('order metadata and explicit optional product/supplier facts preserve blank legacy records',async()=>{
   const p=await po();const out=await ops.orderMetadata(2,p.po_id,{expected_delivery:'2027-01-31',notes:'SYNTHETIC delivery note'});assert.equal(out.expected_delivery,'2027-01-31');assert.equal(out.notes,'SYNTHETIC delivery note');await assert.rejects(ops.orderMetadata(1,p.po_id,{notes:'forbidden'}),{status:403});
   await f.provider().query("UPDATE products SET strength_dosage='SYNTHETIC 10 mg tablet' WHERE product_id=1; UPDATE suppliers SET contact_person='SYNTHETIC contact',email='synthetic@example.invalid',status='active' WHERE supplier_id=100");assert.equal((await purchasing.detail('suppliers',100)).email,'synthetic@example.invalid');
  });
  await t.test('staff edits revoke role, password and status sessions; Admin protection, audit and rollback',async()=>{
   const password='synthetic-test-password-123',staff=await createAccount(f.auth,3,{username:'synthetic_edit',password,role:'employee'}),login=()=>req('/auth/login',{cookie:'',method:'POST',body:{username:'synthetic_edit',password}});
   let signed=await login();assert.equal(signed.status,200);assert.equal((await req('/auth/users/'+staff.user_id,{role:'manager',method:'PATCH',body:{role:'manager'}})).status,403);
   assert.equal((await req('/auth/users/'+staff.user_id,{method:'PATCH',body:{role:'admin'}})).status,400);assert.equal((await req('/auth/users/3',{method:'PATCH',body:{status:'inactive'}})).status,403);
   assert.equal((await req('/auth/users/'+staff.user_id,{method:'PATCH',body:{role:'manager',full_name:'SYNTHETIC updated'}})).status,200);assert.equal((await req('/auth/me',{cookie:signed.cookie})).status,401);signed=await login();assert.equal(signed.data.user.role,'manager');
   const stale=await f.auth.findById(staff.user_id);await updateAccount(f.auth,3,staff.user_id,{password:'synthetic-replacement-password-123'});const late='tgp_session='+sessions.issue(staff.user_id,accountSessionTag(stale)).token;assert.equal((await req('/auth/me',{cookie:late})).status,401);assert.equal((await req('/auth/me',{cookie:signed.cookie})).status,401);assert.equal((await login()).status,401);
   const current=await f.auth.findById(staff.user_id),tag=accountSessionTag(current),broken={...f.auth,audit:async()=>{throw Error('synthetic audit failure')}};await assert.rejects(updateAccount(broken,3,staff.user_id,{status:'inactive'}));assert.equal(accountSessionTag(await f.auth.findById(staff.user_id)),tag);
   await updateAccount(f.auth,3,staff.user_id,{status:'inactive'});assert.equal((await f.auth.findById(staff.user_id)).status,'inactive');await updateAccount(f.auth,3,staff.user_id,{status:'active'});assert.equal((await f.auth.findById(staff.user_id)).status,'active');assert.equal((await f.provider().query('SELECT count(*)::int AS n FROM activity_logs WHERE action=$1',['account.credentials_updated:'+staff.user_id])).rows[0].n,1);
  });
  await t.test('receipt filtering, distinct products across FEFO batches, immutable totals and actual Excel/PDF',async()=>{
   const source=await f.source(2,2),day=new Date(Date.now()+28800000).toISOString().slice(0,10),repo=createReportsRepository(f.provider),query={from:day,to:day,receipt:source.paid.receipt.receipt_no};assert.equal(source.paid.receipt.items.length,2,'Test must split one product over two FEFO batches');let r=await repo.detail('transactions',query);assert.equal(r.data.length,1);assert.equal(r.data[0].item_count,1);assert.equal(r.data[0].sales_amount,source.paid.receipt.total_amount);assert.equal((await repo.detail('transactions',{...query,receipt:"' OR 1=1 --"})).data.length,0);
   const book=new ExcelJS.Workbook();await book.xlsx.load(await generateReportExport('transactions','xlsx',r,query));let cells='';book.eachSheet(s=>s.eachRow(r=>r.eachCell(c=>{assert(!c.value?.formula);cells+=String(c.value)+' ';})));assert(cells.includes(source.paid.receipt.receipt_no));assert(!cells.includes('SYNTHETIC-ID'));assert((await generateReportExport('transactions','pdf',r,query)).subarray(0,4).equals(Buffer.from('%PDF')));
  });
 }finally{if(server)await new Promise(r=>server.close(r));if(f)await f.dispose();await closePool();}
});
