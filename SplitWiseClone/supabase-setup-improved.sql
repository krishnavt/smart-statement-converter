-- Improved Freemium Model for Splitzee
-- Based on user feedback about overly restrictive limits

-- Update the can_create_expense function to be much more generous
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
    
    -- Free users get 50 expenses per month (much more generous)
    -- This allows for daily use without hitting limits like other apps
    IF user_tier = 'free' AND current_count < 50 THEN
        RETURN TRUE;
    END IF;
    
    RETURN FALSE;
END;
$$ language 'plpgsql';

-- Update the can_create_group function to be more generous
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
    
    -- Free users get 10 groups (more than enough for most users)
    IF user_tier = 'free' AND group_count < 10 THEN
        RETURN TRUE;
    END IF;
    
    RETURN FALSE;
END;
$$ language 'plpgsql';

-- Add function to get usage stats with updated limits
CREATE OR REPLACE FUNCTION get_user_usage_stats(user_id UUID)
RETURNS JSON AS $$
DECLARE
    user_tier TEXT;
    expense_count INTEGER;
    group_count INTEGER;
    result JSON;
BEGIN
    SELECT subscription_tier, monthly_expense_count 
    INTO user_tier, expense_count
    FROM user_profiles 
    WHERE id = user_id;
    
    SELECT COUNT(*) INTO group_count
    FROM groups 
    WHERE created_by = user_id;
    
    -- Set limits based on tier
    IF user_tier = 'premium' THEN
        result := json_build_object(
            'subscriptionTier', user_tier,
            'monthlyExpenseCount', expense_count,
            'expenseLimit', 'unlimited',
            'groupCount', group_count,
            'groupLimit', 'unlimited'
        );
    ELSE
        result := json_build_object(
            'subscriptionTier', user_tier,
            'monthlyExpenseCount', expense_count,
            'expenseLimit', 50,
            'groupCount', group_count,
            'groupLimit', 10
        );
    END IF;
    
    RETURN result;
END;
$$ language 'plpgsql';

-- Success message
SELECT 'Splitzee improved freemium model updated successfully! 🚀' as status;
SELECT '✅ Free users now get 50 expenses/month and 10 groups' as improvement;
SELECT '✅ No daily limits - only monthly limits' as benefit;
SELECT '✅ Much more generous than competitors' as advantage;