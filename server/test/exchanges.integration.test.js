import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {exchangeFixture,installExchanges} from './support/exchange-fixture.js';
import {installBenefits} from './support/benefit-fixture.js';
import {closePool} from './support/disposable-database.js';
import {createReportsRepository} from '../src/repositories/reports.repository.js';
import {generateReportExport} from '../src/services/report-exports.js';
import ExcelJS from 'exceljs';
test('isolated exchange migration, posting, financial and concurrency safeguards',{skip:process.env.RUN_WORKFLOW_DB_TESTS!=='1'},async t=>{
 let f;try{f=await exchangeFixture();assert.equal((await f.exchanges.availability(1)).available,true,JSON.stringify((await f.provider().query("SELECT c.contype,count(*)::int AS n FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid WHERE t.relnamespace=current_schema()::regnamespace AND (t.relname='product_exchanges' OR t.relname LIKE 'exchange_%') GROUP BY c.contype")).rows));
 await t.test('equal exchange, independent review, immutable lineage and once-only concurrent posting',async()=>{
  const s=await f.source(3),x=await f.candidate(s.returns,[{product_id:1,quantity:3}]),e=await f.create(x);
  assert.equal((await f.create(x)).exchange_id,e.exchange_id);await assert.rejects(f.create({...x,draft:{...x.draft,reason:'Changed'}}),{status:409});await assert.rejects(f.exchanges.detail(5,e.exchange_id),{status:404});
  await assert.rejects(f.exchanges.decision(1,e.exchange_id,{decision:'approved'}),{status:403});
  await f.approve(e.exchange_id);const q=await f.exchanges.reviewedQuote(1,e.exchange_id),input={request_id:randomUUID(),quote_token:q.quote_token,tender:'0'};
  const results=await Promise.all([f.exchanges.post(1,e.exchange_id,input),f.exchanges.post(1,e.exchange_id,input)]);assert.equal(results.filter(r=>r.replayed).length,1);assert.equal(Number(results[0].receipt.settlement.cash_due),0);
  await assert.rejects(f.exchanges.post(1,e.exchange_id,{...input,tender:'1'}),{status:409});
  const quarantine=(await f.provider().query('SELECT received_quantity FROM sale_returns WHERE sale_id=$1',[s.paid.receipt.sale_id])).rows.reduce((n,r)=>n+r.received_quantity,0);assert.equal(quarantine,3);
  assert.equal((await f.provider().query('SELECT count(*)::int AS n FROM payments WHERE sale_id=$1',[s.paid.receipt.sale_id])).rows[0].n,1);
  await assert.rejects(f.provider().query('UPDATE exchange_items SET quantity=quantity+1 WHERE exchange_id=$1',[e.exchange_id]));
  await assert.rejects(f.provider().query("UPDATE product_exchanges SET state='approved' WHERE exchange_id=$1",[e.exchange_id]));
  await assert.rejects(f.provider().query("DELETE FROM activity_logs WHERE module='exchanges' AND action=$1",['exchange.posted:'+e.exchange_id]));
  await f.provider().query('UPDATE products SET unit_price=113 WHERE product_id=1');assert.equal((await f.exchanges.post(1,e.exchange_id,input)).replayed,true);await f.provider().query('UPDATE products SET unit_price=112 WHERE product_id=1');
 });
 await t.test('higher cash difference and original reporting/export reconciliation',async()=>{
  const s=await f.source(1);await f.provider().query('UPDATE products SET unit_price=140 WHERE product_id=2');const x=await f.candidate(s.returns,[{product_id:2,quantity:1}]),e=await f.create(x);await f.approve(e.exchange_id);
  await assert.rejects(f.complete(e.exchange_id,'27.99'),{status:422});const posted=await f.complete(e.exchange_id,'50');assert.equal(Number(posted.receipt.additional_cash),28);assert.equal(Number(posted.receipt.settlement.change_due),22);
  const day=new Date(Date.now()+28800000).toISOString().slice(0,10),r=await f.exchanges.report(3,day,day);assert.equal(r.additional_cash,'28.00');assert.equal(r.replacement_value,'476.00');assert.equal(r.transactions,2);
  const sales=await createReportsRepository(f.provider).sales({from:day,to:day,period:'day'});assert.equal(Number(sales.sales_amount),448);
  const book=new ExcelJS.Workbook();await book.xlsx.load(await generateReportExport('exchanges','xlsx',r,{from:day,to:day}));let text='';book.eachSheet(s=>s.eachRow(r=>r.eachCell(c=>{text+=String(c.value)+' ';assert(!c.value?.formula);})));assert(text.includes('28.00'));assert(!text.includes('SYNTHETIC-ID'));
  assert((await generateReportExport('exchanges','pdf',r,{})).subarray(0,4).equals(Buffer.from('%PDF')));
 });
 await t.test('multiple replacement items and full receipt prerequisite preserve source lineage',async()=>{
  const unreceived=await f.source(1,1,false);await assert.rejects(f.candidate(unreceived.returns,[{product_id:1,quantity:1}]),{code:'PHYSICAL_RECEIPT_REQUIRED'});
  const source=await f.source(1,[{product_id:1,quantity:1},{product_id:2,quantity:1}]),e=await f.create(await f.candidate(source.returns,[{product_id:1,quantity:1},{product_id:2,quantity:1}]));await f.approve(e.exchange_id);const paid=await f.complete(e.exchange_id);assert.equal(new Set(paid.receipt.items.map(i=>i.product_id)).size,2);assert.equal(Number(paid.receipt.additional_cash),0);
 });
 await t.test('lower-value, statutory, unauthorized substitution and discounted source fail closed',async()=>{
  const s=await f.source(1);await f.provider().query('UPDATE products SET unit_price=100 WHERE product_id=2');await assert.rejects(f.candidate(s.returns,[{product_id:2,quantity:1}]),{code:'LOWER_VALUE_REVIEW_REQUIRED'});
  const base={claims:s.returns.map(r=>({return_id:r.return_id,quantity:r.quantity})),items:[{product_id:1,quantity:1}],reason:'SYNTHETIC reason'};
  await assert.rejects(f.exchanges.quote(1,{...base,route:'defective'}),{code:'AUTHORIZED_REMEDY_REVIEW_REQUIRED'});
  await assert.rejects(f.exchanges.quote(1,{...base,items:[{product_id:3,quantity:1}]}),{code:'CLINICAL_REVIEW_REQUIRED'});
  const paid=await f.pay(await f.prepare([{product_id:2,quantity:1}]));const i=paid.receipt.items[0],r=await f.workflows.requestReturn(1,{sale_id:paid.receipt.sale_id,sale_item_id:i.sale_item_id,quantity:1,reason:'SYNTHETIC benefit return',request_key:randomUUID()});await f.workflows.decideReturn(2,r.return_id,'approved');await f.workflows.receiveReturn(1,r.return_id);
  await assert.rejects(f.exchanges.quote(1,{...base,claims:[{return_id:r.return_id,quantity:1}]}),{code:'DISCOUNTED_EXCHANGE_REVIEW_REQUIRED'});
 });
 await t.test('partial and competing approvals, rejection and cancelled capacity',async()=>{
  const s=await f.source(2),r=s.returns[0];const a=await f.candidate([r],[{product_id:1,quantity:r.quantity}]),b=await f.candidate([r],[{product_id:1,quantity:r.quantity}]);const ea=await f.create(a),eb=await f.create(b);
  const out=await Promise.allSettled([f.approve(ea.exchange_id),f.approve(eb.exchange_id)]);assert.equal(out.filter(r=>r.status==='fulfilled').length,1);
  const winner=out[0].status==='fulfilled'?ea:eb,loser=winner===ea?eb:ea;await f.exchanges.cancel(1,winner.exchange_id,{reason:'SYNTHETIC release'});await f.approve(loser.exchange_id);await f.exchanges.cancel(1,loser.exchange_id,{reason:'SYNTHETIC release'});
  const c=await f.create(await f.candidate(s.returns,[{product_id:1,quantity:2}]));await f.exchanges.decision(2,c.exchange_id,{decision:'rejected',reason:'SYNTHETIC rejected'});await assert.rejects(f.approve(c.exchange_id));
  const partial=await f.create(await f.candidate([{...r,quantity:1}],[{product_id:1,quantity:1}]));await f.approve(partial.exchange_id);await f.complete(partial.exchange_id);
  const mgmtSource=await f.source(1),m=await f.candidate(mgmtSource.returns,[{product_id:1,quantity:1}]),mq=await f.exchanges.quote(2,m.draft),managerRequest=await f.exchanges.create(2,{request_id:randomUUID(),draft:m.draft,quote_token:mq.quote_token});await assert.rejects(f.exchanges.decision(2,managerRequest.exchange_id,{decision:'approved'}),{status:403});await f.exchanges.decision(3,managerRequest.exchange_id,{decision:'approved'});await f.exchanges.cancel(2,managerRequest.exchange_id,{reason:'SYNTHETIC manager cancellation'});
 });
 await t.test('stale price, expired stock, revoked qualification and closed attempts',async()=>{
  const s=await f.source(1),e=await f.create(await f.candidate(s.returns,[{product_id:1,quantity:1}]));await f.approve(e.exchange_id);
  await f.provider().query('UPDATE products SET unit_price=113 WHERE product_id=1');await assert.rejects(f.exchanges.reviewedQuote(1,e.exchange_id),{code:'QUOTE_STALE'});await f.provider().query('UPDATE products SET unit_price=112 WHERE product_id=1');
  await f.provider().query("UPDATE products SET generic_name='SYNTHETIC changed identity' WHERE product_id=1");await assert.rejects(f.exchanges.reviewedQuote(1,e.exchange_id),{code:'QUOTE_STALE'});await f.provider().query("UPDATE products SET generic_name='Synthetic generic' WHERE product_id=1");
  const q=await f.exchanges.reviewedQuote(1,e.exchange_id),id=randomUUID();assert.equal((await f.exchanges.resolve(1,e.exchange_id,id)).status,'closed');await assert.rejects(f.exchanges.post(1,e.exchange_id,{request_id:id,quote_token:q.quote_token,tender:'0'}),{code:'ATTEMPT_CLOSED'});
  await f.provider().query('UPDATE pharmacist_authorizations SET revoked_at=clock_timestamp() WHERE authorization_id=901');await assert.rejects(f.exchanges.reviewedQuote(1,e.exchange_id));await f.provider().query('UPDATE pharmacist_authorizations SET revoked_at=NULL WHERE authorization_id=901');
  await f.provider().query("UPDATE batches SET expiry_date=(clock_timestamp() AT TIME ZONE 'Asia/Manila')::date WHERE product_id=1");await assert.rejects(f.exchanges.reviewedQuote(1,e.exchange_id));
 });
 await t.test('audit failure rolls back deductions, claims and settlement; schema gate detects disabled trigger',async()=>{
  await f.provider().query("UPDATE batches SET expiry_date=(clock_timestamp() AT TIME ZONE 'Asia/Manila')::date+20 WHERE product_id=1");
  const s=await f.source(1),e=await f.create(await f.candidate(s.returns,[{product_id:1,quantity:1}]));await f.approve(e.exchange_id);const before=(await f.provider().query('SELECT sum(qty_on_hand)::int AS n FROM batches WHERE product_id=1')).rows[0].n;
  await f.provider().query("CREATE FUNCTION synthetic_audit_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.module='exchanges' AND NEW.action LIKE 'exchange.posted:%' THEN RAISE EXCEPTION 'SYNTHETIC audit failure'; END IF; RETURN NEW; END $$; CREATE CONSTRAINT TRIGGER synthetic_audit_failure AFTER INSERT ON activity_logs DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION synthetic_audit_failure()");
  await assert.rejects(f.complete(e.exchange_id));assert.equal((await f.provider().query('SELECT sum(qty_on_hand)::int AS n FROM batches WHERE product_id=1')).rows[0].n,before);assert.equal((await f.exchanges.detail(1,e.exchange_id)).settlement,null);
  await f.provider().query('DROP TRIGGER synthetic_audit_failure ON activity_logs');const paid=await f.complete(e.exchange_id);assert.equal((await f.exchanges.resolve(1,e.exchange_id,paid.receipt.posting_request_id)).status,'posted');
  await f.provider().query('ALTER TABLE exchange_items DISABLE TRIGGER exchange_guard');assert.equal((await f.exchanges.availability(1)).available,false);await f.provider().query('ALTER TABLE exchange_items ENABLE TRIGGER exchange_guard');
 });
 await t.test('migration DDL rolls back completely and database money rejects excess precision',async()=>{
  const c=await f.provider().connect(),schema='tgp_exchange_rollback_'+randomUUID().replaceAll('-','');try{await c.query('BEGIN');await c.query('CREATE SCHEMA '+schema);await c.query('SET LOCAL search_path TO '+schema);await installBenefits(c);await installExchanges(c);assert((await c.query("SELECT to_regclass('product_exchanges') AS t")).rows[0].t);await c.query('ROLLBACK');assert.equal((await c.query('SELECT to_regnamespace($1) AS n',[schema])).rows[0].n,null);}finally{await c.query('ROLLBACK');c.release();}
  for(const invalid of ['1.001','-1','NaN','Infinity','1000000000000'])await assert.rejects(f.provider().query('SELECT $1::tgp_exchange_money',[invalid]));
 });
 await t.test('ordinary POS and exchange cannot oversell the same final replacement batch',async()=>{
  await f.provider().query('UPDATE products SET unit_price=140 WHERE product_id=2');await f.provider().query("UPDATE batches SET qty_on_hand=CASE WHEN batch_id=103 THEN 1 ELSE 0 END WHERE product_id=2");
  const s=await f.source(1),e=await f.create(await f.candidate(s.returns,[{product_id:2,quantity:1}]));await f.approve(e.exchange_id);const data={items:[{product_id:2,quantity:1}],request_id:randomUUID(),amount_paid:'200.00'},q=await f.auth.transaction(c=>f.pos.quote(c,data));
  const outcomes=await Promise.allSettled([f.complete(e.exchange_id,'100'),f.auth.transaction(c=>f.pos.checkout(c,f.actor,data,f.auth.audit,q.fingerprint))]);assert.equal(outcomes.filter(r=>r.status==='fulfilled').length,1);assert.equal((await f.provider().query('SELECT sum(qty_on_hand)::int AS n FROM batches WHERE product_id=2')).rows[0].n,0);
 });
 }finally{await f?.dispose();await closePool();}
});
