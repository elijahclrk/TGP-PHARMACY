import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createVerifiedBenefitQuotes} from '../src/services/verified-benefit-quotes.js';
const draft={benefit:'senior',customer:{name:'Synthetic',id:'TEST ONLY'},items:[{product_id:1,quantity:1},{product_id:2,quantity:1},{product_id:3,quantity:1}]};
const policy={verified:true,benefit:'senior',version:'synthetic-v1',source:'TEST ONLY',rounding:'half_up_per_line',discountBps:2000,vatBps:1200,exemptEligibleVatable:true,priceBasisByTax:{vatable:'vat_inclusive',vat_exempt:'vat_exempt'},signoffs:{branchTax:true,medicineEvidence:true,documentaryProcedure:true,invoiceFormat:true}};
function fixture(){
  const records=[1,2,3].map(product_id=>({product_id,name:'Synthetic '+product_id,tax_treatment:product_id===3?'vat_exempt':'vatable',classification_source:'test-tax',classification_version:'v1',classification_reviewed_by:10,classification_reviewed_at:'2026-01-01',eligibility:product_id===2?'ineligible':'eligible',source:'test-scheme',version:'v1',reviewed_by:11,reviewed_at:'2026-01-01'}));
  const client={query:async sql=>({rows:sql.startsWith('SELECT to_regclass')?[{ready:true}]:records})};
  const posRepository={quote:async()=>({fingerprint:'regular-quote',items:records.map(r=>({product_id:r.product_id,quantity:1,unit_price:r.product_id===3?'100.00':'112.00'}))})};
  return {records,client,posRepository,service:createVerifiedBenefitQuotes({posRepository,policyProvider:async()=>policy})};
}
test('benefit quote reads scheme-specific and tax evidence only from server and supports mixed baskets',async()=>{
  const {service,client}=fixture();const result=await service.prepare(client,{user_id:1},draft);
  assert.deepEqual(result.totals,{gross:'324.00',vatRemoved:'12.00',discount:'40.00',net:'272.00',vatable:'100.00',exempt:'160.00',vat:'12.00'});
  assert.equal(result.lines[1].discount,'0.00');service.requireReviewed(result.fingerprint,result);
});
test('every evidence/policy/beneficiary/actor change invalidates prior explicit review',async()=>{
  const f=fixture();const original=await f.service.prepare(f.client,{user_id:1},draft);
  f.records[0].version='v2';const changed=await f.service.prepare(f.client,{user_id:1},draft);
  assert.throws(()=>f.service.requireReviewed(original.fingerprint,changed),{status:409});
  assert.throws(()=>f.service.requireReviewed(null,original),{status:409});
  const renamed=await f.service.prepare(f.client,{user_id:2},{...draft,customer:{...draft.customer,name:'Another synthetic'}});
  assert.notEqual(renamed.fingerprint,changed.fingerprint);
});
test('missing signoffs, unknown metadata and unreviewed products fail closed',async()=>{
  const f=fixture();await assert.rejects(createVerifiedBenefitQuotes({posRepository:f.posRepository}).prepare(f.client,{user_id:1},draft),{status:503});
  for(const change of [{eligibility:'unverified'},{tax_treatment:'unknown'},{source:''},{classification_version:''},{reviewed_by:null}]){
    const x=fixture();Object.assign(x.records[0],change);await assert.rejects(x.service.prepare(x.client,{user_id:1},draft));
  }
  const service=createVerifiedBenefitQuotes({posRepository:f.posRepository,policyProvider:async()=>({...policy,signoffs:{}})});
  await assert.rejects(service.prepare(f.client,{user_id:1},draft),{status:503});
  await assert.rejects(createVerifiedBenefitQuotes({posRepository:f.posRepository,policyProvider:async()=>({...policy,priceBasisByTax:undefined})}).prepare(f.client,{user_id:1},draft),{status:503});
});
test('strict input rejects missing beneficiary, client financial metadata and double discounts',async()=>{
  const {service,client}=fixture();
  for(const input of [{...draft,customer:{name:'',id:'id'}},{...draft,customer:{name:'name',id:''}},{...draft,discount:20},{...draft,benefit:['senior','pwd']},{...draft,items:[draft.items[0],draft.items[0]]},{...draft,items:[{...draft.items[0],unit_price:'1.00'}]}])await assert.rejects(service.prepare(client,{user_id:1},input));
});
