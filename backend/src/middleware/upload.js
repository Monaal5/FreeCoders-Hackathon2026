// Survey photo uploads: Multer -> backend/uploads/surveys/, served publicly at /uploads/surveys/<file>
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const multer = require('multer');
const AppError = require('../utils/AppError');

const UPLOAD_ROOT = path.resolve(__dirname, '..', '..', 'uploads');
const SURVEY_DIR = path.join(UPLOAD_ROOT, 'surveys');
fs.mkdirSync(SURVEY_DIR, { recursive: true });

const ALLOWED = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/heic': '.heic' };
const MAX_PHOTOS = 8;
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB each

const storage = multer.diskStorage({
  destination: SURVEY_DIR,
  // random name: never trust the client's filename (path traversal / overwrites)
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ALLOWED[file.mimetype]}`),
});

const surveyPhotos = multer({
  storage,
  limits: { fileSize: MAX_SIZE, files: MAX_PHOTOS },
  fileFilter: (_req, file, cb) =>
    ALLOWED[file.mimetype]
      ? cb(null, true)
      : cb(AppError.badRequest(`Unsupported file type ${file.mimetype}. Use JPG, PNG, WEBP or HEIC`, { field: 'photos' })),
}).array('photos', MAX_PHOTOS);

/** Public URL path stored in DB, e.g. /uploads/surveys/1732-ab12.jpg */
const toPublicPath = (file) => `/uploads/surveys/${file.filename}`;

/** Delete uploaded files when the DB work fails, so we do not leave orphans. */
function removeFiles(files = []) {
  for (const f of files) fs.promises.unlink(f.path).catch(() => {});
}

module.exports = { UPLOAD_ROOT, surveyPhotos, toPublicPath, removeFiles, MAX_PHOTOS };
