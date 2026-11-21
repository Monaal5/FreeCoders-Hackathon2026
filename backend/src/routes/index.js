const { Router } = require('express');

const router = Router();

router.use('/auth', require('./auth.routes'));
router.use('/public', require('./public.routes'));
router.use('/leads', require('./leads.routes'));
router.use('/surveys', require('./surveys.routes'));
router.use('/users', require('./users.routes'));
router.use('/templates', require('./templates.routes'));
router.use('/quotes', require('./quotes.routes'));

module.exports = router;
