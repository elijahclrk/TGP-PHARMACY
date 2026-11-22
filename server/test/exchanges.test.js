import {test} from 'node:test';
import assert from 'node:assert/strict';
import {exchangeDraft,settlement,quoteTokens,cents,amount} from '../src/services/exchange-validation.js';
import {verifiedLocalExchanges} from '../testing/local-exchange-runtime.mjs';
test('exchange cash values distinguish equal, higher and unresolved lower cases',()=>{
 assert.deepEqual(settlement('100','125','50'),{return_value:'100.00',replacement_value:'125.00',additional_cash:'25.00',tender:'50.00',change_due:'25.00'});
 assert.equal(settlement('100','100','0').additional_cash,'0.00');
 assert.throws(()=>settlement('100','80'),{status:422,code:'LOWER_VALUE_REVIEW_REQUIRED'});
 for(const x of ['1.001','NaN','Infinity','-1','1000000000000'])assert.throws(()=>cents(x));
 assert.throws(()=>settlement('100','100','1'));assert.throws(()=>settlement('100','125','24.99'));assert.equal(amount(cents('999999999999.99')),'999999999999.99');
});
test('exchange input rejects duplicate claims, fractional quantities and injected prices',()=>{
 const d={claims:[{return_id:1,quantity:1}],items:[{product_id:1,quantity:1}],reason:'Valid',route:'voluntary'};
 assert(exchangeDraft.safeParse(d).success);for(const v of [{...d,claims:[...d.claims,...d.claims]},{...d,items:[{product_id:1,quantity:.5}]},{...d,total:1},{...d,reason:' '}])assert(!exchangeDraft.safeParse(v).success);
});
test('exchange quote token binds actor, financial fingerprint and mode',()=>{
 const t=quoteTokens('synthetic-signing-key-'.repeat(3)),token=t.issue(1,'snapshot');assert(t.verify(token,1,'snapshot'));assert(!t.verify(token,2,'snapshot'));assert(!t.verify(token,1,'changed'));assert(!t.verify(token+'x',1,'snapshot'));
});
test('local exchange activation refuses remote/default-port/production targets before connecting',async()=>{
 let connects=0;const provider=()=>{connects++;throw Error('Must not connect');};
 for(const [url,mode] of [['postgresql://remote.invalid/tgp_disposable_test','test'],['postgresql://127.0.0.1:5432/tgp_disposable_test','test'],['postgresql://127.0.0.1:55444/tgp_disposable_test','production']])await assert.rejects(verifiedLocalExchanges(provider,{TEST_DATABASE_URL:url,DATABASE_URL:url,NODE_ENV:mode},'synthetic-secret'.repeat(3),{testOnly:true,pairs:[],validUntil:'2099-01-01'}));
 assert.equal(connects,0);
});
