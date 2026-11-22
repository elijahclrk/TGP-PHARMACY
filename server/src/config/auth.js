import { env } from './env.js';

export function getAuthConfig() {
  const secret = process.env.JWT_SECRET;
  if (!secret || Buffer.byteLength(secret) < 32) {
    throw new Error('JWT_SECRET must contain at least 32 bytes.');
  }
  const ttl = Number(process.env.JWT_TTL_SECONDS ?? 900);
  if (!Number.isInteger(ttl) || ttl < 60 || ttl > 3600) {
    throw new Error('JWT_TTL_SECONDS must be between 60 and 3600.');
  }
  return { secret, ttl, secure: env.nodeEnv === 'production', origin: env.clientOrigin };
}
