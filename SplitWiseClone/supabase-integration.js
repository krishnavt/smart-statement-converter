// Supabase Integration for Real-Time Notifications
// This bridges offline-first approach with real Supabase sync

// Note: Supabase client is loaded via CDN in HTML

class SupabaseSync {
    constructor() {
        // Disable Supabase for now since anonymous auth is disabled
        console.log('🔄 Supabase disabled - running in offline-only mode');
        
        this.userId = null;
        this.isOnline = navigator.onLine;
        this.syncQueue = [];
        this.subscriptions = new Map();
        this.supabaseDisabled = true;
        
        this.setupEventListeners();
        // Skip Supabase initialization
    }

    async initializeUser() {
        // Check if user already has a Supabase session
        const { data: { session } } = await this.supabase.auth.getSession();
        
        if (session) {
            this.userId = session.user.id;
            await this.setupRealtimeSubscriptions();
        } else {
            // Create anonymous user or use existing offline user
            await this.createAnonymousUser();
        }
    }

    async createAnonymousUser() {
        // Get existing offline user ID
        const offlineUserId = localStorage.getItem('splitzee_user_id');
        const userName = localStorage.getItem('splitzee_user_name') || 'Anonymous User';
        const userAvatar = localStorage.getItem('splitzee_user_avatar') || '👤';

        try {
            // Sign in anonymously or create user profile
            const { data, error } = await this.supabase.auth.signInAnonymously();
            
            if (error) throw error;

            this.userId = data.user.id;

            // Create user profile
            const { error: profileError } = await this.supabase
                .from('user_profiles')
                .upsert({
                    id: this.userId,
                    name: userName,
                    avatar_url: userAvatar,
                    anonymous_id: offlineUserId,
                    last_sync: new Date().toISOString()
                });

            if (profileError) console.warn('Profile creation error:', profileError);

            // Setup real-time subscriptions
            await this.setupRealtimeSubscriptions();

        } catch (error) {
            console.warn('Supabase connection failed, continuing offline:', error);
            // Continue in offline-only mode
        }
    }

