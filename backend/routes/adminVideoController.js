const Video = require('../models/Video');

// Helper to extract YouTube ID from a URL
const extractYoutubeId = (url) => {
    const regExp = /^.*(?:(?:youtu\.be\/|v\/|vi\/|u\/\w\/|embed\/|shorts\/)|(?:(?:watch)?\?v(?:i)?=|\&v(?:i)?=))([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[1].length === 11) ? match[1] : url;
};

// @desc    Get all video tasks
// @route   GET /admin/videos
// @access  Private (Admin only)
const getVideos = async (req, res) => {
    try {
        // Fix: Admin needs to see all videos to manage them. changed true -> false
        const videos = await Video.findAll(null, false); 
        res.status(200).json({ success: true, videos });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error: ' + error.message });
    }
};

// @desc    Create a new video task
// @route   POST /admin/videos
// @access  Private (Admin only)
const createVideo = async (req, res) => {
    let { title, platform, video_id, reward, duration_seconds, status } = req.body;

    // Basic validation
    if (!title || !platform || !video_id || !reward || !duration_seconds) {
        return res.status(400).json({ success: false, message: 'Please provide title, platform, video ID, reward, and duration.' });
    }

    // Sanitize platform and extract video ID if URL provided
    platform = platform.toLowerCase();
    if (platform === 'youtube') video_id = extractYoutubeId(video_id);

    try {
        const newVideo = await Video.create({
            title,
            platform,
            video_id,
            reward,
            duration_seconds,
            status: status || 'active' // Default to active so it shows for users immediately
        });
        res.status(201).json({ success: true, message: 'Video task created successfully!', video: newVideo });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error: ' + error.message });
    }
};

// @desc    Update an existing video task
// @route   PUT /admin/videos/:id
// @access  Private (Admin only)
const updateVideo = async (req, res) => {
    const { id } = req.params;
    let { title, platform, video_id, reward, duration_seconds, status } = req.body;

    // Basic validation
    if (!title || !platform || !video_id || !reward || !duration_seconds) {
        return res.status(400).json({ success: false, message: 'Please provide title, platform, video ID, reward, and duration.' });
    }

    platform = platform.toLowerCase();
    if (platform === 'youtube') video_id = extractYoutubeId(video_id);

    try {
        const updatedVideo = await Video.findByIdAndUpdate(
            id,
            { title, platform, video_id, reward, duration_seconds, status }
        );

        if (!updatedVideo) {
            return res.status(404).json({ success: false, message: 'Video task not found' });
        }

        res.status(200).json({ success: true, message: 'Video task updated successfully!', video: updatedVideo });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error: ' + error.message });
    }
};

// @desc    Delete a video task
// @route   DELETE /admin/videos/:id
// @access  Private (Admin only)
const deleteVideo = async (req, res) => {
    const { id } = req.params;

    try {
        const deletedVideo = await Video.findByIdAndDelete(id);

        if (!deletedVideo) {
            return res.status(404).json({ success: false, message: 'Video task not found' });
        }

        res.status(200).json({ success: true, message: 'Video task deleted successfully!' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error: ' + error.message });
    }
};

module.exports = {
    getVideos,
    createVideo,
    updateVideo,
    deleteVideo
};