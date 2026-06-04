const { pool } = require('../config/db');

class User {
    static async findAll() {
        const query = 'SELECT id, full_name, username, email, phone_number, balance, status, is_active FROM users ORDER BY created_at DESC';
        const result = await pool.query(query);
        return result.rows;
    }

    static async findById(id) {
        const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
        return result.rows[0];
    }

    static async update(id, { balance, status, is_active }) {
        const query = `
            UPDATE users 
            SET balance = $1, status = $2, is_active = $3
            WHERE id = $4
            RETURNING id, full_name, username, email, phone_number, balance, status, is_active
        `;
        const values = [balance, status, is_active, id];
        const result = await pool.query(query, values);
        return result.rows[0];
    }

    static async toggleStatus(id) {
        // Fetch current status
        const user = await this.findById(id);
        if (!user) return null;

        const newStatus = user.status === 'active' ? 'suspended' : 'active';
        
        const query = `
            UPDATE users 
            SET status = $1
            WHERE id = $2
            RETURNING status
        `;
        const result = await pool.query(query, [newStatus, id]);
        return result.rows[0];
    }
}

module.exports = User;