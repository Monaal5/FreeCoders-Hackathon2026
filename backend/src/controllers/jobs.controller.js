const jobsService = require('../services/jobs.service');
const { ok } = require('../utils/response');
const AppError = require('../utils/AppError');
const { toId, optionalText, requireFields, isBlank, DATE_RE } = require('../utils/validate');

function parseDate(value, field) {
  if (isBlank(value)) return null;
  const v = String(value).trim();
  if (!DATE_RE.test(v) || Number.isNaN(Date.parse(v))) throw AppError.badRequest(`${field} must be YYYY-MM-DD`, { field });
  return v;
}

/** GET /api/jobs?from=2026-11-01&to=2026-11-30 */
async function list(req, res) {
  ok(res, await jobsService.listJobs({ from: parseDate(req.query.from, 'from'), to: parseDate(req.query.to, 'to') }, req.user));
}

/** PATCH /api/jobs/:id/assign { crewLeadId, scheduledDate, notes? } */
async function assign(req, res) {
  requireFields(req.body, ['crewLeadId', 'scheduledDate']);
  const scheduledDate = parseDate(req.body.scheduledDate, 'scheduledDate');
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  if (scheduledDate < todayStr) throw AppError.badRequest('scheduledDate cannot be in the past', { field: 'scheduledDate' });
  ok(
    res,
    await jobsService.assignJob(
      toId(req.params.id),
      { crewLeadId: toId(req.body.crewLeadId, 'crewLeadId'), scheduledDate, notes: optionalText(req.body.notes, 500) },
      req.user,
    ),
  );
}

/** POST /api/jobs/:id/complete { remarks? } */
async function complete(req, res) {
  ok(
    res,
    await jobsService.completeJob(
      toId(req.params.id),
      { remarks: optionalText(req.body.remarks, 500) },
      req.user,
    ),
  );
}

module.exports = { list, assign, complete };
