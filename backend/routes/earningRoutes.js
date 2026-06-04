const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/authMiddleware');
const { getEarningsSummary } = require('../controllers/earningController');

// All earning routes are protected
router.use(protect);

router.get('/summary', getEarningsSummary);

module.exports = router;