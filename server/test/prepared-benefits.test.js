import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prepareBenefitQuote, cents } from '../src/services/prepared-benefits.js';
// Synthetic policy fixtures test arithmetic, not legal approval or live rates.
const policy = { verified:true, benefit:'senior', version:'fixture-v1', source:'synthetic-policy', rounding:'half_up_per_line', discountBps:2000, vatBps:1200, exemptEligibleVatable:true };
const item = { lineKey:'1:1', name:'Fixture', quantity:1, unitPrice:'112.00', eligibility:'eligible', benefit:'senior', tax:'vatable', priceBasis:'vat_inclusive', classificationSource:'synthetic', classificationVersion:'v1', taxSource:'synthetic-tax', taxVersion:'t1' };
const input = { benefit:'senior', customer:{name:'Fixture Person',id:'synthetic-ID'}, items:[item], policy };
test('prepared benefit interface removes inclusive VAT only on verified eligible lines and snapshots mixed tax treatment', () => {
  const result = prepareBenefitQuote({...input, items:[item,{...item,lineKey:'2:1',eligibility:'ineligible'},{...item,lineKey:'3:1',tax:'vat_exempt',priceBasis:'vat_exempt',unitPrice:'100.00'}]});
  assert.deepEqual(result.totals,{gross:'324.00',vatRemoved:'12.00',discount:'40.00',net:'272.00',vatable:'100.00',exempt:'160.00',vat:'12.00'});
  assert.equal(result.lines[1].discount,'0.00'); assert.equal(result.lines[2].vatRemoved,'0.00');
  assert.equal(result.lines[0].classificationVersion,'v1'); assert.equal(result.policySource,'synthetic-policy');
});
test('unknown/incomplete classifications, beneficiary, source, price basis or policy fail closed', () => {
  for (const bad of [ {...input,customer:{name:'',id:'x'}}, {...input,customer:{name:'x',id:''}}, {...input,policy:{...policy,verified:false}}, {...input,policy:{...policy,source:''}},
    ...[{eligibility:'unverified'},{tax:'unknown'},{benefit:'pwd'},{taxSource:''},{taxVersion:''},{priceBasis:'exclusive'},{classificationSource:''},{quantity:0},{unitPrice:'1.001'},{unitPrice:'NaN'}].map(change => ({...input,items:[{...item,...change}]})),
    {...input,items:[item,item]}, {...input,policy:{...policy,discountBps:2000.1}},
  ]) assert.throws(() => prepareBenefitQuote(bad), /Verified benefit/);
});
test('integer-cent arithmetic is deterministic and each rounded line reconciles with summed totals', () => {
  const result = prepareBenefitQuote({...input,items:[{...item,quantity:3,unitPrice:'0.03'}, {...item,lineKey:'2:1',unitPrice:'0.01'}]});
  for (const row of [...result.lines,result.totals]) {
    assert.equal(cents(row.net),cents(row.gross)-cents(row.vatRemoved)-cents(row.discount));
    assert.equal(cents(row.net),cents(row.vatable)+cents(row.exempt)+cents(row.vat));
  }
  assert.deepEqual(prepareBenefitQuote({...input,benefit:'pwd',items:[{...item,benefit:'pwd'}],policy:{...policy,benefit:'pwd'}}).totals,prepareBenefitQuote(input).totals);
});
