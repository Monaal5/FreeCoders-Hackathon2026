// Tiny validation helpers (no extra dependency). Each throws AppError 400 with field details.
const AppError = require('./AppError');

const PHONE_RE = /^[6-9]\d{9}$/; // Indian mobile, 10 digits
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const isBlank = (v) => v === undefined || v === null || String(v).trim() === '';

/** "+91 98765-43210" -> "9876543210" */
const normalisePhone = (v) =>
  String(v || '')
    .replace(/\D/g, '')
    .replace(/^(91|0)(?=\d{10}$)/, '');

/** Number, or null when blank; throws when not numeric or out of range. */
function toNumber(value, field, { min, max } = {}) {
  if (isBlank(value)) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) throw AppError.badRequest(`${field} must be a number`, { field });
  if (min !== undefined && n < min) throw AppError.badRequest(`${field} must be >= ${min}`, { field });
  if (max !== undefined && n > max) throw AppError.badRequest(`${field} must be <= ${max}`, { field });
  return n;
}

function requireFields(body, fields) {
  const missing = fields.filter((f) => isBlank(body?.[f]));
  if (missing.length) throw AppError.badRequest(`Missing required field(s): ${missing.join(', ')}`, { missing });
}

/** Upper-cases and checks against an enum list; null when blank. */
function oneOf(value, allowed, field) {
  if (isBlank(value)) return null;
  const v = String(value).trim().toUpperCase();
  if (!allowed.includes(v)) throw AppError.badRequest(`${field} must be one of ${allowed.join(', ')}`, { field });
  return v;
}

function toId(value, field = 'id') {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw AppError.badRequest(`${field} must be a positive integer`, { field });
  return n;
}

const optionalText = (v, max = 2000) => (isBlank(v) ? null : String(v).trim().slice(0, max));

/** Validates the contact fields shared by public enquiry + manual lead entry. */
function parseLeadInput(body) {
  requireFields(body, ['customerName', 'phone']);
  const phone = normalisePhone(body.phone);
  if (!PHONE_RE.test(phone)) throw AppError.badRequest('phone must be a valid 10-digit Indian mobile number', { field: 'phone' });
  const email = optionalText(body.email, 200);
  if (email && !EMAIL_RE.test(email)) throw AppError.badRequest('email is invalid', { field: 'email' });
  const pincode = optionalText(body.pincode, 6);
  if (pincode && !/^\d{6}$/.test(pincode)) throw AppError.badRequest('pincode must be 6 digits', { field: 'pincode' });

  return {
    customerName: optionalText(body.customerName, 120),
    phone,
    email,
    address: optionalText(body.address, 500),
    city: optionalText(body.city, 80),
    pincode,
    propertyType: oneOf(body.propertyType, ['RESIDENTIAL', 'COMMERCIAL', 'INDUSTRIAL'], 'propertyType') || 'RESIDENTIAL',
    monthlyBill: toNumber(body.monthlyBill, 'monthlyBill', { min: 0, max: 10_000_000 }),
    message: optionalText(body.message, 2000),
  };
}

module.exports = {
  PHONE_RE,
  EMAIL_RE,
  DATE_RE,
  isBlank,
  normalisePhone,
  toNumber,
  requireFields,
  oneOf,
  toId,
  optionalText,
  parseLeadInput,
};
