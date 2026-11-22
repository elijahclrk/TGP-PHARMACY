import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {benefitFixture} from './benefit-fixture.js';
import {verifiedLocalExchanges} from '../../testing/local-exchange-runtime.mjs';
import {createPreparedWorkflows} from '../../src/services/prepared-workflows.js';
export const exchangeMigration='proposed/batch13/012_local_product_exchanges.sql';
export const syntheticExchangePolicy=(authorizationId=901,source=201,replacement=221)=>({testOnly:true,version:'synthetic-exchange-v1',validUntil:'2099-01-01T00:00:00Z',pairs:[[source,source],[source,replacement],[replacement,replacement]].map(([sourceProductId,replacementProductId])=>({sourceProductId,replacementProductId,authorizationId,prescriptionRequired:false,evidence:'SYNTHETIC TEST ONLY reviewed replacement pair',version:'synthetic-clinical-v1',validUntil:'2099-01-01T00:00:00Z'}))});
export async function installExchanges(c){let sql=(await readFile(new URL('../../database/migrations/'+exchangeMigration,import.meta.url),'utf8')).replace(/--[^\n]*/g,'').trim();sql=sql.slice(6,-7).replace(/^\s*SET LOCAL search_path = public;/,'');if(/\bpublic\s*\./i.test(sql))throw Error('Unsafe fixture search path');await c.query(sql);}
export async function exchangeFixture(){
 const f=await benefitFixture(),c=await f.provider().connect();
 try{await c.query('BEGIN');await installExchanges(c);await c.query("INSERT INTO users(user_id,username,password_hash,role,status) VALUES(5,'synthetic_other_employee','not-login','employee','active'); INSERT INTO pharmacist_authorizations(authorization_id,user_id,authorized_by,evidence_ref,verified_at,expires_at) VALUES(901,4,3,'SYNTHETIC TEST ONLY',clock_timestamp()-interval '1 hour',clock_timestamp()+interval '1 day')");await c.query('COMMIT');}catch(e){await c.query('ROLLBACK');await f.dispose();throw e;}finally{c.release();}
 const exchanges=await verifiedLocalExchanges(f.provider,{...process.env,NODE_ENV:'test',DATABASE_URL:process.env.TEST_DATABASE_URL},f.secret,syntheticExchangePolicy(901,1,2)),workflows=createPreparedWorkflows(f.provider);
 async function source(qty=3,product=1,receive=true){const data={items:Array.isArray(product)?product:[{product_id:product,quantity:qty}],request_id:randomUUID(),amount_paid:'1000.00'};const paid=await f.auth.transaction(async c=>{const q=await f.pos.quote(c,data);return f.pos.checkout(c,f.actor,data,f.auth.audit,q.fingerprint);});
  const returns=[];for(const line of paid.receipt.items){const r=await workflows.requestReturn(1,{sale_id:paid.receipt.sale_id,sale_item_id:line.sale_item_id,quantity:line.quantity,reason:'SYNTHETIC voluntary return',request_key:randomUUID()});await workflows.decideReturn(2,r.return_id,'approved');if(receive)await workflows.receiveReturn(1,r.return_id);returns.push(r);}
  return {paid,returns};}
 async function candidate(returns,items){const draft={claims:returns.map(r=>({return_id:r.return_id,quantity:r.quantity})),items,reason:'SYNTHETIC voluntary replacement',route:'voluntary'},quote=await exchanges.quote(1,draft);return {draft,quote,request_id:randomUUID()};}
 async function create(x){return exchanges.create(1,{request_id:x.request_id,draft:x.draft,quote_token:x.quote.quote_token});}
 return {...f,exchanges,workflows,source,candidate,create,async approve(id){return exchanges.decision(2,id,{decision:'approved'});},async complete(id,tender='0'){const quote=await exchanges.reviewedQuote(1,id);return exchanges.post(1,id,{request_id:randomUUID(),quote_token:quote.quote_token,tender});}};
}
