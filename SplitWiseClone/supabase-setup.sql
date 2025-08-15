-- SplitWise Database Setup for Supabase
-- Run these commands in your Supabase SQL Editor

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create user profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    full_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    avatar_url TEXT,
    subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'premium')),
    subscription_status TEXT DEFAULT 'active' CHECK (subscription_status IN ('active', 'canceled', 'expired')),
    subscription_start DATE,
    subscription_end DATE,
    monthly_expense_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS (Row Level Security)
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Create policies for user_profiles
CREATE POLICY "Users can view own profile" ON user_profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON user_profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON user_profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Create groups table
CREATE TABLE IF NOT EXISTS groups (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    created_by UUID REFERENCES auth.users(id) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for groups
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;

-- Create group members table first
CREATE TABLE IF NOT EXISTS group_members (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(group_id, user_id)
);

-- Enable RLS for group_members
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;

-- Create policies for group_members
CREATE POLICY "Users can view group memberships" ON group_members
    FOR SELECT USING (
        user_id = auth.uid() OR 
        group_id IN (
            SELECT group_id FROM group_members 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can join groups" ON group_members
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- Now create policies for groups (after group_members exists)
CREATE POLICY "Users can view groups they belong to" ON groups
    FOR SELECT USING (
        created_by = auth.uid() OR 
        id IN (
            SELECT group_id FROM group_members 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create groups" ON groups
    FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY "Group creators can update groups" ON groups
    FOR UPDATE USING (created_by = auth.uid());

-- Create expenses table
CREATE TABLE IF NOT EXISTS expenses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    description TEXT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    paid_by UUID REFERENCES auth.users(id) NOT NULL,
    group_id UUID REFERENCES groups(id),
    category TEXT,
    date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for expenses
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- Create policies for expenses
CREATE POLICY "Users can view expenses in their groups" ON expenses
    FOR SELECT USING (
        paid_by = auth.uid() OR
        group_id IN (
            SELECT group_id FROM group_members 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create expenses" ON expenses
    FOR INSERT WITH CHECK (paid_by = auth.uid());

-- Create expense splits table
CREATE TABLE IF NOT EXISTS expense_splits (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    expense_id UUID REFERENCES expenses(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    settled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for expense_splits
ALTER TABLE expense_splits ENABLE ROW LEVEL SECURITY;

-- Create policies for expense_splits
CREATE POLICY "Users can view their expense splits" ON expense_splits
    FOR SELECT USING (
        user_id = auth.uid() OR
        expense_id IN (
            SELECT id FROM expenses WHERE paid_by = auth.uid()
        )
    );

-- Create function to update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER update_user_profiles_updated_at 
    BEFORE UPDATE ON user_profiles 
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_groups_updated_at ON groups;
CREATE TRIGGER update_groups_updated_at 
    BEFORE UPDATE ON groups 
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_expenses_updated_at ON expenses;
CREATE TRIGGER update_expenses_updated_at 
    BEFORE UPDATE ON expenses 
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Function to reset monthly expense counts (call monthly via cron)
CREATE OR REPLACE FUNCTION reset_monthly_expense_counts()
RETURNS void AS $$
BEGIN
    UPDATE user_profiles 
    SET monthly_expense_count = 0
    WHERE subscription_tier = 'free';
END;
$$ language 'plpgsql';

-- Function to check if user can create expense
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
    
    -- Free users limited to 50 expenses per month (generous limit)
    IF user_tier = 'free' AND current_count < 50 THEN
        RETURN TRUE;
    END IF;
    
    RETURN FALSE;
END;
$$ language 'plpgsql';

-- Function to check if user can create group
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
    
    -- Free users limited to 10 groups (generous limit)
    IF user_tier = 'free' AND group_count < 10 THEN
        RETURN TRUE;
    END IF;
    
    RETURN FALSE;
END;
$$ language 'plpgsql';

-- Success message
SELECT 'SplitWise database setup with freemium features completed successfully! 🎉' as status;