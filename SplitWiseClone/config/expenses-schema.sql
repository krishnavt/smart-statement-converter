-- Expenses table for SplitWise Clone
-- Run this in your Supabase SQL Editor

-- Create expenses table
CREATE TABLE IF NOT EXISTS expenses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    description TEXT NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    category VARCHAR(50) DEFAULT 'general',
    
    -- Who paid and who owes
    created_by UUID REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
    paid_by UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    paid_by_name VARCHAR(255),
    
    -- Participants and splits
    participants TEXT[] NOT NULL DEFAULT '{}',
    splits JSONB NOT NULL DEFAULT '{}',
    split_type VARCHAR(20) DEFAULT 'equal',
    
    -- Group context (if applicable)
    group_id UUID,
    group_name VARCHAR(255),
    
    -- Metadata
    receipt_url TEXT,
    notes TEXT,
    location VARCHAR(255),
    date DATE DEFAULT CURRENT_DATE,
    
    -- Sync status
    synced BOOLEAN DEFAULT TRUE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create groups table (if needed for group context)
CREATE TABLE IF NOT EXISTS groups (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_by UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create group members table
CREATE TABLE IF NOT EXISTS group_members (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
    user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'member',
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT unique_group_member UNIQUE(group_id, user_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_expenses_created_by ON expenses(created_by);
CREATE INDEX IF NOT EXISTS idx_expenses_paid_by ON expenses(paid_by);
CREATE INDEX IF NOT EXISTS idx_expenses_group ON expenses(group_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date DESC);
CREATE INDEX IF NOT EXISTS idx_group_members_group ON group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members(user_id);

-- Enable RLS
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;

-- RLS Policies for expenses
DROP POLICY IF EXISTS "Users can view expenses they created or participated in" ON expenses;
CREATE POLICY "Users can view expenses they created or participated in" ON expenses
    FOR SELECT USING (
        created_by = auth.uid() OR 
        paid_by = auth.uid() OR
        auth.uid()::text = ANY(participants) OR
        EXISTS (
            SELECT 1 FROM group_members gm 
            WHERE gm.group_id = expenses.group_id 
            AND gm.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can create expenses" ON expenses;
CREATE POLICY "Users can create expenses" ON expenses
    FOR INSERT WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "Users can update their own expenses" ON expenses;
CREATE POLICY "Users can update their own expenses" ON expenses
    FOR UPDATE USING (created_by = auth.uid());

DROP POLICY IF EXISTS "Users can delete their own expenses" ON expenses;
CREATE POLICY "Users can delete their own expenses" ON expenses
    FOR DELETE USING (created_by = auth.uid());

-- RLS Policies for groups
DROP POLICY IF EXISTS "Users can view groups they belong to" ON groups;
CREATE POLICY "Users can view groups they belong to" ON groups
    FOR SELECT USING (
        created_by = auth.uid() OR
        EXISTS (
            SELECT 1 FROM group_members gm 
            WHERE gm.group_id = groups.id 
            AND gm.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can create groups" ON groups;
CREATE POLICY "Users can create groups" ON groups
    FOR INSERT WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "Group creators can update their groups" ON groups;
CREATE POLICY "Group creators can update their groups" ON groups
    FOR UPDATE USING (created_by = auth.uid());

-- RLS Policies for group members
DROP POLICY IF EXISTS "Users can view group memberships" ON group_members;
CREATE POLICY "Users can view group memberships" ON group_members
    FOR SELECT USING (
        user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM groups g 
            WHERE g.id = group_members.group_id 
            AND g.created_by = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Group creators can manage members" ON group_members;
CREATE POLICY "Group creators can manage members" ON group_members
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM groups g 
            WHERE g.id = group_members.group_id 
            AND g.created_by = auth.uid()
        )
    );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_expenses_updated_at ON expenses;
CREATE TRIGGER update_expenses_updated_at 
    BEFORE UPDATE ON expenses 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_groups_updated_at ON groups;
CREATE TRIGGER update_groups_updated_at 
    BEFORE UPDATE ON groups 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE expenses;
ALTER PUBLICATION supabase_realtime ADD TABLE groups;
ALTER PUBLICATION supabase_realtime ADD TABLE group_members;

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Expenses schema created successfully!';
    RAISE NOTICE 'Tables created: expenses, groups, group_members';
    RAISE NOTICE 'Realtime enabled for all tables';
    RAISE NOTICE 'RLS policies configured';
END $$;