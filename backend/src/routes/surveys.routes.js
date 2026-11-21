const { Router } = require('express');
const surveys = require('../controllers/surveys.controller');
const { authenticate } = require('../middleware/auth');
const { authorize, ROLES } = require('../middleware/roles');
const { surveyPhotos } = require('../middleware/upload');

const router = Router();

router.use(authenticate);

router.get('/my', authorize(ROLES.TECHNICIAN), surveys.mine);
router.patch('/:id/submit', authorize(ROLES.TECHNICIAN), surveyPhotos, surveys.submit);
router.patch('/:id/review', authorize(ROLES.ADMIN), surveys.review);

module.exports = router;
