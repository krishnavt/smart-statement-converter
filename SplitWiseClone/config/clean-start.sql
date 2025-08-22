-- Clean start - remove everything related to expenses and rebuild
-- Run this to start fresh

-- Drop all expense-related objects
DROP TRIGGER IF EXISTS notify_friends_on_expense_change ON expenses;
DROP FUNCTION IF EXISTS notify_friends_expense_update();
DROP TABLE IF EXISTS expenses CASCADE;
DROP TABLE IF EXISTS groups CASCADE;
DROP TABLE IF EXISTS group_members CASCADE;

-- Remove from realtime publication
ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS expenses;
ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS groups;
ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS group_members;

-- Now create simple expenses table
CREATE TABLE expenses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    description TEXT NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    category VARCHAR(50) DEFAULT 'general',
    created_by UUID NOT NULL,
    paid_by UUID,
    participants TEXT[] DEFAULT '{}',
    splits JSONB DEFAULT '{}',
    split_type VARCHAR(20) DEFAULT 'equal',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Simple RLS policy
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "expense_policy" ON expenses FOR ALL USING (created_by = auth.uid());

-- Add to realtime
ALTER PUBLICATION supabase_realtime ADD TABLE expenses;

SELECT 'Clean expenses table created!' as result;