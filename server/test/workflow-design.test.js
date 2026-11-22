import { test } from 'node:test';
import assert from 'node:assert/strict';
import { proposedDecisionAllowed } from '../database/migrations/proposed/batch1/workflow-policy.mjs';
import { createPurchasingRepository } from '../src/repositories/purchasing.repository.js';

test('approved policy denies self-review for new workflows while preserving purchasing permissions', () => {
  for (const kind of ['purchase_order','stock_in','adjustment','return','restock']) {
    for (const role of ['employee','manager','admin']) {
      const reviewer={user_id:2,role,status:'active'};
      const pharmacistAuthorization={user_id:2,verified_at:'2026-01-01',expires_at:'2027-01-01'};
      const input={kind,initiatorId:1,returnInitiatorId:4,reviewer,pharmacistAuthorization,now:new Date('2026-11-21')};
      assert.equal(proposedDecisionAllowed(input),role!=='employee');
      assert.equal(proposedDecisionAllowed({...input,initiatorId:2}),role!=='employee'&&['purchase_order','stock_in'].includes(kind));
      assert.equal(proposedDecisionAllowed({...input,reviewer:{...reviewer,status:'inactive'}}),false);
    }
  }
});
test('proposed restocking needs current professional authorization, independently of the role', () => {
  const input={kind:'restock',initiatorId:1,returnInitiatorId:4,reviewer:{user_id:2,role:'admin',status:'active'},now:new Date('2026-11-21')};
  assert.equal(proposedDecisionAllowed(input),false);
  for(const authorization of [
    {user_id:3,verified_at:'2026-01-01',expires_at:'2027-01-01'},
    {user_id:2,verified_at:'2026-01-01',expires_at:'2026-11-21'},
    {user_id:2,verified_at:'2027-01-01',expires_at:'2028-01-01'},
    {user_id:2,verified_at:'2026-01-01',expires_at:'2027-01-01',revoked_at:'2026-11-20'},
  ])assert.equal(proposedDecisionAllowed({...input,pharmacistAuthorization:authorization}),false);
  assert.equal(proposedDecisionAllowed({...input,returnInitiatorId:2,pharmacistAuthorization:{user_id:2,verified_at:'2026-01-01',expires_at:'2027-01-01'}}),false);
});
test('current PO/stock-in self-approval remains compatible with the Batch 2 policy', async () => {
  const repo=createPurchasingRepository(()=>{throw Error('Unexpected pool access');});
  for(const type of ['orders','receiving']) {
    let qty=0,header={po_id:type==='orders'?5:null,stock_in_id:5,created_by:2,received_by:2,approved_by:null,status:'pending'};
    const client={async query(sql){
      if(sql.startsWith('SELECT * FROM purchase_orders')||sql.startsWith('SELECT * FROM stock_ins'))return {rows:[header]};
      if(sql.startsWith('SELECT * FROM stock_in_items'))return {rows:[{batch_id:3,item_id:1,quantity:2,unit_cost:'1'}]};
      if(sql.startsWith('SELECT batch_id'))return {rows:[{batch_id:3}]};
      if(sql.startsWith('UPDATE batches')){qty+=2;return {rowCount:1};}
      if(sql.startsWith('UPDATE purchase_orders')||sql.startsWith('UPDATE stock_ins')){header={...header,approved_by:2};return {rows:[header],rowCount:1};}
      throw Error('Unexpected fixture SQL');
    }};
    assert.equal((await repo.approve(client,type,5,2)).approved_by,2);
    assert.equal(qty,type==='receiving'?2:0);
    assert.equal(proposedDecisionAllowed({kind:type==='orders'?'purchase_order':'stock_in',initiatorId:2,reviewer:{user_id:2,role:'manager',status:'active'}}),true);
  }
});
