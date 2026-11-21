const templatesService = require('../services/templates.service');
const { ok } = require('../utils/response');
const { oneOf, toNumber } = require('../utils/validate');

/** GET /api/templates?kind=ON_GRID&systemType=ON_GRID&capacityKw=3 (all filters optional) */
async function list(req, res) {
  ok(
    res,
    await templatesService.listTemplates({
      kind: oneOf(req.query.kind, ['PANEL_SET', 'ON_GRID', 'OFF_GRID', 'INSTALLATION'], 'kind'),
      systemType: oneOf(req.query.systemType, ['ON_GRID', 'OFF_GRID'], 'systemType'),
      capacityKw: toNumber(req.query.capacityKw, 'capacityKw', { min: 0 }),
    }),
  );
}

module.exports = { list };
