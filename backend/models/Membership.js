const { pool } = require('../config/db');

class Membership {
    static async findAll() {
        const result = await pool.query('SELECT * FROM memberships ORDER BY price ASC');
        return result.rows;
    }

    static async findById(id) {
        const result = await pool.query('SELECT * FROM memberships WHERE id = $1', [id]);
        return result.rows[0];
    }
    // Add more methods as needed, e.g., to get membership by name
}

module.exports = Membership;