import { randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';

const issuer = 'tgp-pharmacy-api';
const audience = 'tgp-pharmacy-web';

export function createSessions(config, now = () => Date.now()) {
  // An allowlist fails closed after process restart. Use one API process.
  const sessions = new Map();
  const prune = () => {
    for (const [id, session] of sessions) if (session.expiresAt <= now()) sessions.delete(id);
  };
  return {
    issue(userId) {
      prune();
      if (sessions.size >= 10000) throw Object.assign(new Error('Session capacity reached'), { status: 503 });
      const id = randomBytes(32).toString('hex');
      const issued = Math.floor(now() / 1000);
      const expiresAt = (issued + config.ttl) * 1000;
      const token = jwt.sign({ sub: String(userId), jti: id, iat: issued, exp: issued + config.ttl }, config.secret,
        { algorithm: 'HS256', issuer, audience });
      sessions.set(id, { userId, expiresAt });
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
