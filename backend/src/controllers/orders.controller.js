const ordersService = require('../services/orders.service');
const { ok, created } = require('../utils/response');
const AppError = require('../utils/AppError');
const { round2 } = require('../utils/money');
const { toId, toNumber, oneOf, optionalText, requireFields } = require('../utils/validate');
const quotesService = require('../services/quotes.service');
const installService = require('../services/installation.service');
const { renderQuotePdf } = require('../services/pdf.service');
const { renderCertificate } = require('../services/certificate.service');
const { recordPortalFailure } = require('../middleware/portalGuard');

// internal reader used ONLY after the portal verified order number + phone digits
const PORTAL_READER = Object.freeze({ id: 0, role: 'ADMIN', name: 'Customer portal' });

const ORDER_STATUSES = ['PENDING_PAYMENT', 'CONFIRMED', 'DISPATCHED', 'DELIVERED', 'INSTALLED'];
const SERIAL_RE = /^[A-Z0-9][A-Z0-9\-_/.]{2,59}$/;

/** Serial numbers are stored upper-case and trimmed; reject anything that can't be a label. */
function parseSerial(value, field = 'serialNumber') {
  const s = String(value ?? '').trim().toUpperCase();
  if (!SERIAL_RE.test(s)) throw AppError.badRequest(`${field} must be 3-60 letters, digits, - _ / or .`, { field });
  return s;
}

/** GET /api/orders?status=CONFIRMED&q=priya */
async function list(req, res) {
  ok(res, await ordersService.listOrders({ status: oneOf(req.query.status, ORDER_STATUSES, 'status'), q: optionalText(req.query.q, 60) }, req.user));
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

/** GET /api/orders/revenue-analytics */
async function revenueAnalytics(req, res) {
  ok(res, await ordersService.getRevenueAnalytics(req.user));
}

// ---------- public customer portal (order number + last 4 phone digits in the BODY, never the URL) ----------
/** Runs a portal action; a failed verification counts towards the brute-force lockout. */
async function portalCall(req, fn) {
  try {
    return await fn();
  } catch (err) {
    // only real guesses count (wrong order number / wrong digits), not malformed input
    if (err instanceof AppError && err.code === 'NOT_FOUND') recordPortalFailure(req);
    throw err;
  }
}

/** POST /api/public/portal/:orderNumber  { phoneLast4 } */
async function publicPortal(req, res) {
  ok(res, await portalCall(req, () => ordersService.getPublicPortalData(req.params.orderNumber, req.body?.phoneLast4)));
}

/** POST /api/public/portal/:orderNumber/feedback  { phoneLast4, rating 1-5, feedback? } */
async function publicFeedback(req, res) {
  ok(res, await portalCall(req, () => ordersService.savePublicFeedback(req.params.orderNumber, req.body || {})));
}

/** POST /api/public/portal/:orderNumber/quote-pdf  { phoneLast4 } */
async function publicQuotePdf(req, res) {
  const docs = await portalCall(req, () => ordersService.getPortalDocuments(req.params.orderNumber, req.body?.phoneLast4));
  const quote = await quotesService.getQuote(docs.quoteId, PORTAL_READER);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${quote.quote_number}.pdf"`);
  renderQuotePdf(quote, res);
}

/** POST /api/public/portal/:orderNumber/certificate  { phoneLast4 } */
async function publicCertificate(req, res) {
  const docs = await portalCall(req, () => ordersService.getPortalDocuments(req.params.orderNumber, req.body?.phoneLast4));
  if (!docs.job || docs.job.status !== 'COMPLETED') {
    throw AppError.conflict('The certificate is available once the installation is completed', 'JOB_NOT_COMPLETED');
  }
  const job = await installService.getJobDetail(docs.job.id, PORTAL_READER);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="installation-certificate-${job.order_number}.pdf"`);
  renderCertificate(job, res);
}

module.exports = {
  list,
  detail,
  pickList,
  pay,
  scan,
  unscan,
  dispatch,
  deliver,
  parseSerial,
  revenueAnalytics,
  publicPortal,
  publicFeedback,
  publicQuotePdf,
  publicCertificate,
};
