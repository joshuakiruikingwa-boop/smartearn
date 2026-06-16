const { pool } = require('../config/db'); // Use destructuring to fix queries below
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

exports.registerUser = async (req, res) => {
    const { fullName, username, email, phoneNumber, password, referredBy } = req.body;

    try {
        // Check if user exists
        const userExists = await pool.query(
            'SELECT * FROM users WHERE email = $1 OR phone_number = $2 OR username = $3', 
            [email, phoneNumber, username]
        );

        if (userExists.rows.length > 0) {
            return res.status(400).json({ message: 'Username, Email, or Phone already taken.' });
        }

        // Validate referrer if provided to ensure the referral chain is valid from the start
        if (referredBy) {
            const referrerCheck = await pool.query('SELECT id FROM users WHERE referral_code = $1', [referredBy]);
            if (referrerCheck.rows.length === 0) {
                return res.status(400).json({ message: 'The referral code provided does not exist.' });
            }
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Using 3 bytes (6 characters) for the referral code to support a larger user base
        const userReferralCode = 'SM-' + crypto.randomBytes(3).toString('hex').toUpperCase();

        // Insert User
        const newUser = await pool.query(
            'INSERT INTO users (full_name, username, email, phone_number, password, referred_by, referral_code, balance, tiktok_balance, youtube_balance, surveys_balance, spin_balance, referrals_balance, total_withdrawals, is_active, status, membership_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, 0, 0, 0, 0, 0, $9, $10, $11) RETURNING id',
            [fullName, username, email, phoneNumber, hashedPassword, referredBy || null, userReferralCode, 0, false, 'active', 1]
        );

        const token = jwt.sign({ id: newUser.rows[0].id, email: email }, process.env.JWT_SECRET, { expiresIn: '1d' });
        res.status(201).json({ success: true, token, message: 'Registration successful' });
    } catch (err) {
        // This will print the specific PostgreSQL error to your terminal
        console.error("Registration Database Error:", err.message); 
        res.status(500).json({ message: err.message || 'Server error during registration' });
    }
};

/**
 * Activates a user and distributes 3-tier referral commissions.
 * This should be called by your Payment IPN handler (e.g., PesaPal callback)
 * upon successful verification of the Ksh 500 payment.
 */
exports.activateUser = async (req, res) => {
    const { userId } = req.body;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Verify user exists and isn't already active
        const userRes = await client.query(
            'SELECT id, referred_by, is_active FROM users WHERE id = $1',
            [userId]
        );

        if (userRes.rows.length === 0) {
            throw new Error('User not found');
        }

        const user = userRes.rows[0];
        if (user.is_active) {
            await client.query('COMMIT');
            return res.status(200).json({ message: 'User is already active' });
        }

        // 2. Mark user as active
        await client.query('UPDATE users SET is_active = true WHERE id = $1', [userId]);

        // Record the activation payment in transactions so it reflects in logs
        const settingsRes = await client.query("SELECT setting_value FROM settings WHERE setting_key = 'activation_fee'");
        const activationFee = settingsRes.rows.length > 0 ? parseFloat(settingsRes.rows[0].setting_value) : 20.00;
        await client.query(
            'INSERT INTO transactions (user_id, type, amount, description, status) VALUES ($1, $2, $3, $4, $5)',
            [userId, 'activation_fee', -activationFee, 'Account Activation Fee', 'completed']
        );

        await client.query(
            'INSERT INTO activity_log (user_id, activity_type, reward_amount) VALUES ($1, $2, $3)',
            [userId, 'account_activation', 0]
        );

        // 3. Distribute Commissions (3 Levels)
        const commissionRates = [0.10, 0.05, 0.02]; // Level 1: 10%, Level 2: 5%, Level 3: 2%
        let currentReferrerCode = user.referred_by;

        for (let i = 0; i < commissionRates.length; i++) {
            if (!currentReferrerCode) break;

            // Find the referrer by their code
            const refRes = await client.query(
                'SELECT id, referred_by, is_active FROM users WHERE referral_code = $1',
                [currentReferrerCode]
            );

            if (refRes.rows.length === 0) break;

            const referrer = refRes.rows[0];

            // Only distribute commission if the referrer has an active account.
            // If they are inactive, skip them and move to the next level.
            if (!referrer.is_active) {
                currentReferrerCode = referrer.referred_by;
                continue;
            }

            const reward = activationFee * commissionRates[i];

            // Credit referrer balance
            await client.query('UPDATE users SET balance = balance + $1, referrals_balance = referrals_balance + $1 WHERE id = $2', [reward, referrer.id]);

            // Log activity for the referrer
            await client.query(
                'INSERT INTO activity_log (user_id, activity_type, reward_amount) VALUES ($1, $2, $3)',
                [referrer.id, 'referral_commission', reward]
            );

            // Move to the next level (the person who referred the current referrer)
            currentReferrerCode = referrer.referred_by;
        }

        await client.query('COMMIT');
        res.json({ success: true, message: 'User activated and rewards distributed' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Activation Error:", err.message);
        res.status(500).json({ message: 'Failed to activate user' });
    } finally {
        client.release();
    }
};

exports.getReferrerInfo = async (req, res) => {
    const { ref } = req.query;

    try {
        if (!ref) return res.status(400).json({ message: 'No referral code' });

        // Lookup the username of the person who owns this referral code
        const result = await pool.query('SELECT username FROM users WHERE referral_code = $1', [ref]);

        if (result.rows.length > 0) {
            res.json({ username: result.rows[0].username });
        } else {
            res.status(404).json({ message: 'Referrer not found' });
        }
    } catch (err) {
        console.error("Referrer Info Error:", err.message);
        res.status(500).json({ message: 'Server error fetching referrer info' });
    }
};

exports.loginUser = async (req, res) => {
    const { email, password } = req.body;

    try {
        // Support login via email, phone_number, or username
        const result = await pool.query('SELECT * FROM users WHERE email = $1 OR phone_number = $1 OR username = $1', [email]);
        if (result.rows.length === 0) return res.status(400).json({ message: 'Invalid credentials' });

        const user = result.rows[0];
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });
        
        // Block login if account is suspended
        if (user.status === 'suspended') {
            return res.status(403).json({ success: false, message: 'Your account has been suspended. Please contact support.' });
        }

        // Block login if account is not active
        if (!user.is_active || user.is_active === 'false' || user.is_active === '0') {
            const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '1d' });
            return res.status(403).json({ 
                success: false,
                message: 'Account not activated. Please pay the activation fee.', 
                needsActivation: true,
                token,
                userId: user.id,
                fullName: user.full_name,
                phoneNumber: user.phone_number
            });
        }

        const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '1d' });
        res.json({ 
            success: true,
            token, 
            id: user.id, 
            fullName: user.full_name, 
            message: 'Login successful' 
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error during login' });
    }
};

