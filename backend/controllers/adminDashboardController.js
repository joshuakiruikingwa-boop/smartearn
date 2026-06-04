const { pool } = require('../config/db');

// @desc    Get summary statistics for admin dashboard
exports.getDashboardStats = async (req, res) => {
    try {
        const stats = await pool.query(`
            SELECT 
                (SELECT COUNT(*) FROM users) as total_users,
                (SELECT COUNT(*) FROM users WHERE is_active = true) as active_users,
                (SELECT SUM(balance) FROM users) as total_liability,
                (SELECT SUM(amount + COALESCE(processing_fee, 0)) FROM withdrawal_requests WHERE LOWER(status) = 'pending') as pending_payouts,
                (SELECT SUM(amount) FROM withdrawal_requests WHERE LOWER(status) = 'completed') as total_paid
        `);

        res.json({
            success: true,
            stats: {
                totalUsers: parseInt(stats.rows[0].total_users || 0),
                activeUsers: parseInt(stats.rows[0].active_users || 0),
                totalLiability: parseFloat(stats.rows[0].total_liability || 0).toFixed(2),
                pendingWithdrawals: parseFloat(stats.rows[0].pending_payouts || 0).toFixed(2),
                totalPaid: parseFloat(stats.rows[0].total_paid || 0).toFixed(2)
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get all withdrawal requests with user details
exports.getWithdrawals = async (req, res) => {
    try {
        const withdrawals = await pool.query(`
            SELECT w.*, u.full_name, u.username, u.email, u.phone_number, u.balance as user_balance
            FROM withdrawal_requests w
            LEFT JOIN users u ON w.user_id = u.id
            ORDER BY w.created_at DESC
        `);
        res.json({ success: true, withdrawals: withdrawals.rows });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Approve (complete) or Reject withdrawal
exports.processWithdrawal = async (req, res) => {
    const { id } = req.params;
    const { status, transaction_ref, admin_note } = req.body; // 'completed' or 'rejected'

    if (!['completed', 'rejected'].includes(status)) {
        return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    try {
        await pool.query('BEGIN');

        const wRes = await pool.query('SELECT * FROM withdrawal_requests WHERE id = $1', [id]);
        if (wRes.rows.length === 0) throw new Error('Withdrawal request not found');
        
        const withdrawal = wRes.rows[0];
        if (withdrawal.status !== 'pending') throw new Error('Withdrawal already processed');

        // If rejecting, refund the full amount (including fee) back to the user
        if (status === 'rejected') {
            const refundAmount = parseFloat(withdrawal.amount) + parseFloat(withdrawal.processing_fee || 0);
            await pool.query('UPDATE users SET balance = balance + $1 WHERE id = $2', [refundAmount, withdrawal.user_id]);
        }

        // Update withdrawal record
        await pool.query(
            'UPDATE withdrawal_requests SET status = $1, transaction_ref = $2, admin_note = $3 WHERE id = $4',
            [status, transaction_ref || null, admin_note || null, id]
        );

        await pool.query('COMMIT');
        res.json({ success: true, message: `Withdrawal marked as ${status}` });
    } catch (error) {
        await pool.query('ROLLBACK');
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Reset platform (Delete all users and records)
exports.clearAllData = async (req, res) => {
    try {
        // Using TRUNCATE with CASCADE to clear users and all related activity/transaction tables
        // RESTART IDENTITY resets the auto-incrementing IDs back to 1
        await pool.query('TRUNCATE TABLE transactions, user_tasks, withdrawal_requests, activity_log, users RESTART IDENTITY CASCADE');
        res.json({ success: true, message: 'System reset successful. All users and data cleared.' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get system settings (like activation fee)
exports.getSettings = async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM settings');
        const settings = {};
        result.rows.forEach(row => { settings[row.setting_key] = row.setting_value; });
        res.json({ success: true, settings });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Update a specific system setting
exports.updateSetting = async (req, res) => {
    const { key, value } = req.body;
    try {
        await pool.query('INSERT INTO settings (setting_key, setting_value) VALUES ($1, $2) ON CONFLICT (setting_key) DO UPDATE SET setting_value = $2', [key, value.toString()]);
        res.json({ success: true, message: `${key} updated to ${value}` });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};