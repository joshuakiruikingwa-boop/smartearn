const express = require('express');
const router = express.Router();
const { pool } = require('../config/db'); // Use pool directly
const auth = require('../authMiddleware');

router.get('/profile', auth, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT 
                full_name, username, email, phone_number, 
                balance, profile_photo, is_active, status
             FROM users 
             WHERE id = $1`,
            [req.user.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ message: 'User not found' });
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server Error' });
    }
});

router.post('/update-photo', auth, async (req, res) => {
    const { profilePhoto } = req.body;
    try {
        await pool.query('UPDATE users SET profile_photo = $1 WHERE id = $2', [profilePhoto, req.user.id]);
        res.json({ message: 'Profile photo updated successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server Error' });
    }
});

router.get('/stats', auth, async (req, res) => {
    const userId = req.user.id;
    try {
        const result = await pool.query(`
            SELECT 
                TO_CHAR(days.day, 'Dy') as label,
                COALESCE(SUM(al.reward_amount), 0) as total,
                COUNT(al.id) as count
            FROM (
                SELECT generate_series(CURRENT_DATE - INTERVAL '6 days', CURRENT_DATE, '1 day')::date AS day
            ) days
            LEFT JOIN activity_log al ON days.day = al.created_at::date AND al.user_id = $1
            GROUP BY days.day
            ORDER BY days.day;
        `, [userId]);

        res.json({
            labels: result.rows.map(r => r.label),
            earnings: result.rows.map(r => parseFloat(r.total)),
            tasks: result.rows.map(r => parseInt(r.count))
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server Error' });
    }
});

module.exports = router;