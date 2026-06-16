-- Migration to fix "column merchant_reference does not exist" error
-- Run this against your PostgreSQL database

ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS merchant_reference TEXT;