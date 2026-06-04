const { pool } = require('../config/db');

class WithdrawalRequest {
    static async create({ userId, amount, method, payoutIdentifier, processingFee }) {
        const query = `
            INSERT INTO withdrawal_requests (user_id, amount, method, payout_identifier, processing_fee, status)
            VALUES ($1, $2, $3, $4, $5, 'pending')
            RETURNING *
        `;
        const values = [userId, amount, method, payoutIdentifier, processingFee];
        const result = await pool.query(query, values);
        return result.rows[0];
    }

    static async findByUserId(userId) {
        const result = await pool.query('SELECT * FROM withdrawal_requests WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
        return result.rows;
    }
}

module.exports = WithdrawalRequest;