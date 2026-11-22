import { bootstrapSchema } from '../services/auth-validation.js';
import { createAccount } from '../services/accounts.js';
import { createAuthRepository } from '../repositories/auth.repository.js';
import { getPool, closePool } from '../config/database.js';

try {
  const data = bootstrapSchema.safeParse({ username: process.env.BOOTSTRAP_ADMIN_USERNAME,
    password: process.env.BOOTSTRAP_ADMIN_PASSWORD,
    ...(process.env.BOOTSTRAP_ADMIN_NAME ? { full_name: process.env.BOOTSTRAP_ADMIN_NAME } : {}), role: 'admin' });
  delete process.env.BOOTSTRAP_ADMIN_PASSWORD;
  if (!data.success) throw new Error('Invalid bootstrap configuration');
  await createAccount(createAuthRepository(getPool), null, data.data, true);
  console.log('Initial admin created. Remove bootstrap credentials from your environment.');
} catch {
  console.error('Bootstrap refused or failed. Check environment fields and confirm the users table is empty. No credentials were logged.');
  process.exitCode = 1;
} finally { await closePool().catch(() => { process.exitCode = 1; }); }
