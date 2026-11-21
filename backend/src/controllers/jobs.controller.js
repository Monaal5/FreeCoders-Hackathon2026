const jobsService = require('../services/jobs.service');
const install = require('../services/installation.service');
const { renderCertificate } = require('../services/certificate.service');
const { ok, created } = require('../utils/response');
const AppError = require('../utils/AppError');
const { toId, toNumber, optionalText, requireFields, isBlank, oneOf, DATE_RE } = require('../utils/validate');
const { toPublicPath, removeFiles } = require('../middleware/upload');
const { parseSerial } = require('./orders.controller');

function parseDate(value, field) {
  if (isBlank(value)) return null;
  const v = String(value).trim();
  if (!DATE_RE.test(v) || Number.isNaN(Date.parse(v))) throw AppError.badRequest(`${field} must be YYYY-MM-DD`, { field });
  return v;
}

/** Only known checklist keys, only true/false values. */
function parseChecklist(value, { required = false } = {}) {
  if (value === undefined || value === null) {
    if (required) throw AppError.badRequest('checklist is required', { field: 'checklist' });
    return undefined;
  }
  if (typeof value !== 'object' || Array.isArray(value)) throw AppError.badRequest('checklist must be an object', { field: 'checklist' });
  const unknown = Object.keys(value).filter((k) => !install.CHECKLIST_KEYS.includes(k));
  if (unknown.length) {
    throw AppError.badRequest(`Unknown checklist item(s): ${unknown.join(', ')}`, { field: 'checklist', allowed: install.CHECKLIST_KEYS });
  }
  const bad = Object.entries(value).filter(([, v]) => typeof v !== 'boolean').map(([k]) => k);
  if (bad.length) throw AppError.badRequest(`Checklist values must be true or false: ${bad.join(', ')}`, { field: 'checklist' });
  return value;
}

const MAX_SIGNATURE_BYTES = 512 * 1024;
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** "data:image/png;base64,...." (or bare base64) -> PNG Buffer; anything else is "signature missing". */
function parseSignature(value) {
  const missing = (msg) => new AppError(400, 'SIGNATURE_MISSING', msg, { field: 'signature' });
  if (isBlank(value)) throw missing("The customer's signature is required");
  const b64 = String(value).replace(/^data:image\/png;base64,/i, '').replace(/\s+/g, '');
  if (!/^[A-Za-z0-9+/]+=*$/.test(b64)) throw missing('Signature must be a base64 PNG image');
  const buf = Buffer.from(b64, 'base64');
  if (buf.length < PNG_MAGIC.length + 20 || !buf.subarray(0, 8).equals(PNG_MAGIC)) throw missing('Signature must be a PNG image');
  if (buf.length > MAX_SIGNATURE_BYTES) throw AppError.badRequest('Signature image is larger than 512 KB', { field: 'signature' });
  return buf;
}

// ---------------------------------------------------------------------------------------------
// Office side (Phase 2)
// ---------------------------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------------------------
// On the roof (Phase 3)
// ---------------------------------------------------------------------------------------------
/** GET /api/jobs/my?date=2026-11-22 – technician's today + upcoming jobs */
async function my(req, res) {
  ok(res, await install.myJobs(req.user, parseDate(req.query.date, 'date')));
}

/** GET /api/jobs/:id – job + customer + package + expected serials + photos + checklist */
async function detail(req, res) {
  ok(res, await install.getJobDetail(toId(req.params.id), req.user));
}

/** PUT /api/jobs/:id/crew { technicianIds: [] } */
async function setCrew(req, res) {
  const ids = req.body?.technicianIds;
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 8) {
    throw AppError.badRequest('technicianIds must be a list of 1-8 technician ids', { field: 'technicianIds' });
  }
  ok(res, await install.setCrew(toId(req.params.id), ids.map((i) => toId(i, 'technicianIds')), req.user));
}

/** POST /api/jobs/:id/start */
async function start(req, res) {
  ok(res, await install.startJob(toId(req.params.id), req.user));
}

/** PATCH /api/jobs/:id/checklist { checklist: { STANDS_MOUNTED: true, ... } } */
async function checklist(req, res) {
  const value = req.body?.checklist !== undefined ? req.body.checklist : req.body;
  ok(res, await install.saveChecklist(toId(req.params.id), parseChecklist(value, { required: true }), req.user));
}

/** POST /api/jobs/:id/photos  multipart: stage=BEFORE|DURING|AFTER + photos[] (1-8 images) */
async function photos(req, res) {
  const files = req.files || [];
  try {
    if (!files.length) throw AppError.badRequest('Attach at least one photo in the "photos" field', { field: 'photos' });
    const stage = oneOf(req.body?.stage, install.PHOTO_STAGES, 'stage');
    if (!stage) throw AppError.badRequest('stage is required (BEFORE, DURING or AFTER)', { field: 'stage' });
    created(res, await install.addPhotos(toId(req.params.id), stage, files.map(toPublicPath), req.user));
  } catch (err) {
    removeFiles(files); // nothing saved in the DB -> don't keep the files
    throw err;
  }
}

/** POST /api/jobs/:id/serials/verify { serialNumber } */
async function verifySerial(req, res) {
  requireFields(req.body, ['serialNumber']);
  ok(res, await install.verifySerial(toId(req.params.id), parseSerial(req.body.serialNumber), req.user));
}

/**
 * POST /api/jobs/:id/complete
 * { confirmedCapacityKw, generationReadingKw, checklist?, notes?, signedByName, signature: "data:image/png;base64,..." }
 */
async function complete(req, res) {
  const b = req.body || {};
  const signedByName = optionalText(b.signedByName, 120);
  if (!signedByName) throw new AppError(400, 'SIGNATURE_MISSING', "The customer's name is required for sign-off", { field: 'signedByName' });
  const signaturePng = parseSignature(b.signature);
  requireFields(b, ['confirmedCapacityKw', 'generationReadingKw']);
  ok(
    res,
    await install.completeJob(
      toId(req.params.id),
      {
        confirmedCapacityKw: toNumber(b.confirmedCapacityKw, 'confirmedCapacityKw', { min: 0.1, max: 1000 }),
        generationReadingKw: toNumber(b.generationReadingKw, 'generationReadingKw', { min: 0.01, max: 1000 }),
        checklist: parseChecklist(b.checklist),
        notes: optionalText(b.notes ?? b.remarks, 1000),
        signedByName,
        signaturePng,
      },
      req.user,
    ),
  );
}

/** GET /api/jobs/:id/certificate – completion certificate PDF (?download=1 to save) */
async function certificate(req, res) {
  const job = await install.getJobDetail(toId(req.params.id), req.user);
  if (job.status !== 'COMPLETED') {
    throw AppError.conflict('The certificate is available once the installation is completed', 'JOB_NOT_COMPLETED', { status: job.status });
  }
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `${req.query.download ? 'attachment' : 'inline'}; filename="installation-certificate-${job.order_number}.pdf"`,
  );
  renderCertificate(job, res);
}

module.exports = { list, assign, my, detail, setCrew, start, checklist, photos, verifySerial, complete, certificate };
