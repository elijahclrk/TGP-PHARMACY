import {accountSessionTag} from '../services/sessions.js';
export const publicUser = user => ({
  user_id: user.user_id, username: user.username, full_name: user.full_name,
  role: user.role, status: user.status,
  ...(Object.hasOwn(user,'last_sign_in')?{last_sign_in:user.last_sign_in}:{}),
});

export function requireAuth(repository, sessions, cookieName) {
  return async (req, res, next) => {
    const session = sessions.verify(req.cookies?.[cookieName]);
    if (!session) return res.status(401).json({ success: false, message: 'Please sign in again.' });
    const user = await repository.findById(session.userId);
    if (!user || user.status !== 'active' || !['admin', 'manager', 'employee'].includes(user.role) || (session.accountTag&&session.accountTag!==accountSessionTag(user))) {
      sessions.revoke(session.id);
      return res.status(401).json({ success: false, message: 'Please sign in again.' });
    }
    req.auth = { session, user: publicUser(user) };
    next();
  };
}

export const requireRole = (...roles) => (req, res, next) => {
  if (!req.auth) return res.status(401).json({ success: false, message: 'Please sign in again.' });
  if (!roles.includes(req.auth.user.role)) return res.status(403).json({ success: false, message: 'Access denied.' });
  next();
};

export const requireTrustedRequest = origin => (req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.get('Origin') !== origin || req.get('X-TGP-Request') !== '1') {
    return res.status(403).json({ success: false, message: 'Request not permitted.' });
  }
  next();
};
