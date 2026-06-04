const Survey = require('../models/Survey');

// @desc    Get all surveys
// @route   GET /admin/surveys
// @access  Private (Admin only)
const getSurveys = async (req, res) => {
    try {
        const surveys = await Survey.findAll();
        res.status(200).json({ success: true, surveys });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error: ' + error.message });
    }
};

// @desc    Create a new survey
// @route   POST /admin/surveys
// @access  Private (Admin only - needs role check)
const createSurvey = async (req, res) => {
    const { title, description, reward, duration_minutes, questions, status } = req.body;

    // Basic validation
    if (!title || !reward || !duration_minutes || !questions || questions.length === 0) {
        return res.status(400).json({ success: false, message: 'Please provide title, reward, duration, and at least one question.' });
    }

    // Validate questions structure (basic check for array of objects)
    if (!Array.isArray(questions) || !questions.every(q => q.questionText && Array.isArray(q.options) && typeof q.correctOptionIndex === 'number')) {
        return res.status(400).json({ success: false, message: 'Invalid questions format. Each question must have questionText, options (array), and correctOptionIndex (number).' });
    }

    try {
        const newSurvey = await Survey.create({
            title,
            description,
            reward,
            duration_minutes,
            questions,
            status: status || 'draft' // Default to draft if not provided
        });
        res.status(201).json({ success: true, message: 'Survey created successfully!', survey: newSurvey });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error: ' + error.message });
    }
};

// @desc    Update an existing survey
// @route   PUT /admin/surveys/:id
// @access  Private (Admin only)
const updateSurvey = async (req, res) => {
    const { id } = req.params;
    const { title, description, reward, duration_minutes, questions, status } = req.body;

    // Basic validation
    if (!title || !reward || !duration_minutes || !questions || questions.length === 0) {
        return res.status(400).json({ success: false, message: 'Please provide title, reward, duration, and at least one question.' });
    }

    // Validate questions structure
    if (!Array.isArray(questions) || !questions.every(q => q.questionText && Array.isArray(q.options) && typeof q.correctOptionIndex === 'number')) {
        return res.status(400).json({ success: false, message: 'Invalid questions format. Each question must have questionText, options (array), and correctOptionIndex (number).' });
    }

    try {
        const updatedSurvey = await Survey.findByIdAndUpdate(
            id,
            { title, description, reward, questions, duration_minutes, status }
        );

        if (!updatedSurvey) {
            return res.status(404).json({ success: false, message: 'Survey not found' });
        }

        res.status(200).json({ success: true, message: 'Survey updated successfully!', survey: updatedSurvey });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error: ' + error.message });
    }
};

// @desc    Delete a survey
// @route   DELETE /admin/surveys/:id
// @access  Private (Admin only)
const deleteSurvey = async (req, res) => {
    const { id } = req.params;

    try {
        const deletedSurvey = await Survey.findByIdAndDelete(id);

        if (!deletedSurvey) {
            return res.status(404).json({ success: false, message: 'Survey not found' });
        }

        res.status(200).json({ success: true, message: 'Survey deleted successfully!' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error: ' + error.message });
    }
};

module.exports = { createSurvey, getSurveys, updateSurvey, deleteSurvey };