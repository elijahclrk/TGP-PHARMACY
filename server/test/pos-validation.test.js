import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {checkoutInput,cartInput} from '../src/services/pos-validation.js';
test('POS only accepts positive integer items, decimal cash strings and no discounts or trusted client totals',()=>{
  const data={request_id:randomUUID(),items:[{product_id:1,quantity:1}],amount_paid:'10.00'};
  assert(checkoutInput.safeParse(data).success);
  for(const value of [10,'-1','1.001','NaN','Infinity','1e2',null]) assert(!checkoutInput.safeParse({...data,amount_paid:value}).success);
  for(const extra of [{discount_id:1},{total_amount:'0'},{vat_exempt:true},{approved_by:1}]) assert(!checkoutInput.safeParse({...data,...extra}).success);
  assert(!cartInput.safeParse({items:[]}).success);
  assert(!cartInput.safeParse({items:[{product_id:1,quantity:0}]}).success);
  assert(!cartInput.safeParse({items:[{product_id:1,quantity:1},{product_id:1,quantity:2}]}).success);
});
