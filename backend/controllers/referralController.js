const User = require('../models/User');
const Transaction = require('../models/Transaction');
const { pool } = require('../config/db');

// @desc    Get user's referral network and earnings
// @route   GET /api/referrals/network
// @access  Private
const getReferralNetwork = async (req, res) => {
    const userId = req.user.id; // From authMiddleware

    try {
        // This is a simplified example. A real implementation would involve
        // complex queries to build the 3-tier network and calculate commissions.
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Fetch direct referrals (Level 1)
        const level1Referrals = await pool.query('SELECT id, full_name, created_at FROM users WHERE referred_by = $1', [userId]);

        // Placeholder for more complex logic to fetch Level 2 and Level 3
        // and calculate commissions based on user activities (transactions)

        res.status(200).json({
            referralCode: user.referral_code,
            level1: level1Referrals.rows,
            // Add level2, level3, and commission summaries here
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = { getReferralNetwork };