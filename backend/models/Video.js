const { pool } = require('../config/db');

class Video {
    static async findAll(platform = null, onlyActive = true) {
        let query = 'SELECT * FROM videos';
        let params = [];
        let conditions = [];

        if (onlyActive) {
            conditions.push("status = 'active'");
        }

        if (platform) {
            params.push(platform);
            conditions.push(`LOWER(platform) = LOWER($${params.length})`);
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }

        query += ' ORDER BY created_at DESC';
        const result = await pool.query(query, params);
        return result.rows;
    }

    static async create({ title, platform, video_id, reward, duration_seconds, status }) {
        const query = `
            INSERT INTO videos (title, platform, video_id, reward, duration_seconds, status)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `;
        const values = [title, platform, video_id, reward, duration_seconds, status || 'draft'];
        const result = await pool.query(query, values);
        return result.rows[0];
    }

    static async findById(id) {
        const result = await pool.query('SELECT * FROM videos WHERE id = $1', [id]);
        return result.rows[0];
    }

    static async findByIdAndUpdate(id, { title, platform, video_id, reward, duration_seconds, status }) {
        const query = `
            UPDATE videos 
            SET title = $1, platform = $2, video_id = $3, reward = $4, duration_seconds = $5, status = $6
            WHERE id = $7
            RETURNING *
        `;
        const values = [title, platform, video_id, reward, duration_seconds, status, id];
        const result = await pool.query(query, values);
        return result.rows[0];
    }

    static async findByIdAndDelete(id) {
        const result = await pool.query('DELETE FROM videos WHERE id = $1 RETURNING *', [id]);
        return result.rows[0];
    }
}

module.exports = Video;