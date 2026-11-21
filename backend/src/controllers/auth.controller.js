const authService = require('../services/auth.service');
const { ok } = require('../utils/response');
const { requireFields } = require('../utils/validate');

async function login(req, res) {
  requireFields(req.body, ['email', 'password']);
  const result = await authService.login(String(req.body.email).trim(), String(req.body.password));
  ok(res, result);
}

async function me(req, res) {
  ok(res, await authService.getMe(req.user.id));
}

module.exports = { login, me };
