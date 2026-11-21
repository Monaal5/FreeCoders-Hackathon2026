const { Router } = require('express');
const inventory = require('../controllers/inventory.controller');
const { authenticate } = require('../middleware/auth');
const { authorize, ROLES } = require('../middleware/roles');

const router = Router();

router.use(authenticate, authorize(ROLES.ADMIN, ROLES.STAFF));

router.get('/', inventory.list);
router.post('/receive', inventory.receive);
router.get('/serials', inventory.serials);
router.get('/movements', inventory.movements);

module.exports = router;
