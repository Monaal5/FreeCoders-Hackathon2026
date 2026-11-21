const surveysService = require('../services/surveys.service');
const { ok, created } = require('../utils/response');
const AppError = require('../utils/AppError');
const { toId, toNumber, oneOf, optionalText, requireFields, DATE_RE } = require('../utils/validate');
const { toPublicPath, removeFiles } = require('../middleware/upload');

/**
 * POST /api/leads/:id/surveys  { technicianId, scheduledDate, notes? }
 * scheduledDate: 'YYYY-MM-DD' (date only) or an ISO date-time such as '2026-11-22T05:30:00.000Z'.
 */
async function assign(req, res) {
  requireFields(req.body, ['technicianId', 'scheduledDate']);
  const scheduledDate = String(req.body.scheduledDate).trim();
  const when = new Date(DATE_RE.test(scheduledDate) ? `${scheduledDate}T00:00:00` : scheduledDate);
  if (!/^\d{4}-\d{2}-\d{2}/.test(scheduledDate) || Number.isNaN(when.getTime())) {
    throw AppError.badRequest('scheduledDate must be YYYY-MM-DD or an ISO date-time', { field: 'scheduledDate' });
  }
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  if (when < startOfToday) throw AppError.badRequest('scheduledDate cannot be in the past', { field: 'scheduledDate' });

  const survey = await surveysService.assignSurvey(
    toId(req.params.id),
    {
      technicianId: toId(req.body.technicianId, 'technicianId'),
      scheduledDate: when.toISOString(),
      notes: optionalText(req.body.notes, 1000),
    },
    req.user,
  );
  created(res, survey);
}

/** GET /api/surveys/my?status=SCHEDULED */
async function mine(req, res) {
  const status = oneOf(req.query.status, ['SCHEDULED', 'SUBMITTED', 'APPROVED', 'REJECTED'], 'status');
  ok(res, await surveysService.listMySurveys(req.user.id, status));
}

/** PATCH /api/surveys/:id/submit  multipart/form-data: fields + photos[] (1-8 images) */
async function submit(req, res) {
  const files = req.files || [];
  try {
    if (!files.length) throw AppError.badRequest('At least one roof/site photo is required', { field: 'photos' });
    const b = req.body || {};
    const data = {
      roofType: optionalText(b.roofType, 60),
      roofAreaSqft: toNumber(b.roofAreaSqft, 'roofAreaSqft', { min: 0, max: 1_000_000 }),
      shading: optionalText(b.shading, 500), // free text, e.g. "No shade 9am-4pm"
      orientation: optionalText(b.orientation, 40),
      structureType: optionalText(b.structureType, 120),
      cableRunMeters: toNumber(b.cableRunMeters, 'cableRunMeters', { min: 0, max: 10_000 }),
      inverterLocation: optionalText(b.inverterLocation, 200),
      sanctionedLoadKw: toNumber(b.sanctionedLoadKw, 'sanctionedLoadKw', { min: 0, max: 10_000 }),
      recommendedKw: toNumber(b.recommendedKw, 'recommendedKw', { min: 0.5, max: 1000 }),
      latitude: toNumber(b.latitude, 'latitude', { min: -90, max: 90 }),
      longitude: toNumber(b.longitude, 'longitude', { min: -180, max: 180 }),
      technicianNotes: optionalText(b.technicianNotes, 2000),
    };
    const survey = await surveysService.submitSurvey(toId(req.params.id), data, files.map(toPublicPath), req.user);
    ok(res, survey);
  } catch (err) {
    removeFiles(files); // DB rolled back -> don't keep orphan photos
    throw err;
  }
}

/** PATCH /api/surveys/:id/review  { decision: 'APPROVE' | 'REJECT', note } (note required on reject) */
async function review(req, res) {
  const decision = oneOf(req.body?.decision, ['APPROVE', 'REJECT'], 'decision');
  if (!decision) throw AppError.badRequest('decision is required (APPROVE or REJECT)', { field: 'decision' });
  const note = optionalText(req.body.note, 1000);
  if (decision === 'REJECT' && !note) throw AppError.badRequest('A note explaining the rejection is required', { field: 'note' });

  ok(res, await surveysService.reviewSurvey(toId(req.params.id), { decision, note }, req.user));
}

module.exports = { assign, mine, submit, review };
