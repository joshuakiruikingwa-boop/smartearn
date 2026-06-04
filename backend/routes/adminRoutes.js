const express = require('express');
const path = require('path');
const jwt = require('jsonwebtoken');
const router = express.Router();
const auth = require('../authMiddleware'); // This is the general auth middleware
const { createSurvey, getSurveys, updateSurvey, deleteSurvey } = require('../controllers/adminController'); // Survey controller
const { getVideos, createVideo, updateVideo, deleteVideo } = require('../controllers/adminVideoController'); // Video controller
const { getUsers, updateUser, toggleUserStatus, activateUserManually } = require('../controllers/adminUserController'); // User controller
const { getDashboardStats, getWithdrawals, processWithdrawal, clearAllData } = require('../controllers/adminDashboardController');

const adminDir = path.join(__dirname, '..', '..', 'admin');

// Serve static admin pages from the 'admin' directory
router.use(express.static(adminDir));

// 1. Login Page Route
router.get('/login', (req, res) => {
    res.sendFile('adminlogin.html', { root: adminDir });
});

// 2. Login Action
router.post('/login', (req, res) => {
    const { username, password } = req.body;
    if (username === 'joshua' && password === 'joshua') {
        const token = jwt.sign({ userId: 'admin', role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '2h' });
        return res.json({ success: true, token });
    }
    res.status(401).json({ success: false, message: 'Invalid Admin Credentials' });
});

// 3. Dashboard Route (Served at /admin/)
router.get('/', (req, res) => {
    res.sendFile('admindashboard.html', { root: adminDir });
});

// 4. Protected API Endpoints
// Dashboard Statistics
router.get('/stats', auth, getDashboardStats);

// Surveys
router.get('/surveys', auth, getSurveys);
router.post('/surveys', auth, createSurvey); // Create new survey
router.put('/surveys/:id', auth, updateSurvey); // Update existing survey
router.delete('/surveys/:id', auth, deleteSurvey); // Delete survey

// Videos
router.get('/videos', auth, getVideos);
router.post('/videos', auth, createVideo);
router.put('/videos/:id', auth, updateVideo);
router.delete('/videos/:id', auth, deleteVideo);

// Users Management
router.get('/users', auth, getUsers);
router.put('/users/:id', auth, updateUser);
router.patch('/users/:id/status', auth, toggleUserStatus);
router.post('/users/:id/activate', auth, activateUserManually);

// Withdrawal Management
router.get('/withdrawals', auth, getWithdrawals);
router.patch('/withdrawals/:id', auth, processWithdrawal);

// System Reset
router.delete('/reset', auth, clearAllData);

module.exports = router;