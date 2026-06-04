const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/authMiddleware');
const { getReferralNetwork } = require('../controllers/referralController');

// Protect all routes in this router
router.get('/network', protect, getReferralNetwork);

module.exports = router;