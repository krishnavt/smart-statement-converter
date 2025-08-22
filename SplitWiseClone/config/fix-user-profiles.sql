-- Fix user_profiles table to match expenses table requirements
-- Run this BEFORE running the expenses schema

-- Check current columns in user_profiles
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'user_profiles' 
ORDER BY ordinal_position;

-- Add missing columns to user_profiles if they don't exist
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS full_name VARCHAR(255);

ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS display_name VARCHAR(255);

-- Update existing records to have proper names
UPDATE user_profiles 
SET full_name = COALESCE(full_name, email)
WHERE full_name IS NULL;

UPDATE user_profiles 
SET display_name = COALESCE(display_name, split_part(email, '@', 1))
WHERE display_name IS NULL;

-- Verify the structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'user_profiles' 
ORDER BY ordinal_position;