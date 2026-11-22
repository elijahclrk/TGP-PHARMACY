import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateBenefitPreparation} from '../src/services/benefit-preparation.js';
test('future benefit integration validates identity and fails closed before producing financial data',()=>{
  for(const draft of [{benefit:'senior',customer:{name:'',id:'x'}},{benefit:'pwd',customer:{name:'Fixture',id:''}},{benefit:'senior',customer:{name:'Fixture',id:'synthetic'},policy:{verified:true}}])assert.throws(()=>validateBenefitPreparation(draft,[],{}));
  assert.throws(()=>validateBenefitPreparation({benefit:'pwd',customer:{name:'Fixture',id:'synthetic'}},[{eligibility:'unverified',tax:'unknown'}],{}),/Verified benefit/);
});
