const { Router } = require('express');
const jobs = require('../controllers/jobs.controller');
const { authenticate } = require('../middleware/auth');
const { authorize, ROLES } = require('../middleware/roles');

const router = Router();

router.use(authenticate);

// technicians see only the jobs where they are crew lead (filtered in the service)
router.get('/', authorize(ROLES.ADMIN, ROLES.STAFF, ROLES.TECHNICIAN), jobs.list);
router.patch('/:id/assign', authorize(ROLES.ADMIN, ROLES.STAFF), jobs.assign);
// crew lead (technician) or staff can mark installation completed
router.post('/:id/complete', authorize(ROLES.ADMIN, ROLES.STAFF, ROLES.TECHNICIAN), jobs.complete);

module.exports = router;
