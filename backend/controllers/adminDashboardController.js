const { pool } = require('../config/db');
const { activateUser } = require('./authController');

// @desc    Get summary statistics for admin dashboard
exports.getDashboardStats = async (req, res) => {
    try {
        const stats = await pool.query(`
            SELECT 
                COUNT(*)::int as total_users,
                SUM(CASE WHEN is_active = true THEN 1 ELSE 0 END)::int as active_users,
                COALESCE(SUM(balance), 0)::float as total_liability,
                (SELECT COALESCE(SUM(amount + COALESCE(processing_fee, 0)), 0) FROM withdrawal_requests WHERE LOWER(status) = 'pending') as pending_payouts,
                (SELECT COUNT(*) FROM withdrawal_requests WHERE LOWER(status) = 'pending')::int as pending_count,
                -- Site Revenue should typically be money coming IN (e.g., activation fees)
                (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE type = 'activation_fee' AND status = 'completed')::float as total_paid
            FROM users
        `);

        // Fetch recent spin tasks specifically for the logs
        const recentSpins = await pool.query(`
            SELECT t.*, u.username 
            FROM user_tasks t 
            LEFT JOIN users u ON t.user_id = u.id 
            WHERE t.task_type = 'spin' 
            ORDER BY t.created_at DESC 
            LIMIT 50
        `);

        // Fetch recent activation payments (Site Revenue)
        const recentPayments = await pool.query(`
            SELECT t.*, u.full_name, u.username, u.email
            FROM transactions t
            LEFT JOIN users u ON t.user_id = u.id
            WHERE t.type = 'activation_fee' AND t.status = 'completed'
            ORDER BY t.created_at DESC
            LIMIT 10
        `);

        res.json({
            success: true,
            stats: {
                totalUsers: parseInt(stats.rows[0].total_users || 0),
                activeUsers: parseInt(stats.rows[0].active_users || 0),
                totalLiability: parseFloat(stats.rows[0].total_liability || 0).toFixed(2),
                pendingWithdrawals: parseFloat(stats.rows[0].pending_payouts || 0).toFixed(2),
                totalPaid: parseFloat(stats.rows[0].total_paid || 0).toFixed(2),
                pendingCount: parseInt(stats.rows[0].pending_count || 0)
            },
            recent_spins: recentSpins.rows,
            recent_payments: recentPayments.rows
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

// @desc    Get all transactions (for managing user wallets/payments)
exports.getPayments = async (req, res) => {
    const { type, status, userId } = req.query;
    try {
        let query = `
            SELECT t.*, u.full_name, u.username, u.email, u.phone_number, u.balance as user_balance
            FROM transactions t
            LEFT JOIN users u ON t.user_id = u.id
            WHERE 1=1
        `;
        const params = [];
        
        if (type) { params.push(type); query += ` AND t.type = $${params.length}`; }
        if (status) { params.push(status); query += ` AND t.status = $${params.length}`; }
        if (userId) { params.push(userId); query += ` AND t.user_id = $${params.length}`; }

        query += ` ORDER BY t.created_at DESC`;

        const payments = await pool.query(query, params);
        res.json({ success: true, payments: payments.rows });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Update a transaction status (e.g., confirming a manual payment)
exports.updateTransactionStatus = async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const txRes = await client.query('SELECT * FROM transactions WHERE id = $1', [id]);
        if (txRes.rows.length === 0) throw new Error('Transaction not found');
        const transaction = txRes.rows[0];

        // Update transaction status
        await client.query('UPDATE transactions SET status = $1 WHERE id = $2', [status, id]);

        // If manually confirming an activation fee, trigger user activation flow
        if (transaction.type === 'activation_fee' && status === 'completed') {
            await activateUser({ body: { userId: transaction.user_id } }, {
                status: () => ({ json: () => {} }),
                json: () => {}
            });
        }

        await client.query('COMMIT');
        res.json({ success: true, message: `Transaction marked as ${status}` });
    } catch (error) {
        await client.query('ROLLBACK');
        res.status(500).json({ success: false, message: error.message });
    } finally {
        client.release();
    }
};

// @desc    Approve (complete) or Reject withdrawal
exports.processWithdrawal = async (req, res) => {
    const { id } = req.params;
    const { status, transaction_ref, admin_note } = req.body; // 'completed' or 'rejected'

    if (!['completed', 'rejected'].includes(status)) {
        return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const wRes = await client.query('SELECT * FROM withdrawal_requests WHERE id = $1', [id]);
        if (wRes.rows.length === 0) throw new Error('Withdrawal request not found');
        
        const withdrawal = wRes.rows[0];
        if (withdrawal.status !== 'pending') throw new Error('Withdrawal already processed');

        // If rejecting, refund the full amount (including fee) back to the user
        if (status === 'rejected') {
            const refundAmount = parseFloat(withdrawal.amount) + parseFloat(withdrawal.processing_fee || 0);
            await client.query('UPDATE users SET balance = balance + $1 WHERE id = $2', [refundAmount, withdrawal.user_id]);
        }

        // Update withdrawal record
        await client.query(
            'UPDATE withdrawal_requests SET status = $1, transaction_ref = $2, admin_note = $3 WHERE id = $4',
            [status, transaction_ref || null, admin_note || null, id]
        );

        // Sync with transactions table so user's history is updated
        const transactionStatus = status === 'completed' ? 'completed' : 'failed';
        const grossAmount = parseFloat(withdrawal.amount) + parseFloat(withdrawal.processing_fee || 0);
        
        await client.query(
            "UPDATE transactions SET status = $1 WHERE user_id = $2 AND type = 'withdrawal' AND status = 'pending' AND ABS(amount + $3) < 0.01",
            [transactionStatus, withdrawal.user_id, grossAmount]
        );

        // If completed, increment the user's lifetime total_withdrawals
        if (status === 'completed') {
            await client.query('UPDATE users SET total_withdrawals = total_withdrawals + $1 WHERE id = $2', [withdrawal.amount, withdrawal.user_id]);
        }

        await client.query('COMMIT');
        res.json({ success: true, message: `Withdrawal marked as ${status}` });
    } catch (error) {
        await client.query('ROLLBACK');
        res.status(500).json({ success: false, message: error.message });
    } finally {
        client.release();
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