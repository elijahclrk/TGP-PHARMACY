import app from './app.js';
import { env } from './config/env.js';
import { closePool } from './config/database.js';

const server = app.listen(env.port, () => {
  console.log(`TGP Pharmacy API listening at http://localhost:${env.port}`);
});

server.on('error', (error) => {
  console.error(error.code === 'EADDRINUSE'
    ? `Port ${env.port} is already in use.`
    : 'Failed to start the API server.');
  process.exit(1);
});

let shuttingDown = false;

function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;

  const timeout = setTimeout(() => process.exit(1), 10000);
  timeout.unref();

  server.close(async () => {
    try {
      await closePool();
      clearTimeout(timeout);
      process.exitCode = 0;
    } catch {
      console.error('Failed to close the database pool.');
      process.exitCode = 1;
    }
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
