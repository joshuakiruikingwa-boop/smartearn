const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../authMiddleware');

// Segments match the frontend array exactly
const REWARDS = [5.00, 10.00, 15.00, 20.00, 25.00, 30.00, 50.00, 80.00];

router.post('/spin', auth, async (req, res) => {
    const userId = req.user.id;

    try {
        // Cooldown check disabled for testing

        // 2. Determine Prize (Random index 0-7)
        // In production, you'd likely weight this so index 0 (Ksh 50) is rarer.
        const prizeIndex = Math.floor(Math.random() * REWARDS.length);
        const rewardAmount = REWARDS[prizeIndex];

        // 3. Update Database
        // Log activity
        await db.query(
            "INSERT INTO activity_log (user_id, activity_type, reward_amount) VALUES ($1, 'spin', $2)",
            [userId, rewardAmount]
        );

        // Update user balance
        if (rewardAmount > 0) {
            await db.query('UPDATE users SET balance = balance + $1 WHERE id = $2', [rewardAmount, userId]);
        }

        const userRes = await db.query('SELECT balance FROM users WHERE id = $1', [userId]);
        const newBalance = userRes.rows[0].balance;

        res.json({
            prizeIndex: prizeIndex,
            message: rewardAmount > 0 ? `Congratulations! You won Ksh ${rewardAmount.toFixed(2)}` : "Better luck next time!",
            reward: rewardAmount,
            newBalance: newBalance
        });

    } catch (err) {
        console.error('Spin Error:', err);
        res.status(500).json({ message: 'Server Error: ' + err.message });
    }
});

module.exports = router;