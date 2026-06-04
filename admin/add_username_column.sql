-- Migration to fix "column username does not exist" error
-- Run this against your PostgreSQL database

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS username VARCHAR(255) UNIQUE,
ADD COLUMN IF NOT EXISTS referred_by VARCHAR(255),
ADD COLUMN IF NOT EXISTS referral_code VARCHAR(20) UNIQUE;