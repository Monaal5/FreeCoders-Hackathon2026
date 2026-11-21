// Photo uploads (Multer) -> backend/uploads/<folder>/, served publicly at /uploads/<folder>/<file>
//   surveys/    – Phase 1 site-survey photos
//   jobs/       – Phase 3 installation photos (BEFORE / DURING / AFTER)
//   signatures/ – Phase 3 customer sign-off PNGs (written by the jobs service, not by Multer)
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const multer = require('multer');
const AppError = require('../utils/AppError');

const UPLOAD_ROOT = path.resolve(__dirname, '..', '..', 'uploads');
const SURVEY_DIR = path.join(UPLOAD_ROOT, 'surveys');
const JOB_DIR = path.join(UPLOAD_ROOT, 'jobs');
const SIGNATURE_DIR = path.join(UPLOAD_ROOT, 'signatures');
for (const dir of [SURVEY_DIR, JOB_DIR, SIGNATURE_DIR]) fs.mkdirSync(dir, { recursive: true });

const ALLOWED = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/heic': '.heic' };
const MAX_PHOTOS = 8;
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB each

const randomName = (ext) => `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;

/** Multer middleware for up to 8 images in the "photos" field, stored in `dir`. */
function imageUpload(dir) {
  return multer({
    storage: multer.diskStorage({
      destination: dir,
      // random name: never trust the client's filename (path traversal / overwrites)
      filename: (_req, file, cb) => cb(null, randomName(ALLOWED[file.mimetype])),
    }),
    limits: { fileSize: MAX_SIZE, files: MAX_PHOTOS },
    fileFilter: (_req, file, cb) =>
      ALLOWED[file.mimetype]
        ? cb(null, true)
        : cb(AppError.badRequest(`Unsupported file type ${file.mimetype}. Use JPG, PNG, WEBP or HEIC`, { field: 'photos' })),
  }).array('photos', MAX_PHOTOS);
}

const surveyPhotos = imageUpload(SURVEY_DIR);
const jobPhotos = imageUpload(JOB_DIR);

/** Public URL path stored in DB, e.g. /uploads/surveys/1732-ab12.jpg (works for any upload folder) */
const toPublicPath = (file) => `/uploads/${path.relative(UPLOAD_ROOT, file.path).split(path.sep).join('/')}`;

/** Absolute disk path for a stored public path – only inside uploads/, never outside it. */
function diskPathFor(publicPath) {
  const rel = String(publicPath || '').replace(/^\/uploads\//, '');
  const abs = path.resolve(UPLOAD_ROOT, rel);
  return abs.startsWith(UPLOAD_ROOT + path.sep) ? abs : null;
}

/** Delete uploaded files when the DB work fails, so we do not leave orphans. */
function removeFiles(files = []) {
  for (const f of files) fs.promises.unlink(f.path).catch(() => {});
}

module.exports = {
  UPLOAD_ROOT,
  SIGNATURE_DIR,
  surveyPhotos,
  jobPhotos,
  toPublicPath,
  diskPathFor,
  removeFiles,
  randomName,
  MAX_PHOTOS,
};
