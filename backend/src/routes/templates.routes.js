const { Router } = require('express');
const templates = require('../controllers/templates.controller');
const { authenticate } = require('../middleware/auth');
const { authorize, ROLES } = require('../middleware/roles');

const router = Router();

router.get('/', authenticate, authorize(ROLES.ADMIN, ROLES.STAFF), templates.list);

module.exports = router;
