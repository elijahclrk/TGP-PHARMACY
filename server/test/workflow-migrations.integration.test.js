import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {getPool,closePool} from './support/disposable-database.js';
import {createPosRepository} from '../src/repositories/pos.repository.js';
import {createVerifiedBenefitQuotes} from '../src/services/verified-benefit-quotes.js';
import {packagedWorkflowFixture} from './support/packaged-workflow-fixture.js';
import {writeFile,unlink} from 'node:fs/promises';
import {join} from 'node:path';

// Prepared, never enabled automatically. No production fallback. All fixtures,
// triggers and DDL below stay inside one rollback-only disposable transaction.
test('disposable PostgreSQL corrected workflow and financial migration contracts', {skip:process.env.RUN_WORKFLOW_DB_TESTS!=='1'}, async t=>{
  const c=await getPool().connect();
  async function rejects(sql,values=[]){
    await c.query('SAVEPOINT rejected_fixture');
    try { await assert.rejects(()=>c.query(sql,values)); }
    finally {await c.query('ROLLBACK TO SAVEPOINT rejected_fixture');await c.query('RELEASE SAVEPOINT rejected_fixture');}
  }
  try {
    await c.query('BEGIN');
    const schema='tgp_workflow_test_'+randomUUID().replaceAll('-','');
    await c.query('CREATE SCHEMA '+schema);await c.query('SET LOCAL search_path TO '+schema);
    for(const [i,file] of ['001_phase3_baseline.sql','proposed/002_supported_integrity.sql','proposed/004_lookup_indexes.sql','proposed/003_return_sale_item_link.sql','proposed/batch1/007_decision_workflows.sql','proposed/batch1/008_return_dispositions.sql','proposed/batch1/009_discount_financial_snapshots.sql'].entries()){
      let sql=(await readFile(new URL('../database/migrations/'+file,import.meta.url),'utf8')).replace(/--[^\n]*/g,'').trim();
      if(i){assert(sql.startsWith('BEGIN;')&&sql.endsWith('COMMIT;'));sql=sql.slice(6,-7).replace(/^\s*SET LOCAL search_path = public;/,'');}
      assert(!/\bpublic\s*\./i.test(sql));await c.query(sql);
    }
    await t.test('copied packaged runtime verifies actual local schema/function bodies and fails closed on missing canonical files',async()=>{
      const fixture=await packagedWorkflowFixture();
      try{
        const repository=fixture.createWorkflowsRepository(()=>c);
        assert.equal(await repository.schemaReady(),true);
        await unlink(join(fixture.resources,'007_decision_workflows.sql'));
        assert.equal(await repository.schemaReady(),false);
        // Corrupt only the disposable copied artifact; original SQL is untouched.
        await writeFile(join(fixture.resources,'007_decision_workflows.sql'),'CREATE FUNCTION tgp_adjustment_lifecycle() RETURNS trigger LANGUAGE plpgsql AS $$tampered$$;');
        assert.equal(await repository.schemaReady(),false);
      }finally{await fixture.dispose();}
    });
    await c.query(`INSERT INTO users(user_id,username,password_hash,role,status) VALUES
      (1,'fixture_employee','synthetic','employee','active'),(2,'fixture_admin','synthetic','admin','active'),(3,'fixture_manager','synthetic','manager','active');
      INSERT INTO products(product_id,name) VALUES(1,'fixture');
      INSERT INTO batches(batch_id,product_id,qty_on_hand,expiry_date) VALUES(1,1,10,'2099-01-01'),(2,1,10,'2099-01-01');
      INSERT INTO sales(sale_id,user_id,total_amount) VALUES(1,1,50),(2,1,10);
      INSERT INTO sale_items(sale_item_id,sale_id,batch_id,quantity,unit_price) VALUES(1,1,1,5,10),(2,2,2,1,10);`);
    await t.test('adjustments require pending entry, distinct reviewer and immutable rejection',async()=>{
      await rejects("INSERT INTO stock_adjustments(adjustment_id,batch_id,adjusted_by,quantity,reason) VALUES(1,1,1,1,'fixture')");
      await c.query("INSERT INTO stock_adjustments(adjustment_id,batch_id,adjusted_by,quantity,reason,adjustment_date,decision_state,request_key) VALUES(1,1,1,-1,'fixture',CURRENT_TIMESTAMP,'pending',$1)",[randomUUID()]);
      await rejects("UPDATE stock_adjustments SET decision_state='rejected',reviewed_by=1,reviewed_at=CURRENT_TIMESTAMP,decision_reason='fixture' WHERE adjustment_id=1");
      await c.query("UPDATE stock_adjustments SET decision_state='rejected',reviewed_by=2,reviewed_at=CURRENT_TIMESTAMP,decision_reason='fixture' WHERE adjustment_id=1");
      await rejects("UPDATE stock_adjustments SET decision_state='pending' WHERE adjustment_id=1");
    });
    await t.test('sale linkage, cumulative limits, quarantine and disposition caps',async()=>{
      for(const id of [1,2])await c.query("INSERT INTO sale_returns(return_id,sale_id,sale_item_id,processed_by,quantity,reason,return_date,decision_state,request_key) VALUES($1,1,1,1,3,'fixture',CURRENT_DATE,'pending',$2)",[id,randomUUID()]);
      await rejects('UPDATE sale_returns SET sale_id=2 WHERE return_id=1');
      await c.query("UPDATE sale_returns SET decision_state='approved',approved_by=2,reviewed_by=2,reviewed_at=CURRENT_TIMESTAMP WHERE return_id=1");
      await rejects("UPDATE sale_returns SET decision_state='approved',approved_by=2,reviewed_by=2,reviewed_at=CURRENT_TIMESTAMP WHERE return_id=2");
      await rejects('UPDATE sale_returns SET received_quantity=1,received_at=CURRENT_TIMESTAMP,received_by=1 WHERE return_id=1');
      await c.query('UPDATE sale_returns SET received_quantity=3,received_at=CURRENT_TIMESTAMP,received_by=1 WHERE return_id=1');
      await rejects('UPDATE sale_items SET batch_id=2 WHERE sale_item_id=1');
      for(const id of [1,2])await c.query("INSERT INTO return_dispositions(disposition_id,return_id,request_key,action,quantity,requested_by,requested_at,reason,decision_state) VALUES($1,1,$2,'destroy',3,3,CURRENT_TIMESTAMP,'fixture','pending')",[id,randomUUID()]);
      await c.query("UPDATE return_dispositions SET decision_state='approved',reviewed_by=2,reviewed_at=CURRENT_TIMESTAMP WHERE disposition_id=1");
      await rejects("UPDATE return_dispositions SET decision_state='approved',reviewed_by=2,reviewed_at=CURRENT_TIMESTAMP WHERE disposition_id=2");
      assert.equal((await c.query('SELECT qty_on_hand FROM batches WHERE batch_id=1')).rows[0].qty_on_hand,10);
    });
    await t.test('real migration 009 metadata integrates with locked authoritative POS quotes, without posting',async()=>{
      await c.query('SAVEPOINT benefit_metadata_fixture');
      try{
        await c.query("UPDATE products SET unit_price=112,tax_treatment='vatable',classification_source='synthetic-tax',classification_version='tax-v1',classification_reviewed_by=2,classification_reviewed_at=CURRENT_TIMESTAMP WHERE product_id=1");
        await c.query("INSERT INTO product_benefit_classifications(product_id,benefit_type,eligibility,source,version,reviewed_by,reviewed_at) VALUES(1,'senior','eligible','synthetic-evidence','v1',2,CURRENT_TIMESTAMP)");
        const policy={verified:true,benefit:'senior',version:'synthetic-v1',source:'TEST ONLY',rounding:'half_up_per_line',discountBps:2000,vatBps:1200,exemptEligibleVatable:true,priceBasisByTax:{vatable:'vat_inclusive',vat_exempt:'vat_exempt'},signoffs:{branchTax:true,medicineEvidence:true,documentaryProcedure:true,invoiceFormat:true}};
        const service=createVerifiedBenefitQuotes({posRepository:createPosRepository(()=>c),policyProvider:async()=>policy});
        const input={benefit:'senior',customer:{name:'SYNTHETIC TEST ONLY',id:'TEST ONLY'},items:[{product_id:1,quantity:1}]};
        const before=(await c.query('SELECT count(*)::int AS n FROM sales')).rows[0].n;
        const first=await service.prepare(c,{user_id:1},input);assert.equal(first.totals.net,'80.00');
        await c.query("UPDATE product_benefit_classifications SET version='v2' WHERE product_id=1");
        const second=await service.prepare(c,{user_id:1},input);assert.throws(()=>service.requireReviewed(first.fingerprint,second),{status:409});
        await c.query("UPDATE product_benefit_classifications SET eligibility='unverified' WHERE product_id=1");
        await assert.rejects(service.prepare(c,{user_id:1},input));
        assert.equal((await c.query('SELECT count(*)::int AS n FROM sales')).rows[0].n,before);
      }finally{await c.query('ROLLBACK TO SAVEPOINT benefit_metadata_fixture');await c.query('RELEASE SAVEPOINT benefit_metadata_fixture');}
    });
    await t.test('new discount marker cannot bypass version; financial lines require quantities and cents',async()=>{
      await c.query("INSERT INTO discounts(discount_id,type,rate) VALUES(1,'senior',0.2)");
      await rejects("INSERT INTO sales(sale_id,user_id,discount_id,senior_pwd_id,total_amount) VALUES(3,1,1,'synthetic-id',80)");
      await rejects("INSERT INTO sales(sale_id,user_id,total_amount,benefit_type,gross_amount) VALUES(3,1,80,'regular',80)");
      await rejects("INSERT INTO sale_items(sale_item_id,sale_id,batch_id,quantity,unit_price,product_name_snapshot) VALUES(3,1,1,1,10,'partial')");
      await c.query(`INSERT INTO sales(sale_id,user_id,receipt_no,sale_date,total_amount,discount_id,senior_pwd_id,vat_exempt,
        financial_snapshot_version,customer_name,benefit_type,policy_version,policy_source_snapshot,gross_amount,vat_removed_amount,discount_amount,vatable_amount,vat_exempt_amount,vat_amount)
        VALUES(3,1,'fixture-receipt',CURRENT_TIMESTAMP,80,1,'synthetic-id',true,'1','Fixture Beneficiary','senior','fixture-v1','synthetic',112,12,20,0,80,0)`);
      const sql=`INSERT INTO sale_items(sale_item_id,sale_id,batch_id,quantity,unit_price,financial_snapshot_version,product_name_snapshot,tax_treatment_snapshot,
        benefit_eligible_snapshot,discount_rate_snapshot,vat_rate_snapshot,price_basis_snapshot,eligibility_source_snapshot,eligibility_version_snapshot,policy_version_snapshot,
        benefit_type_snapshot,tax_source_snapshot,tax_version_snapshot,gross_line_amount,vat_removed_line_amount,discount_line_amount,net_line_amount,vatable_line_amount,vat_exempt_line_amount,vat_line_amount)
        VALUES(3,3,1,$1,$2,'1','Fixture','vatable',true,0.2,0.12,'vat_inclusive','synthetic','v1','fixture-v1','senior','synthetic-tax','t1',112,12,20,80,0,80,0)`;
      await rejects(sql,[null,'112']);await rejects(sql,[1,'112.001']);await c.query(sql,[1,'112']);
      await c.query('SET CONSTRAINTS ALL IMMEDIATE');
      await rejects('UPDATE sale_items SET quantity=2 WHERE sale_item_id=3');
      await rejects('UPDATE sales SET financial_snapshot_version=NULL WHERE sale_id=3');
    });
  } finally {await c.query('ROLLBACK').catch(()=>{});c.release();await closePool();}
});
