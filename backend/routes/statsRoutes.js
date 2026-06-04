const express = require('express');
const router = express.Router();
const { getLiveStats } = require('../controllers/statsController');

// Public route for landing page stats
router.get('/live', getLiveStats);

module.exports = router;