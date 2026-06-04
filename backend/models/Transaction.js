const { pool } = require('../config/db');

class Transaction {
    static async create({ userId, type, amount, description, status = 'completed' }) {
        const query = `
            INSERT INTO transactions (user_id, type, amount, description, status)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
        `;
        const values = [userId, type, amount, description, status];
        const result = await pool.query(query, values);
        return result.rows[0];
    }

    static async findByUserId(userId) {
        const result = await pool.query('SELECT * FROM transactions WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
        return result.rows;
    }
}

module.exports = Transaction;