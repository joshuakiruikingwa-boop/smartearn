const { pool } = require('../config/db');
const Video = require('../models/Video');
const Survey = require('../models/Survey');
const UserTask = require('../models/UserTask');
const User = require('../models/User');
const Transaction = require('../models/Transaction');

// @desc    Get available videos for a platform
// @route   GET /api/tasks/videos/:platform
// @access  Private
const getVideos = async (req, res) => {
    const { platform } = req.params;
    try {
        const videos = await Video.findAll(platform);
        res.status(200).json({ success: true, videos });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get available surveys
// @route   GET /api/tasks/surveys
// @access  Private
const getSurveys = async (req, res) => {
    try {
        const surveys = await Survey.findAll();
        res.status(200).json({ success: true, surveys });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Record task completion (video, survey, spin)
// @route   POST /api/tasks/complete
// @access  Private
const completeTask = async (req, res) => {
    const { taskType, taskId } = req.body;
    const userId = req.user.id; // From authMiddleware

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: 'User not found' });

        // Limit survey rewards to once per day
        if (['survey', 'surveys'].includes(taskType.toLowerCase())) {
            const checkRes = await client.query(
                "SELECT id FROM user_tasks WHERE user_id = $1 AND LOWER(task_type) IN ('survey', 'surveys') AND created_at >= CURRENT_DATE",
                [userId]
            );
            if (checkRes.rows.length > 0) {
                return res.status(403).json({ success: false, message: 'You have already completed a survey today. Please try again tomorrow.' });
            }
        }

        let actualReward = 0;
        // Security: Fetch task details from DB to verify reward
        if (['youtube', 'tiktok', 'video'].includes(taskType.toLowerCase())) {
            const video = await Video.findById(taskId);
            if (!video || video.status !== 'active') throw new Error('Video task not found or inactive');
            actualReward = parseFloat(video.reward);
        } else if (['survey', 'surveys'].includes(taskType.toLowerCase())) {
            const survey = await Survey.findById(taskId);
            if (!survey || survey.status !== 'active') throw new Error('Survey not found or inactive');
            actualReward = parseFloat(survey.reward);
        } else {
            throw new Error('Invalid task type');
        }

        // Calculate actual reward based on membership multiplier
        const multiplier = parseFloat(user.earning_multiplier || 1.0);
        const finalReward = actualReward * multiplier;

        const taskRes = await client.query(
            'INSERT INTO user_tasks (user_id, task_type, task_id, reward_amount) VALUES ($1, $2, $3, $4) RETURNING *',
            [userId, taskType, taskId, finalReward]
        );
        const userTask = taskRes.rows[0];

        // Update specific wallet balance
        const walletMapping = {
            'youtube': 'youtube_balance',
            'tiktok': 'tiktok_balance',
            'surveys': 'surveys_balance',
            'survey': 'surveys_balance'
        };
        const specificWallet = walletMapping[taskType.toLowerCase()];
        const updateQuery = specificWallet 
            ? `UPDATE users SET balance = balance + $1, ${specificWallet} = ${specificWallet} + $1 WHERE id = $2`
            : 'UPDATE users SET balance = balance + $1 WHERE id = $2';

        await client.query(updateQuery, [finalReward, userId]);

        // Increment view count if the task is a video or platform-specific task
        if (['video', 'youtube', 'tiktok'].includes(taskType.toLowerCase())) {
            await client.query('UPDATE videos SET views = views + 1 WHERE id = $1', [taskId]);
        }

        await client.query(
            'INSERT INTO transactions (user_id, type, amount, description, status) VALUES ($1, $2, $3, $4, $5)',
            [userId, 'earning', finalReward, `${taskType} completion (${multiplier}x multiplier)`, 'completed']
        );

        // Handle 3-Tier Referral Commissions
        const commissionTiers = [0.10, 0.05, 0.02]; // 10%, 5%, 2%
        let currentReferrerCode = user.referred_by;

        for (let i = 0; i < commissionTiers.length; i++) {
            if (!currentReferrerCode) break;

            const refRes = await client.query(
                'SELECT id, full_name, referred_by FROM users WHERE referral_code = $1',
                [currentReferrerCode]
            );

            if (refRes.rows.length === 0) break;
            const referrer = refRes.rows[0];

            const commission = finalReward * commissionTiers[i];
            await client.query('UPDATE users SET balance = balance + $1, referrals_balance = referrals_balance + $1 WHERE id = $2', [commission, referrer.id]);
            
            await client.query(
                'INSERT INTO transactions (user_id, type, amount, description, status, referred_user_id) VALUES ($1, $2, $3, $4, $5, $6)',
                [referrer.id, 'referral_commission', commission, `L${i + 1} commission from ${user.full_name}'s ${taskType}`, 'completed', userId]
            );

            currentReferrerCode = referrer.referred_by;
        }

        await client.query('COMMIT');
        res.status(200).json({ message: 'Task completed and reward credited!', userTask });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Task Completion Error:', error.message);
        res.status(500).json({ success: false, message: error.message });
    } finally {
        client.release();
    }
};

// @desc    Process Lucky Spin
// @route   POST /api/tasks/spin
// @access  Private
const handleSpin = async (req, res) => {
    const userId = req.user.id;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: 'User not found' });

        // Cooldown check disabled

        // 2. Probability Logic (Aligned with Economy Settings)
        const rand = Math.random() * 100;
        let prize, prizeIndex;

        // Wheel Segments Mapping: 
        // 0: 5.00, 1: 0.05, 2: 0.50, 3: 0.10, 4: 1.00, 5: 0 (TRY AGAIN), 6: 0.20, 7: 0.01
        if (rand < 3) { // 3% Jackpot
            prize = 5.00; prizeIndex = 0;
        } else if (rand < 15) { // 12% Medium Wins
            const subRand = Math.random();
            prize = subRand > 0.5 ? 0.50 : 1.00;
            prizeIndex = subRand > 0.5 ? 2 : 4;
        } else { // 85% Small Wins
            const smallPrizes = [
                { v: 0.05, i: 1 }, { v: 0.10, i: 3 }, 
                { v: 0.00, i: 5 }, { v: 0.20, i: 6 }, { v: 0.01, i: 7 }
            ];
            const pick = smallPrizes[Math.floor(Math.random() * smallPrizes.length)];
            prize = pick.v; prizeIndex = pick.i;
        }

        // 3. Record Task and Update Balance
        // Removed multiplier to ensure user wins the exact amount shown on the wheel
        const finalPrize = prize;

        await client.query(
            'INSERT INTO user_tasks (user_id, task_type, task_id, reward_amount) VALUES ($1, $2, $3, $4)',
            [userId, 'spin', 0, finalPrize]
        );
        
        if (finalPrize > 0) {
            await client.query('UPDATE users SET balance = balance + $1, spin_balance = spin_balance + $1 WHERE id = $2', [finalPrize, userId]);
            await client.query(
                'INSERT INTO transactions (user_id, type, amount, description, status) VALUES ($1, $2, $3, $4, $5)',
                [userId, 'earning', finalPrize, 'Lucky Spin Win', 'completed']
            );
        }

        await client.query('COMMIT');
        res.status(200).json({ 
            success: true,
            prize: finalPrize,
            prizeIndex, 
            message: finalPrize > 0 ? `You won Ksh ${finalPrize}!` : "Better luck next time!" 
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Spin Error:', error.message);
        res.status(500).json({ success: false, message: error.message });
    } finally {
        client.release();
    }
};
module.exports = { getVideos, getSurveys, completeTask, handleSpin };