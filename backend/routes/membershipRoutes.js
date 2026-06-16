const express = require('express');
const router = express.Router();
const auth = require('../authMiddleware');
const { getMembershipPlans, upgradeMembership } = require('../controllers/membershipController');

// Public route to get all membership plans
router.get('/plans', getMembershipPlans);
// Protected route to upgrade membership
router.post('/upgrade', auth, upgradeMembership);

module.exports = router;