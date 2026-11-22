import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

// No database or process-local quote state. A restart preserves quotes when the
// signing key is unchanged; the locked live snapshot is always checked again.
export const quoteFingerprint = snapshot => createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
export function createQuoteProtection(secret) {
  if (!secret || Buffer.byteLength(secret) < 32) throw new Error('A valid signing key is required for POS quotes.');
  const mac = payload => createHmac('sha256', secret).update('tgp-pos-quote-v1:' + payload).digest();
  return {
    sign(userId, fingerprint) {
      const payload = Buffer.from(JSON.stringify({ v: 1, userId, fingerprint })).toString('base64url');
      return payload + '.' + mac(payload).toString('base64url');
    },
    verify(token, userId) {
      try {
        if (typeof token !== 'string' || token.length > 512) return null;
        const parts = token.split('.');
        if (parts.length !== 2) return null;
        const signature = Buffer.from(parts[1], 'base64url'), expected = mac(parts[0]);
        if (signature.length !== expected.length || !timingSafeEqual(signature, expected)) return null;
        const value = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
        return value.v === 1 && value.userId === userId && /^[a-f0-9]{64}$/.test(value.fingerprint) ? value.fingerprint : null;
      } catch { return null; }
    },
  };
}
