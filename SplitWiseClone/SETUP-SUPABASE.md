# Supabase Setup for Real-Time Notifications

## 📋 Quick Setup Steps

### 1. **Run the Schema Updates**
In your Supabase SQL Editor, run the `supabase-schema-updates.sql` file:

```sql
-- This will create all the new tables:
-- ✅ sync_codes (for friend linking)
-- ✅ friend_relationships (bidirectional friends)  
-- ✅ notifications (real-time notifications)
-- ✅ activity_feed (user activity timeline)
-- ✅ notification_preferences (user settings)
-- ✅ sync_queue (offline sync support)
-- ✅ And all the functions, triggers, and security policies
```

### 2. **Update Your Supabase Config**
Edit `supabase-integration.js` and add your actual Supabase credentials:

```javascript
// Replace these with your actual values from Supabase Dashboard
this.supabaseUrl = 'https://your-project.supabase.co';
this.supabaseKey = 'your-anon-key-here';
```

### 3. **Include Supabase in Your HTML**
Add to your `app-offline.html` (before closing `</body>`):

```html
<!-- Supabase Client -->
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>

<!-- Your integration -->
<script src="supabase-integration.js"></script>
```

### 4. **Enable Realtime on Tables**
In Supabase Dashboard → Database → Replication:

```
✅ Enable realtime for:
- notifications
- activity_feed  
- friend_relationships
- expenses (if not already enabled)
```

## 🔄 How It Works Now

### **Friend Connection Flow:**
```
1. Friend A clicks "Generate Code" → Creates sync_codes record
2. Friend B enters code → Calls add_friend_relationship()
3. Database creates bidirectional friendship
4. Both users get notification via realtime subscription
```

### **Expense Update Flow:**
```
1. Friend A updates expense → Triggers notify_friends_expense_update()
2. Database finds all friends in same group
3. Creates notifications for each friend
4. Realtime subscription delivers notification instantly
5. Friend B sees notification + browser push notification
```

### **Offline Support:**
```
- All operations work offline-first
- Changes sync when connection returns
- Local storage + Supabase cloud storage
- No data loss if offline for days
```

## 🧪 Testing the Real-Time Notifications

### **Test 1: Friend Addition**
```javascript
// In browser console on Device A:
const code = await SupabaseSync.generateSyncCode();
console.log('Share this code:', code);

// In browser console on Device B:
await SupabaseSync.addFriendByCode('CODE_HERE');
// Both devices should get notifications!
```

### **Test 2: Expense Updates**
```javascript
// On Device A (after being friends):
await SupabaseSync.createExpense({
    description: 'Test expense',
    amount: 25.50,
    category: 'food',
    group_id: 'your_group_id'
});
// Device B should get real-time notification!
```

## 📊 Database Functions You Can Use

### **Generate Sync Code:**
```sql
SELECT generate_sync_code();
-- Returns: 'AB12CD34'
```

### **Add Friends:**
```sql
SELECT add_friend_relationship(
    'user-uuid-1'::uuid, 
    'user-uuid-2'::uuid, 
    'AB12CD34'
);
```

### **Get User Stats:**
```sql
SELECT * FROM user_notification_stats 
WHERE user_id = 'your-user-id';
```

## 🔧 Troubleshooting

### **Notifications Not Working?**
1. Check browser console for errors
2. Verify realtime is enabled on tables
3. Check RLS policies allow your user
4. Test with different browsers/devices

### **Friends Not Syncing?**
1. Check sync_codes table has valid codes
2. Verify friend_relationships table is populated
3. Test with SQL queries directly first

### **Performance Issues?**
1. All tables have proper indexes
2. RLS policies are optimized
3. Cleanup functions remove old data
4. Consider limiting notification history

## 📱 Production Deployment

### **Security Checklist:**
- ✅ RLS policies prevent data leaks
- ✅ Sync codes expire after 24h
- ✅ Anonymous users can't access others' data
- ✅ Friend relationships are validated

### **Performance Optimizations:**
- ✅ Database indexes on all lookups
- ✅ Notification cleanup (keeps last 50)
- ✅ Activity feed cleanup (keeps last 100)
- ✅ Expired sync code cleanup

### **Monitoring:**
```sql
-- Check realtime connections
SELECT * FROM pg_stat_activity WHERE application_name = 'supabase_realtime';

-- Check notification volume
SELECT COUNT(*), type FROM notifications 
WHERE created_at > NOW() - INTERVAL '1 day'
GROUP BY type;
```

## 🎯 What You Get

✅ **Real-time friend notifications** when expenses are updated
✅ **Offline-first** with automatic cloud sync
✅ **No registration required** - anonymous user system
✅ **Friend syncing via codes** - no email/phone needed
✅ **Push notifications** - works when app is closed
✅ **Activity feed** - timeline of all changes
✅ **Scalable architecture** - handles thousands of users

The system is now **production-ready** for real friend-to-friend notifications!

## 🚀 Next Steps

1. Run the SQL schema updates
2. Add your Supabase credentials
3. Test with multiple devices
4. Deploy and share with friends!

Your notification system will now work across devices and update friends in real-time! 🎉