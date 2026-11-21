const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/db');
const { jwtSecret, jwtExpiresIn } = require('../config/env');
const AppError = require('../utils/AppError');

// Used when the email is unknown so the response time does not reveal which emails exist.
const DUMMY_HASH = '$2b$10$j0qonkoI4zdDtQhCojlAVu7IX7uPTuIi6Xhnan3LLXI9kw3igsKJG';

const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role });

async function login(email, password) {
  const { rows } = await query(
    'SELECT id, name, email, phone, role, password_hash, is_active FROM users WHERE lower(email) = lower($1)',
    [email],
  );
  const user = rows[0];
  const valid = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);
  if (!user || !valid || !user.is_active) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect');
  }

  const token = jwt.sign({ sub: String(user.id), name: user.name, email: user.email, role: user.role }, jwtSecret, {
    expiresIn: jwtExpiresIn,
  });
  return { token, user: publicUser(user) };
}

async function getMe(userId) {
  const { rows } = await query('SELECT id, name, email, phone, role FROM users WHERE id = $1 AND is_active', [userId]);
  if (!rows.length) throw AppError.notFound('User');
  return publicUser(rows[0]);
}

module.exports = { login, getMe };
