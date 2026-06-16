const express = require('express');
const router = express.Router();
const auth = require('../authMiddleware');
const { getReferralNetwork } = require('../controllers/referralController');

// Protect all routes in this router
router.get('/network', auth, getReferralNetwork);

module.exports = router;