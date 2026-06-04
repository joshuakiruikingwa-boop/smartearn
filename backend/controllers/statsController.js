const { pool } = require('../config/db');

// @desc    Get public platform statistics
// @route   GET /api/stats/live
// @access  Public
const getLiveStats = async (req, res) => {
    try {
        const userCount = await pool.query('SELECT COUNT(*) FROM users');
        const totalPayouts = await pool.query("SELECT SUM(amount) FROM withdrawal_requests WHERE status = 'completed'");
        const tasksDone = await pool.query('SELECT COUNT(*) FROM user_tasks');

        res.status(200).json({
            totalUsers: parseInt(userCount.rows[0].count || 0) + 12000, // Marketing offset
            totalPaidOut: parseFloat(totalPayouts.rows[0].sum || 0) + 85000,
            activeTasks: parseInt(tasksDone.rows[0].count || 0) + 45000
        });
    } catch (error) {
        console.error('Stats Error:', error);
        res.status(500).json({ message: 'Error fetching stats: ' + error.message });
    }
};

module.exports = { getLiveStats };