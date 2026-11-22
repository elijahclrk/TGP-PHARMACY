import argon2 from 'argon2';
import { randomBytes } from 'node:crypto';

export const hashPassword = password => argon2.hash(password, {
  type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1,
});

let dummyHash;
export async function verifyPassword(hash, password) {
  // Unknown usernames still incur a real password verification.
  dummyHash ??= hashPassword(randomBytes(32).toString('hex'));
  try { return await argon2.verify(hash || await dummyHash, password); }
  catch { return false; }
}
