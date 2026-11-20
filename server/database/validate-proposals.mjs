import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {getPool,closePool} from '../src/config/database.js';
const schema='tgp_test_'+randomUUID().replaceAll('-','');
const files=['001_phase3_baseline.sql','proposed/002_supported_integrity.sql','proposed/003_return_sale_item_link.sql','proposed/004_lookup_indexes.sql','proposed/deferred/005_complete_records.sql'];
const raw=await Promise.all(files.map(f=>readFile(new URL('./migrations/'+f,import.meta.url),'utf8')));
const checksum=createHash('sha256').update(await readFile(new URL('./migrations/001_phase3_baseline.sql',import.meta.url))).digest('hex');
// Transform copies only: remove outer transaction wrappers and public search path.
const copies=raw.map((s,i)=>{
 let t=s.replace(/--[^\n]*/g,'').trim();
 if(i){assert(t.startsWith('BEGIN;'));assert(t.endsWith('COMMIT;'));t=t.slice(6,-7).replace(/^\s*SET LOCAL search_path = public;/,'');}
 assert(!/\bpublic\b|\bCOMMIT\b|\bROLLBACK\b|\bDROP\b/i.test(t));
 return t;
});
const tableNames=[...copies[0].matchAll(/CREATE TABLE (\w+)/g)].map(m=>m[1]);
let client,active=false,passed=0;
const log=s=>console.log(s);
async function reject(label,sql,codes,params=[]){
 await client.query('SAVEPOINT negative_case');let code;
 try{await client.query(sql,params);}catch(e){code=e.code;}
 await client.query('ROLLBACK TO SAVEPOINT negative_case');await client.query('RELEASE SAVEPOINT negative_case');
 assert(codes.includes(code),label+' rejected with expected SQLSTATE');passed++;
}
async function publicSnapshot(){
 const catalog=(await client.query("SELECT c.relname,k.conname,pg_get_constraintdef(k.oid) AS definition FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace LEFT JOIN pg_constraint k ON k.conrelid=c.oid WHERE n.nspname='public' ORDER BY c.relname,k.conname")).rows;
 const tracking=(await client.query('SELECT version,checksum,applied_at FROM public.tgp_schema_migrations ORDER BY version')).rows;
 const counts=[];for(const t of tableNames)counts.push((await client.query('SELECT count(*)::int AS n FROM public.'+t)).rows[0].n);
 return {catalog,tracking,counts};
}
try{
 client=await getPool().connect();
 const before=await publicSnapshot();assert(before.tracking.find(r=>r.version===files[0])?.checksum===checksum);
 log('Public baseline checksum verified; application row counts captured.');
 await client.query('BEGIN');active=true;
 await client.query('CREATE SCHEMA '+schema);
 await client.query('SET LOCAL search_path TO '+schema);
 await client.query(copies[0]);await client.query(copies[1]);
 log('Baseline and 002 applied in isolated transaction.');
 await client.query("INSERT INTO users(user_id,username,password_hash,role) VALUES(1,'isolated_test','not-a-real-password-hash','admin'); INSERT INTO products(product_id,unit_price,reorder_level) VALUES(1,10,0); INSERT INTO suppliers(supplier_id) VALUES(1); INSERT INTO batches(batch_id,product_id,expiry_date,qty_on_hand,cost_price,selling_price) VALUES(1,1,'2099-01-01',10,5,10); INSERT INTO sales(sale_id,user_id,total_amount) VALUES(1,1,10),(2,1,10); INSERT INTO sale_items(sale_item_id,sale_id,batch_id,quantity,unit_price) VALUES(1,1,1,1,10); INSERT INTO purchase_orders(po_id,supplier_id,created_by) VALUES(1,1,1); INSERT INTO purchase_order_items(po_item_id,po_id,product_id,quantity,unit_cost) VALUES(1,1,1,1,5); INSERT INTO stock_ins(stock_in_id,supplier_id,received_by) VALUES(1,1,1); INSERT INTO stock_in_items(item_id,stock_in_id,batch_id,quantity,unit_cost) VALUES(1,1,1,1,5); INSERT INTO payments(payment_id,sale_id,method,amount_paid,change_due) VALUES(1,1,'cash',10,0); INSERT INTO stock_adjustments(adjustment_id,batch_id,adjusted_by,quantity,reason) VALUES(1,1,1,-1,'isolated test'); INSERT INTO activity_logs(log_id,user_id,action,module,logged_at) VALUES(1,1,'test','test',CURRENT_TIMESTAMP)");

 // Safe subset must allow incomplete values deferred for business review.
 await client.query('SAVEPOINT safe_subset');
 const optionalColumns = [{"table":"batches","columns":["expiry_date","qty_on_hand","cost_price","selling_price"]},{"table":"products","columns":["reorder_level","unit_price"]},{"table":"purchase_order_items","columns":["quantity","unit_cost"]},{"table":"stock_in_items","columns":["quantity","unit_cost"]},{"table":"sale_items","columns":["quantity","unit_price"]},{"table":"sale_returns","columns":["quantity"]},{"table":"stock_adjustments","columns":["quantity"]},{"table":"sales","columns":["total_amount"]},{"table":"payments","columns":["amount_paid","change_due","method"]}];
 for(const {table,columns} of optionalColumns) for(const column of columns) {
   await client.query('UPDATE '+table+' SET '+column+'=NULL');
   // Verify metadata even when a fixture table (returns) is empty.
   const field=(await client.query('SELECT is_nullable FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2 AND column_name=$3',[schema,table,column])).rows[0];
   assert.equal(field.is_nullable,'YES');
 }
 await client.query(copies[3]);
 const safeIndexes=(await client.query('SELECT indexname FROM pg_indexes WHERE schemaname=$1',[schema])).rows;
 assert.equal(safeIndexes.length,40);
 assert(!safeIndexes.some(i=>i.indexname==='sale_returns_sale_id_idx'));
 await client.query('ROLLBACK TO SAVEPOINT safe_subset');await client.query('RELEASE SAVEPOINT safe_subset');
 log('Safe 002 + 004 subset passed: deferred fields nullable, 40 indexes, no 003 dependency.');
 await client.query(copies[4]);
 log('Deferred 005 applied only in isolation for complete-record rejection tests.');
 await client.query('SAVEPOINT old_return');
 await client.query('INSERT INTO sale_returns(return_id,sale_id,processed_by,quantity) VALUES(1,1,1,1)');
 await reject('003 populated return guard',copies[2],['P0001']);
 await client.query('ROLLBACK TO SAVEPOINT old_return');await client.query('RELEASE SAVEPOINT old_return');
 await client.query(copies[2]);await client.query(copies[3]);
 log('003 empty-table amendment and 004 indexes applied; populated-return guard passed.');
 for(let i=0;i<4;i++)await reject('repeat '+files[i],copies[i],['42P07','42710','42701']);
 await client.query(copies[4]);
 log('Baseline/002/003/004 repeats rejected safely; repeated 005 SET NOT NULL succeeded without changes.');
 await client.query('INSERT INTO sale_returns(return_id,sale_id,sale_item_id,processed_by,quantity) VALUES(1,1,1,1,1)');
 await reject('cross-sale return','UPDATE sale_returns SET sale_id=2',['23503']);
 await reject('missing line','UPDATE sale_returns SET sale_item_id=999',['23503']);
 await reject('null line','UPDATE sale_returns SET sale_item_id=NULL',['23502']);
 await reject('negative stock','UPDATE batches SET qty_on_hand=-1',['23514']);
 await reject('null stock','UPDATE batches SET qty_on_hand=NULL',['23502']);
 await reject('negative reorder','UPDATE products SET reorder_level=-1',['23514']);
 for(const t of ['sale_items','stock_in_items','purchase_order_items','sale_returns']){
  for(const n of [-1,0])await reject(t+' quantity','UPDATE '+t+' SET quantity=$1',['23514'],[n]);
  await reject(t+' null quantity','UPDATE '+t+' SET quantity=NULL',['23502']);
 }
 for(const [t,cols] of Object.entries({products:['unit_price'],batches:['cost_price','selling_price'],purchase_order_items:['unit_cost'],stock_in_items:['unit_cost'],sale_items:['unit_price'],sales:['total_amount'],payments:['amount_paid','change_due']}))for(const c of cols){
  for(const v of ['-1','NaN','Infinity','-Infinity'])await reject(t+'.'+c,'UPDATE '+t+' SET '+c+'=$1',['23514'],[v]);
  await reject(t+'.'+c+' null','UPDATE '+t+' SET '+c+'=NULL',['23502']);
 }
 await reject('zero adjustment','UPDATE stock_adjustments SET quantity=0',['23514']);
 await reject('blank reason',"UPDATE stock_adjustments SET reason=' '",['23514']);
 await reject('null reason','UPDATE stock_adjustments SET reason=NULL',['23502']);
 await reject('blank action',"UPDATE activity_logs SET action=' '",['23514']);
 await reject('null audit time','UPDATE activity_logs SET logged_at=NULL',['23502']);
 await reject('invalid method',"UPDATE payments SET method='card'",['23514']);
 await reject('excess change','UPDATE payments SET change_due=11',['23514']);
 await reject('null expiry','UPDATE batches SET expiry_date=NULL',['23502']);
 await client.query('SAVEPOINT valid_boundaries');
 await client.query('UPDATE batches SET qty_on_hand=0,cost_price=0,selling_price=0; UPDATE stock_adjustments SET quantity=1; UPDATE products SET unit_price=0');
 await client.query('ROLLBACK TO SAVEPOINT valid_boundaries');await client.query('RELEASE SAVEPOINT valid_boundaries');
 assert.equal((await client.query('SELECT qty_on_hand FROM batches WHERE batch_id=1')).rows[0].qty_on_hand,10);
 const constraints=(await client.query("SELECT contype,count(*)::int AS n FROM pg_constraint WHERE connamespace=$1::regnamespace GROUP BY contype",[schema])).rows;
 assert.equal(constraints.find(r=>r.contype==='p').n,15);assert.equal(constraints.find(r=>r.contype==='f').n,25);
 const indexes=(await client.query('SELECT indexname,indexdef FROM pg_indexes WHERE schemaname=$1',[schema])).rows;
 assert.equal(indexes.length,42);assert(indexes.find(r=>r.indexname==='batches_fefo_available_idx').indexdef.includes('WHERE (qty_on_hand > 0)'));
 assert(!indexes.some(i=>i.indexname==='sale_returns_sale_id_idx'));
 assert(indexes.some(i=>i.indexname==='sale_returns_original_item_idx'));
 assert(indexes.some(i=>i.indexname==='sale_items_sale_item_pair_uq'));
 const foreignTargets=(await client.query("SELECT count(*)::int AS n FROM pg_constraint k JOIN pg_class c ON c.oid=k.confrelid WHERE k.connamespace=$1::regnamespace AND k.contype='f' AND c.relnamespace<>$1::regnamespace",[schema])).rows[0].n;assert.equal(foreignTargets,0);
 log('PASS '+passed+' expected-rejection tests; valid boundaries and data rollback passed.');
 log('Isolated catalog: 15 PKs, 25 FKs (one amendment), 42 indexes; all FK targets isolated.');
 await client.query('ROLLBACK');active=false;
 assert.equal((await client.query('SELECT count(*)::int AS n FROM pg_namespace WHERE nspname=$1',[schema])).rows[0].n,0);
 assert.deepEqual(await publicSnapshot(),before);
 log('PASS full rollback removed task-owned schema. Public constraints, migration history and row counts unchanged.');
}catch(e){console.error('Validation failed; sanitized code: '+(/^[A-Z0-9]{5}$/.test(e.code??'')?e.code:'TEST_FAILURE'));process.exitCode=1;}
finally{if(active&&client)await client.query('ROLLBACK').catch(()=>{});client?.release();await closePool();}
