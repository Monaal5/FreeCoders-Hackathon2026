const ordersService = require('../services/orders.service');
const { ok, created } = require('../utils/response');
const AppError = require('../utils/AppError');
const { round2 } = require('../utils/money');
const { toId, toNumber, oneOf, optionalText, requireFields } = require('../utils/validate');

const ORDER_STATUSES = ['PENDING_PAYMENT', 'CONFIRMED', 'DISPATCHED', 'DELIVERED', 'INSTALLED'];
const SERIAL_RE = /^[A-Z0-9][A-Z0-9\-_/.]{2,59}$/;

/** Serial numbers are stored upper-case and trimmed; reject anything that can't be a label. */
function parseSerial(value, field = 'serialNumber') {
  const s = String(value ?? '').trim().toUpperCase();
  if (!SERIAL_RE.test(s)) throw AppError.badRequest(`${field} must be 3-60 letters, digits, - _ / or .`, { field });
  return s;
}

/** GET /api/orders?status=CONFIRMED */
async function list(req, res) {
  ok(res, await ordersService.listOrders({ status: oneOf(req.query.status, ORDER_STATUSES, 'status') }, req.user));
}

/** GET /api/orders/:id – order + payments + pick list + serials + dispatch + job + warranties */
async function detail(req, res) {
  ok(res, await ordersService.getOrderDetail(toId(req.params.id), req.user));
}

/** GET /api/orders/:id/pick-list */
async function pickList(req, res) {
  ok(res, await ordersService.getPickList(toId(req.params.id), req.user));
}

/** POST /api/orders/:id/payments { amount, mode, type?, reference? } */
async function pay(req, res) {
  requireFields(req.body, ['amount', 'mode']);
  const result = await ordersService.recordPayment(
    toId(req.params.id),
    {
      amount: round2(toNumber(req.body.amount, 'amount', { min: 0.01, max: 100_000_000 })),
      mode: oneOf(req.body.mode, ['UPI', 'CASH', 'BANK', 'CHEQUE'], 'mode'),
      type: oneOf(req.body.type, ['ADVANCE', 'BALANCE', 'FULL'], 'type'),
      reference: optionalText(req.body.reference, 120),
    },
    req.user,
  );
  created(res, result);
}

/** POST /api/orders/:id/scan { serialNumber } */
async function scan(req, res) {
  requireFields(req.body, ['serialNumber']);
  ok(res, await ordersService.scanSerial(toId(req.params.id), parseSerial(req.body.serialNumber), req.user));
}

/** DELETE /api/orders/:id/scan/:serialNumber */
async function unscan(req, res) {
  ok(res, await ordersService.unscanSerial(toId(req.params.id), parseSerial(req.params.serialNumber), req.user));
}

/** POST /api/orders/:id/dispatch { vehicleNo, driverName } */
async function dispatch(req, res) {
  requireFields(req.body, ['vehicleNo', 'driverName']);
  const vehicleNo = String(req.body.vehicleNo).trim().toUpperCase().replace(/\s+/g, ' ');
  if (!/^[A-Z0-9][A-Z0-9 -]{3,19}$/.test(vehicleNo)) {
    throw AppError.badRequest('vehicleNo must look like a registration number, e.g. MH12 AB 1234', { field: 'vehicleNo' });
  }
  ok(
    res,
    await ordersService.dispatchOrder(toId(req.params.id), { vehicleNo, driverName: optionalText(req.body.driverName, 80) }, req.user),
  );
}

/** POST /api/orders/:id/deliver */
async function deliver(req, res) {
  ok(res, await ordersService.deliverOrder(toId(req.params.id), req.user));
}

module.exports = { list, detail, pickList, pay, scan, unscan, dispatch, deliver, parseSerial };
