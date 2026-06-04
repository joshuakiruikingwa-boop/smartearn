const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/authMiddleware');
const { requestWithdrawal } = require('../controllers/walletController');

// Protect all routes in this router
router.post('/withdraw', protect, requestWithdrawal);

module.exports = router;