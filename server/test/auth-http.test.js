import { test } from 'node:test';
import assert from 'node:assert/strict';
import {listenForFetch} from '../testing/local-http.mjs';
import { randomBytes } from 'node:crypto';
import express from 'express';
import cookieParser from 'cookie-parser';
import { createAuthRouter } from '../src/routes/auth.routes.js';
import { hashPassword } from '../src/services/passwords.js';

test('production cookies are Secure and login limiter/CSRF validation enforce boundaries', async () => {
  const password = randomBytes(20).toString('hex');
  const user = { user_id: 1, username: 'test', role: 'admin', status: 'active', password_hash: await hashPassword(password) };
  const config = { secret: randomBytes(48).toString('hex'), ttl: 60, secure: true, origin: 'https://pharmacy.example' };
  const repository = { findByUsername: async () => user, findById: async () => user,
    audit: async () => {}, transaction: async work => work({}) };
  const app = express(); app.use(express.json()); app.use(cookieParser());
  app.use('/api/auth', createAuthRouter({ config, repository, loginLimit: 2 }));
  const server = await listenForFetch(app);
  const url = 'http://127.0.0.1:' + server.address().port;
  try {
    const post = (body, headers = {}) => fetch(url + '/api/auth/login', { method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: config.origin, 'X-TGP-Request': '1', ...headers }, body: JSON.stringify(body) });
    assert.equal((await post({ username: 'test', password }, { Origin: '' })).status, 403);
    const success = await post({ username: 'test', password });
    assert.equal(success.status, 200);
    const cookie = success.headers.get('set-cookie');
    assert(cookie.startsWith('__Secure-tgp_session=')); assert(cookie.includes('Secure')); assert(cookie.includes('HttpOnly')); assert(cookie.includes('SameSite=Strict'));
    assert.equal((await post({ username: 'test', password: 'wrong' })).status, 401);
    assert.equal((await post({ username: 'test', password: 'wrong' })).status, 429);
    assert.equal((await fetch(url + '/api/auth/register', { method: 'POST', headers: { Origin: config.origin, 'X-TGP-Request': '1' } })).status, 404);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
