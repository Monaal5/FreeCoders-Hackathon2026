const { Router } = require('express');
const users = require('../controllers/users.controller');
const { authenticate } = require('../middleware/auth');
const { authorize, ROLES } = require('../middleware/roles');

const router = Router();

router.get('/', authenticate, authorize(ROLES.ADMIN, ROLES.STAFF), users.list);

module.exports = router;
