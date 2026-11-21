import { test } from 'node:test';
import assert from 'node:assert/strict';
import {listenForFetch} from '../testing/local-http.mjs';
import { randomBytes } from 'node:crypto';
import express from 'express';
import cookieParser from 'cookie-parser';
import { createAuthRouter } from '../src/routes/auth.routes.js';
import { createSessions } from '../src/services/sessions.js';
import { hashPassword, verifyPassword } from '../src/services/passwords.js';
import { errorHandler } from '../src/middleware/error-handler.js';
import { notFound } from '../src/middleware/not-found.js';

// Entirely in-memory repositories: no database URL, getPool call or real account writes.
async function fixture(t) {
  const password = randomBytes(20).toString('hex');
  const hash = await hashPassword(password);
  const users = new Map([
    [1, { user_id: 1, username: 'fixture_admin', full_name: 'Fixture Admin', role: 'admin', status: 'active', password_hash: hash }],
    [2, { user_id: 2, username: 'fixture_employee', full_name: 'Fixture Employee', role: 'employee', status: 'active', password_hash: hash }],
    [3, { user_id: 3, username: 'fixture_manager', full_name: 'Fixture Manager', role: 'manager', status: 'active', password_hash: hash }],
    [4, { user_id: 4, username: 'fixture_inactive', full_name: null, role: 'employee', status: 'inactive', password_hash: hash }],
    [5, { user_id: 5, username: 'fixture_other_admin', role: 'admin', status: 'active', password_hash: hash }],
  ]);
  const logs = [];
  let failAudit = false, failRead = false;
  let now = Date.now();
  const config = { secret: randomBytes(48).toString('hex'), ttl: 60, secure: false, origin: 'http://localhost:5173' };
  const sessions = createSessions(config, () => now);
  const repository = {
    findById: async id => users.get(id),
    findByUsername: async username => [...users.values()].find(user => user.username === username),
    publicUserById: async id => { if (failRead) throw new Error('Private storage failure'); return users.get(id); },
    listUsers: async ({ q, page, limit }) => {
      if (failRead) throw new Error('Private storage failure');
      const rows = [...users.values()].filter(user => [user.username, user.full_name || ''].some(value => value.toLowerCase().includes(q.toLowerCase())));
      return { total: rows.length, page, limit, data: rows.slice((page - 1) * limit, page * limit), password_hash: hash };
    },
    requireActiveAdmin: async (_client, id) => {
      const user = users.get(id);
      if (!user || user.role !== 'admin' || user.status !== 'active') throw Object.assign(new Error('Access denied'), { status: 403 });
    },
    transaction: async work => {
      const snapshot = structuredClone([...users]); const before = logs.length;
      try { return await work({}); }
      catch (error) { users.clear(); for (const [id, row] of snapshot) users.set(id, row); logs.length = before; throw error; }
    },
    insertUser: async (_client, data) => {
      if ([...users.values()].some(user => user.username === data.username)) throw Object.assign(new Error('Duplicate'), { code: '23505' });
      const user = { ...data, user_id: Math.max(...users.keys()) + 1, status: 'active' };
      users.set(user.user_id, user); return user;
    },
    deactivate: async (_client, id) => {
      const user = users.get(id); if (!user) return undefined;
      user.status = 'inactive'; return user;
    },
    audit: async (_client, actor, action) => {
      if (failAudit) throw new Error('Synthetic audit failure');
      logs.push({ actor, action });
    },
  };
  const app = express(); app.use(express.json()); app.use(cookieParser());
  app.use('/api/auth', createAuthRouter({ config, repository, sessions, loginLimit: 100 }));
  app.use(notFound);
  app.use(errorHandler);
  const server = await listenForFetch(app);
  t.after(() => new Promise(resolve => server.close(resolve)));
  const url = 'http://127.0.0.1:' + server.address().port;
  const cookie = id => 'tgp_session=' + sessions.issue(id).token;
  async function request(path, { cookie: token, body, origin = config.origin, marker = '1' } = {}) {
    const response = await fetch(url + '/api/auth' + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json', Origin: origin, 'X-TGP-Request': marker, ...(token ? { Cookie: token } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, cache: response.headers.get('cache-control'), body: await response.json() };
  }
  return { request, users, logs, cookie, password, repository, sessions, setFailAudit: value => { failAudit = value; }, setFailRead: value => { failRead = value; }, expire: () => { now += 61000; } };
}
const keys = ['full_name','role','status','user_id','username'];

test('account APIs reject anonymous, inactive, Employee and Manager access', async t => {
  const f = await fixture(t);
  for (const id of [undefined, 2, 3, 4]) {
    const cookie = id ? f.cookie(id) : undefined;
    for (const [path, body] of [['/users',undefined],['/users/2',undefined],['/users',{}],['/users/2/deactivate',{}]]) {
      assert.equal((await f.request(path, { cookie, body })).status, !id || id === 4 ? 401 : 403);
    }
  }
  assert.equal(f.users.size, 5); assert.equal(f.logs.length, 0);
});
test('Admin list/search/pagination/details expose only public account fields', async t => {
  const f = await fixture(t), cookie = f.cookie(1);
  const list = await f.request('/users?q=FIXTURE&page=2&limit=2', { cookie });
  assert.equal(list.status, 200); assert.equal(list.cache, 'no-store');
  assert.deepEqual(Object.keys(list.body).sort(), ['data','limit','page','success','total']);
  assert.equal(list.body.total, 5); assert.equal(list.body.data.length, 2); assert.equal(list.body.page, 2);
  for (const row of list.body.data) assert.deepEqual(Object.keys(row).sort(), keys);
  const detail = await f.request('/users/2', { cookie });
  assert.equal(detail.status, 200); assert.deepEqual(Object.keys(detail.body.user).sort(), keys);
  const empty = await f.request('/users?q=%27%20OR%201%3D1--', { cookie });
  assert.equal(empty.status, 200); assert.equal(empty.body.total, 0);
  assert.equal((await f.request('/users/999', { cookie })).status, 404);
  assert.equal(f.logs.length, 0);
});
test('account query/ID validation rejects unbounded, repeated and injected authority fields', async t => {
  const f = await fixture(t), cookie = f.cookie(1);
  for (const query of ['limit=0','limit=101','page=0','page=1000000','q=a&q=b','role=admin','status=active','q='+'a'.repeat(201)]) {
    assert.equal((await f.request('/users?'+query, { cookie })).status, 400);
  }
  for (const path of ['/users/0','/users/2147483648','/users/2?password_hash=true']) assert.equal((await f.request(path, { cookie })).status, 400);
});
test('Admin creation uses real Argon2id, role assignment, auditing and generic duplicate handling', async t => {
  const f = await fixture(t), cookie = f.cookie(1);
  for (const role of ['employee','manager']) {
    const result = await f.request('/users', { cookie, body: { username: 'new_'+role, password: f.password, role, full_name: 'Fixture New Staff' } });
    assert.equal(result.status, 201); assert.deepEqual(Object.keys(result.body.user).sort(), keys);
    const stored = f.users.get(result.body.user.user_id);
    assert(stored.password_hash.startsWith('$argon2id$'));
    assert(await verifyPassword(stored.password_hash, f.password));
    assert.equal(stored.status, 'active');
    assert(f.logs.some(log => log.actor === 1 && log.action === 'account.created:'+stored.user_id));
    const login = await f.request('/login', {body:{username:stored.username,password:f.password}});
    assert.equal(login.status, 200); assert.deepEqual(Object.keys(login.body.user).sort(), keys);
  }
  assert.equal((await f.request('/users', { cookie, body: { username:'new_employee',password:f.password,role:'employee' } })).status, 409);
  for (const body of [
    {username:'forged',password:f.password,role:'admin'},
    {username:'forged',password:'short',role:'employee'},
    {username:'forged',password:f.password,role:'employee',status:'active'},
    {username:'forged',password:f.password,role:'employee',password_hash:'forged'},
  ]) assert.equal((await f.request('/users', { cookie, body })).status, 400);
  assert(f.logs.every(log => !log.action.includes(f.password)));
});
test('deactivation preserves records, audits actor, revokes all target sessions and blocks login', async t => {
  const f = await fixture(t), cookie = f.cookie(1), targetA = f.cookie(2), targetB = f.cookie(2);
  assert.equal((await f.request('/users/2/deactivate', { cookie, body:{} })).status, 200);
  assert.equal(f.users.get(2).status, 'inactive'); assert.equal(f.users.size, 5);
  assert(f.logs.some(log => log.actor === 1 && log.action === 'account.deactivated:2'));
  for (const token of [targetA,targetB]) assert.equal((await f.request('/me', { cookie:token })).status, 401);
  assert.equal((await f.request('/login', { body:{username:'fixture_employee',password:f.password} })).status, 401);
  assert.equal((await f.request('/users/1/deactivate', { cookie, body:{} })).status, 409);
  assert.equal((await f.request('/users/5/deactivate', { cookie, body:{} })).status, 403);
  assert.equal((await f.request('/users/999/deactivate', { cookie, body:{} })).status, 404);
});
test('account mutations preserve trusted-origin/CSRF checks and unsupported operations stay absent', async t => {
  const f = await fixture(t), cookie = f.cookie(1);
  for (const headers of [{origin:'https://untrusted.example'}, {marker:''}]) {
    assert.equal((await f.request('/users', {cookie,body:{username:'new',password:f.password,role:'employee'},...headers})).status, 403);
    assert.equal((await f.request('/users/2/deactivate', {cookie,body:{},...headers})).status, 403);
  }
  for (const path of ['/users/2/reactivate','/users/2/reset','/users/2/role','/register']) assert.equal((await f.request(path, {cookie,body:{}})).status, 404);
  assert.equal(f.users.size, 5); assert.equal(f.users.get(2).status, 'active');
});
test('audit failure rolls back account changes in the fixture and never reports a successful mutation', async t => {
  const f = await fixture(t), cookie = f.cookie(1), target = f.cookie(2);
  f.setFailAudit(true);
  assert.equal((await f.request('/users', {cookie,body:{username:'rollback_fixture',password:f.password,role:'employee'}})).status, 500);
  assert.equal(f.users.size, 5);
  assert.equal((await f.request('/users/2/deactivate', {cookie,body:{}})).status, 500);
  assert.equal(f.users.get(2).status, 'active'); assert.equal(f.logs.length, 0);
  assert.equal((await f.request('/me', {cookie:target})).status, 200);
});
test('account reads fail safely and expired or currently demoted administrators lose access', async t => {
  const f = await fixture(t), cookie = f.cookie(1);
  f.setFailRead(true);
  const response = await f.request('/users', {cookie});
  assert.equal(response.status, 500); assert.equal(response.body.message, 'Internal server error');
  f.setFailRead(false); f.users.get(1).role = 'employee';
  assert.equal((await f.request('/users', {cookie})).status, 403);
  f.users.get(1).role = 'admin'; f.expire();
  assert.equal((await f.request('/users', {cookie})).status, 401);
});
