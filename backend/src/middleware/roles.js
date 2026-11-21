const AppError = require('../utils/AppError');

const ROLES = Object.freeze({ ADMIN: 'ADMIN', STAFF: 'STAFF', TECHNICIAN: 'TECHNICIAN' });

/** authorize('ADMIN', 'STAFF') – use after authenticate. */
const authorize =
  (...allowed) =>
  (req, _res, next) => {
    if (!req.user) return next(AppError.unauthorized());
    if (!allowed.includes(req.user.role)) {
      return next(AppError.forbidden(`This action needs role: ${allowed.join(' or ')}`));
    }
    return next();
  };

module.exports = { ROLES, authorize };
