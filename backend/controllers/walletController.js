const WithdrawalRequest = require('../models/WithdrawalRequest');
const User = require('../models/User');
const Transaction = require('../models/Transaction');

// @desc    Request a withdrawal
// @route   POST /api/wallet/withdraw
// @access  Private
const requestWithdrawal = async (req, res) => {
    const { amount, method, payoutIdentifier } = req.body;
    const userId = req.user.id; // From authMiddleware

    if (!amount || !method || !payoutIdentifier) {
        return res.status(400).json({ message: 'Please enter all fields' });
    }

    try {
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (user.balance < amount) {
            return res.status(400).json({ message: 'Insufficient balance' });
        }

        // Implement processing fee logic here
        const processingFee = amount * 0.015; // 1.5% fee
        const netAmount = amount - processingFee;

        const withdrawal = await WithdrawalRequest.create({ userId, amount: netAmount, method, payoutIdentifier, processingFee });
        await User.updateBalance(userId, -amount); // Deduct full amount including fee
        await Transaction.create({ userId, type: 'withdrawal', amount: -amount, description: `Withdrawal request via ${method}`, status: 'pending' });

        res.status(201).json({ message: 'Withdrawal request submitted successfully', withdrawal });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = { requestWithdrawal };