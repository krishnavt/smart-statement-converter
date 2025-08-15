-- Supabase Schema Updates for Real-Time Notifications & Friend Syncing
-- Add these tables to your existing database

-- 1. Sync Codes Table (for anonymous friend linking)
CREATE TABLE sync_codes (
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

-- Index for fast code lookups
CREATE INDEX idx_sync_codes_code ON sync_codes(code);
CREATE INDEX idx_sync_codes_expires ON sync_codes(expires_at);

-- 2. Friend Relationships Table
CREATE TABLE friend_relationships (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    friend_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    sync_code_used VARCHAR(8),
    status VARCHAR(20) DEFAULT 'active', -- active, blocked, removed
    
    -- Ensure no duplicate friendships and no self-friendship
    CONSTRAINT unique_friendship UNIQUE(user_id, friend_id),
    CONSTRAINT no_self_friendship CHECK(user_id != friend_id)
);

-- Index for fast friend lookups
CREATE INDEX idx_friend_relationships_user ON friend_relationships(user_id);
CREATE INDEX idx_friend_relationships_friend ON friend_relationships(friend_id);

-- 3. Notifications Table
CREATE TABLE notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- expense_added, expense_updated, settlement_request, group_activity
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    icon VARCHAR(10) DEFAULT '📱',
    
    -- Related data
    expense_id UUID REFERENCES expenses(id) ON DELETE CASCADE,
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
    from_user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    from_user_name VARCHAR(255),
    
    -- Metadata
    data JSONB, -- Additional data as needed
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for notifications
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, read, created_at);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_created ON notifications(created_at);

-- 4. Activity Feed Table
CREATE TABLE activity_feed (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- expense_added, expense_updated, group_created, friend_added
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

-- Index for activity feed
CREATE INDEX idx_activity_feed_user_created ON activity_feed(user_id, created_at DESC);

-- 5. User Notification Preferences
CREATE TABLE notification_preferences (
    user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE PRIMARY KEY,
    expense_updates BOOLEAN DEFAULT TRUE,
    settlement_requests BOOLEAN DEFAULT TRUE,
    group_activity BOOLEAN DEFAULT TRUE,
    friend_requests BOOLEAN DEFAULT TRUE,
    push_notifications BOOLEAN DEFAULT TRUE,
    email_notifications BOOLEAN DEFAULT FALSE,
    
    -- Push notification tokens for different platforms
    web_push_token TEXT,
    fcm_token TEXT, -- Firebase Cloud Messaging for mobile
    
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Sync Queue Table (for offline sync)
CREATE TABLE sync_queue (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- expense_create, expense_update, group_create, etc.
    operation VARCHAR(20) NOT NULL, -- create, update, delete
    
    -- Data
    table_name VARCHAR(50) NOT NULL,
    record_id UUID NOT NULL,
    data JSONB NOT NULL,
    
    -- Sync status
    status VARCHAR(20) DEFAULT 'pending', -- pending, processing, completed, failed
    retries INTEGER DEFAULT 0,
    last_retry TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE
);

-- Index for sync queue processing
CREATE INDEX idx_sync_queue_status ON sync_queue(status, created_at);
CREATE INDEX idx_sync_queue_user ON sync_queue(user_id, status);

-- 7. Real-time Subscriptions Table (track active WebSocket connections)
CREATE TABLE active_subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    session_id VARCHAR(255) NOT NULL,
    subscription_type VARCHAR(50) NOT NULL, -- groups, friends, expenses
    resource_id UUID, -- group_id or friend_id
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_ping TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(user_id, session_id, subscription_type, resource_id)
);

-- Clean up old subscriptions automatically
CREATE INDEX idx_active_subscriptions_ping ON active_subscriptions(last_ping);

-- 8. Update existing user_profiles table to support anonymous users
-- (Only add if columns don't exist)
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS anonymous_id VARCHAR(255) UNIQUE,
ADD COLUMN IF NOT EXISTS sync_code_current VARCHAR(8),
ADD COLUMN IF NOT EXISTS last_sync TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS device_info JSONB DEFAULT '{}';

-- Add index for anonymous lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_anonymous ON user_profiles(anonymous_id);

-- 9. Row Level Security (RLS) Policies

-- Enable RLS on all new tables
ALTER TABLE sync_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE friend_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_feed ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_queue ENABLE ROW LEVEL SECURITY;

-- Sync codes: Users can only see their own codes and codes they're using
CREATE POLICY "Users can manage their own sync codes" ON sync_codes
    FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Users can view unexpired sync codes for adding friends" ON sync_codes
    FOR SELECT USING (NOT used AND expires_at > NOW());

-- Friend relationships: Users can see their own friendships
CREATE POLICY "Users can manage their own friendships" ON friend_relationships
    FOR ALL USING (user_id = auth.uid() OR friend_id = auth.uid());

-- Notifications: Users can only see their own notifications
CREATE POLICY "Users can view their own notifications" ON notifications
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "System can insert notifications" ON notifications
    FOR INSERT WITH CHECK (true);

-- Activity feed: Users can see activity related to their groups/friends
CREATE POLICY "Users can view their activity feed" ON activity_feed
    FOR SELECT USING (user_id = auth.uid());

-- Notification preferences: Users can manage their own preferences
CREATE POLICY "Users can manage their notification preferences" ON notification_preferences
    FOR ALL USING (user_id = auth.uid());

-- Sync queue: Users can see their own sync items
CREATE POLICY "Users can view their own sync queue" ON sync_queue
    FOR ALL USING (user_id = auth.uid());

-- 10. Functions for common operations

-- Function to generate unique sync code
CREATE OR REPLACE FUNCTION generate_sync_code()
RETURNS VARCHAR(8) AS $$
DECLARE
    new_code VARCHAR(8);
    exists_count INTEGER;
BEGIN
    LOOP
        -- Generate random 8-character code (A-Z, 0-9)
        new_code := upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 8));
        
        -- Check if code already exists and is not expired
        SELECT COUNT(*) INTO exists_count 
        FROM sync_codes 
        WHERE code = new_code AND expires_at > NOW();
        
        -- If unique, return the code
        IF exists_count = 0 THEN
            RETURN new_code;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to add friend relationship (bidirectional)
