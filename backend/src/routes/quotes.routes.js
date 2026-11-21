const { Router } = require('express');
const quotes = require('../controllers/quotes.controller');
const { authenticate } = require('../middleware/auth');
const { authorize, ROLES } = require('../middleware/roles');

const router = Router();

router.use(authenticate, authorize(ROLES.ADMIN, ROLES.STAFF));

router.get('/:id', quotes.detail);
router.get('/:id/pdf', quotes.pdf);
router.patch('/:id/status', quotes.updateStatus);

module.exports = router;
