import { randomBytes,createHash } from 'node:crypto';
import jwt from 'jsonwebtoken';

const issuer = 'tgp-pharmacy-api';
const audience = 'tgp-pharmacy-web';
// Bound to the accepted account state, so login/update races cannot resurrect
// a session authenticated with an old password or role. Never sent to clients.
export const accountSessionTag=user=>createHash('sha256').update(JSON.stringify([user.user_id,user.username,user.password_hash,user.role,user.status])).digest('hex');

export function createSessions(config, now = () => Date.now()) {
  // An allowlist fails closed after process restart. Use one API process.
  const sessions = new Map();
  const prune = () => {
    for (const [id, session] of sessions) if (session.expiresAt <= now()) sessions.delete(id);
  };
  return {
    issue(userId,accountTag) {
      prune();
      if (sessions.size >= 10000) throw Object.assign(new Error('Session capacity reached'), { status: 503 });
      const id = randomBytes(32).toString('hex');
      const issued = Math.floor(now() / 1000);
      const expiresAt = (issued + config.ttl) * 1000;
      const token = jwt.sign({ sub: String(userId), jti: id, iat: issued, exp: issued + config.ttl }, config.secret,
        { algorithm: 'HS256', issuer, audience });
      sessions.set(id, { userId, expiresAt, ...(accountTag?{accountTag}:{}) });
      return { token, id, expiresAt };
    },
    verify(token) {
      prune();
      try {
        const claims = jwt.verify(token, config.secret, { algorithms: ['HS256'], issuer, audience, clockTimestamp: Math.floor(now() / 1000) });
        const session = sessions.get(claims.jti);
        if (!session || String(session.userId) !== claims.sub) return null;
        return { ...session, id: claims.jti };
      } catch { return null; }
    },
    revoke(id) { sessions.delete(id); },
    revokeUser(userId) { for (const [id, session] of sessions) if (session.userId === userId) sessions.delete(id); },
  };
}
