const express = require('express');
const bundlesRoutes = require('../modules/bundles/routes');

const router = express.Router(); // eslint-disable-line new-cap

router.use('/bundles', bundlesRoutes);

module.exports = router;