CREATE OR REPLACE FUNCTION add_friend_relationship(
    requester_id UUID,
    friend_id UUID,
    sync_code VARCHAR(8)
)
RETURNS BOOLEAN AS $$
BEGIN
    -- Insert both directions of the friendship
    INSERT INTO friend_relationships (user_id, friend_id, sync_code_used)
    VALUES 
        (requester_id, friend_id, sync_code),
        (friend_id, requester_id, sync_code)
    ON CONFLICT (user_id, friend_id) DO NOTHING;
    
    -- Mark sync code as used
    UPDATE sync_codes 
    SET used = TRUE, used_by = requester_id, used_at = NOW()
    WHERE code = sync_code;
    
    RETURN TRUE;
EXCEPTION
    WHEN OTHERS THEN
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Function to notify friends about expense updates
CREATE OR REPLACE FUNCTION notify_friends_expense_update()
RETURNS TRIGGER AS $$
DECLARE
    friend_record RECORD;
    expense_record RECORD;
    user_record RECORD;
BEGIN
    -- Get expense and user details
    SELECT * INTO expense_record FROM expenses WHERE id = NEW.id;
    SELECT * INTO user_record FROM user_profiles WHERE id = expense_record.created_by;
    
    -- Notify all friends who are in the same groups as this expense
    FOR friend_record IN
        SELECT DISTINCT fr.friend_id, up.name as friend_name
        FROM friend_relationships fr
        JOIN user_profiles up ON up.id = fr.friend_id
        JOIN group_members gm ON gm.user_id = fr.friend_id
        WHERE fr.user_id = expense_record.created_by
        AND gm.group_id = expense_record.group_id
        AND fr.status = 'active'
    LOOP
        -- Insert notification
        INSERT INTO notifications (
            user_id, type, title, message, icon,
            expense_id, group_id, from_user_id, from_user_name,
            data
        ) VALUES (
            friend_record.friend_id,
            CASE 
                WHEN TG_OP = 'INSERT' THEN 'expense_added'
                ELSE 'expense_updated'
            END,
            CASE 
                WHEN TG_OP = 'INSERT' THEN 'New Expense Added'
                ELSE 'Expense Updated'
            END,
            user_record.name || ' ' || 
            CASE 
                WHEN TG_OP = 'INSERT' THEN 'added a new expense: ' 
                ELSE 'updated expense: '
            END || expense_record.description,
            CASE 
                WHEN TG_OP = 'INSERT' THEN '💰'
                ELSE '✏️'
            END,
            expense_record.id,
            expense_record.group_id,
            expense_record.created_by,
            user_record.name,
            jsonb_build_object(
                'amount', expense_record.amount,
                'category', expense_record.category,
                'operation', TG_OP
            )
        );
        
        -- Add to activity feed
        INSERT INTO activity_feed (
            user_id, type, description, icon,
            expense_id, group_id, related_user_id, related_user_name,
            data
        ) VALUES (
            friend_record.friend_id,
            CASE 
                WHEN TG_OP = 'INSERT' THEN 'expense_added'
                ELSE 'expense_updated'
            END,
            user_record.name || ' ' || 
            CASE 
                WHEN TG_OP = 'INSERT' THEN 'added expense: ' 
                ELSE 'updated expense: '
            END || expense_record.description,
            CASE 
                WHEN TG_OP = 'INSERT' THEN '💰'
                ELSE '✏️'
            END,
            expense_record.id,
            expense_record.group_id,
            expense_record.created_by,
            user_record.name,
            jsonb_build_object(
                'amount', expense_record.amount,
                'category', expense_record.category
            )
        );
    END LOOP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 11. Triggers

