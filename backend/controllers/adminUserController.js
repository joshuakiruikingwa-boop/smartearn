const User = require('../models/User');
const { activateUser } = require('./authController');

// @desc    Get all users
// @route   GET /admin/users
// @access  Private (Admin)
exports.getUsers = async (req, res) => {
    try {
        const users = await User.findAll();
        res.status(200).json({ success: true, users });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error: ' + error.message });
    }
};

// @desc    Manually activate a user (triggered by admin)
// @route   POST /admin/users/:id/activate
exports.activateUserManually = async (req, res) => {
    try {
        // Leverage the activation logic from authController to distribute commissions
        await activateUser({ body: { userId: req.params.id } }, {
            status: (code) => ({ json: (data) => res.status(code).json(data) }),
            json: (data) => res.json(data)
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error: ' + error.message });
    }
};

// @desc    Update user details
// @route   PUT /admin/users/:id
// @access  Private (Admin)
exports.updateUser = async (req, res) => {
    const { id } = req.params;
    const { balance, status } = req.body;

    try {
        const updatedUser = await User.update(id, { 
            balance: parseFloat(balance), 
            status 
        });

        if (!updatedUser) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        res.status(200).json({ success: true, message: 'User updated successfully', user: updatedUser });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error: ' + error.message });
    }
};

// @desc    Toggle user suspension
// @route   PATCH /admin/users/:id/status
// @access  Private (Admin)
exports.toggleUserStatus = async (req, res) => {
    const { id } = req.params;

    try {
        const result = await User.toggleStatus(id);

        if (!result) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        res.status(200).json({ 
            success: true, 
            message: `User status changed to ${result.status}`, 
            status: result.status 
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error: ' + error.message });
    }
};