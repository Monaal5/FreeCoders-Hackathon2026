const templatesService = require('../services/templates.service');
const { ok } = require('../utils/response');
const { oneOf, toNumber } = require('../utils/validate');

/** GET /api/templates?systemType=ON_GRID&capacityKw=3 */
async function list(req, res) {
  ok(
    res,
    await templatesService.listTemplates({
      systemType: oneOf(req.query.systemType, ['ON_GRID', 'OFF_GRID'], 'systemType'),
      capacityKw: toNumber(req.query.capacityKw, 'capacityKw', { min: 0 }),
    }),
  );
}

module.exports = { list };
