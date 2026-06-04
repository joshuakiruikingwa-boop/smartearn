const { pool } = require('../config/db');

class UserTask {
    static async create({ userId, taskType, taskId, rewardAmount }) {
        const query = `
            INSERT INTO user_tasks (user_id, task_type, task_id, reward_amount)
            VALUES ($1, $2, $3, $4)
            RETURNING *
        `;
        const values = [userId, taskType, taskId, rewardAmount];
        const result = await pool.query(query, values);
        return result.rows[0];
    }

    static async getDailyTaskCount(userId, taskType, taskId) {
        const query = 'SELECT COUNT(*) FROM user_tasks WHERE user_id = $1 AND task_type = $2 AND task_id = $3 AND DATE(completed_at) = CURRENT_DATE';
        const result = await pool.query(query, [userId, taskType, taskId]);
        return parseInt(result.rows[0].count, 10);
    }

    static async getLastTaskTime(userId, taskType) {
        const query = 'SELECT completed_at FROM user_tasks WHERE user_id = $1 AND task_type = $2 ORDER BY completed_at DESC LIMIT 1';
        const result = await pool.query(query, [userId, taskType]);
        return result.rows[0] ? result.rows[0].completed_at : null;
    }

    static async getLatestTaskByType(userId, taskType) {
        const query = 'SELECT * FROM user_tasks WHERE user_id = $1 AND task_type = $2 ORDER BY completed_at DESC LIMIT 1';
        const result = await pool.query(query, [userId, taskType]);
        return result.rows[0];
    }
}

module.exports = UserTask;