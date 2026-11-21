const { Router } = require('express');
const ctrl = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth');

const router = Router();

router.post('/login', ctrl.login);
router.get('/me', authenticate, ctrl.me); // extra: lets the frontend restore a session from a stored token

module.exports = router;
