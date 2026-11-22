export function errorHandler(error, _req, res, _next) {
  if (res.headersSent) {
    return _next(error);
  }

  const status = Number.isInteger(error.status) && error.status >= 400 && (error.status < 500 || error.status === 503)
    ? error.status
    : 500;

  res.status(status).json({
    success: false,
    message: status === 503 ? 'The service is temporarily unavailable.' : status === 500 ? 'Internal server error' : 'Invalid request',
  });
}
