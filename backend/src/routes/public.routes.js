const { Router } = require('express');
const leads = require('../controllers/leads.controller');
const orders = require('../controllers/orders.controller');

const router = Router();

// Public website enquiry form – no auth
router.post('/enquiries', leads.createEnquiry);

// Public customer tracking portal – no auth
router.get('/portal/:orderNumber', orders.publicPortal);
router.post('/portal/:orderNumber/feedback', orders.publicFeedback);

module.exports = router;
