const { Router } = require('express');
const leads = require('../controllers/leads.controller');
const surveys = require('../controllers/surveys.controller');
const quotes = require('../controllers/quotes.controller');
const { authenticate } = require('../middleware/auth');
const { authorize, ROLES } = require('../middleware/roles');

const router = Router();

router.use(authenticate, authorize(ROLES.ADMIN, ROLES.STAFF));

router.get('/', leads.list);
router.post('/', leads.create);
router.get('/:id', leads.detail);
router.patch('/:id/qualify', leads.qualify);
router.patch('/:id/lost', leads.lost);

router.post('/:id/surveys', surveys.assign);
router.post('/:id/quotes', quotes.create);

module.exports = router;
