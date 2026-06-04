const express = require('express');
const router = express.Router();
const auth = require('../authMiddleware');
const { getVideos, getSurveys, completeTask, handleSpin } = require('../controllers/taskController');

// Video tasks
router.get('/videos/:platform', auth, getVideos); // Fetches active videos for a specific platform

// Survey tasks
router.get('/surveys', auth, getSurveys); // Fetches available surveys

// Complete task (for videos, surveys, etc.)
router.post('/complete', auth, completeTask); // Records task completion and awards rewards

// Spin task
router.post('/spin', auth, handleSpin); // Handles the lucky spin logic

module.exports = router;