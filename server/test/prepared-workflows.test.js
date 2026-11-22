import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createPreparedWorkflows} from '../src/services/prepared-workflows.js';
import {workflowFixture} from './support/workflow-fixture.js';
const setup=()=>{const f=workflowFixture();return {f,service:createPreparedWorkflows(f.provider)};};
const adjustment=()=>({batch_id:10,quantity:-2,reason:'Count discrepancy',request_key:randomUUID()});
const returned=(quantity=2)=>({sale_id:30,sale_item_id:20,quantity,reason:'Damaged pack',request_key:randomUUID()});
async function quarantined(service,quantity=2){const r=await service.requestReturn(1,returned(quantity));await service.decideReturn(2,r.return_id,'approved');await service.receiveReturn(1,r.return_id);return r.return_id;}
test('adjustment requests are idempotent, bind all input, and post once under competing mocked approvals',async()=>{
  const {f,service}=setup(),input=adjustment();const row=await service.requestAdjustment(1,input);
  assert.equal((await service.requestAdjustment(1,input)).adjustment_id,row.adjustment_id);
  await assert.rejects(()=>service.requestAdjustment(1,{...input,quantity:-1}),{status:409});
  assert.equal(f.state.batches[0].qty_on_hand,5);
  const results=await Promise.allSettled([service.decideAdjustment(2,row.adjustment_id,'approved'),service.decideAdjustment(3,row.adjustment_id,'approved')]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(f.state.batches[0].qty_on_hand,3);
  assert.equal(f.state.activity_logs.filter(l=>l.action.startsWith('adjustment.approved')).length,1);
  assert(f.calls.some(c=>c.sql.includes('FOR UPDATE')&&c.sql.includes('batches')));
});
test('self/inactive/employee review, unsupported decisions and supplier-delivery pseudo-operations are refused',async()=>{
  const {f,service}=setup();const row=await service.requestAdjustment(2,adjustment());
  for(const actor of [1,2,4])await assert.rejects(()=>service.decideAdjustment(actor,row.adjustment_id,'approved'),{status:403});
  await assert.rejects(()=>service.decideAdjustment(3,row.adjustment_id,'legacy'),{status:400});
  await assert.rejects(()=>service.decideAdjustment(3,row.adjustment_id,'rejected',' '),{status:400});
  f.state.stock_adjustments[0].origin_kind='return_restock';await assert.rejects(()=>service.decideAdjustment(3,row.adjustment_id,'approved'),{status:409});
  assert.equal(f.state.batches[0].qty_on_hand,5);
});
test('rejected adjustments are terminal and insufficient balances never post',async()=>{
  const {f,service}=setup();const r=await service.requestAdjustment(1,adjustment());
  await service.decideAdjustment(2,r.adjustment_id,'rejected','Count not substantiated');
  await assert.rejects(()=>service.decideAdjustment(3,r.adjustment_id,'approved'),{status:409});
  const x=await service.requestAdjustment(1,{...adjustment(),quantity:-6});await assert.rejects(()=>service.decideAdjustment(2,x.adjustment_id,'approved'),{status:409});
  assert.equal(f.state.batches[0].qty_on_hand,5);
});
test('posting and decision roll back together on audit or COMMIT failure',async()=>{
  for(const failure of ['failAudit','failCommit']){
    const {f,service}=setup();const row=await service.requestAdjustment(1,adjustment());f[failure]();
    await assert.rejects(()=>service.decideAdjustment(2,row.adjustment_id,'approved'),/Synthetic/);
    assert.equal(f.state.batches[0].qty_on_hand,5);assert.equal(f.state.stock_adjustments[0].decision_state,'pending');
    assert.equal(f.state.activity_logs.length,1);
  }
});
test('lost COMMIT acknowledgement preserves once-only posting on the following attempt',async()=>{
  const {f,service}=setup(),input=adjustment();const row=await service.requestAdjustment(1,input);f.loseCommit();
  await assert.rejects(()=>service.decideAdjustment(2,row.adjustment_id,'approved'),/lost COMMIT/);
  assert.equal(f.state.batches[0].qty_on_hand,3);
  assert.equal((await service.requestAdjustment(1,input)).decision_state,'approved');
  await assert.rejects(()=>service.decideAdjustment(2,row.adjustment_id,'approved'),{status:409});
  assert.equal(f.state.batches[0].qty_on_hand,3);
});
test('returns share the sold-line lock, limit cumulative approvals, preserve stock/cash, and quarantine once',async()=>{
  const {f,service}=setup();const a=await service.requestReturn(1,returned(3)),b=await service.requestReturn(1,returned(3));
  const outcomes=await Promise.allSettled([service.decideReturn(2,a.return_id,'approved'),service.decideReturn(3,b.return_id,'approved')]);
  assert.equal(outcomes.filter(r=>r.status==='fulfilled').length,1);
  const approved=f.state.sale_returns.find(r=>r.decision_state==='approved');
  await service.receiveReturn(1,approved.return_id);const logs=f.state.activity_logs.length;
  await service.receiveReturn(2,approved.return_id);assert.equal(f.state.activity_logs.length,logs);
  assert.equal(approved.received_quantity,3);assert.equal(f.state.batches[0].qty_on_hand,5);
  const itemLock=f.calls.findIndex(c=>c.sql==='SELECT * FROM sale_items WHERE sale_item_id=$1 FOR UPDATE');
  const returnLock=f.calls.findIndex(c=>c.sql==='SELECT * FROM sale_returns WHERE return_id=$1 FOR UPDATE');assert(itemLock<returnLock);
  assert(f.calls.every(c=>!c.sql.startsWith('UPDATE payments')&&!c.sql.startsWith('INSERT INTO payments')));
});
test('cross-sale links, return self-review, rejected receipt and inconsistent original batch metadata fail closed',async()=>{
  const {f,service}=setup();await assert.rejects(()=>service.requestReturn(1,{...returned(),sale_id:99}),{status:404});
  const r=await service.requestReturn(2,returned());await assert.rejects(()=>service.decideReturn(2,r.return_id,'approved'),{status:403});
  f.state.sale_returns[0].sale_id=99;await assert.rejects(()=>service.decideReturn(3,r.return_id,'approved'),{status:409});
  f.state.sale_returns[0].sale_id=30;await service.decideReturn(3,r.return_id,'rejected','Not accepted');
  await assert.rejects(()=>service.receiveReturn(2,r.return_id),{status:409});
});
test('returns fail closed when the original completed cash sale cannot be reconciled',async()=>{
  const {f,service}=setup();f.state.sales[0].qualified=false;
  await assert.rejects(()=>service.requestReturn(1,returned()),{status:404});
  assert.equal(f.state.sale_returns.length,0);
  f.state.sales[0].qualified=true;const row=await service.requestReturn(1,returned());
  f.state.sales[0].qualified=false;await assert.rejects(()=>service.decideReturn(2,row.return_id,'approved'),{status:404});
  assert.equal(f.state.sale_returns[0].decision_state,'pending');
});
test('quarantine disposition limits span all actions and rejection consumes no quantity',async()=>{
  const {f,service}=setup(),id=await quarantined(service);
  const request=action=>service.requestDisposition(3,{return_id:id,quantity:2,action,reason:'Controlled disposition',request_key:randomUUID()});
  const a=await request('destroy'),b=await request('supplier_return');
  await service.decideDisposition(2,a.disposition_id,'rejected','Use supplier process');
  await service.decideDisposition(2,b.disposition_id,'approved');
  const c=await request('restock');await assert.rejects(()=>service.decideDisposition(2,c.disposition_id,'approved',null,40,'Fixture verified medicine integrity/storage'),{status:409});
  assert.equal(f.state.batches[0].qty_on_hand,5);assert.equal(f.state.stock_adjustments.length,0);
});
test('restock requires separate current pharmacist authorization and posts only original sold batch once',async()=>{
  const {f,service}=setup(),id=await quarantined(service);
  const d=await service.requestDisposition(3,{return_id:id,quantity:2,action:'restock',reason:'Verified integrity and storage',request_key:randomUUID()});
  f.state.pharmacist_authorizations[0].revoked_at='2026-11-20';await assert.rejects(()=>service.decideDisposition(2,d.disposition_id,'approved',null,40,'Fixture verified medicine integrity/storage'),{status:404});
  f.state.pharmacist_authorizations[0].revoked_at=null;
  f.state.batches[0].expiry_date='2026-11-21';await assert.rejects(()=>service.decideDisposition(2,d.disposition_id,'approved',null,40,'Fixture verified medicine integrity/storage'),{status:404});
  f.state.batches[0].expiry_date='2099-01-01';await service.decideDisposition(2,d.disposition_id,'approved',null,40,'Fixture verified medicine integrity/storage');
  const a=f.state.stock_adjustments[0];assert.equal(a.batch_id,10);assert.equal(a.quantity,2);assert.equal(a.return_disposition_id,d.disposition_id);
  assert.equal(f.state.batches[0].qty_on_hand,7);assert.equal(a.decision_state,'approved');
  await assert.rejects(()=>service.decideDisposition(2,d.disposition_id,'approved',null,40,'Fixture verified medicine integrity/storage'),{status:409});
  assert.equal(f.state.batches[0].qty_on_hand,7);
});
test('restock blocks both its disposition initiator and original return initiator',async()=>{
  const {f,service}=setup();const r=await service.requestReturn(2,returned());await service.decideReturn(3,r.return_id,'approved');await assert.rejects(()=>service.receiveReturn(1,r.return_id),{status:403});await service.receiveReturn(2,r.return_id);
  const d=await service.requestDisposition(3,{return_id:r.return_id,quantity:2,action:'restock',reason:'Review request',request_key:randomUUID()});
  for(const actor of [2,3])await assert.rejects(()=>service.decideDisposition(actor,d.disposition_id,'approved',null,40,'Fixture verified medicine integrity/storage'),{status:403});
  assert.equal(f.state.batches[0].qty_on_hand,5);
});
