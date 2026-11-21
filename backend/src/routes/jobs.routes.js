const { Router } = require('express');
const jobs = require('../controllers/jobs.controller');
const { authenticate } = require('../middleware/auth');
const { authorize, ROLES } = require('../middleware/roles');
const { jobPhotos } = require('../middleware/upload');

const router = Router();
const everyone = authorize(ROLES.ADMIN, ROLES.STAFF, ROLES.TECHNICIAN);
const office = authorize(ROLES.ADMIN, ROLES.STAFF);
// crew / crew-lead / admin rules are checked per job in installation.service (403 or 404)
const field = authorize(ROLES.ADMIN, ROLES.TECHNICIAN);

router.use(authenticate);

// office: schedule + assignment (Phase 2)
router.get('/', everyone, jobs.list);
router.patch('/:id/assign', office, jobs.assign);

// on the roof (Phase 3) – /my must come before /:id
router.get('/my', authorize(ROLES.TECHNICIAN), jobs.my);
router.get('/:id', everyone, jobs.detail);
router.put('/:id/crew', office, jobs.setCrew);
router.post('/:id/start', field, jobs.start);
router.patch('/:id/checklist', field, jobs.checklist);
router.post('/:id/photos', field, jobPhotos, jobs.photos);
router.post('/:id/serials/verify', field, jobs.verifySerial);
router.post('/:id/complete', field, jobs.complete);
router.get('/:id/certificate', everyone, jobs.certificate);

module.exports = router;
