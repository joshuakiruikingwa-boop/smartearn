-- Use this script to ensure your videos table has all required columns
-- Run this in your PostgreSQL terminal or pgAdmin

CREATE TABLE IF NOT EXISTS videos (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    platform VARCHAR(50) NOT NULL,
    video_id VARCHAR(255) NOT NULL,
    reward DECIMAL(10, 2) NOT NULL,
    duration_seconds INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'draft',
    views INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);