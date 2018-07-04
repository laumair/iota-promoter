const express = require('express');
const controllers = require('./controller');

const router = express.Router(); // eslint-disable-line new-cap

router.route('/:bundle').delete(controllers.removeBundle);
router.route('/:bundle').post(controllers.addBundle);
router.route('/').get(controllers.fetchBundles);
router.route('/:bundle').patch(controllers.increasePromotionCount);

module.exports = router;
