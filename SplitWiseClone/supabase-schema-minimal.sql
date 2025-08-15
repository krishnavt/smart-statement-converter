-- Minimal Schema for Real-Time Notifications
-- Run this if you get column errors with the main schema

-- 1. Sync Codes Table (for anonymous friend linking)
CREATE TABLE IF NOT EXISTS sync_codes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    code VARCHAR(8) UNIQUE NOT NULL,
    user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    user_name VARCHAR(255) NOT NULL,
    user_avatar VARCHAR(10) DEFAULT '👤',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    used_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    used_at TIMESTAMP WITH TIME ZONE
);

-- 2. Friend Relationships Table
CREATE TABLE IF NOT EXISTS friend_relationships (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    friend_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    sync_code_used VARCHAR(8),
    status VARCHAR(20) DEFAULT 'active',
    
    CONSTRAINT unique_friendship UNIQUE(user_id, friend_id),
    CONSTRAINT no_self_friendship CHECK(user_id != friend_id)
);

-- 3. Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    icon VARCHAR(10) DEFAULT '📱',
    
    -- Related data
    expense_id UUID REFERENCES expenses(id) ON DELETE CASCADE,
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
    from_user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    from_user_name VARCHAR(255),
    
    -- Metadata
    data JSONB,
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Activity Feed Table
CREATE TABLE IF NOT EXISTS activity_feed (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    description TEXT NOT NULL,
    icon VARCHAR(10) DEFAULT '📱',
    
    -- Related entities
    expense_id UUID REFERENCES expenses(id) ON DELETE CASCADE,
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
    related_user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    related_user_name VARCHAR(255),
    
    -- Metadata
    data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Notification Preferences
CREATE TABLE IF NOT EXISTS notification_preferences (
    user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE PRIMARY KEY,
    expense_updates BOOLEAN DEFAULT TRUE,
    settlement_requests BOOLEAN DEFAULT TRUE,
    group_activity BOOLEAN DEFAULT TRUE,
    friend_requests BOOLEAN DEFAULT TRUE,
    push_notifications BOOLEAN DEFAULT TRUE,
    
    web_push_token TEXT,
    fcm_token TEXT,
    
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Basic indexes
CREATE INDEX IF NOT EXISTS idx_sync_codes_code ON sync_codes(code);
CREATE INDEX IF NOT EXISTS idx_friend_relationships_user ON friend_relationships(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, read, created_at);
CREATE INDEX IF NOT EXISTS idx_activity_feed_user_created ON activity_feed(user_id, created_at DESC);

-- Enable RLS
ALTER TABLE sync_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE friend_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_feed ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

-- Basic RLS policies
DROP POLICY IF EXISTS "Users can manage their own sync codes" ON sync_codes;
CREATE POLICY "Users can manage their own sync codes" ON sync_codes
    FOR ALL USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can manage their own friendships" ON friend_relationships;
CREATE POLICY "Users can manage their own friendships" ON friend_relationships
    FOR ALL USING (user_id = auth.uid() OR friend_id = auth.uid());

DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
CREATE POLICY "Users can view their own notifications" ON notifications
    FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "System can insert notifications" ON notifications;
CREATE POLICY "System can insert notifications" ON notifications
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view their activity feed" ON activity_feed;
CREATE POLICY "Users can view their activity feed" ON activity_feed
    FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can manage their notification preferences" ON notification_preferences;
CREATE POLICY "Users can manage their notification preferences" ON notification_preferences
    FOR ALL USING (user_id = auth.uid());

-- Essential functions
CREATE OR REPLACE FUNCTION generate_sync_code()
RETURNS VARCHAR(8) AS $$
DECLARE
    new_code VARCHAR(8);
    exists_count INTEGER;
BEGIN
    LOOP
        new_code := upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 8));
        
        SELECT COUNT(*) INTO exists_count 
        FROM sync_codes 
        WHERE code = new_code AND expires_at > NOW();
        
        IF exists_count = 0 THEN
            RETURN new_code;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to add friend relationship
CREATE OR REPLACE FUNCTION add_friend_relationship(
    requester_id UUID,
    friend_id UUID,
    sync_code VARCHAR(8)
)
RETURNS BOOLEAN AS $$
BEGIN
    INSERT INTO friend_relationships (user_id, friend_id, sync_code_used)
    VALUES 
        (requester_id, friend_id, sync_code),
        (friend_id, requester_id, sync_code)
    ON CONFLICT (user_id, friend_id) DO NOTHING;
    
    UPDATE sync_codes 
    SET used = TRUE, used_by = requester_id, used_at = NOW()
    WHERE code = sync_code;
    
    RETURN TRUE;
EXCEPTION
    WHEN OTHERS THEN
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Simple trigger for expense notifications
CREATE OR REPLACE FUNCTION notify_friends_expense_update()
RETURNS TRIGGER AS $$
DECLARE
    friend_record RECORD;
    expense_record RECORD;
    user_name_val VARCHAR(255);
BEGIN
    -- Get expense details
    expense_record := NEW;
    
    -- Get user name (adjust this based on your user_profiles schema)
    SELECT COALESCE(full_name, display_name, email, 'User') 
    INTO user_name_val
    FROM user_profiles 
    WHERE id = expense_record.created_by;
    
    -- Notify friends in the same group
    FOR friend_record IN
        SELECT DISTINCT fr.friend_id
        FROM friend_relationships fr
        JOIN group_members gm ON gm.user_id = fr.friend_id
        WHERE fr.user_id = expense_record.created_by
        AND gm.group_id = expense_record.group_id
        AND fr.status = 'active'
    LOOP
        INSERT INTO notifications (
            user_id, type, title, message, icon,
            expense_id, group_id, from_user_id, from_user_name
        ) VALUES (
            friend_record.friend_id,
            CASE WHEN TG_OP = 'INSERT' THEN 'expense_added' ELSE 'expense_updated' END,
            CASE WHEN TG_OP = 'INSERT' THEN 'New Expense Added' ELSE 'Expense Updated' END,
            user_name_val || ' ' || 
            CASE WHEN TG_OP = 'INSERT' THEN 'added: ' ELSE 'updated: ' END || 
            expense_record.description,
            CASE WHEN TG_OP = 'INSERT' THEN '💰' ELSE '✏️' END,
            expense_record.id,
            expense_record.group_id,
            expense_record.created_by,
            user_name_val
        );
    END LOOP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
DROP TRIGGER IF EXISTS notify_friends_on_expense_change ON expenses;
CREATE TRIGGER notify_friends_on_expense_change
    AFTER INSERT OR UPDATE ON expenses
    FOR EACH ROW
    EXECUTE FUNCTION notify_friends_expense_update();

-- Test query to see your user_profiles columns
-- Run this to see what columns you actually have:
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'user_profiles';

COMMENT ON TABLE sync_codes IS 'Anonymous sync codes for friend linking';
COMMENT ON TABLE friend_relationships IS 'Bidirectional friend relationships';
COMMENT ON TABLE notifications IS 'Real-time notifications for users';
COMMENT ON TABLE activity_feed IS 'Activity timeline for users';
COMMENT ON TABLE notification_preferences IS 'User notification settings';

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Real-time notification schema installed successfully!';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '1. Enable realtime on: notifications, activity_feed, friend_relationships';
    RAISE NOTICE '2. Update supabase-integration.js with your credentials';
    RAISE NOTICE '3. Test with multiple devices';
END $$;