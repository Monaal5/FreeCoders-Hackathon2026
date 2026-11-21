const inventoryService = require('../services/inventory.service');
const { ok, created } = require('../utils/response');
const AppError = require('../utils/AppError');
const { toId, toNumber, oneOf, optionalText, requireFields, isBlank } = require('../utils/validate');
const { parseSerial } = require('./orders.controller');

/** GET /api/inventory?q=inv&lowOnly=true */
async function list(req, res) {
  ok(res, await inventoryService.listInventory({ q: optionalText(req.query.q, 60), lowOnly: req.query.lowOnly === 'true' }));
}

/** POST /api/inventory/receive  { productId, quantity } (bulk) or { productId, serials: [...] } */
async function receive(req, res) {
  requireFields(req.body, ['productId']);
  const { serials } = req.body;
  if (serials !== undefined && !Array.isArray(serials)) throw AppError.badRequest('serials must be an array', { field: 'serials' });
  if (serials && serials.length > 500) throw AppError.badRequest('At most 500 serials per receipt', { field: 'serials' });
  if (serials && !isBlank(req.body.quantity)) throw AppError.badRequest('Send either quantity or serials, not both');

  const cleaned = serials ? serials.map((s, i) => parseSerial(s, `serials[${i}]`)) : undefined;
  if (cleaned) {
    const dupes = cleaned.filter((s, i) => cleaned.indexOf(s) !== i);
    if (dupes.length) throw AppError.badRequest(`Serial repeated in this receipt: ${[...new Set(dupes)].join(', ')}`, { field: 'serials' });
  }

  const result = await inventoryService.receiveStock(
    {
      productId: toId(req.body.productId, 'productId'),
      quantity: toNumber(req.body.quantity, 'quantity', { min: 0.01, max: 1_000_000 }),
      serials: cleaned,
      purchaseCost: toNumber(req.body.purchaseCost, 'purchaseCost', { min: 0 }),
      note: optionalText(req.body.note, 200),
    },
    req.user,
  );
  created(res, result);
}

/** GET /api/inventory/serials?productId=&status=&q=&orderId= */
async function serials(req, res) {
  ok(
    res,
    await inventoryService.listSerials({
      productId: isBlank(req.query.productId) ? null : toId(req.query.productId, 'productId'),
      status: oneOf(req.query.status, ['IN_STOCK', 'RESERVED', 'DISPATCHED', 'DELIVERED', 'INSTALLED'], 'status'),
      q: optionalText(req.query.q, 60),
      orderId: isBlank(req.query.orderId) ? null : toId(req.query.orderId, 'orderId'),
    }),
  );
}

/** GET /api/inventory/movements?productId= – stock ledger */
async function movements(req, res) {
  ok(res, await inventoryService.listMovements({ productId: isBlank(req.query.productId) ? null : toId(req.query.productId, 'productId') }));
}

module.exports = { list, receive, serials, movements };
