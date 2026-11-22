import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {getPool} from './disposable-database.js';
import {verifiedLocalBenefits} from '../../testing/local-benefit-runtime.mjs';
import {createAuthRepository} from '../../src/repositories/auth.repository.js';
import {createPosRepository} from '../../src/repositories/pos.repository.js';
export const benefitMigrations=['001_phase3_baseline.sql','proposed/002_supported_integrity.sql','proposed/004_lookup_indexes.sql','proposed/003_return_sale_item_link.sql','proposed/batch1/007_decision_workflows.sql','proposed/batch1/008_return_dispositions.sql','proposed/batch1/009_discount_financial_snapshots.sql','proposed/batch10/011_local_benefit_checkout.sql'];
export async function installBenefits(c,files=benefitMigrations){
 for(const file of files){
  let sql=(await readFile(new URL('../../database/migrations/'+file,import.meta.url),'utf8')).replace(/--[^\n]*/g,'').trim();
  if(file!=='001_phase3_baseline.sql'){assert(sql.startsWith('BEGIN;')&&sql.endsWith('COMMIT;'));sql=sql.slice(6,-7).replace(/^\s*SET LOCAL search_path = public;/,'');}
  assert(!/\bpublic\s*\./i.test(sql));await c.query(sql);
 }
}
export async function seedBenefits(c,{users={employee:1,manager:2,admin:3,pharmacist:4},products=[1,2,3,4,5,6],batches=100}={}){
 const source='SYNTHETIC TEST ONLY - not branch evidence';
 for(const[scheme,id]of [['senior',1],['pwd',2]]){
  await c.query('INSERT INTO discounts(discount_id,type,rate) VALUES($1,$2,0.2)',[id,scheme]);
  await c.query('INSERT INTO benefit_policies(policy_id,benefit_type,version,payload,reviewed_by,reviewed_at,active,test_only) VALUES($1,$2,$3,$4,$5,CURRENT_TIMESTAMP,true,true)',[id,scheme,'synthetic-'+scheme+'-v1',{
   testOnly:true,vatStatus:'vat_registered',rounding:'half_up_product_line_v1',discountBps:2000,vatBps:1200,source,validUntil:'2099-01-01T00:00:00Z',documentaryVersion:'synthetic-sop-v1',priceProvenanceVerified:true,fiscalInvoice:false},users.admin]);
 }
 for(const[index,id]of products.entries()){
  const price=index===1?'100.00':index===4?'0.01':'112.00';
  await c.query('INSERT INTO products(product_id,name,generic_name,category,unit_price) VALUES($1,$2,$3,$4,$5)',[id,'SYNTHETIC benefit '+(index+1),'Synthetic generic','Synthetic only',price]);
  for(const[offset,qty]of [[0,1],[1,20],[2,3]])await c.query("INSERT INTO batches(batch_id,product_id,batch_no,qty_on_hand,expiry_date,cost_price) VALUES($1,$2,$3,$4,(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila')::date+$5::int,1)",[batches+index*3+offset,id,'TEST-BENEFIT-'+index+'-'+offset,qty,offset===2?0:10+offset]);
  if(index===3)continue;
  for(const scheme of ['senior','pwd'])await c.query(`INSERT INTO benefit_product_versions(version_id,product_id,benefit_type,version,eligibility,tax,price_basis,prescription_required,promotion_state,source,reviewed_by,reviewed_at,valid_from,valid_until,active)
   VALUES($1,$2,$3,'synthetic-v1',$4,$5,$6,$7,'none',$8,$9,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP-interval '1 day','2099-01-01',true)`,[randomUUID(),id,scheme,index===2?'ineligible':'eligible',index===1?'vat_exempt':'vatable',index===1?'vat_exempt':'vat_inclusive',index===5,source,users.admin]);
 }
}
export const syntheticDraft=(benefit='senior')=>({benefit,customer:{name:'SYNTHETIC BENEFICIARY',id:'SYNTHETIC-ID',idType:benefit==='senior'?'osca':'pwd_digital'},documents:{identitySeen:true,entitlementConfirmed:true,exclusiveUse:true,purchaser:'self',...(benefit==='pwd'?{bookletSeen:true}:{})}});
export async function benefitFixture(){
 const schema='tgp_benefit_test_'+randomUUID().replaceAll('-',''),base=getPool();
 const admin=await base.connect();
 try{
  await admin.query('BEGIN');await admin.query('CREATE SCHEMA '+schema);await admin.query('SET LOCAL search_path TO '+schema);await installBenefits(admin);
  await admin.query("INSERT INTO users(user_id,username,password_hash,role,status) VALUES(1,'synthetic_employee','not-login','employee','active'),(2,'synthetic_manager','not-login','manager','active'),(3,'synthetic_admin','not-login','admin','active'),(4,'synthetic_pharmacist','not-login','manager','active')");
  await seedBenefits(admin);await admin.query('COMMIT');
 }catch(error){await admin.query('ROLLBACK');throw error;}finally{admin.release();}
 const provider=()=>({async connect(){const c=await base.connect();await c.query('SET search_path TO '+schema);return c;},async query(...args){const c=await this.connect();try{return await c.query(...args);}finally{c.release();}}});
 const auth=createAuthRepository(provider),pos=createPosRepository(provider),secret='synthetic-only-fixture-key-'.repeat(3);
 const service=await verifiedLocalBenefits(provider,{...process.env,NODE_ENV:'test',DATABASE_URL:process.env.TEST_DATABASE_URL},secret);
 return {schema,provider,auth,pos,service,secret,
  actor:{user_id:1,role:'employee',status:'active'},
  async prepare(items,benefit='senior',actor=this.actor,draft=syntheticDraft(benefit)){
   const v=await auth.transaction(c=>service.verification(c,actor,{items,draft}));
   const q=await auth.transaction(c=>service.quote(c,actor,{items,benefit,...v}));
   return {request_id:randomUUID(),items,benefit,...v,quote_token:q.quote_token,amount_paid:'500.00',quote:q};
  },
  async pay(input,actor=this.actor,audit=auth.audit){const{quote,...body}=input;return auth.transaction(c=>service.checkout(c,actor,body,audit));},
  async dispose(){assert(/^tgp_benefit_test_[a-f0-9]{32}$/.test(schema));await base.query('DROP SCHEMA '+schema+' CASCADE');},
 };
}
