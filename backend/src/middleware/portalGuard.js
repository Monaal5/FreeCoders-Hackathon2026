// Brute-force guard for the public customer portal.
// The portal is unlocked with order number + last 4 digits of the customer's phone, so wrong
// guesses are counted per IP and per order number; too many -> 429 for a while.
// In-memory on purpose (single API process); restarting the API clears it.
const AppError = require('../utils/AppError');

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILS_PER_IP = 30;
const MAX_FAILS_PER_ORDER = 5;
const fails = new Map(); // key -> { count, resetAt }

function bump(key) {
  const now = Date.now();
  const e = fails.get(key);
  if (!e || e.resetAt <= now) fails.set(key, { count: 1, resetAt: now + WINDOW_MS });
  else e.count += 1;
}

function blocked(key, max) {
  const e = fails.get(key);
  if (!e) return false;
  if (e.resetAt <= Date.now()) {
    fails.delete(key);
    return false;
  }
  return e.count >= max;
}

const keys = (req) => ({
  ip: `ip:${req.ip}`,
  order: `order:${String(req.params.orderNumber || '').trim().toUpperCase()}`,
});

/** Express middleware: refuse while this IP / order number is locked out. */
function portalGuard(req, res, next) {
  const k = keys(req);
  if (blocked(k.ip, MAX_FAILS_PER_IP) || blocked(k.order, MAX_FAILS_PER_ORDER)) {
    return next(new AppError(429, 'TOO_MANY_ATTEMPTS', 'Too many wrong attempts. Please try again in 15 minutes.'));
  }
  return next();
}

/** Call when a lookup failed verification (wrong order number / phone digits). */
function recordPortalFailure(req) {
  const k = keys(req);
  bump(k.ip);
  bump(k.order);
}

/** Test helper: forget all counters. */
function resetPortalGuard() {
  fails.clear();
}

module.exports = { portalGuard, recordPortalFailure, resetPortalGuard, MAX_FAILS_PER_ORDER };