// @desc    Get public system settings (activation fee)
exports.getPublicSettings = async (req, res) => {
    try {
        const settingsRes = await pool.query(`
            SELECT setting_key, setting_value 
            FROM settings 
            WHERE setting_key LIKE 'min_withdrawal_%' 
               OR setting_key LIKE 'max_withdrawal_%' 
               OR setting_key IN ('activation_fee', 'announcement_text', 'maintenance_mode')`);
        const settings = {};
        settingsRes.rows.forEach(row => {
            settings[row.setting_key] = row.setting_value;
        });

        res.json({ 
            success: true, 
            activationFee: settings['activation_fee'] || '20',
            announcement: settings['announcement_text'] || '',
            maintenance: settings['maintenance_mode'] === 'true',
            withdrawalLimits: {
                min: {
                    total: settings['min_withdrawal_total'] || '50',
                    tiktok: settings['min_withdrawal_tiktok'] || '50',
                    youtube: settings['min_withdrawal_youtube'] || '50',
                    surveys: settings['min_withdrawal_surveys'] || '50',
                    spin: settings['min_withdrawal_spin'] || '50',
                    referrals: settings['min_withdrawal_referrals'] || '50'
                },
                max: {
                    total: settings['max_withdrawal_total'] || '1000000',
                    tiktok: settings['max_withdrawal_tiktok'] || '1000000',
                    youtube: settings['max_withdrawal_youtube'] || '1000000',
                    surveys: settings['max_withdrawal_surveys'] || '1000000',
                    spin: settings['max_withdrawal_spin'] || '1000000',
                    referrals: settings['max_withdrawal_referrals'] || '1000000'
                }
            }
        });
    } catch (err) {
        console.error("Public Settings Error:", err.message);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// @desc    Check user activation status
exports.checkUserStatus = async (req, res) => {
    try {
        const result = await pool.query('SELECT is_active FROM users WHERE id = $1', [req.user.id]);
        if (result.rows.length === 0) return res.status(404).json({ message: 'User not found' });
        res.json({ success: true, is_active: result.rows[0].is_active });
    } catch (err) {
        console.error("Check Status Error:", err.message);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};