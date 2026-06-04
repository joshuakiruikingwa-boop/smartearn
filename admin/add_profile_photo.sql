-- Migration to fix "column u.profile_photo does not exist" error
-- Run this against your PostgreSQL database

ALTER TABLE users 
ADD COLUMN profile_photo TEXT DEFAULT NULL;