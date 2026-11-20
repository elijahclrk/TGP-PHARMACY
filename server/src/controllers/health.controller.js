import { checkDatabaseConnection } from '../repositories/health.repository.js';

export function getHealth(_req, res) {
  res.status(200).json({
    success: true,
    status: 'ok',
    message: 'TGP Pharmacy API is running',
  });
}

export async function getDatabaseHealth(_req, res) {
  res.set('Cache-Control', 'no-store');

  try {
    await checkDatabaseConnection();
    return res.status(200).json({
      success: true,
      status: 'ok',
      message: 'Database connection successful',
    });
  } catch {
    return res.status(503).json({
      success: false,
      status: 'unavailable',
      message: 'Database connection unavailable',
    });
  }
}
