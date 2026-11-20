import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { createAuthRepository } from '../repositories/auth.repository.js';
import { getPool } from '../config/database.js';
import { getAuthConfig } from '../config/auth.js';
import { createSessions } from '../services/sessions.js';
import { verifyPassword } from '../services/passwords.js';
import { createAccount } from '../services/accounts.js';
import { loginSchema, userSchema, validateBody } from '../services/auth-validation.js';
import { requireAuth, requireRole, requireTrustedRequest, publicUser } from '../middleware/auth.js';

export function createAuthRouter({ config = getAuthConfig(), repository = createAuthRepository(getPool),
  sessions = createSessions(config), loginLimit = 10 } = {}) {
  const router = Router();
  const cookieName = config.secure ? '__Secure-tgp_session' : 'tgp_session';
  const cookieOptions = { httpOnly: true, secure: config.secure, sameSite: 'strict', path: '/api' };
  const authenticate = requireAuth(repository, sessions, cookieName);
  router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  router.use(requireTrustedRequest(config.origin));
  router.post('/login', rateLimit({ windowMs: 15 * 60 * 1000, limit: loginLimit,
    standardHeaders: 'draft-8', legacyHeaders: false,
    message: { success: false, message: 'Too many sign-in attempts. Please try again later.' },
  }), validateBody(loginSchema), async (req, res) => {
    const user = await repository.findByUsername(req.validated.username);
    const matches = await verifyPassword(user?.password_hash, req.validated.password);
    if (!matches || !user || user.status !== 'active' || !['admin', 'manager', 'employee'].includes(user.role)) {
      return res.status(401).json({ success: false, message: 'Invalid username or password.' });
    }
    const accepted = await repository.transaction(async client => {
      const current = await repository.findById(user.user_id, client);
      if (!current || current.status !== 'active' || current.password_hash !== user.password_hash) return null;
      await repository.audit(client, current.user_id, 'auth.login');
      return current;
    });
    if (!accepted) return res.status(401).json({ success: false, message: 'Invalid username or password.' });
    const previous = sessions.verify(req.cookies?.[cookieName]);
    if (previous) sessions.revoke(previous.id);
    const session = sessions.issue(accepted.user_id);
    res.cookie(cookieName, session.token, { ...cookieOptions, maxAge: config.ttl * 1000 });
    return res.json({ success: true, user: publicUser(accepted), expiresAt: session.expiresAt });
  });
  router.get('/me', authenticate, (req, res) => res.json({ success: true, user: req.auth.user, expiresAt: req.auth.session.expiresAt }));
  router.post('/logout', validateBody(loginSchema.pick({}).strict()), async (req, res) => {
    const session = sessions.verify(req.cookies?.[cookieName]);
    if (session) sessions.revoke(session.id); // revoke even if subsequent audit storage fails
    res.clearCookie(cookieName, cookieOptions);
    if (session) await repository.transaction(client => repository.audit(client, session.userId, 'auth.logout'));
    res.json({ success: true });
  });
  router.get('/dashboard/:role', authenticate, (req, res, next) => {
    if (!['admin', 'manager', 'employee'].includes(req.params.role)) return res.status(404).json({ success: false, message: 'Route not found' });
    const permitted = { admin: ['admin'], manager: ['admin', 'manager'], employee: ['admin', 'manager', 'employee'] };
    return requireRole(...permitted[req.params.role])(req, res, next);
  }, (req, res) => res.json({ success: true, role: req.auth.user.role }));
  router.post('/users', authenticate, requireRole('admin'), validateBody(userSchema), async (req, res) => {
    try {
      const user = await createAccount(repository, req.auth.user.user_id, req.validated);
      res.status(201).json({ success: true, user: publicUser(user) });
    } catch (error) {
      if (error.code === '23505') return res.status(409).json({ success: false, message: 'Username is unavailable.' });
      throw error;
    }
  });
  router.post('/users/:id/deactivate', authenticate, requireRole('admin'), validateBody(loginSchema.pick({}).strict()), async (req, res) => {
    if (!/^[1-9]\d{0,9}$/.test(req.params.id) || Number(req.params.id) > 2147483647) return res.status(400).json({ success: false, message: 'Invalid user ID.' });
    const id = Number(req.params.id);
    if (id === req.auth.user.user_id) return res.status(409).json({ success: false, message: 'You cannot deactivate your own account.' });
    const user = await repository.transaction(async client => {
      await repository.requireActiveAdmin(client, req.auth.user.user_id);
      const target = await repository.findById(id, client);
      if (target?.role === 'admin') throw Object.assign(new Error('Administrator account changes are not available'), { status: 403 });
      const updated = await repository.deactivate(client, id);
      if (updated) await repository.audit(client, req.auth.user.user_id, `account.deactivated:${id}`);
      return updated;
    });
    if (!user) return res.status(404).json({ success: false, message: 'Account not found.' });
    sessions.revokeUser(id);
    res.json({ success: true, user: publicUser(user) });
  });
  return router;
}
