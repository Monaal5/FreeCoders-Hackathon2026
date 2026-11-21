const quotesService = require('../services/quotes.service');
const { renderQuotePdf } = require('../services/pdf.service');
const { ok, created } = require('../utils/response');
const AppError = require('../utils/AppError');
const { toId, toNumber, oneOf, optionalText, requireFields } = require('../utils/validate');

/** POST /api/leads/:id/quotes  { templateId, discountPct?, validDays?, notes? } */
async function create(req, res) {
  requireFields(req.body, ['templateId']);
  const quote = await quotesService.createQuote(
    toId(req.params.id),
    {
      templateId: toId(req.body.templateId, 'templateId'),
      discountPct: toNumber(req.body.discountPct, 'discountPct', { min: 0, max: 30 }) ?? 0, // cap discounts at 30%
      validDays: toNumber(req.body.validDays, 'validDays', { min: 1, max: 90 }) ?? 15,
      notes: optionalText(req.body.notes, 1000),
    },
    req.user,
  );
  created(res, quote);
}

/** GET /api/quotes/:id */
async function detail(req, res) {
  ok(res, await quotesService.getQuote(toId(req.params.id)));
}

/** GET /api/quotes/:id/pdf  (?download=1 to force a file download instead of inline view) */
async function pdf(req, res) {
  const quote = await quotesService.getQuote(toId(req.params.id));
  const disposition = req.query.download ? 'attachment' : 'inline';
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `${disposition}; filename="${quote.quote_number}.pdf"`);
  renderQuotePdf(quote, res);
}

/** PATCH /api/quotes/:id/status  { status: 'SENT' | 'ACCEPTED' | 'REJECTED' } */
async function updateStatus(req, res) {
  const status = oneOf(req.body?.status, ['SENT', 'ACCEPTED', 'REJECTED'], 'status');
  if (!status) throw AppError.badRequest('status is required (SENT, ACCEPTED or REJECTED)', { field: 'status' });
  ok(res, await quotesService.updateQuoteStatus(toId(req.params.id), status, req.user));
}

module.exports = { create, detail, pdf, updateStatus };
