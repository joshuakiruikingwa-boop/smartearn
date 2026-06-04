const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/authMiddleware');
const { getMembershipPlans, upgradeMembership } = require('../controllers/membershipController');

// Public route to get all membership plans
router.get('/plans', getMembershipPlans);
// Protected route to upgrade membership
router.post('/upgrade', protect, upgradeMembership);

module.exports = router;