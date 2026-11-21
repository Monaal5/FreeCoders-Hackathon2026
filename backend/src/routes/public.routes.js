const { Router } = require('express');
const leads = require('../controllers/leads.controller');
const orders = require('../controllers/orders.controller');
const { portalGuard } = require('../middleware/portalGuard');

const router = Router();

// Public website enquiry form – no auth
router.post('/enquiries', leads.createEnquiry);

// Public customer tracking portal – no login, but every call must carry
// { phoneLast4 } in the JSON body (last 4 digits of the phone on the order).
// POST (not GET) so the digits never end up in URLs, browser history or server logs.
router.post('/portal/:orderNumber', portalGuard, orders.publicPortal);
router.post('/portal/:orderNumber/feedback', portalGuard, orders.publicFeedback);
router.post('/portal/:orderNumber/quote-pdf', portalGuard, orders.publicQuotePdf);
router.post('/portal/:orderNumber/certificate', portalGuard, orders.publicCertificate);

module.exports = router;
