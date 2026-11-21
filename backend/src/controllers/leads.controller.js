const leadsService = require('../services/leads.service');
const { ok, created } = require('../utils/response');
const { ALL_STATUSES } = require('../utils/leadStatus');
const { scopedAssignee, isScopedStaff } = require('../utils/access');
const AppError = require('../utils/AppError');
const { parseLeadInput, toNumber, toId, oneOf, optionalText, requireFields, isBlank } = require('../utils/validate');

const SOURCES = ['WEBSITE', 'PHONE', 'WHATSAPP', 'WALK_IN', 'REFERRAL'];

/** POST /api/public/enquiries – no auth. */
async function createEnquiry(req, res) {
  const input = parseLeadInput(req.body);
  const result = await leadsService.createEnquiry(input);
  created(res, {
    leadCode: result.leadCode,
    assignedToName: result.assignedToName,
    message: result.duplicate
      ? 'We already have your enquiry – our team will contact you shortly.'
      : 'Thank you! Our solar expert will call you within 24 hours.',
  });
}

/** GET /api/leads?status=NEW,QUALIFIED&q=priya&assignedTo=2&source=PHONE&mine=true&page=1&limit=20 */
async function list(req, res) {
  const { status, q, assignedTo, source, mine, page, limit } = req.query;

  let statuses = null;
  if (!isBlank(status)) {
    statuses = String(status).split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
    const bad = statuses.filter((s) => !ALL_STATUSES.includes(s));
    if (bad.length) throw AppError.badRequest(`Unknown status: ${bad.join(', ')}`, { field: 'status' });
  }

  const requested = mine === 'true' ? req.user.id : isBlank(assignedTo) ? null : toId(assignedTo, 'assignedTo');
  const data = await leadsService.listLeads({
    statuses,
    q: optionalText(q, 100),
    assignedTo: scopedAssignee(req.user, requested), // staff: always their own leads, whatever they ask for
    source: oneOf(source, SOURCES, 'source'),
    page: toNumber(page, 'page', { min: 1 }) || 1,
    limit: Math.min(toNumber(limit, 'limit', { min: 1 }) || 20, 100),
    scopeAssignee: scopedAssignee(req.user, null),
  });
  ok(res, data);
}

/** POST /api/leads – manual entry (phone / WhatsApp / walk-in). */
async function create(req, res) {
  const input = parseLeadInput(req.body);
  const lead = await leadsService.createManualLead(
    input,
    {
      source: oneOf(req.body.source, SOURCES, 'source') || 'PHONE',
      // only admins choose the owner; staff-created leads are always their own
      assignedTo:
        isScopedStaff(req.user) || isBlank(req.body.assignedTo) ? null : toId(req.body.assignedTo, 'assignedTo'),
      force: req.body.force === true,
    },
    req.user,
  );
  created(res, lead);
}

/** GET /api/leads/:id – lead + surveys + quotes + activity timeline. */
async function detail(req, res) {
  ok(res, await leadsService.getLeadDetail(toId(req.params.id), req.user));
}

/** PATCH /api/leads/:id/assign  { assignedTo } – admin only */
async function reassign(req, res) {
  requireFields(req.body, ['assignedTo']);
  ok(res, await leadsService.reassignLead(toId(req.params.id), toId(req.body.assignedTo, 'assignedTo'), req.user));
}

/** PATCH /api/leads/:id/qualify */
async function qualify(req, res) {
  const b = req.body || {};
  const input = {
    monthlyBill: toNumber(b.monthlyBill, 'monthlyBill', { min: 0 }),
    monthlyUnits: toNumber(b.monthlyUnits, 'monthlyUnits', { min: 0 }),
    roofAreaSqft: toNumber(b.roofAreaSqft, 'roofAreaSqft', { min: 0 }),
    sanctionedLoadKw: toNumber(b.sanctionedLoadKw, 'sanctionedLoadKw', { min: 0 }),
    suggestedKw: toNumber(b.suggestedKw, 'suggestedKw', { min: 0.5, max: 100 }), // manual override
    systemType: oneOf(b.systemType, ['ON_GRID', 'OFF_GRID'], 'systemType'),
    roofType: optionalText(b.roofType, 60),
    roofViability: oneOf(b.roofViability, ['HIGH', 'MEDIUM', 'LOW'], 'roofViability'),
    timeline: optionalText(b.timeline, 60),
    budget: toNumber(b.budget, 'budget', { min: 0 }),
    interestedInSubsidy: typeof b.interestedInSubsidy === 'boolean' ? b.interestedInSubsidy : null,
    notes: optionalText(b.notes, 1000),
  };
  ok(res, await leadsService.qualifyLead(toId(req.params.id), input, req.user));
}

/** PATCH /api/leads/:id/lost  { reason } */
async function lost(req, res) {
  requireFields(req.body, ['reason']);
  ok(res, await leadsService.markLost(toId(req.params.id), optionalText(req.body.reason, 500), req.user));
}

module.exports = { createEnquiry, list, create, detail, qualify, lost, reassign };
