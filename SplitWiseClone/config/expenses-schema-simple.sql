-- Simplified Expenses schema for SplitWise Clone
-- Run this AFTER running fix-user-profiles.sql

-- Create expenses table with minimal dependencies
CREATE TABLE IF NOT EXISTS expenses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    description TEXT NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    category VARCHAR(50) DEFAULT 'general',
    
    -- Who paid and who owes (using UUID references)
    created_by UUID REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
    paid_by UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    paid_by_name VARCHAR(255),
    
    -- Participants and splits
    participants TEXT[] NOT NULL DEFAULT '{}',
    splits JSONB NOT NULL DEFAULT '{}',
    split_type VARCHAR(20) DEFAULT 'equal',
    
    -- Group context (simplified)
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

-- Simple groups table (optional, self-contained)
CREATE TABLE IF NOT EXISTS groups (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_by UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_expenses_created_by ON expenses(created_by);
CREATE INDEX IF NOT EXISTS idx_expenses_paid_by ON expenses(paid_by);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date DESC);

-- Enable RLS
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;

-- Simple RLS Policies for expenses
DROP POLICY IF EXISTS "Users can view their expenses" ON expenses;
CREATE POLICY "Users can view their expenses" ON expenses
    FOR SELECT USING (
        created_by = auth.uid() OR 
        paid_by = auth.uid() OR
        auth.uid()::text = ANY(participants)
    );

DROP POLICY IF EXISTS "Users can create expenses" ON expenses;
CREATE POLICY "Users can create expenses" ON expenses
    FOR INSERT WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "Users can update their expenses" ON expenses;
CREATE POLICY "Users can update their expenses" ON expenses
    FOR UPDATE USING (created_by = auth.uid());

DROP POLICY IF EXISTS "Users can delete their expenses" ON expenses;
CREATE POLICY "Users can delete their expenses" ON expenses
    FOR DELETE USING (created_by = auth.uid());

-- Simple policies for groups
DROP POLICY IF EXISTS "Users can view groups" ON groups;
CREATE POLICY "Users can view groups" ON groups
    FOR SELECT USING (created_by = auth.uid());

DROP POLICY IF EXISTS "Users can create groups" ON groups;
CREATE POLICY "Users can create groups" ON groups
    FOR INSERT WITH CHECK (created_by = auth.uid());

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

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE expenses;
ALTER PUBLICATION supabase_realtime ADD TABLE groups;

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Simple expenses schema created successfully!';
    RAISE NOTICE 'Next: Test creating an expense from your app';
END $$;