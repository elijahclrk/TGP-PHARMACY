import {test} from 'node:test';
import assert from 'node:assert/strict';
import {calculateLocalBenefits,allocateBenefitLine,localBenefitDraft} from '../src/services/local-benefit-calculation.js';
import {syntheticDraft} from './support/benefit-fixture.js';
const policy={testOnly:true,vatStatus:'vat_registered',rounding:'half_up_product_line_v1',discountBps:2000,vatBps:1200,source:'SYNTHETIC ONLY',validUntil:'2099-01-01T00:00:00Z',documentaryVersion:'synthetic-v1',priceProvenanceVerified:true,fiscalInvoice:false};
const item=(changes={})=>({productId:1,lineKey:'1',name:'Synthetic',quantity:1,unitPrice:'112.00',eligibility:'eligible',benefit:'senior',tax:'vatable',priceBasis:'vat_inclusive',promotion:'none',taxSource:'SYNTHETIC',taxVersion:'v1',classificationSource:'SYNTHETIC',classificationVersion:'v1',...changes});
const calc=(items,p=policy,benefit='senior')=>calculateLocalBenefits({benefit,customer:syntheticDraft(benefit).customer,items,policy:p,version:'synthetic-v1'});
for(const benefit of ['senior','pwd'])test(benefit+' mixed classification, VAT inclusion and already exempt calculation',()=>{
 const q=calc([item({benefit}),item({benefit,lineKey:'2',productId:2,unitPrice:'100.00',tax:'vat_exempt',priceBasis:'vat_exempt'}),item({benefit,lineKey:'3',productId:3,eligibility:'ineligible'})],policy,benefit);
 assert.deepEqual(q.totals,{gross:'324.00',vatRemoved:'12.00',discount:'40.00',net:'272.00',vatable:'100.00',exempt:'160.00',vat:'12.00',nonVat:'0.00'});
 assert.equal(q.lines[1].discount,'20.00');assert.equal(q.lines[2].discount,'0.00');
});
test('explicit non-VAT branch has no invented VAT removal or VAT-exempt base',()=>{
 const q=calc([item({priceBasis:'non_vat'}),item({lineKey:'2',productId:2,eligibility:'ineligible',priceBasis:'non_vat'})],{...policy,vatStatus:'non_vat'});
 assert.equal(q.totals.net,'201.60');assert.equal(q.totals.nonVat,'201.60');assert.equal(q.totals.exempt,'0.00');assert.equal(q.totals.vat,'0.00');assert.equal(q.totals.vatRemoved,'0.00');
});
test('synthetic intermediate rounding and FEFO batch splits preserve every cent',()=>{
 assert.equal(calc([item({unitPrice:'0.99'})]).totals.net,'0.70');
 const line=calc([item({unitPrice:'0.01',quantity:3})]).lines[0];
 const split=allocateBenefitLine(line,[{quantity:1,unit_price:'0.01',batch_id:1},{quantity:2,unit_price:'0.01',batch_id:2}]);
 assert.equal(line.net,'0.02');
 for(const key of ['gross','discount','vatRemoved','net','vat','exempt','vatable','nonVat'])assert.equal(Math.round(split.reduce((n,l)=>n+Number(l[key]),0)*100),Math.round(Number(line[key])*100));
 assert.throws(()=>allocateBenefitLine(line,[{quantity:2,unit_price:'0.01'}]));
});
test('unknown eligibility/tax/basis, promotion stacking, fractional units and invalid policy fail closed',()=>{
 for(const bad of [{eligibility:'unknown'},{tax:'unknown'},{priceBasis:'unknown'},{promotion:'discounted'},{quantity:.5},{quantity:0},{unitPrice:'1.001'},{classificationSource:''}])assert.throws(()=>calc([item(bad)]));
 for(const bad of [{testOnly:false},{vatStatus:'unknown'},{priceProvenanceVerified:false},{rounding:'unspecified'},{validUntil:'2000-01-01T00:00:00Z'},{fiscalInvoice:true}])assert.throws(()=>calc([item()],{...policy,...bad}));
});
test('scheme documents, beneficiary fields and representative evidence must be complete',()=>{
 for(const benefit of ['senior','pwd']){
  const good=syntheticDraft(benefit);assert(localBenefitDraft.safeParse(good).success);
  for(const customer of [{...good.customer,name:''},{...good.customer,id:' '},{...good.customer,idType:benefit==='pwd'?'osca':'pwd_lgu'}])assert(!localBenefitDraft.safeParse({...good,customer}).success);
  for(const documents of [{...good.documents,identitySeen:false},{...good.documents,purchaser:'representative'},{...good.documents,exclusiveUse:false}])assert(!localBenefitDraft.safeParse({...good,documents}).success);
 }
 const pwd=syntheticDraft('pwd');assert(!localBenefitDraft.safeParse({...pwd,documents:{...pwd.documents,bookletSeen:false}}).success);
 const senior=syntheticDraft();assert(localBenefitDraft.safeParse({...senior,documents:{...senior.documents,bookletSeen:false}}).success);
 assert(localBenefitDraft.safeParse({...pwd,documents:{...pwd.documents,purchaser:'guardian',representativeName:'SYNTHETIC',representativeId:'SYNTHETIC',authorizationRef:'TEST SOP'}}).success);
});
