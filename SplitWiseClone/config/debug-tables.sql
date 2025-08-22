-- Debug: Check what tables and columns actually exist
-- Run this first to see the current database structure

-- Check if user_profiles table exists and what columns it has
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'user_profiles'
ORDER BY ordinal_position;

-- Check all tables in the public schema
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;

-- If user_profiles doesn't exist, let's see what auth tables are available
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'auth'
ORDER BY table_name;