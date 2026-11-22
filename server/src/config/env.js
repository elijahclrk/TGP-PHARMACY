import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';

dotenv.config({
  path: fileURLToPath(new URL('../../.env', import.meta.url)),
  quiet: true,
});

const port = Number(process.env.PORT ?? 5000);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535.');
}

const clientOrigin = process.env.CLIENT_ORIGIN ?? 'http://localhost:5173';
const parsedOrigin = new URL(clientOrigin);

if (!['http:', 'https:'].includes(parsedOrigin.protocol) || parsedOrigin.origin !== clientOrigin) {
  throw new Error('CLIENT_ORIGIN must be an HTTP(S) origin without a path or trailing slash.');
}

export const env = Object.freeze({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port,
  clientOrigin,
  databaseUrl: process.env.DATABASE_URL?.trim() || '',
});
