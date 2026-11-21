const { Router } = require('express');
const leads = require('../controllers/leads.controller');

const router = Router();

// Public website enquiry form – no auth
router.post('/enquiries', leads.createEnquiry);

module.exports = router;
