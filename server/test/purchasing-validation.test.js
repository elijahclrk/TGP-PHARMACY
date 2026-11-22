import { test } from 'node:test';
import assert from 'node:assert/strict';
import { supplierCreate, supplierEdit, orderCreate, receivingCreate, approvalInput, purchasingQuery } from '../src/services/purchasing-validation.js';

test('purchasing rejects injected state, invalid items and unbounded inputs', () => {
  assert(!supplierCreate.safeParse({ name: ' ' }).success);
  assert(!supplierEdit.safeParse({}).success);
  assert(!supplierEdit.safeParse({ supplier_id: 5, name: 'Test' }).success);
  const order = { supplier_id: 1, items: [{ product_id: 1, quantity: 2, unit_cost: '0' }] };
  assert(orderCreate.safeParse(order).success);
  for (const quantity of [0, -1, null, 1.2, '5']) assert(!orderCreate.safeParse({ ...order, items: [{ ...order.items[0], quantity }] }).success);
  assert(!orderCreate.safeParse({ ...order, status: 'approved' }).success);
  assert(!orderCreate.safeParse({ ...order, items: [] }).success);
  const receiving = { supplier_id: 1, delivery_ref: 'REF', items: [{ product_id: 1, quantity: 3, batch_no: 'B', expiry_date: '2028-02-29', cost_price: '5', selling_price: '7' }] };
  assert(receivingCreate.safeParse(receiving).success);
  for (const extra of [{ approved_by: 1 }, { received_by: 1 }, { po_id: 1 }]) assert(!receivingCreate.safeParse({ ...receiving, ...extra }).success);
  assert(!receivingCreate.safeParse({ ...receiving, items: [{ ...receiving.items[0], qty_on_hand: 0 }] }).success);
  assert(!approvalInput.safeParse({ approved_by: 1 }).success);
  assert(approvalInput.safeParse({}).success);
  assert(!purchasingQuery.safeParse({ limit: '101' }).success);
  assert(!purchasingQuery.safeParse({ page: ['1','2'] }).success);
});
