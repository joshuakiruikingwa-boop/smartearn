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
        res.status(200).json(videos);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get available surveys
// @route   GET /api/tasks/surveys
// @access  Private
const getSurveys = async (req, res) => {
    try {
        const surveys = await Survey.findAll();
        res.status(200).json(surveys);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Record task completion (video, survey, spin)
// @route   POST /api/tasks/complete
// @access  Private
const completeTask = async (req, res) => {
    const { taskType, taskId, rewardAmount } = req.body;
    const userId = req.user.id; // From authMiddleware

    try {
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: 'User not found' });

        // Daily limit check disabled

        // Calculate actual reward based on membership multiplier
        const multiplier = parseFloat(user.earning_multiplier || 1.0);
        const finalReward = rewardAmount * multiplier;

        const userTask = await UserTask.create({ userId, taskType, taskId, rewardAmount: finalReward });
        await pool.query('UPDATE users SET balance = balance + $1 WHERE id = $2', [finalReward, userId]);

        // Increment view count if the task is a video or platform-specific task
        if (['video', 'youtube', 'tiktok'].includes(taskType.toLowerCase())) {
            await pool.query('UPDATE videos SET views = views + 1 WHERE id = $1', [taskId]);
        }

        await Transaction.create({ userId, type: 'earning', amount: finalReward, description: `${taskType} completion (${multiplier}x multiplier)` });

        // Handle 3-Tier Referral Commissions
        const commissionTiers = [0.10, 0.05, 0.02]; // 10%, 5%, 2%
        let currentReferrerCode = user.referred_by;

        for (let i = 0; i < commissionTiers.length; i++) {
            if (!currentReferrerCode) break;

            const refRes = await pool.query(
                'SELECT id, full_name, referred_by FROM users WHERE referral_code = $1',
                [currentReferrerCode]
            );

            if (refRes.rows.length === 0) break;
            const referrer = refRes.rows[0];

            const commission = finalReward * commissionTiers[i];
            await pool.query('UPDATE users SET balance = balance + $1 WHERE id = $2', [commission, referrer.id]);
            await Transaction.create({
                userId: referrer.id,
                type: 'referral_commission',
                amount: commission,
                description: `L${i + 1} commission from ${user.full_name}'s ${taskType}`
            });

            currentReferrerCode = referrer.referred_by;
        }

        res.status(200).json({ message: 'Task completed and reward credited!', userTask });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Process Lucky Spin
// @route   POST /api/tasks/spin
// @access  Private
const handleSpin = async (req, res) => {
    const userId = req.user.id;

    try {
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

        await UserTask.create({ userId, taskType: 'spin', taskId: 0, rewardAmount: finalPrize });
        
        if (finalPrize > 0) {
            await pool.query('UPDATE users SET balance = balance + $1 WHERE id = $2', [finalPrize, userId]);
            await Transaction.create({ 
                userId, 
                type: 'earning', 
                amount: finalPrize, 
                description: `Lucky Spin Win` 
            });
        }

        res.status(200).json({ 
            prize: finalPrize, 
            prizeIndex, 
            message: finalPrize > 0 ? `You won Ksh ${finalPrize}!` : "Better luck next time!" 
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = { getVideos, getSurveys, completeTask, handleSpin };