const { pool } = require('../config/db');

class Survey {
    static async findAll() {
        const result = await pool.query('SELECT * FROM surveys ORDER BY created_at DESC');
        return result.rows;
    }

    static async findById(id) {
        const result = await pool.query('SELECT * FROM surveys WHERE id = $1', [id]);
        return result.rows[0];
    }

    static async create({ title, description, reward, questions, duration_minutes, status }) {
        const query = `
            INSERT INTO surveys (title, description, reward, questions, duration_minutes, status)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `;
        const values = [title, description, reward, JSON.stringify(questions), duration_minutes, status || 'draft'];
        const result = await pool.query(query, values);
        return result.rows[0];
    }

    static async findByIdAndUpdate(id, { title, description, reward, questions, duration_minutes, status }) {
        const query = `
            UPDATE surveys 
            SET title = $1, description = $2, reward = $3, questions = $4, duration_minutes = $5, status = $6
            WHERE id = $7
            RETURNING *
        `;
        const values = [title, description, reward, JSON.stringify(questions), duration_minutes, status, id];
        const result = await pool.query(query, values);
        return result.rows[0];
    }

    static async findByIdAndDelete(id) {
        const result = await pool.query('DELETE FROM surveys WHERE id = $1 RETURNING *', [id]);
        return result.rows[0];
    }
}

module.exports = Survey;