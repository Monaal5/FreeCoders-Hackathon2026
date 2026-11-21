const { Router } = require('express');
const orders = require('../controllers/orders.controller');
const { authenticate } = require('../middleware/auth');
const { authorize, ROLES } = require('../middleware/roles');

const router = Router();
const office = authorize(ROLES.ADMIN, ROLES.STAFF);

router.use(authenticate);

// Financial & Profitability analytics for office
router.get('/revenue-analytics', office, orders.revenueAnalytics);

router.get('/', office, orders.list);
// technicians may open an order only when they are its crew lead (checked in the service)
router.get('/:id', authorize(ROLES.ADMIN, ROLES.STAFF, ROLES.TECHNICIAN), orders.detail);
router.get('/:id/pick-list', office, orders.pickList);
router.post('/:id/payments', office, orders.pay);
router.post('/:id/scan', office, orders.scan);
router.delete('/:id/scan/:serialNumber', office, orders.unscan);
router.post('/:id/dispatch', office, orders.dispatch);
// the crew lead (technician) can confirm delivery at site
router.post('/:id/deliver', authorize(ROLES.ADMIN, ROLES.STAFF, ROLES.TECHNICIAN), orders.deliver);

module.exports = router;
