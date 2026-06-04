const Membership = require('../models/Membership');
const User = require('../models/User');
const Transaction = require('../models/Transaction');

// @desc    Get all membership plans
// @route   GET /api/membership/plans
// @access  Public
const getMembershipPlans = async (req, res) => {
    try {
        const plans = await Membership.findAll();
        res.status(200).json(plans);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Upgrade user membership
// @route   POST /api/membership/upgrade
// @access  Private
const upgradeMembership = async (req, res) => {
    const { membershipId } = req.body;
    const userId = req.user.id; // From authMiddleware

    try {
        const newMembership = await Membership.findById(membershipId);
        if (!newMembership) {
            return res.status(404).json({ message: 'Membership plan not found' });
        }
        // Implement payment logic here (e.g., deduct from balance or external payment gateway)
        await User.updateMembership(userId, membershipId);
        await Transaction.create({ userId, type: 'membership_payment', amount: -newMembership.price, description: `Upgraded to ${newMembership.name} plan` });
        res.status(200).json({ message: `Membership upgraded to ${newMembership.name}` });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = { getMembershipPlans, upgradeMembership };