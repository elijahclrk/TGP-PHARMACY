import { getPool } from '../config/database.js';

export async function checkDatabaseConnection() {
  const result = await getPool().query('SELECT 1 AS connected');

  if (result.rows[0]?.connected !== 1) {
    throw new Error('Database connectivity check failed.');
  }
}
