import { test } from 'node:test';
import assert from 'node:assert/strict';
import { batchCreate, batchEdit, productCreate, productEdit, productQuery, batchQuery } from '../src/services/inventory-validation.js';

test('inventory input boundaries reject quantity injection and invalid money/date values', () => {
  const batch = { batch_no: 'test', expiry_date: '2028-02-29', cost_price: '1.123456789', selling_price: '2' };
  assert(batchCreate.safeParse(batch).success);
  assert(batchCreate.safeParse({ ...batch, qty_on_hand: 0 }).success);
  for (const qty_on_hand of [-1, 1, '0', null]) assert(!batchCreate.safeParse({ ...batch, qty_on_hand }).success);
  for (const qty_on_hand of [-1, 0, 1, null]) assert(!batchEdit.safeParse({ qty_on_hand }).success);
  for (const expiry_date of ['2027-02-29', '2028-02-30', 'today', '2028-01-01T00:00:00Z']) assert(!batchCreate.safeParse({ ...batch, expiry_date }).success);
  for (const cost_price of [-1, 'NaN', 'Infinity', '', true, null, '1e10']) assert(!batchCreate.safeParse({ ...batch, cost_price }).success);
  assert(!productCreate.safeParse({ name: ' ', unit_price: '1' }).success);
  assert(!productEdit.safeParse({}).success);
  assert(!productEdit.safeParse({ qty_on_hand: 10 }).success);
});

test('pagination and expiry queries have bounded strict inputs', () => {
  assert.deepEqual(productQuery.parse({}), { q: '', category: '', stock: 'all', page: 1, limit: 20 });
  for (const query of [{ page: '0' }, { page: '-1' }, { limit: '101' }, { page: ['1', '2'] }, { includeCost: 'true' }]) assert(!productQuery.safeParse(query).success);
  assert(batchQuery.safeParse({ status: 'near_expiry' }).success);
  assert(!batchQuery.safeParse({ status: 'near_expiry', days: '366' }).success);
  assert(!batchQuery.safeParse({ status: 'near_expiry', days: '0' }).success);
  assert(batchQuery.safeParse({ status: 'expiring_today' }).success);
});
