// Invoked only by an independently attested disposable runtime. No env switch.
import {randomUUID,createHmac,timingSafeEqual} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {z} from 'zod';
import {cartInput} from '../services/pos-validation.js';
import {localBenefitDraft,localBenefitPolicy,calculateLocalBenefits,allocateBenefitLine} from '../services/local-benefit-calculation.js';
import {quoteFingerprint} from '../services/pos-quotes.js';
import {cents,amount} from '../services/prepared-benefits.js';
import {insertWithId} from './auth.repository.js';
import {isAcademic} from '../academic/capabilities.js';
export const benefitVerificationInput=cartInput.safeExtend({draft:localBenefitDraft});
export const benefitQuoteInput=cartInput.safeExtend({benefit:z.enum(['senior','pwd']),verification_id:z.uuid()});
export const benefitCheckoutInput=benefitQuoteInput.safeExtend({request_id:z.uuid(),amount_paid:z.string().regex(/^(0|[1-9]\d{0,11})(\.\d{1,2})?$/),quote_token:z.string().max(1024).optional()});
const unavailable=()=>{throw Object.assign(new Error('Local benefit checkout unavailable: verified synthetic configuration required.'),{status:503});};
const conflict=(correctable=true)=>{throw Object.assign(new Error('Review a fresh benefit quote.'),{status:409,correctable});};
const invalid=()=>{throw Object.assign(new Error('Documentary verification is incomplete or inconsistent.'),{status:422,correctable:true,code:'BENEFIT_DOCUMENTS_INVALID'});};
const canon=items=>[...items].sort((a,b)=>a.product_id-b.product_id).map(({product_id,quantity})=>({product_id,quantity}));
export function createLocalBenefitsRepository({poolProvider,posRepository,secret,isolatedCapability}){
 const cloud=isAcademic(isolatedCapability,poolProvider);
 if((!cloud&&(isolatedCapability?.localOnly!==true||isolatedCapability?.tlsVerified!==true))||!secret)unavailable();
 const digest=value=>createHmac('sha256',secret).update('tgp-benefit-private-v2:'+JSON.stringify(value)).digest('hex');
 const sign=(actor,fingerprint)=>{const body=Buffer.from(JSON.stringify({v:2,actor,mode:'benefit',fingerprint,expires:Date.now()+300000})).toString('base64url');return body+'.'+digest(body);};
 function verify(token,actor){try{const[body,sig]=token.split('.'),expected=digest(body);if(sig.length!==expected.length||!timingSafeEqual(Buffer.from(sig),Buffer.from(expected)))return null;const data=JSON.parse(Buffer.from(body,'base64url'));return data.v===2&&data.actor===actor&&data.mode==='benefit'&&data.expires>Date.now()?data.fingerprint:null;}catch{return null;}}
 async function ready(c){
  const installed=(await c.query("SELECT to_regprocedure('tgp_benefit_reconcile()')::text AS installed,to_regclass('benefit_policies')::text AS policies")).rows[0];
  if(!installed?.installed||!installed.policies)return false;
  // Exact installed function body checks plus required triggers/constraints.
  const sql=(await Promise.all(['batch1/009_discount_financial_snapshots.sql','batch10/011_local_benefit_checkout.sql'].map(p=>readFile(new URL('../../database/migrations/proposed/'+p,import.meta.url),'utf8')))).join('\n');
  for(const match of sql.matchAll(/CREATE FUNCTION (tgp_\w+)\([^]*? AS \$\$([^]*?)\$\$;/g)){
   const body=(await c.query('SELECT prosrc FROM pg_proc WHERE oid=to_regprocedure($1)',[match[1]+'()'])).rows[0]?.prosrc;
   // Parameterized validation functions have different signatures.
   const actual=body??(await c.query('SELECT prosrc FROM pg_proc WHERE pronamespace=current_schema()::regnamespace AND proname=$1',[match[1]])).rows[0]?.prosrc;
   const normalize=s=>s?.replace(/--[^\n]*/g,'').replace(/\s+/g,' ').trim();
   if(normalize(actual)!==normalize(match[2]))return false;
  }
  const requiredTriggers=['benefit_sale_reconcile','benefit_item_reconcile','benefit_payment_reconcile','benefit_logical_reconcile','benefit_audit_guard','benefit_payment_guard','benefit_logical_guard','benefit_policy_immutable','benefit_product_immutable','benefit_verification_immutable','benefit_logical_immutable','benefit_fill_immutable','sale_snapshot_write','item_snapshot_write','sale_snapshot_reconciliation','item_snapshot_reconciliation'];
  const triggers=(await c.query("SELECT count(*)::int AS n FROM pg_trigger WHERE tgname=ANY($1::text[]) AND tgenabled='O' AND tgrelid IN (SELECT oid FROM pg_class WHERE relnamespace=current_schema()::regnamespace)",[requiredTriggers])).rows[0].n;
  const checks=(await c.query("SELECT conname,pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE connamespace=current_schema()::regnamespace AND conname=ANY($1::text[])",[['sale_financial_snapshot_ck','sale_item_financial_snapshot_ck','benefit_logical_line_fk','sale_snapshot_cent_precision_ck','item_snapshot_cent_precision_ck','benefit_header_extension_ck','benefit_item_extension_ck']])).rows;
  return triggers===requiredTriggers.length&&checks.length===7&&checks.some(r=>r.definition.includes('tgp_benefit_header'))&&checks.some(r=>r.definition.includes('tgp_benefit_item'));
 }
 async function policy(c,scheme){
  const p=(await c.query('SELECT * FROM benefit_policies WHERE benefit_type=$1 AND active FOR SHARE',[scheme])).rows[0];
  if(!p||p.test_only!==true)unavailable();localBenefitPolicy.parse(p.payload);
  if(Date.parse(p.payload.validUntil)<=Date.now())unavailable();return p;
 }
 async function snapshot(c,actor,input){
  if(!await ready(c))unavailable();const p=await policy(c,input.benefit);
  const v=(await c.query('SELECT * FROM benefit_verifications WHERE verification_id=$1 FOR UPDATE',[input.verification_id])).rows[0];
  if(!v||v.actor_id!==actor.user_id||v.benefit_type!==input.benefit||v.policy_id!==p.policy_id||new Date(v.expires_at)<=new Date()||JSON.stringify(canon(v.cart))!==JSON.stringify(canon(input.items)))invalid();
  const draft=localBenefitDraft.parse({benefit:v.benefit_type,customer:{name:v.customer_name,id:v.customer_id,idType:v.document_snapshot.idType},documents:v.document_snapshot.documents});
  const q=await posRepository.quote(c,{items:input.items});
  const records=(await c.query('SELECT * FROM benefit_product_versions WHERE product_id=ANY($1::int[]) AND benefit_type=$2 AND active ORDER BY product_id FOR SHARE',[input.items.map(i=>i.product_id),input.benefit])).rows;
  const items=q.items.map(item=>{
   const r=records.find(row=>row.product_id===item.product_id);
   if(!r||new Date(r.valid_from)>new Date()||new Date(r.valid_until)<=new Date())unavailable();
   return {productId:item.product_id,lineKey:String(item.product_id),name:item.name,quantity:item.quantity,unitPrice:item.unit_price,eligibility:r.eligibility,benefit:input.benefit,tax:r.tax,
    priceBasis:r.price_basis,promotion:r.promotion_state,taxSource:r.source,taxVersion:r.version,classificationSource:r.source,classificationVersion:r.version};
  });
  const documents=draft.documents;
  if(records.some(r=>r.prescription_required)){
   if(!documents.prescriptionRef||!documents.prescribedQuantity||!documents.pharmacistAuthorizationId)invalid();
   const qualified=(await c.query("SELECT authorization_id FROM pharmacist_authorizations WHERE authorization_id=$1 AND user_id=$2 AND revoked_at IS NULL AND verified_at<=CURRENT_TIMESTAMP AND expires_at>CURRENT_TIMESTAMP FOR SHARE",[documents.pharmacistAuthorizationId,actor.user_id])).rows[0];
   if(!qualified)invalid();
   for(const item of items.filter(i=>records.find(r=>r.product_id===i.productId).prescription_required)){
    const used=(await c.query('SELECT coalesce(sum(quantity),0)::int AS used FROM benefit_prescription_fills WHERE beneficiary_digest=$1 AND prescription_ref=$2 AND product_id=$3',[digest([input.benefit,v.customer_id]),documents.prescriptionRef,item.productId])).rows[0].used;
    if(used+item.quantity>documents.prescribedQuantity)invalid();
   }
  }
  let calculation;try{calculation=calculateLocalBenefits({benefit:input.benefit,customer:{name:v.customer_name,id:v.customer_id},items,policy:p.payload,version:p.version});}catch{unavailable();}
  return {p,v,records,calculation,fingerprint:quoteFingerprint({actor:actor.user_id,regular:q.fingerprint,policy:p,verification:v,records,calculation})};
 }
 return {
  async availability(c){try{if(!await ready(c))return false;await policy(c,'senior');await policy(c,'pwd');return true;}catch{return false;}},
  async verification(c,actor,input){
   const data=benefitVerificationInput.parse(input);if(cloud&&(!data.draft.customer.name.startsWith('SYNTHETIC ')||!data.draft.customer.id.startsWith('SYNTHETIC-')))invalid();if(!await ready(c))unavailable();const p=await policy(c,data.draft.benefit);const id=randomUUID();
   await c.query(`INSERT INTO benefit_verifications(verification_id,actor_id,policy_id,benefit_type,customer_name,customer_id,document_snapshot,cart,expires_at)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,CURRENT_TIMESTAMP+interval '15 minutes')`,[id,actor.user_id,p.policy_id,data.draft.benefit,data.draft.customer.name,data.draft.customer.id,{idType:data.draft.customer.idType,documents:data.draft.documents},JSON.stringify(canon(data.items))]);
   return {verification_id:id};
  },
  async quote(c,actor,input){const s=await snapshot(c,actor,benefitQuoteInput.parse(input));return {
   items:s.calculation.lines.map(l=>({product_id:l.productId,name:l.productName,quantity:l.quantity,unit_price:l.unitPrice,line_total:l.net,discount:l.discount,vat_removed:l.vatRemoved,vat:l.vat,eligible:l.benefitEligible,price_basis:l.priceBasis})),
   total:s.calculation.totals.net,financial:s.calculation.totals,quote_token:sign(actor.user_id,s.fingerprint),local_only:!cloud,academic_demo:cloud};},
  async checkout(c,actor,input,audit){
   const data=benefitCheckoutInput.parse(input),reference='POS-'+data.request_id.toLowerCase();
   const requestDigest=digest({actor:actor.user_id,benefit:data.benefit,verification:data.verification_id,items:canon(data.items),cash:amount(cents(data.amount_paid))});
   const old=(await c.query('SELECT sale_id,user_id,to_jsonb(s)->>\'benefit_request_digest\' AS digest FROM sales s WHERE receipt_no=$1 FOR UPDATE',[reference])).rows;
   if(old.length){if(old.length!==1||old[0].user_id!==actor.user_id||old[0].digest!==requestDigest)conflict(false);return {receipt:await posRepository.receipt(old[0].sale_id,actor,c),replayed:true};}
   if((await c.query("SELECT 1 FROM sales WHERE to_jsonb(sales)->>'benefit_verification_id'=$1",[data.verification_id])).rowCount)conflict();
   if((await c.query("SELECT 1 FROM activity_logs WHERE module='POS_checkout' AND action=$1",['checkout.closed:'+data.request_id.toLowerCase()])).rowCount)conflict();
   const s=await snapshot(c,actor,data);if(verify(data.quote_token,actor.user_id)!==s.fingerprint)conflict();
   const net=cents(s.calculation.totals.net),paid=cents(data.amount_paid);if(paid<net)throw Object.assign(new Error('Cash received must cover the full total.'),{status:422,correctable:true});
   const allocations=[];
   for(const line of s.calculation.lines){
    const batches=(await c.query("SELECT batch_id,batch_no,to_char(expiry_date,'YYYY-MM-DD') AS expiry_date,qty_on_hand FROM batches WHERE product_id=$1 AND qty_on_hand>0 AND expiry_date>(clock_timestamp() AT TIME ZONE 'Asia/Manila')::date ORDER BY expiry_date,batch_id FOR UPDATE",[line.productId])).rows;
    let left=line.quantity;const selected=[];for(const b of batches){const quantity=Math.min(left,b.qty_on_hand);if(quantity)selected.push({...b,quantity,unit_price:line.unitPrice});left-=quantity;if(!left)break;}if(left)conflict();
    allocations.push(...allocateBenefitLine(line,selected));
   }
   const discount=(await c.query('SELECT discount_id FROM discounts WHERE type=$1 AND rate=0.2 ORDER BY discount_id FOR SHARE',[data.benefit])).rows;
   if(discount.length!==1)unavailable();const t=s.calculation.totals;
   const sale=await insertWithId(c,`INSERT INTO sales(sale_id,user_id,receipt_no,sale_date,total_amount,discount_id,senior_pwd_id,customer_name,benefit_type,vat_exempt,
    financial_snapshot_version,policy_version,policy_source_snapshot,gross_amount,vat_removed_amount,discount_amount,vatable_amount,vat_exempt_amount,vat_amount,
    benefit_policy_id,benefit_verification_id,benefit_request_digest,branch_vat_status_snapshot,non_vat_amount)
    VALUES($1,$2,$3,CURRENT_TIMESTAMP,$4,$5,$6,$7,$8,$9,'2',$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22) RETURNING sale_id`,
    [actor.user_id,reference,t.net,discount[0].discount_id,s.v.customer_id,s.v.customer_name,data.benefit,t.vat==='0.00',s.p.version,s.p.payload.source,t.gross,t.vatRemoved,t.discount,t.vatable,t.exempt,t.vat,s.p.policy_id,data.verification_id,requestDigest,s.p.payload.vatStatus,t.nonVat]);
   for(const line of s.calculation.lines)await c.query('INSERT INTO sale_pricing_lines(sale_id,product_id,payload) VALUES($1,$2,$3)',[sale.sale_id,line.productId,line]);
   for(const l of allocations){
    const updated=await c.query("UPDATE batches SET qty_on_hand=qty_on_hand-$2 WHERE batch_id=$1 AND qty_on_hand>=$2 AND expiry_date>(clock_timestamp() AT TIME ZONE 'Asia/Manila')::date RETURNING batch_id",[l.batch_id,l.quantity]);if(!updated.rowCount)conflict();
    await insertWithId(c,`INSERT INTO sale_items(sale_item_id,sale_id,batch_id,quantity,unit_price,financial_snapshot_version,product_name_snapshot,generic_name_snapshot,tax_treatment_snapshot,
     benefit_eligible_snapshot,discount_rate_snapshot,vat_rate_snapshot,price_basis_snapshot,eligibility_source_snapshot,eligibility_version_snapshot,policy_version_snapshot,benefit_type_snapshot,tax_source_snapshot,tax_version_snapshot,
     gross_line_amount,vat_removed_line_amount,discount_line_amount,net_line_amount,vatable_line_amount,vat_exempt_line_amount,vat_line_amount,non_vat_line_amount,pricing_product_id,batch_no_snapshot,expiry_date_snapshot,category_snapshot)
     SELECT $1,$2,$3,$4,$5,'2',$6,p.generic_name,$7,$8,$9,$10,$11,$12,$13,$14,$15,$12,$13,$16,$17,$18,$19,$20,$21,$22,$23,p.product_id,$24,$25,p.category FROM products p WHERE p.product_id=$26 RETURNING sale_item_id`,
     [sale.sale_id,l.batch_id,l.quantity,l.unitPrice,l.productName,l.taxTreatment,l.benefitEligible,String(l.discountRateBps/10000),String(l.vatRateBps/10000),l.priceBasis,l.classificationSource,l.classificationVersion,l.policyVersion,l.benefitType,l.gross,l.vatRemoved,l.discount,l.net,l.vatable,l.exempt,l.vat,l.nonVat,l.batch_no,l.expiry_date,l.productId]);
   }
   const doc=s.v.document_snapshot.documents;
   for(const r of s.records.filter(r=>r.prescription_required))await c.query('INSERT INTO benefit_prescription_fills(sale_id,product_id,beneficiary_digest,prescription_ref,quantity) VALUES($1,$2,$3,$4,$5)',[sale.sale_id,r.product_id,digest([data.benefit,s.v.customer_id]),doc.prescriptionRef,data.items.find(i=>i.product_id===r.product_id).quantity]);
   await insertWithId(c,"INSERT INTO payments(payment_id,sale_id,method,amount_paid,change_due) VALUES($1,$2,'cash',$3,$4) RETURNING payment_id",[sale.sale_id,amount(paid),amount(paid-net)]);
   await audit(c,actor.user_id,'sale.paid:'+sale.sale_id,'POS');
   return {receipt:await posRepository.receipt(sale.sale_id,actor,c),replayed:false};
  },
 };
}
