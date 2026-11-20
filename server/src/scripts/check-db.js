import { checkDatabaseConnection } from '../repositories/health.repository.js';
import { closePool } from '../config/database.js';

try {
  await checkDatabaseConnection();
  console.log('Database connection successful: SELECT 1 returned 1.');
} catch {
  console.error('Database connection unavailable. Check the saved DATABASE_URL and network access.');
  process.exitCode = 1;
} finally {
  try {
    await closePool();
  } catch {
    console.error('Database connection cleanup failed.');
    process.exitCode = 1;
  }
}
