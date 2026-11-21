const multer = require('multer');
const AppError = require('../utils/AppError');
const { nodeEnv } = require('../config/env');

function notFound(req, _res, next) {
  next(new AppError(404, 'NOT_FOUND', `Route ${req.method} ${req.originalUrl} not found`));
}

/** Translates known DB / library errors into AppErrors. */
function normalise(err) {
  if (err instanceof AppError) return err;

  if (err instanceof multer.MulterError) {
    const messages = {
      LIMIT_FILE_SIZE: 'Each photo must be 5 MB or smaller',
      LIMIT_FILE_COUNT: 'Too many photos (max 8)',
      LIMIT_UNEXPECTED_FILE: 'Photos must be sent in the "photos" field',
    };
    return AppError.badRequest(messages[err.code] || err.message, { field: 'photos' });
  }

  if (err.type === 'entity.parse.failed') return AppError.badRequest('Request body is not valid JSON');

  // http-errors from Express internals (e.g. missing static file -> 404)
  if (err.expose && err.status >= 400 && err.status < 500) {
    return new AppError(err.status, err.status === 404 ? 'NOT_FOUND' : 'BAD_REQUEST', err.message);
  }

  // PostgreSQL error codes: https://www.postgresql.org/docs/current/errcodes-appendix.html
  switch (err.code) {
    case '23505': return AppError.conflict('A record with these details already exists', 'DUPLICATE', { constraint: err.constraint });
    case '23503': return AppError.badRequest('Referenced record does not exist', { constraint: err.constraint });
    case '23514': return AppError.badRequest('A value is out of the allowed range', { constraint: err.constraint });
    case '22P02': return AppError.badRequest('Invalid value for one of the fields');
    case 'ECONNREFUSED': return new AppError(503, 'DB_UNAVAILABLE', 'Database is not running (npm run db:start)');
    default: return null;
  }
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, _next) {
  const appErr = normalise(err);
  if (!appErr) {
    console.error(`[${req.method} ${req.originalUrl}]`, err);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: nodeEnv === 'production' ? 'Something went wrong' : err.message },
    });
  }
  const body = { code: appErr.code, message: appErr.message };
  if (appErr.details) body.details = appErr.details;
  return res.status(appErr.status).json({ success: false, error: body });
}

module.exports = { notFound, errorHandler };
