-- Quick Database Update for Freemium Features
-- Run this in your Supabase SQL Editor

-- Add subscription columns to existing user_profiles table
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'premium')),
ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'active' CHECK (subscription_status IN ('active', 'canceled', 'expired')),
ADD COLUMN IF NOT EXISTS subscription_start DATE,
ADD COLUMN IF NOT EXISTS subscription_end DATE,
ADD COLUMN IF NOT EXISTS monthly_expense_count INTEGER DEFAULT 0;

-- Add the freemium functions
CREATE OR REPLACE FUNCTION can_create_expense(user_id UUID)
RETURNS boolean AS $$
DECLARE
    user_tier TEXT;
    current_count INTEGER;
BEGIN
    SELECT subscription_tier, monthly_expense_count 
    INTO user_tier, current_count
    FROM user_profiles 
    WHERE id = user_id;
    
    -- Premium users have unlimited expenses
    IF user_tier = 'premium' THEN
        RETURN TRUE;
    END IF;
    
    -- Free users limited to 10 expenses per month
    IF user_tier = 'free' AND current_count < 10 THEN
        RETURN TRUE;
    END IF;
    
    RETURN FALSE;
END;
$$ language 'plpgsql';

CREATE OR REPLACE FUNCTION can_create_group(user_id UUID)
RETURNS boolean AS $$
DECLARE
    user_tier TEXT;
    group_count INTEGER;
BEGIN
    SELECT subscription_tier INTO user_tier
    FROM user_profiles 
    WHERE id = user_id;
    
    -- Premium users have unlimited groups
    IF user_tier = 'premium' THEN
        RETURN TRUE;
    END IF;
    
    -- Count user's groups
    SELECT COUNT(*) INTO group_count
    FROM groups 
    WHERE created_by = user_id;
    
    -- Free users limited to 3 groups
    IF user_tier = 'free' AND group_count < 3 THEN
        RETURN TRUE;
    END IF;
    
    RETURN FALSE;
END;
$$ language 'plpgsql';

-- Success message
SELECT 'Freemium features added successfully! 🎉' as status;