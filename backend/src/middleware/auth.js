const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config/env');
const AppError = require('../utils/AppError');

/** Requires `Authorization: Bearer <token>`; sets req.user = { id, name, email, role }. */
function authenticate(req, _res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) return next(AppError.unauthorized());

  try {
    const payload = jwt.verify(token, jwtSecret);
    req.user = { id: Number(payload.sub), name: payload.name, email: payload.email, role: payload.role };
    return next();
  } catch (err) {
    const message = err.name === 'TokenExpiredError' ? 'Session expired, please log in again' : 'Invalid token';
    return next(new AppError(401, 'UNAUTHORIZED', message));
  }
}

module.exports = { authenticate };
