import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { auditQuery } from '../services/audit-validation.js';

export function createAuditRouter({ config, sessions, authRepository, repository }) {
  const router = Router();
  router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); },
    requireAuth(authRepository, sessions, config.secure ? '__Secure-tgp_session' : 'tgp_session'), requireRole('admin'));
  router.get('/', async (req, res) => {
    const query = auditQuery.safeParse(req.query);
    if (!query.success) return res.status(400).json({ success: false, message: 'Invalid audit log filters.' });
    const result = await repository.list(query.data);
    res.json({ success: true, total: result.total, page: result.page, limit: result.limit, modules: result.modules,
      data: result.data.map(row => ({ log_id: row.log_id, user_id: row.user_id, username: row.username,
        full_name: row.full_name, action: row.action, module: row.module, logged_at: row.logged_at })) });
  });
  return router;
}