-- Trigger to notify friends when expenses are added/updated
CREATE TRIGGER notify_friends_on_expense_change
    AFTER INSERT OR UPDATE ON expenses
    FOR EACH ROW
    EXECUTE FUNCTION notify_friends_expense_update();

-- Trigger to clean up old sync codes
CREATE OR REPLACE FUNCTION cleanup_expired_sync_codes()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM sync_codes WHERE expires_at < NOW() - INTERVAL '1 day';
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Run cleanup daily
CREATE TRIGGER cleanup_sync_codes
    AFTER INSERT ON sync_codes
    FOR EACH STATEMENT
    EXECUTE FUNCTION cleanup_expired_sync_codes();

-- 12. Useful Views

-- View for user's friends with latest activity
-- Note: Update column names based on your actual user_profiles schema
CREATE OR REPLACE VIEW user_friends_with_activity AS
SELECT 
    fr.user_id,
    fr.friend_id,
    COALESCE(up.full_name, up.display_name, 'Friend') as friend_name,
    up.email as friend_email,
    up.avatar_url as friend_avatar,
    fr.created_at as friendship_created,
    fr.status as friendship_status,
    COALESCE(latest_activity.last_activity, fr.created_at) as last_activity,
    latest_activity.activity_type
FROM friend_relationships fr
JOIN user_profiles up ON up.id = fr.friend_id
LEFT JOIN (
    SELECT DISTINCT ON (related_user_id, user_id)
        related_user_id,
        user_id as activity_for_user,
        created_at as last_activity,
        type as activity_type
    FROM activity_feed
    WHERE related_user_id IS NOT NULL
    ORDER BY related_user_id, user_id, created_at DESC
) latest_activity ON latest_activity.related_user_id = fr.friend_id 
                 AND latest_activity.activity_for_user = fr.user_id
WHERE fr.status = 'active'
ORDER BY COALESCE(latest_activity.last_activity, fr.created_at) DESC;

-- View for unread notifications count
CREATE OR REPLACE VIEW user_notification_stats AS
SELECT 
    user_id,
    COUNT(*) as total_notifications,
    COUNT(*) FILTER (WHERE NOT read) as unread_count,
    COUNT(*) FILTER (WHERE type = 'expense_added') as expense_added_count,
    COUNT(*) FILTER (WHERE type = 'expense_updated') as expense_updated_count,
    COUNT(*) FILTER (WHERE type = 'settlement_request') as settlement_requests_count,
    MAX(created_at) as latest_notification
FROM notifications
GROUP BY user_id;

-- 13. Sample data insertion function for testing
CREATE OR REPLACE FUNCTION create_sample_sync_code(
    user_uuid UUID,
    user_display_name VARCHAR(255) DEFAULT 'Test User'
)
RETURNS VARCHAR(8) AS $$
DECLARE
    new_code VARCHAR(8);
BEGIN
    new_code := generate_sync_code();
    
    INSERT INTO sync_codes (code, user_id, user_name, expires_at)
    VALUES (
        new_code, 
        user_uuid, 
        user_display_name,
        NOW() + INTERVAL '24 hours'
    );
    
    RETURN new_code;
END;
$$ LANGUAGE plpgsql;

-- 14. Indexes for performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_expenses_created_by ON expenses(created_by);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_expenses_group_id ON expenses(group_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_group_members_user_group ON group_members(user_id, group_id);

COMMENT ON TABLE sync_codes IS 'Anonymous sync codes for friend linking without registration';
COMMENT ON TABLE friend_relationships IS 'Bidirectional friend relationships';
COMMENT ON TABLE notifications IS 'Real-time notifications for users';
COMMENT ON TABLE activity_feed IS 'Activity timeline for users';
COMMENT ON TABLE notification_preferences IS 'User notification settings and push tokens';
COMMENT ON TABLE sync_queue IS 'Offline sync queue for data synchronization';