import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAuthRepository } from '../src/repositories/auth.repository.js';
import { accountListQuery } from '../src/services/auth-validation.js';

test('account read SQL uses public projections, literal parameterized search and bounded pagination', async () => {
  const calls = [];
  const repository = createAuthRepository(() => ({ query: async (sql, values) => {
    calls.push({sql,values}); return {rows:sql.includes('WITH filtered')?[{total:0,data:[]}]:[]};
  } }));
  const search = "%' OR 1=1--";
  assert.deepEqual(accountListQuery.parse({}), {q:'',page:1,limit:20});
  const result = await repository.listUsers({q:search,page:3,limit:20});
  assert.deepEqual(result, {total:0,data:[],page:3,limit:20});
  assert.deepEqual(calls[0].values, [search,20,40]);
  assert(!calls[0].sql.includes(search)); assert(!calls[0].sql.includes('password_hash'));
  assert.match(calls[0].sql, /strpos\(lower\(username\),lower\(\$1\)\)/);
  await repository.publicUserById(2);
  assert.deepEqual(calls[1].values, [2]); assert(!calls[1].sql.includes('password_hash'));
  assert(calls.every(call => !/\b(INSERT|UPDATE|DELETE|ALTER|CREATE|DROP)\b/.test(call.sql)));
});
