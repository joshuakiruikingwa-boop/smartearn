-- Migration to fix "column status does not exist" error
-- Run this against your PostgreSQL database

ALTER TABLE videos 
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'draft';