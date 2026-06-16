-- Migration to add task-specific balance columns to the users table
-- Run this against your PostgreSQL database

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS tiktok_balance DECIMAL(12, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS youtube_balance DECIMAL(12, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS surveys_balance DECIMAL(12, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS spin_balance DECIMAL(12, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS referrals_balance DECIMAL(12, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_withdrawals DECIMAL(12, 2) DEFAULT 0;

-- Ensure settings table exists for admin configurations
CREATE TABLE IF NOT EXISTS settings (
    setting_key VARCHAR(255) PRIMARY KEY,
    setting_value TEXT NOT NULL
);

-- Initialize default limits (Both Min and Max) as required by adminsettings.html
INSERT INTO settings (setting_key, setting_value) VALUES
('activation_fee', '500'),
('min_withdrawal_total', '50'), ('max_withdrawal_total', '1000000'),
('min_withdrawal_tiktok', '50'), ('max_withdrawal_tiktok', '1000000'),
('min_withdrawal_youtube', '50'), ('max_withdrawal_youtube', '1000000'),
('min_withdrawal_surveys', '50'), ('max_withdrawal_surveys', '1000000'),
('min_withdrawal_spin', '50'), ('max_withdrawal_spin', '1000000'),
('min_withdrawal_referrals', '50'), ('max_withdrawal_referrals', '1000000')
ON CONFLICT (setting_key) DO NOTHING;