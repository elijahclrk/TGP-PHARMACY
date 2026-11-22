import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {installBenefits,benefitMigrations} from './support/benefit-fixture.js';
import {getPool,closePool} from './support/disposable-database.js';
import {createPosRepository} from '../src/repositories/pos.repository.js';
test('011 populated legacy/version1 upgrade and DDL rollback preserve historical financial rows',{skip:process.env.RUN_WORKFLOW_DB_TESTS!=='1'},async()=>{
 const c=await getPool().connect(),schema='tgp_benefit_upgrade_'+randomUUID().replaceAll('-','');
 const insert=async(table,row)=>{const keys=Object.keys(row);return c.query(`INSERT INTO ${table}(${keys.join(',')}) VALUES(${keys.map((_,i)=>'$'+(i+1)).join(',')})`,Object.values(row));};
 try{
  await c.query('BEGIN');await c.query('CREATE SCHEMA '+schema);await c.query('SET LOCAL search_path TO '+schema);await installBenefits(c,benefitMigrations.slice(0,-1));
  await c.query("INSERT INTO users(user_id,username,password_hash,role,status) VALUES(1,'SYNTHETIC','SYNTHETIC','admin','active');INSERT INTO products(product_id,name,unit_price) VALUES(1,'SYNTHETIC',112);INSERT INTO batches(batch_id,product_id,batch_no,expiry_date,qty_on_hand) VALUES(1,1,'SYNTHETIC','2099-01-01',20);INSERT INTO discounts(discount_id,type,rate) VALUES(1,'senior',0.2)");
  await c.query("INSERT INTO sales(sale_id,user_id,receipt_no,sale_date,total_amount) VALUES(1,1,'SYNTHETIC-LEGACY',CURRENT_TIMESTAMP,112);INSERT INTO sale_items(sale_item_id,sale_id,batch_id,quantity,unit_price) VALUES(1,1,1,1,112)");
  await insert('sales',{sale_id:2,user_id:1,receipt_no:'SYNTHETIC-V1',sale_date:new Date(),total_amount:80,discount_id:1,senior_pwd_id:'SYNTHETIC',vat_exempt:true,financial_snapshot_version:'1',customer_name:'SYNTHETIC',benefit_type:'senior',policy_version:'synthetic-v1',policy_source_snapshot:'SYNTHETIC',gross_amount:112,vat_removed_amount:12,discount_amount:20,vatable_amount:0,vat_exempt_amount:80,vat_amount:0});
  await insert('sale_items',{sale_item_id:2,sale_id:2,batch_id:1,quantity:1,unit_price:112,financial_snapshot_version:'1',product_name_snapshot:'SYNTHETIC-V1-PRODUCT',tax_treatment_snapshot:'vatable',benefit_eligible_snapshot:true,discount_rate_snapshot:.2,vat_rate_snapshot:.12,price_basis_snapshot:'vat_inclusive',eligibility_source_snapshot:'SYNTHETIC',eligibility_version_snapshot:'v1',policy_version_snapshot:'synthetic-v1',benefit_type_snapshot:'senior',tax_source_snapshot:'SYNTHETIC',tax_version_snapshot:'v1',gross_line_amount:112,vat_removed_line_amount:12,discount_line_amount:20,net_line_amount:80,vatable_line_amount:0,vat_exempt_line_amount:80,vat_line_amount:0});
  await c.query("INSERT INTO payments(payment_id,sale_id,method,amount_paid,change_due) VALUES(1,1,'cash',112,0),(2,2,'cash',80,0);INSERT INTO activity_logs(log_id,user_id,action,module,logged_at) VALUES(1,1,'sale.paid:1','POS',CURRENT_TIMESTAMP),(2,1,'sale.paid:2','POS',CURRENT_TIMESTAMP);SET CONSTRAINTS ALL IMMEDIATE");
  const before=(await c.query('SELECT to_jsonb(s) AS row FROM sales s ORDER BY sale_id')).rows;
  await c.query('SAVEPOINT isolated_upgrade');await installBenefits(c,benefitMigrations.slice(-1));assert((await c.query("SELECT to_regclass('benefit_policies') AS t")).rows[0].t);
  await c.query('ROLLBACK TO SAVEPOINT isolated_upgrade');assert.equal((await c.query("SELECT to_regclass('benefit_policies') AS t")).rows[0].t,null);
  await installBenefits(c,benefitMigrations.slice(-1));
  const after=(await c.query('SELECT to_jsonb(s) AS row FROM sales s ORDER BY sale_id')).rows;
  for(let i=0;i<before.length;i++)assert.deepEqual(Object.fromEntries(Object.keys(before[i].row).map(k=>[k,after[i].row[k]])),before[i].row);
  const pos=createPosRepository(()=>c);const legacy=await pos.receipt(1,{user_id:1,role:'admin'},c),v1=await pos.receipt(2,{user_id:1,role:'admin'},c);
  assert.equal(Number(legacy.total_amount),112);assert.equal(legacy.financial,null);assert.equal(Number(v1.total_amount),80);assert.equal(v1.items[0].product_name,'SYNTHETIC-V1-PRODUCT');
  await c.query('SAVEPOINT rejected_history_edit');await assert.rejects(c.query('UPDATE sales SET total_amount=1 WHERE sale_id=2'));await c.query('ROLLBACK TO SAVEPOINT rejected_history_edit');
 }finally{await c.query('ROLLBACK').catch(()=>{});c.release();await closePool();}
});
