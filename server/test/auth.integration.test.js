import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import {listenForFetch} from '../testing/local-http.mjs';
import express from 'express';
import cookieParser from 'cookie-parser';
import { getPool, closePool } from './support/disposable-database.js';
import { createAuthRepository } from '../src/repositories/auth.repository.js';
import { createAccount } from '../src/services/accounts.js';
import { createSessions } from '../src/services/sessions.js';
import { createAuthRouter } from '../src/routes/auth.routes.js';
import { errorHandler } from '../src/middleware/error-handler.js';

// Explicit opt-in. Every fixture and DDL statement is inside a rolled-back
// transaction in a unique schema. Public tables are only read for verification.
test('PostgreSQL authentication integration', { skip: process.env.RUN_AUTH_DB_TESTS !== '1' }, async t => {
  let client, server;
  const schema = 'tgp_auth_test_' + randomUUID().replaceAll('-', '');
  const password = randomBytes(20).toString('hex');
  const secret = randomBytes(48).toString('hex');
  let clock = Date.now();
  const config = { secret, ttl: 60, secure: false, origin: 'http://localhost:5173' };
  const sessions = createSessions(config, () => clock);
  let url;
  const request = async (path, { body, cookie, origin = config.origin, marker = '1', method } = {}) => {
    const response = await fetch(url + path, {
      method: method || (body === undefined ? 'GET' : 'POST'),
      headers: { 'Content-Type': 'application/json', Origin: origin, 'X-TGP-Request': marker, ...(cookie ? { Cookie: cookie } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, body: await response.json(),
      cookie: response.headers.get('set-cookie')?.split(';')[0], cookieHeader: response.headers.get('set-cookie'),
      cache: response.headers.get('cache-control') };
  };
  const login = username => request('/login', { body: { username, password } });
  let adminCookie, employeeCookie, managerCookie, employeeId;
  try {
    client = await getPool().connect();
    const baseline = await readFile(new URL('../database/migrations/001_phase3_baseline.sql', import.meta.url));
    const history = (await client.query('SELECT version,checksum,applied_at FROM public.tgp_schema_migrations ORDER BY version')).rows;
    assert.equal(history[0].checksum, createHash('sha256').update(baseline).digest('hex'));
    const tables = [...baseline.toString().matchAll(/CREATE TABLE (\w+)/g)].map(m => m[1]);
    const publicCounts = async () => {
      const counts = [];
      for (const table of tables) counts.push((await client.query('SELECT count(*)::int AS n FROM public.' + table)).rows[0].n);
      return counts;
    };
    const beforeCounts = await publicCounts();
    await client.query('BEGIN');
    await client.query('CREATE SCHEMA ' + schema);
    await client.query('SET LOCAL search_path TO ' + schema);
    await client.query(baseline.toString());
    for (const file of ['002_supported_integrity.sql', '004_lookup_indexes.sql']) {
      const raw = await readFile(new URL('../database/migrations/proposed/' + file, import.meta.url), 'utf8');
      let sql = raw.replace(/--[^\n]*/g, '').trim();
      assert(sql.startsWith('BEGIN;') && sql.endsWith('COMMIT;'));
      sql = sql.slice(6, -7).replace(/^\s*SET LOCAL search_path = public;/, '');
      assert(!/\b(public|COMMIT|ROLLBACK|DROP)\b/i.test(sql));
      await client.query(sql);
    }
    // Map repository transactions to savepoints, preserving the outer rollback.
    const query = async (sql, values) => {
      if (sql === 'BEGIN') return client.query('SAVEPOINT account_operation');
      if (sql === 'COMMIT') return client.query('RELEASE SAVEPOINT account_operation');
      if (sql === 'ROLLBACK') {
        await client.query('ROLLBACK TO SAVEPOINT account_operation');
        return client.query('RELEASE SAVEPOINT account_operation');
      }
      return client.query(sql, values);
    };
    const repository = createAuthRepository(() => ({ query, connect: async () => ({ query, release() {} }) }));
    const app = express();
    app.use(express.json()); app.use(cookieParser());
    app.use(createAuthRouter({ config, repository, sessions, loginLimit: 100 }));
    app.use(errorHandler);
    server = await listenForFetch(app);
    url = 'http://127.0.0.1:' + server.address().port;

    await t.test('bootstrap creates exactly one admin with Argon2id and audit; repeat refuses', async () => {
      const admin = await createAccount(repository, null, { username: 'admin_test', password, role: 'admin' }, true);
      assert.equal(admin.role, 'admin');
      assert.equal(Object.hasOwn(admin, 'password_hash'), false);
      assert((await repository.findById(admin.user_id)).password_hash.startsWith('$argon2id$'));
      await assert.rejects(() => createAccount(repository, null, { username: 'another', password, role: 'admin' }, true), { status: 409 });
    });
    await t.test('login returns safe user and HttpOnly Strict cookie; me works', async () => {
      const result = await login('admin_test');
      assert.equal(result.status, 200); adminCookie = result.cookie;
      assert(result.cookieHeader.includes('HttpOnly')); assert(result.cookieHeader.includes('SameSite=Strict'));
      assert.equal(result.cache, 'no-store'); assert.equal(Object.hasOwn(result.body.user, 'password_hash'), false);
      assert.equal(Object.hasOwn(result.body, 'token'), false);
      assert.equal((await request('/me', { cookie: adminCookie })).status, 200);
    });
    await t.test('invalid credentials, injection strings and missing auth are rejected', async () => {
      for (const username of ['admin_test', 'unknown']) assert.equal((await request('/login', { body: { username, password: 'wrong' } })).status, 401);
      assert.equal((await request('/login', { body: { username: "' OR 1=1 --", password } })).status, 400);
      assert.equal((await request('/me')).status, 401);
      assert.equal((await request('/users', { body: { username: 'x', password, role: 'admin' } })).status, 401);
    });
    await t.test('CSRF checks reject untrusted origin and missing marker', async () => {
      assert.equal((await request('/login', { body: { username: 'admin_test', password }, origin: 'https://other.invalid' })).status, 403);
      assert.equal((await request('/logout', { body: {}, cookie: adminCookie, marker: '' })).status, 403);
    });
    await t.test('admin creates manager and employee; invalid fields and duplicates rejected', async () => {
      for (const role of ['manager', 'employee']) {
        const result = await request('/users', { cookie: adminCookie, body: { username: role + '_test', password, role } });
        assert.equal(result.status, 201); assert.equal(result.body.user.status, 'active');
        assert.equal(Object.hasOwn(result.body.user, 'password_hash'), false);
        if (role === 'employee') employeeId = result.body.user.user_id;
      }
      assert.equal((await request('/users', { cookie: adminCookie, body: { username: 'employee_test', password, role: 'employee' } })).status, 409);
      for (const body of [{ username: 'x', password: 'short', role: 'employee' }, { username: 'x', password, role: 'owner' }, { username: 'x', password, role: 'admin' }, { username: 'x', password, role: 'employee', status: 'active' }]) {
        assert.equal((await request('/users', { cookie: adminCookie, body })).status, 400);
      }
      managerCookie = (await login('manager_test')).cookie;
      employeeCookie = (await login('employee_test')).cookie;
    });
    await t.test('roles enforced by backend, including direct dashboard URLs', async () => {
      for (const [role, cookie] of [['admin', adminCookie], ['manager', managerCookie], ['employee', employeeCookie]]) {
        assert.equal((await request('/dashboard/' + role, { cookie })).status, 200);
        for (const target of ['admin', 'manager', 'employee']) {
          const rank = { employee: 1, manager: 2, admin: 3 };
          assert.equal((await request('/dashboard/' + target, { cookie })).status, rank[role] >= rank[target] ? 200 : 403);
        }
        if (role !== 'admin') {
          assert.equal((await request('/users', { cookie, body: { username: 'forbidden', password, role: 'admin' } })).status, 403);
          assert.equal((await request('/users/' + employeeId + '/deactivate', { cookie, body: {} })).status, 403);
        }
      }
    });
    await t.test('current database role and status override existing session access', async () => {
      const manager = await repository.findByUsername('manager_test');
      await client.query("UPDATE users SET role='employee' WHERE user_id=$1", [manager.user_id]);
      assert.equal((await request('/dashboard/manager', { cookie: managerCookie })).status, 401);
      await client.query("UPDATE users SET role='manager',status='inactive' WHERE user_id=$1", [manager.user_id]);
      assert.equal((await request('/me', { cookie: managerCookie })).status, 401);
      await client.query("UPDATE users SET status='active' WHERE user_id=$1", [manager.user_id]);
      assert.equal((await request('/me', { cookie: managerCookie })).status, 401);
      managerCookie = (await login('manager_test')).cookie;
    });
    await t.test('deactivation blocks login and existing sessions; self-deactivation prevented', async () => {
      const me = await request('/me', { cookie: adminCookie });
      assert.equal((await request('/users/' + me.body.user.user_id + '/deactivate', { cookie: adminCookie, body: {} })).status, 409);
      assert.equal((await request('/users/' + employeeId + '/deactivate', { cookie: adminCookie, body: {} })).status, 200);
      assert.equal((await request('/me', { cookie: employeeCookie })).status, 401);
      assert.equal((await login('employee_test')).status, 401);
    });
    await t.test('logout revokes copied JWT and clears cookie', async () => {
      const result = await request('/logout', { cookie: managerCookie, body: {} });
      assert.equal(result.status, 200); assert(result.cookieHeader.includes('Expires='));
      assert.equal((await request('/me', { cookie: managerCookie })).status, 401);
    });
    await t.test('expired JWT cannot access protected resources', async () => {
      clock += 61000;
      assert.equal((await request('/me', { cookie: adminCookie })).status, 401);
    });
    await t.test('account and audit writes roll back together on audit failure', async () => {
      const admin = await repository.findByUsername('admin_test');
      const broken = { ...repository, audit: async () => { throw new Error('Simulated audit failure'); } };
      await assert.rejects(() => createAccount(broken, admin.user_id, { username: 'rollback_test', password, role: 'employee' }));
      assert.equal(await repository.findByUsername('rollback_test'), undefined);
    });
    await t.test('successful account actions are audited without secrets', async () => {
      const actions = (await client.query('SELECT action,module,logged_at FROM activity_logs')).rows;
      for (const prefix of ['account.bootstrap', 'account.created:', 'auth.login', 'auth.logout', 'account.deactivated:']) assert(actions.some(r => r.action.startsWith(prefix)));
      assert(actions.every(r => r.module === 'accounts' && r.logged_at && !r.action.includes(password)));
    });
    await new Promise(resolve => server.close(resolve)); server = null;
    await client.query('ROLLBACK');
    assert.equal((await client.query('SELECT count(*)::int AS n FROM pg_namespace WHERE nspname=$1', [schema])).rows[0].n, 0);
    assert.deepEqual(await publicCounts(), beforeCounts);
    assert.deepEqual((await client.query('SELECT version,checksum,applied_at FROM public.tgp_schema_migrations ORDER BY version')).rows, history);
    console.log('Verified isolated auth fixtures removed; public row counts and migration history unchanged.');
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    if (client) { await client.query('ROLLBACK').catch(() => {}); client.release(); }
    await closePool();
  }
});