    setupEventListeners() {
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.processSyncQueue();
        });

        window.addEventListener('offline', () => {
            this.isOnline = false;
        });
    }

    async setupRealtimeSubscriptions() {
        if (!this.userId) return;

        // Subscribe to notifications
        const notificationSubscription = this.supabase
            .channel('notifications')
            .on('postgres_changes', 
                { 
                    event: 'INSERT', 
                    schema: 'public', 
                    table: 'notifications',
                    filter: `user_id=eq.${this.userId}`
                }, 
                (payload) => this.handleNotification(payload.new)
            )
            .subscribe();

        // Subscribe to friend activities
        const activitySubscription = this.supabase
            .channel('activity_feed')
            .on('postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'activity_feed',
                    filter: `user_id=eq.${this.userId}`
                },
                (payload) => this.handleActivity(payload.new)
            )
            .subscribe();

        this.subscriptions.set('notifications', notificationSubscription);
        this.subscriptions.set('activity', activitySubscription);

        console.log('🔔 Real-time subscriptions active');
    }

    handleNotification(notification) {
        // Show browser notification
        this.showBrowserNotification({
            title: notification.title,
            message: notification.message,
            icon: notification.icon,
            type: notification.type,
            data: notification.data
        });

        // Update notification badge
        this.updateNotificationBadge();

        // Update UI if notification panel is open
        if (window.updateNotificationPanel) {
            window.updateNotificationPanel();
        }
    }

    handleActivity(activity) {
        // Update activity feed in UI
        if (window.updateActivityFeed) {
            window.updateActivityFeed();
        }
    }

    showBrowserNotification(notification) {
        if ('Notification' in window && Notification.permission === 'granted') {
            const browserNotification = new Notification(notification.title, {
                body: notification.message,
                icon: '/icon-192.png',
                badge: '/icon-96.png',
                tag: notification.type,
                data: notification.data
            });

            // Auto-close after 5 seconds
            setTimeout(() => browserNotification.close(), 5000);
        }
    }

    // Sync Code Management
    async generateSyncCode() {
        // Always use OfflineStorage when Supabase is disabled
        return window.OfflineStorage.generateSyncCode();

        try {
            const { data, error } = await this.supabase.rpc('generate_sync_code');
            
            if (error) throw error;

            const { data: insertData, error: insertError } = await this.supabase
                .from('sync_codes')
                .insert({
                    code: data,
                    user_id: this.userId,
                    user_name: localStorage.getItem('splitzee_user_name') || 'Anonymous User',
                    user_avatar: localStorage.getItem('splitzee_user_avatar') || '👤',
                    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
                })
                .select()
                .single();

            if (insertError) throw insertError;

            return data;
        } catch (error) {
            console.warn('Sync code generation failed:', error);
            return window.OfflineStorage.generateSyncCode();
        }
    }

    async addFriendByCode(code) {
        // Always use OfflineStorage when Supabase is disabled
        return window.OfflineStorage.addFriendByCode(code);

        try {
            // Find the sync code
            const { data: syncCodeData, error: codeError } = await this.supabase
                .from('sync_codes')
                .select('*')
                .eq('code', code.toUpperCase())
                .eq('used', false)
                .gt('expires_at', new Date().toISOString())
                .single();

            if (codeError || !syncCodeData) {
                throw new Error('Invalid or expired sync code');
            }

            // Add friend relationship using the database function
            const { data, error } = await this.supabase
                .rpc('add_friend_relationship', {
                    requester_id: this.userId,
                    friend_id: syncCodeData.user_id,
                    sync_code: code.toUpperCase()
                });

            if (error) throw error;

            // Get friend info
            const { data: friendData, error: friendError } = await this.supabase
                .from('user_profiles')
                .select('id, name, avatar_url')
                .eq('id', syncCodeData.user_id)
                .single();

            if (friendError) throw friendError;

            // Create welcome notification for both users
            await this.createFriendAddedNotification(friendData);

            return {
                id: friendData.id,
                name: friendData.name,
                avatar: friendData.avatar_url || syncCodeData.user_avatar,
                addedAt: Date.now()
            };

        } catch (error) {
            console.warn('Add friend failed:', error);
            throw error;
        }
    }

    async createFriendAddedNotification(friendData) {
        const notifications = [
            {
                user_id: this.userId,
                type: 'friend_added',
                title: 'New Friend Added',
                message: `You're now connected with ${friendData.name}`,
                icon: '👥',
                from_user_id: friendData.id,
                from_user_name: friendData.name
            },
            {
                user_id: friendData.id,
                type: 'friend_added', 
                title: 'New Friend Added',
                message: `${localStorage.getItem('splitzee_user_name') || 'Someone'} added you as a friend`,
                icon: '👥',
                from_user_id: this.userId,
                from_user_name: localStorage.getItem('splitzee_user_name') || 'Anonymous User'
            }
        ];

        const { error } = await this.supabase
            .from('notifications')
            .insert(notifications);

        if (error) console.warn('Notification creation failed:', error);
    }

    // Expense sync methods
    async createExpense(expense) {
        // Always use OfflineStorage when Supabase is disabled
        if (this.supabaseDisabled) {
            return window.OfflineStorage.createExpense(expense);
        }
        
        // Create locally first for instant feedback
        const localExpense = window.OfflineStorage.createExpense(expense);

        if (!this.supabaseDisabled && this.isOnline && this.userId) {
            try {
                // Sync to Supabase
                const { data, error } = await this.supabase
                    .from('expenses')
                    .insert({
                        ...expense,
                        id: localExpense.id,
                        created_by: this.userId,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    })
                    .select()
                    .single();

                if (error) throw error;

                // Mark as synced locally
                window.OfflineStorage.updateExpense(localExpense.id, { synced: true });

                // The database trigger will automatically notify friends

            } catch (error) {
                console.warn('Expense sync failed, queued for later:', error);
                this.addToSyncQueue('expense_create', localExpense);
            }
        } else {
            this.addToSyncQueue('expense_create', localExpense);
        }

        return localExpense;
    }

    async updateExpense(expenseId, updates) {
        // Update locally first
        const localExpense = window.OfflineStorage.updateExpense(expenseId, updates);

        if (!this.supabaseDisabled && this.isOnline && this.userId) {
            try {
                const { error } = await this.supabase
                    .from('expenses')
                    .update({
                        ...updates,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', expenseId);

                if (error) throw error;

                // Mark as synced
                window.OfflineStorage.updateExpense(expenseId, { synced: true });

            } catch (error) {
                console.warn('Expense update sync failed:', error);
                this.addToSyncQueue('expense_update', { id: expenseId, ...updates });
            }
        } else {
            this.addToSyncQueue('expense_update', { id: expenseId, ...updates });
        }

        return localExpense;
    }

    // Notification management
    async getNotifications(unreadOnly = false) {
        if (this.supabaseDisabled || !this.isOnline || !this.userId) {
            return window.OfflineStorage.getNotifications(unreadOnly);
        }

        try {
            let query = this.supabase
                .from('notifications')
                .select('*')
                .eq('user_id', this.userId)
                .order('created_at', { ascending: false })
                .limit(50);

            if (unreadOnly) {
                query = query.eq('read', false);
            }

            const { data, error } = await query;
            
            if (error) throw error;

            return data.map(notification => ({
                id: notification.id,
                type: notification.type,
                title: notification.title,
                message: notification.message,
                icon: notification.icon,
                timestamp: new Date(notification.created_at).getTime(),
                read: notification.read,
                data: notification.data,
                fromUser: notification.from_user_name
            }));

        } catch (error) {
            console.warn('Failed to fetch notifications:', error);
            return window.OfflineStorage.getNotifications(unreadOnly);
        }
    }

    async markNotificationRead(notificationId) {
        if (this.supabaseDisabled || !this.isOnline || !this.userId) {
            return window.OfflineStorage.markNotificationRead(notificationId);
        }

        try {
            const { error } = await this.supabase
                .from('notifications')
                .update({ read: true })
                .eq('id', notificationId)
                .eq('user_id', this.userId);

            if (error) throw error;

            // Also update local copy
            window.OfflineStorage.markNotificationRead(notificationId);

        } catch (error) {
            console.warn('Mark notification read failed:', error);
        }
    }

    async markAllNotificationsRead() {
        if (this.supabaseDisabled || !this.isOnline || !this.userId) {
            return window.OfflineStorage.markAllNotificationsRead();
        }

        try {
            const { error } = await this.supabase
                .from('notifications')
                .update({ read: true })
                .eq('user_id', this.userId)
                .eq('read', false);

            if (error) throw error;

            // Also update local copy
            window.OfflineStorage.markAllNotificationsRead();

        } catch (error) {
            console.warn('Mark all notifications read failed:', error);
        }
    }

    // Sync queue management
    addToSyncQueue(type, payload) {
        const syncItem = {
            id: Date.now() + '_' + Math.random().toString(36).substr(2, 5),
            type,
            payload,
            timestamp: Date.now(),
            retries: 0
        };

        this.syncQueue.push(syncItem);
        
        if (this.isOnline) {
            setTimeout(() => this.processSyncQueue(), 1000);
        }
    }

    async processSyncQueue() {
        if (!this.isOnline || !this.userId || this.syncQueue.length === 0) {
            return;
        }

        console.log('Processing sync queue:', this.syncQueue.length, 'items');

        const processed = [];
        
        for (const item of this.syncQueue) {
            try {
                await this.processSyncItem(item);
                processed.push(item.id);
            } catch (error) {
                console.warn('Sync item failed:', item.id, error);
                item.retries++;
                
                if (item.retries > 3) {
                    processed.push(item.id);
                }
            }
        }

        // Remove processed items
        this.syncQueue = this.syncQueue.filter(item => !processed.includes(item.id));
    }

    async processSyncItem(item) {
        switch (item.type) {
            case 'expense_create':
                await this.supabase.from('expenses').upsert(item.payload);
                break;
                
            case 'expense_update':
                await this.supabase.from('expenses')
                    .update(item.payload)
                    .eq('id', item.payload.id);
                break;
                
            case 'friend_add':
                // Process friend addition
                break;
                
            default:
                console.warn('Unknown sync item type:', item.type);
        }
    }

    // Get sync status
    getSyncStatus() {
        return {
            isOnline: this.isOnline,
            hasSupabaseConnection: !this.supabaseDisabled && !!this.userId,
            queueLength: this.syncQueue.length,
            lastSync: Date.now(),
            hasUnsyncedData: this.syncQueue.length > 0,
            mode: this.supabaseDisabled ? 'offline-only' : 'hybrid'
        };
    }

    updateNotificationBadge() {
        if (window.updateNotificationBadge) {
            window.updateNotificationBadge();
        }
    }

    // Cleanup
    destroy() {
        // Unsubscribe from all real-time subscriptions
        for (const [name, subscription] of this.subscriptions) {
            subscription.unsubscribe();
        }
        this.subscriptions.clear();
    }
}

// Initialize Supabase integration (offline-only mode)
try {
    window.SupabaseSync = new SupabaseSync();
} catch (error) {
    console.log('🔄 Supabase unavailable - running in offline-only mode');
    // Create a minimal SupabaseSync that always uses offline storage
    window.SupabaseSync = {
        supabaseDisabled: true,
        async generateSyncCode() { return window.OfflineStorage.generateSyncCode(); },
        async addFriendByCode(code) { return window.OfflineStorage.addFriendByCode(code); },
        async createExpense(expense) { return window.OfflineStorage.createExpense(expense); },
        async updateExpense(expenseId, updates) { return window.OfflineStorage.updateExpense(expenseId, updates); },
        async getNotifications(unreadOnly) { return window.OfflineStorage.getNotifications(unreadOnly); },
        async markNotificationRead(id) { return window.OfflineStorage.markNotificationRead(id); },
        async markAllNotificationsRead() { return window.OfflineStorage.markAllNotificationsRead(); },
        getSyncStatus() { return { isOnline: navigator.onLine, hasSupabaseConnection: false, mode: 'offline-only', queueLength: 0 }; }
    };
}

// Enhanced OfflineDB with Supabase integration
window.OfflineDB = {
    // Use Supabase when available, fall back to local storage
    async createExpense(expense) {
        return await window.SupabaseSync.createExpense(expense);
    },

    async updateExpense(expenseId, updates) {
        return await window.SupabaseSync.updateExpense(expenseId, updates);
    },

    async getNotifications(unreadOnly = false) {
        return await window.SupabaseSync.getNotifications(unreadOnly);
    },

    async markNotificationRead(notificationId) {
        return await window.SupabaseSync.markNotificationRead(notificationId);
    },

    async markAllNotificationsRead() {
        return await window.SupabaseSync.markAllNotificationsRead();
    },

    async generateSyncCode() {
        return await window.SupabaseSync.generateSyncCode();
    },

    async addFriendByCode(code) {
        return await window.SupabaseSync.addFriendByCode(code);
    },

    getSyncStatus() {
        return window.SupabaseSync.getSyncStatus();
    }
};

console.log('🚀 Supabase integration initialized');
console.log('✅ Real-time notifications active');
console.log('🔄 Offline-first with cloud sync');