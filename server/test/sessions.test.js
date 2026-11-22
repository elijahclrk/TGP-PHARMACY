import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { createSessions } from '../src/services/sessions.js';
import { hashPassword, verifyPassword } from '../src/services/passwords.js';

test('Argon2id hashes with independent salts and verifies passwords', async () => {
  const password = randomBytes(20).toString('hex');
  const first = await hashPassword(password);
  const second = await hashPassword(password);
  assert(first.startsWith('$argon2id$'));
  assert(first !== second);
  assert(await verifyPassword(first, password));
  assert.equal(await verifyPassword(first, 'incorrect'), false);
  assert.equal(await verifyPassword(undefined, 'incorrect'), false);
});

test('JWT allowlist enforces expiration, signature, algorithm, issuer, audience and revocation', () => {
  let clock = Date.now();
  const config = { secret: randomBytes(48).toString('hex'), ttl: 60 };
  const sessions = createSessions(config, () => clock);
  const first = sessions.issue(1);
  assert.equal(sessions.verify(first.token)?.userId, 1);
  assert.equal(sessions.verify(first.token + 'tampered'), null);
  const payload = jwt.decode(first.token);
  for (const overrides of [{ iss: 'other' }, { aud: 'other' }]) {
    const token = jwt.sign({ ...payload, ...overrides }, config.secret, { algorithm: 'HS256' });
    assert.equal(sessions.verify(token), null);
  }
  assert.equal(sessions.verify(jwt.sign(payload, config.secret, { algorithm: 'HS384' })), null);
  assert.equal(createSessions(config).verify(first.token), null); // restart fails closed
  sessions.revoke(first.id);
  assert.equal(sessions.verify(first.token), null);
  const second = sessions.issue(1);
  sessions.revokeUser(1);
  assert.equal(sessions.verify(second.token), null);
  const expiring = sessions.issue(2);
  clock += 61000;
  assert.equal(sessions.verify(expiring.token), null);
});
