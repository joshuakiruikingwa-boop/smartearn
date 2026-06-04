const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://joshua:joshua123@localhost:5432/postgres',
});

const connectDB = async () => {
    try {
        await pool.connect();
        console.log(`PostgreSQL Connected to smartearn database`);
        
        // Initialize Tables
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                full_name VARCHAR(255) NOT NULL,
                username VARCHAR(255) UNIQUE,
                email VARCHAR(255) UNIQUE NOT NULL,
                phone_number VARCHAR(20),
                password VARCHAR(255) NOT NULL,
                country VARCHAR(100) DEFAULT 'Kenya',
                balance DECIMAL(12, 2) DEFAULT 0.00,
                referral_code VARCHAR(50) UNIQUE,
                referred_by VARCHAR(50),
                is_active BOOLEAN DEFAULT FALSE,
                status VARCHAR(20) DEFAULT 'active',
                membership_id INTEGER DEFAULT 1,
                spins_count INTEGER DEFAULT 0,
                youtube_count INTEGER DEFAULT 0,
                tiktok_count INTEGER DEFAULT 0,
                last_activity_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Initialize Settings Table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS settings (
                setting_key VARCHAR(50) PRIMARY KEY,
                setting_value TEXT NOT NULL
            );
            INSERT INTO settings (setting_key, setting_value) VALUES ('activation_fee', '1') ON CONFLICT DO NOTHING;
        `);

    } catch (error) {
        console.error(`PostgreSQL Connection Error: ${error.message}`);
        process.exit(1);
    }
};

module.exports = {
    connectDB,
    pool
};