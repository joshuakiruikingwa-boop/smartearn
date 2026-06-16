const express = require('express');
const router = express.Router();
const auth = require('../authMiddleware');
const { requestWithdrawal } = require('../controllers/walletController');

// Protect all routes in this router
router.post('/withdraw', auth, requestWithdrawal);

module.exports = router;