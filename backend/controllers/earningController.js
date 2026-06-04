const Transaction = require('../models/Transaction');
const User = require('../models/User');

// @desc    Get earnings summary and history for the user
// @route   GET /api/earnings/summary
// @access  Private
const getEarningsSummary = async (req, res) => {
    try {
        const userId = req.user.id;
        const transactions = await Transaction.findByUserId(userId);
        
        // Aggregate totals for the summary section
        const summary = transactions.reduce((acc, tx) => {
            const amount = parseFloat(tx.amount);
            if (tx.type === 'earning') acc.tasks += amount;
            if (tx.type === 'referral_commission') acc.referrals += amount;
            return acc;
        }, { tasks: 0, referrals: 0 });

        res.status(200).json({
            summary,
            history: transactions.slice(0, 20) // Send recent 20 transactions
        });
    } catch (error) {
        console.error('Error fetching earnings summary:', error);
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
};

module.exports = { getEarningsSummary };