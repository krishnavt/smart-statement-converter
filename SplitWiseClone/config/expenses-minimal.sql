-- Minimal expenses table creation - step by step
-- Run each section separately to identify where the error occurs

-- Step 1: Drop existing table if it exists
DROP TABLE IF EXISTS expenses CASCADE;

-- Step 2: Create basic table structure
CREATE TABLE expenses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    description TEXT NOT NULL,
    amount DECIMAL(12,2) NOT NULL
);

-- Step 3: Add user columns one by one
ALTER TABLE expenses ADD COLUMN created_by UUID NOT NULL;
ALTER TABLE expenses ADD COLUMN paid_by UUID;
ALTER TABLE expenses ADD COLUMN paid_by_name VARCHAR(255);

-- Step 4: Add other columns
ALTER TABLE expenses ADD COLUMN category VARCHAR(50) DEFAULT 'general';
ALTER TABLE expenses ADD COLUMN participants TEXT[] DEFAULT '{}';
ALTER TABLE expenses ADD COLUMN splits JSONB DEFAULT '{}';
ALTER TABLE expenses ADD COLUMN split_type VARCHAR(20) DEFAULT 'equal';
ALTER TABLE expenses ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE expenses ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Step 5: Enable RLS
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- Step 6: Create simple policy
CREATE POLICY "Users can access their expenses" ON expenses
    FOR ALL USING (created_by = auth.uid());

-- Step 7: Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE expenses;

-- Success message
SELECT 'Expenses table created successfully!' as result;