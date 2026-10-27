-- Migration 002: Add password_hash column to users table
-- Version-controlled relational schema update for individual staff authentication

ALTER TABLE users
ADD COLUMN IF NOT EXISTS password_hash TEXT DEFAULT NULL;
