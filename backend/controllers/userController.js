const { pool } = require('../config/db');

// @desc    Get user profile data
// @route   GET /api/users/profile
// @access  Private
exports.getProfile = async (req, res) => {
    try {
        const userRes = await pool.query(
            `SELECT 
                id, full_name, username, email, phone_number, balance, referral_code, referred_by, 
                is_active, status, total_withdrawals, created_at,
                tiktok_balance, youtube_balance, surveys_balance, spin_balance, referrals_balance
            FROM users WHERE id = $1`,
            [req.user.id]
        );

        if (userRes.rows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        const user = userRes.rows[0];
        res.json(user);
    } catch (error) {
        console.error('Error fetching user profile:', error.message);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Get referral statistics and recent activity for the logged-in user
// @route   GET /api/users/referrals
// @access  Private
exports.getReferralStats = async (req, res) => {
    const userId = req.user.id;

    try {
        const userRes = await pool.query('SELECT referral_code FROM users WHERE id = $1', [userId]);
        if (userRes.rows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }
        const userReferralCode = userRes.rows[0].referral_code;

        // Fetch L1 referrals (direct recruits) and their active status
        const l1UsersRes = await pool.query(
            `SELECT id, referral_code, full_name, created_at, is_active FROM users WHERE referred_by = $1`,
            [userReferralCode]
        );
        const l1Users = l1UsersRes.rows;
        const l1Count = l1Users.filter(u => u.is_active).length;

        // Calculate L1 earned commission from transactions
        const l1EarnedRes = await pool.query(
            `SELECT COALESCE(SUM(amount), 0)::float as total_earned
             FROM transactions 
             WHERE user_id = $1 AND type = 'referral_commission' AND description LIKE 'L1 commission%'`,
            [userId]
        );
        const l1Earned = l1EarnedRes.rows[0].total_earned;

        // Fetch L2 referrals (referred by L1 users)
        const l1ReferralCodes = l1Users.map(u => u.referral_code).filter(Boolean);
        let l2Users = [];
        let l2Count = 0;
        let l2Earned = 0;
        if (l1ReferralCodes.length > 0) {
            const l2UsersRes = await pool.query(
                `SELECT id, referral_code, full_name, created_at, is_active FROM users WHERE referred_by = ANY($1::text[])`,
                [l1ReferralCodes]
            );
            l2Users = l2UsersRes.rows;
            l2Count = l2Users.filter(u => u.is_active).length;

            const l2EarnedRes = await pool.query(
                `SELECT COALESCE(SUM(amount), 0)::float as total_earned
                 FROM transactions 
                 WHERE user_id = $1 AND type = 'referral_commission' AND description LIKE 'L2 commission%'`,
                [userId]
            );
            l2Earned = l2EarnedRes.rows[0].total_earned;
        }

        // Fetch L3 referrals (referred by L2 users)
        const l2ReferralCodes = l2Users.map(u => u.referral_code).filter(Boolean);
        let l3Users = [];
        let l3Count = 0;
        let l3Earned = 0;
        if (l2ReferralCodes.length > 0) {
            const l3UsersRes = await pool.query(
                `SELECT id, full_name, created_at, is_active FROM users WHERE referred_by = ANY($1::text[])`,
                [l2ReferralCodes]
            );
            l3Users = l3UsersRes.rows;
            l3Count = l3Users.filter(u => u.is_active).length;

            const l3EarnedRes = await pool.query(
                `SELECT COALESCE(SUM(amount), 0)::float as total_earned
                 FROM transactions 
                 WHERE user_id = $1 AND type = 'referral_commission' AND description LIKE 'L3 commission%'`,
                [userId]
            );
            l3Earned = l3EarnedRes.rows[0].total_earned;
        }

        // Combine recent activity for the table
        const recentActivityRes = await pool.query(
            `SELECT 
                t.amount as commission, 
                ru.full_name, -- Referred user's full name
                ru.created_at, -- Referred user's join date
                ru.is_active, -- Referred user's active status
                CASE
                    WHEN t.description LIKE 'L1 commission%' THEN 'Level 1'
                    WHEN t.description LIKE 'L2 commission%' THEN 'Level 2'
                    WHEN t.description LIKE 'L3 commission%' THEN 'Level 3'
                    ELSE 'Unknown'
                END as level,
                CASE
                    WHEN ru.is_active = true THEN 'Active'
                    ELSE 'Pending'
                END as status
             FROM transactions t
             JOIN users ru ON t.referred_user_id = ru.id -- Join with referred user
             WHERE t.user_id = $1 AND t.type = 'referral_commission'
             ORDER BY t.created_at DESC
             LIMIT 10`, // Limit to recent 10 activities
            [userId]
        );

        res.json({
            success: true,
            summary: {
                l1_count: l1Count,
                l1_earned: l1Earned,
                l2_count: l2Count,
                l2_earned: l2Earned,
                l3_count: l3Count,
                l3_earned: l3Earned,
            },
            recent_activity: recentActivityRes.rows
        });

    } catch (error) {
        console.error('Error fetching referral stats:', error.message);
        res.status(500).json({ message: 'Server error' });
    }
};