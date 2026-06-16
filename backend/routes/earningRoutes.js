const express = require('express');
const router = express.Router();
const auth = require('../authMiddleware');
const { getEarningsSummary } = require('../controllers/earningController');

// All earning routes are protected
router.use(auth);

router.get('/summary', getEarningsSummary);

module.exports = router;