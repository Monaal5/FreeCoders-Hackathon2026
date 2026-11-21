const usersService = require('../services/users.service');
const { ok } = require('../utils/response');
const { oneOf } = require('../utils/validate');

/** GET /api/users?role=TECHNICIAN */
async function list(req, res) {
  const role = oneOf(req.query.role, ['ADMIN', 'STAFF', 'TECHNICIAN'], 'role');
  ok(res, await usersService.listUsers(role));
}

module.exports = { list };
