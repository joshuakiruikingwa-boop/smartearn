const express = require('express');
const router = express.Router();
const { registerUser, loginUser, getPublicSettings, getReferrerInfo } = require('../controllers/authController');

// Authentication Routes
router.post('/register', registerUser);
router.post('/login', loginUser);

router.get('/settings', getPublicSettings);
router.get('/referrer', getReferrerInfo);

module.exports = router;