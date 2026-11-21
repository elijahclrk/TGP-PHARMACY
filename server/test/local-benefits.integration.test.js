import {test} from 'node:test';
import assert from 'node:assert/strict';
import {benefitFixture,syntheticDraft} from './support/benefit-fixture.js';
import {closePool} from './support/disposable-database.js';
import {createReportsRepository} from '../src/repositories/reports.repository.js';
test('attested local benefit checkout, financial snapshots and recovery',{skip:process.env.RUN_WORKFLOW_DB_TESTS!=='1'},async t=>{
 let f;
 try{
  f=await benefitFixture();
  await t.test('Senior mixed basket uses net reporting and immutable historical receipt',async()=>{
   const input=await f.prepare([{product_id:1,quantity:2},{product_id:2,quantity:1},{product_id:3,quantity:1}]);
   assert.equal(input.quote.total,'352.00');
   const paid=await f.pay(input);assert.equal(Number(paid.receipt.total_amount),352);assert.equal(Number(paid.receipt.financial.discount),60);
   assert.equal(paid.receipt.items.filter(i=>i.product_id===1).length,2);
   await f.provider().query("UPDATE products SET name='Synthetic renamed',unit_price=999 WHERE product_id=1");
   const replay=await f.pay(input);assert.equal(replay.replayed,true);assert.deepEqual(replay.receipt,paid.receipt);
   const day=new Date(Date.now()+28800000).toISOString().slice(0,10);
   const reports=createReportsRepository(f.provider);assert.equal(Number((await reports.sales({from:day,to:day,period:'day'})).sales_amount),352);
   const rows=(await reports.detail('transactions',{from:day,to:day})).data;assert.equal(Number(rows[0].discount_amount),60);assert(!JSON.stringify(rows).includes('SYNTHETIC-ID'));
   await assert.rejects(f.provider().query('UPDATE payments SET amount_paid=amount_paid+1 WHERE sale_id=$1',[paid.receipt.sale_id]));
   await assert.rejects(f.provider().query("DELETE FROM activity_logs WHERE action=$1",['sale.paid:'+paid.receipt.sale_id]));
   await assert.rejects(f.pay({...input,verification_id:crypto.randomUUID()}),{status:409,correctable:false});
  });
  await t.test('PWD and penny FEFO allocation preserve logical totals, once-only concurrent requests',async()=>{
   const input=await f.prepare([{product_id:5,quantity:3}],'pwd');assert.equal(input.quote.total,'0.02');
   const results=await Promise.all([f.pay(input),f.pay(input)]);assert.equal(results.filter(r=>r.replayed).length,1);assert.equal(results[0].receipt.items.reduce((n,i)=>n+Number(i.line_total),0),.02);
  });
  await t.test('missing scheme documents, unknown catalog, fractional units and unqualified Rx fail closed',async()=>{
   const items=[{product_id:2,quantity:1}];
   await assert.rejects(f.auth.transaction(c=>f.service.verification(c,f.actor,{items,draft:{...syntheticDraft('pwd'),documents:syntheticDraft().documents}})));
   await assert.rejects(f.prepare([{product_id:4,quantity:1}]));
   await assert.rejects(f.prepare([{product_id:2,quantity:.5}]));
   await assert.rejects(f.prepare([{product_id:6,quantity:1}]));
  });
  await t.test('stale quote and audit failure roll back all financial and stock records',async()=>{
   const input=await f.prepare([{product_id:2,quantity:1}]);
   const before=(await f.provider().query('SELECT count(*)::int AS n FROM sales')).rows[0].n;
   await f.provider().query('UPDATE products SET unit_price=101 WHERE product_id=2');
   await assert.rejects(f.pay(input),{status:409});
   const fresh=await f.prepare([{product_id:2,quantity:1}]);await assert.rejects(f.pay(fresh,f.actor,async()=>{throw Error('Synthetic audit failure')}));
   assert.equal((await f.provider().query('SELECT count(*)::int AS n FROM sales')).rows[0].n,before);
  });
  await t.test('prescription fills require current qualified actor and cap cumulative concurrent dispensing',async()=>{
   await f.provider().query("INSERT INTO pharmacist_authorizations(authorization_id,user_id,authorized_by,evidence_ref,verified_at,expires_at) VALUES(1,4,3,'SYNTHETIC VERIFIED TEST FIXTURE',CURRENT_TIMESTAMP-interval '1 hour',CURRENT_TIMESTAMP+interval '1 day')");
   const actor={user_id:4,role:'manager',status:'active'},draft=syntheticDraft();draft.documents={...draft.documents,prescriptionRef:'SYNTHETIC-RX',prescribedQuantity:3,pharmacistAuthorizationId:1};
   const input=await f.prepare([{product_id:6,quantity:2}],'senior',actor,draft);await f.pay(input,actor);
   const a=await f.prepare([{product_id:6,quantity:1}],'senior',actor,draft),b=await f.prepare([{product_id:6,quantity:1}],'senior',actor,draft);
   const results=await Promise.allSettled([f.pay(a,actor),f.pay(b,actor)]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
   assert.equal((await f.provider().query('SELECT sum(quantity)::int AS n FROM benefit_prescription_fills')).rows[0].n,3);
   await f.provider().query('UPDATE pharmacist_authorizations SET revoked_at=CURRENT_TIMESTAMP WHERE authorization_id=1');
   await assert.rejects(f.prepare([{product_id:6,quantity:1}],'senior',actor,{...draft,documents:{...draft.documents,prescriptionRef:'SYNTHETIC-OTHER'}}));
  });
  await t.test('changed metadata requires new quote; completed recovery survives policy deactivation',async()=>{
   const input=await f.prepare([{product_id:2,quantity:1}]);
   await f.provider().query("UPDATE benefit_product_versions SET active=false WHERE product_id=2 AND benefit_type='senior'");
   await assert.rejects(f.pay(input),{status:503});
   await f.provider().query("UPDATE benefit_product_versions SET active=true WHERE product_id=2 AND benefit_type='senior'");
   const fresh=await f.prepare([{product_id:2,quantity:1}]);const paid=await f.pay(fresh);
   await f.provider().query("UPDATE benefit_policies SET active=false WHERE benefit_type='senior'");
   assert.equal((await f.pay(fresh)).receipt.sale_id,paid.receipt.sale_id);
   await assert.rejects(f.pay({...fresh,request_id:crypto.randomUUID()}),{status:409});
   await f.provider().query("UPDATE benefit_policies SET active=true WHERE benefit_type='senior'");
  });
  await t.test('non-VAT policy version posts reconciled snapshots without VAT removal',async()=>{
   await f.provider().query("UPDATE benefit_policies SET active=false WHERE benefit_type='pwd'");
   await f.provider().query("INSERT INTO benefit_policies SELECT 3,benefit_type,'synthetic-non-vat-v2',jsonb_set(payload,'{vatStatus}','\"non_vat\"'),reviewed_by,CURRENT_TIMESTAMP,true,true FROM benefit_policies WHERE policy_id=2");
   await f.provider().query("UPDATE benefit_product_versions SET active=false WHERE benefit_type='pwd' AND product_id=2");
   await f.provider().query("INSERT INTO benefit_product_versions SELECT $1,product_id,benefit_type,'synthetic-non-vat-v2',eligibility,tax,'non_vat',prescription_required,promotion_state,source,reviewed_by,CURRENT_TIMESTAMP,valid_from,valid_until,true FROM benefit_product_versions WHERE product_id=2 AND benefit_type='pwd'",[crypto.randomUUID()]);
   const input=await f.prepare([{product_id:2,quantity:1}],'pwd'),paid=await f.pay(input);
   assert.equal(paid.receipt.financial.vatRemoved,'0.00');assert.equal(Number(paid.receipt.financial.nonVat),80.8);
   await assert.rejects(f.provider().query('UPDATE sale_items SET net_line_amount=1 WHERE sale_id=$1',[paid.receipt.sale_id]));
  });
  await t.test('competing distinct benefit checkouts cannot oversell and disabled guards block availability',async()=>{
   await f.provider().query('UPDATE batches SET qty_on_hand=1 WHERE product_id=5 AND batch_id=113');
   await f.provider().query('UPDATE batches SET qty_on_hand=0 WHERE product_id=5 AND batch_id=112');
   const a=await f.prepare([{product_id:5,quantity:1}]),b=await f.prepare([{product_id:5,quantity:1}]);
   const outcomes=await Promise.allSettled([f.pay(a),f.pay(b)]);assert.equal(outcomes.filter(r=>r.status==='fulfilled').length,1);
   assert.equal((await f.provider().query('SELECT qty_on_hand FROM batches WHERE batch_id=113')).rows[0].qty_on_hand,0);
   await f.provider().query('ALTER TABLE benefit_verifications DISABLE TRIGGER benefit_verification_immutable');
   assert.equal(await f.auth.transaction(c=>f.service.availability(c)),false);
   await assert.rejects(f.prepare([{product_id:2,quantity:1}]),{status:503});
   await f.provider().query('ALTER TABLE benefit_verifications ENABLE TRIGGER benefit_verification_immutable');
  });
 }finally{await f?.dispose();await closePool();}
});
