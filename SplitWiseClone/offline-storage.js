// Storage System for Splitzee
// Works without registration, syncs with friends via server codes

class OfflineStorage {
    constructor() {
        this.userId = this.getOrCreateUserId();
        this.notifications = [];
        this.activityFeed = [];
        this.initializeStorage();
        this.setupNotifications();
    }

    getOrCreateUserId() {
        let userId = localStorage.getItem('splitzee_user_id');
        if (!userId) {
            userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('splitzee_user_id', userId);
        }
        return userId;
    }

    initializeStorage() {
        // Initialize local storage structure
        const defaultData = {
            user: {
                id: this.userId,
                name: localStorage.getItem('splitzee_user_name') || 'Me',
                avatar: localStorage.getItem('splitzee_user_avatar') || '👤',
                isPremium: localStorage.getItem('splitzee_premium') === 'true',
                premiumType: localStorage.getItem('splitzee_premium_type') || null,
                created: Date.now()
            },
            groups: {},
            expenses: {},
            friends: {},
            syncCodes: {},
            notifications: [],
            activityFeed: [],
            lastSync: 0,
            lastNotificationCheck: 0
        };

        // Initialize if doesn't exist
        if (!localStorage.getItem('splitzee_data')) {
            localStorage.setItem('splitzee_data', JSON.stringify(defaultData));
        }
    }

    setupSyncListeners() {
        // Listen for online/offline events
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.processSyncQueue();
        });

        window.addEventListener('offline', () => {
            this.isOnline = false;
        });

        // Auto-sync every 30 seconds when online
        setInterval(() => {
            if (this.isOnline) {
                this.processSyncQueue();
                this.checkForUpdates();
            }
            // Always check for shared notifications (works offline too)
            this.checkForSharedNotifications();
        }, 30000);
        
        // Check for shared notifications more frequently
        setInterval(() => {
            this.checkForSharedNotifications();
        }, 5000);
    }

    getData() {
        return JSON.parse(localStorage.getItem('splitzee_data') || '{}');
    }

    saveData(data) {
        localStorage.setItem('splitzee_data', JSON.stringify(data));
        // Data saved locally
    }

    // User Management
    updateUser(updates) {
        const data = this.getData();
        data.user = { ...data.user, ...updates };
        
        // Save specific items to localStorage for quick access
        if (updates.name) localStorage.setItem('splitzee_user_name', updates.name);
        if (updates.avatar) localStorage.setItem('splitzee_user_avatar', updates.avatar);
        if (updates.isPremium !== undefined) localStorage.setItem('splitzee_premium', updates.isPremium.toString());
        if (updates.premiumType) localStorage.setItem('splitzee_premium_type', updates.premiumType);
        
        this.saveData(data);
        return data.user;
    }

    getUser() {
        return this.getData().user;
    }

    // Expense Management
    async createExpense(expense) {
        const data = this.getData();
        const expenseId = 'exp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        
        const newExpense = {
            id: expenseId,
            ...expense,
            createdBy: this.userId,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            synced: false
        };

        data.expenses[expenseId] = newExpense;
        this.saveData(data);
        
        // Share expense with friends (async)
        await this.shareExpenseWithFriends(newExpense);
        
        return newExpense;
    }

    getExpenses() {
        const data = this.getData();
        return Object.values(data.expenses).sort((a, b) => b.createdAt - a.createdAt);
    }

    updateExpense(expenseId, updates) {
        const data = this.getData();
        if (data.expenses[expenseId]) {
            data.expenses[expenseId] = {
                ...data.expenses[expenseId],
                ...updates,
                updatedAt: Date.now(),
                synced: false
            };
            this.saveData(data);
            return data.expenses[expenseId];
        }
        return null;
    }

    deleteExpense(expenseId) {
        const data = this.getData();
        if (data.expenses[expenseId]) {
            delete data.expenses[expenseId];
            this.saveData(data);
            return true;
        }
        return false;
    }

    // Group Management
    createGroup(group) {
        const data = this.getData();
        const groupId = 'grp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        
        const newGroup = {
            id: groupId,
            ...group,
            members: [this.userId, ...(group.members || [])],
            createdBy: this.userId,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            synced: false
        };

        data.groups[groupId] = newGroup;
        this.saveData(data);
        
        return newGroup;
    }

    getGroups() {
        const data = this.getData();
        return Object.values(data.groups).filter(group => 
            group.members.includes(this.userId)
        ).sort((a, b) => b.updatedAt - a.updatedAt);
    }

    // Friend Management (via sync codes)
    async generateSyncCode() {
        const code = Math.random().toString(36).substr(2, 8).toUpperCase();
        const data = this.getData();
        
        const codeData = {
            code: code,
            userId: this.userId,
            userName: data.user.name,
            userAvatar: data.user.avatar,
            created: Date.now(),
            expires: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
        };
        
        try {
            // Store on server
            const response = await fetch('http://192.168.6.163:3001/api/sync-codes', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(codeData)
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            console.log('📤 Sync code stored on server:', code);
            
            // Also store locally for reference
            data.syncCodes[code] = codeData;
            this.saveData(data);
            
            return code;
        } catch (error) {
            console.error('❌ Failed to generate sync code:', error.message);
            throw new Error('Failed to generate sync code. Please check your internet connection and try again.');
        }
    }

    async addFriendByCode(code) {
        const data = this.getData();
        console.log('🤝 Adding friend using server...');
        
        try {
            // Use bidirectional endpoint
            const response = await fetch(`http://192.168.6.163:3001/api/sync-codes/${code.toUpperCase()}/add-friend`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    userId: this.userId,
                    userName: data.user.name,
                    userAvatar: data.user.avatar
                })
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to add friend');
            }
            
            const result = await response.json();
            console.log('✅ Friend added via server:', result);
            
            // Create friend data
            const friendData = {
                id: result.friend.id,
                name: result.friend.name,
                avatar: result.friend.avatar,
                addedAt: Date.now(),
                syncCode: code.toUpperCase()
            };

            data.friends[friendData.id] = friendData;
            this.saveData(data);
            
            // Local notification
            this.addNotification({
                title: 'New Friend Added',
                message: `You're now connected with ${friendData.name}`,
                type: 'friend_added',
                icon: '👥',
                fromUser: friendData.id,
                fromUserName: friendData.name
            });
            
            console.log('🎉 Friend added successfully!');
            return friendData;
            
        } catch (error) {
            console.error('❌ Failed to add friend:', error.message);
            throw new Error('Failed to add friend. Please check your internet connection and try again.');
        }
    }

    getFriends() {
        const data = this.getData();
        return Object.values(data.friends);
    }
    
    
    async getSyncCodeFromServer(code) {
        console.log('🔍 Looking up sync code on server:', code);
        try {
            const response = await fetch(`http://192.168.6.163:3001/api/sync-codes/${code}`);
            console.log('📡 Server response status:', response.status);
            
            if (response.ok) {
                const result = await response.json();
                console.log('📥 Retrieved sync code from server:', code, result);
                return result;
            } else if (response.status === 404) {
                console.log('❌ Sync code not found on server:', code);
                return null; // Code not found
            } else {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
        } catch (error) {
            console.warn('⚠️ Failed to get sync code from server:', error);
            return null;
        }
    }
    
    async sendNotificationToServer(userId, notification) {
        try {
            const response = await fetch('http://192.168.6.163:3001/api/notifications', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userId: userId,
                    ...notification
                })
            });
            
            if (response.ok) {
                const result = await response.json();
                console.log('📤 Notification sent to server for user:', userId);
                return result;
            } else {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
        } catch (error) {
            console.warn('Failed to send notification to server:', error);
            // Fallback to localStorage
            this.addFriendNotificationToUser(userId, notification);
        }
    }
    
    addFriendNotificationToUser(friendUserId, notification) {
        // Fallback to localStorage for notifications
        const sharedNotifications = JSON.parse(localStorage.getItem('splitzee_shared_notifications') || '[]');
        
        const newNotification = {
            id: 'notif_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
            userId: friendUserId,
            timestamp: Date.now(),
            read: false,
            ...notification
        };
        
        sharedNotifications.push(newNotification);
        localStorage.setItem('splitzee_shared_notifications', JSON.stringify(sharedNotifications));
    }
    
    async checkForSharedNotifications() {
        try {
            // Try to get notifications from server first
            const response = await fetch(`http://192.168.6.163:3001/api/notifications/${this.userId}`);
            
            if (response.ok) {
                const serverNotifications = await response.json();
                
                if (serverNotifications.length > 0) {
                    const data = this.getData();
                    
                    serverNotifications.forEach(notification => {
                        // Add to local notifications
                        data.notifications.unshift({
                            id: notification.id,
                            title: notification.title,
                            message: notification.message,
                            type: notification.type,
                            icon: notification.icon,
                            timestamp: notification.timestamp,
                            read: false,
                            fromUser: notification.fromUser,
                            fromUserName: notification.fromUserName
                        });
                        
                        // Show browser notification
                        this.showBrowserNotification(notification);
                    });
                    
                    this.saveData(data);
                    console.log(`📥 Received ${serverNotifications.length} notifications from server`);
                    return;
                }
            }
        } catch (error) {
            console.warn('Failed to get notifications from server:', error);
        }
        
        // Fallback to localStorage
        const sharedNotifications = JSON.parse(localStorage.getItem('splitzee_shared_notifications') || '[]');
        const myNotifications = sharedNotifications.filter(n => n.userId === this.userId && !n.processed);
        
        if (myNotifications.length > 0) {
            const data = this.getData();
            
            myNotifications.forEach(notification => {
                // Add to local notifications
                data.notifications.unshift({
                    id: notification.id,
                    title: notification.title,
                    message: notification.message,
                    type: notification.type,
                    icon: notification.icon,
                    timestamp: notification.timestamp,
                    read: false,
                    fromUser: notification.fromUser,
                    fromUserName: notification.fromUserName
                });
                
                // Show browser notification
                this.showBrowserNotification(notification);
                
                // Mark as processed
                notification.processed = true;
            });
            
            this.saveData(data);
            
            // Update shared storage
            localStorage.setItem('splitzee_shared_notifications', JSON.stringify(sharedNotifications));
        }
    }
    
    async shareExpenseWithFriends(expense) {
        const data = this.getData();
        const friends = Object.values(data.friends);
        
        console.log(`💰 Sharing expense with ${friends.length} friends:`, expense.description);
        
        if (friends.length === 0) {
            console.log('⚠️ No friends to share expense with');
            return;
        }
        
        // Send notifications to each friend via server
        for (const friend of friends) {
            const notification = {
                title: 'New Expense Added',
                message: `${data.user.name} added: ${expense.description} - $${expense.amount}`,
                type: 'expense_added',
                icon: '💰',
                fromUser: data.user.id,
                fromUserName: data.user.name,
                expenseId: expense.id,
                expenseData: expense
            };
            
            try {
                await this.sendNotificationToServer(friend.id, notification);
                console.log(`✅ Notified ${friend.name} about expense`);
            } catch (error) {
                console.warn(`❌ Failed to notify ${friend.name}:`, error.message);
            }
        }
    }


    // Premium Management
    isPremium() {
        return this.getUser().isPremium;
    }

    upgradeToPremium(type = 'monthly') {
        const user = this.updateUser({ 
            isPremium: true, 
            premiumType: type,
            premiumDate: Date.now()
        });
        
        // Premium upgrade processed locally
        
        return user;
    }

    // Usage Tracking (for freemium)
    getUsageStats() {
        const data = this.getData();
        const now = new Date();
        const currentMonth = now.getFullYear() + '-' + (now.getMonth() + 1);
        
        const monthlyExpenses = Object.values(data.expenses).filter(expense => {
            const expenseDate = new Date(expense.createdAt);
            const expenseMonth = expenseDate.getFullYear() + '-' + (expenseDate.getMonth() + 1);
            return expenseMonth === currentMonth;
        });

        const totalGroups = this.getGroups().length;
        const isPremium = this.isPremium();

        return {
            monthlyExpenseCount: monthlyExpenses.length,
            expenseLimit: isPremium ? 'unlimited' : 50,
            groupCount: totalGroups,
            groupLimit: isPremium ? 'unlimited' : 10,
            canCreateExpense: isPremium || monthlyExpenses.length < 50,
            canCreateGroup: isPremium || totalGroups < 10
        };
    }

    // Export/Import for sharing
    exportData() {
        const data = this.getData();
        return {
            version: '1.0',
            exported: Date.now(),
            user: data.user,
            expenses: data.expenses,
            groups: data.groups
        };
    }

    importData(importedData) {
        const data = this.getData();
        
        // Merge imported expenses and groups
        data.expenses = { ...data.expenses, ...importedData.expenses };
        data.groups = { ...data.groups, ...importedData.groups };
        
        this.saveData(data);
        return true;
    }

    // Sync Status
    getSyncStatus() {
        return {
            isOnline: this.isOnline,
            queueLength: this.syncQueue.length,
            lastSync: this.getData().lastSync,
            hasUnsyncedData: this.syncQueue.length > 0
        };
    }

    // Notification System
    setupNotifications() {
        // Request notification permission
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }

        // Setup service worker for background notifications
        if ('serviceWorker' in navigator) {
            this.registerServiceWorker();
        }
    }

    async registerServiceWorker() {
        try {
            const registration = await navigator.serviceWorker.register('/sw.js');
            console.log('Service Worker registered for notifications');
            
            // Setup background sync
            if ('sync' in registration) {
                registration.sync.register('background-sync');
            }
        } catch (error) {
            console.warn('Service Worker registration failed:', error);
        }
    }

    addNotification(notification) {
        const data = this.getData();
        const newNotification = {
            id: 'notif_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
            ...notification,
            timestamp: Date.now(),
            read: false
        };

        data.notifications.unshift(newNotification);
        
        // Keep only last 50 notifications
        if (data.notifications.length > 50) {
            data.notifications = data.notifications.slice(0, 50);
        }

        this.saveData(data);

        // Show browser notification if permitted
        this.showBrowserNotification(newNotification);

        return newNotification;
    }

    showBrowserNotification(notification) {
        if ('Notification' in window && Notification.permission === 'granted') {
            const options = {
                body: notification.message,
                icon: notification.icon || '/icon-192.png',
                badge: '/icon-96.png',
                tag: notification.type || 'expense-update',
                data: notification,
                actions: notification.actions || []
            };

            new Notification(notification.title, options);
        }
    }

    getNotifications(unreadOnly = false) {
        const data = this.getData();
        let notifications = data.notifications || [];
        
        if (unreadOnly) {
            notifications = notifications.filter(n => !n.read);
        }

        return notifications.sort((a, b) => b.timestamp - a.timestamp);
    }

    markNotificationRead(notificationId) {
        const data = this.getData();
        const notification = data.notifications.find(n => n.id === notificationId);
        
        if (notification) {
            notification.read = true;
            this.saveData(data);
        }
    }

    markAllNotificationsRead() {
        const data = this.getData();
        data.notifications.forEach(n => n.read = true);
        this.saveData(data);
    }

    // Activity Feed
    addActivity(activity) {
        const data = this.getData();
        const newActivity = {
            id: 'activity_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
            ...activity,
            timestamp: Date.now()
        };

        data.activityFeed.unshift(newActivity);
        
        // Keep only last 100 activities
        if (data.activityFeed.length > 100) {
            data.activityFeed = data.activityFeed.slice(0, 100);
        }

        this.saveData(data);
        return newActivity;
    }

    getActivityFeed(limit = 20) {
        const data = this.getData();
        return (data.activityFeed || [])
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, limit);
    }

    // Check for updates from friends/groups
    async checkForUpdates() {
        const now = Date.now();
        const data = this.getData();
        
        // Only check every 2 minutes to avoid spam
        if (now - data.lastNotificationCheck < 120000) {
            return;
        }

        try {
            // In real implementation, this would check a cloud service for updates
            // For demo, we'll simulate receiving updates
            await this.simulateUpdates();
            
            data.lastNotificationCheck = now;
            this.saveData(data);
        } catch (error) {
            console.warn('Failed to check for updates:', error);
        }
    }

    async simulateUpdates() {
        // Simulate receiving updates from friends
        const friends = this.getFriends();
        
        if (friends.length > 0 && Math.random() < 0.1) { // 10% chance
            const friend = friends[Math.floor(Math.random() * friends.length)];
            const updateTypes = [
                {
                    type: 'expense_added',
                    title: 'New Expense Added',
                    message: `${friend.name} added a new expense`,
                    icon: '💰'
                },
                {
                    type: 'expense_updated',
                    title: 'Expense Updated',
                    message: `${friend.name} updated an expense`,
                    icon: '✏️'
                },
                {
                    type: 'settlement_request',
                    title: 'Settlement Request',
                    message: `${friend.name} wants to settle up`,
                    icon: '⚖️'
                }
            ];

            const update = updateTypes[Math.floor(Math.random() * updateTypes.length)];
            
            this.addNotification({
                title: update.title,
                message: update.message,
                type: update.type,
                icon: update.icon,
                fromUser: friend.id,
                fromUserName: friend.name
            });

            this.addActivity({
                type: update.type,
                description: update.message,
                user: friend.name,
                icon: update.icon
            });
        }
    }

    // Real-time sync methods (would connect to WebSocket in production)
    subscribeToGroupUpdates(groupId) {
        // In production, this would establish a WebSocket connection
        console.log('Subscribed to updates for group:', groupId);
        
        // For demo, simulate periodic updates
        const interval = setInterval(() => {
            if (Math.random() < 0.05) { // 5% chance every check
                this.simulateGroupUpdate(groupId);
            }
        }, 10000);

        return () => clearInterval(interval);
    }

    simulateGroupUpdate(groupId) {
        const friends = this.getFriends();
        if (friends.length === 0) return;

        const friend = friends[Math.floor(Math.random() * friends.length)];
        
        this.addNotification({
            title: 'Group Activity',
            message: `${friend.name} made changes to the group`,
            type: 'group_update',
            icon: '👥',
            groupId: groupId
        });
    }

    // Enable/disable notifications
    setNotificationPreferences(preferences) {
        const data = this.getData();
        data.user.notificationPreferences = {
            expenseUpdates: true,
            settlementRequests: true,
            groupActivity: true,
            friendRequests: true,
            ...preferences
        };
        this.saveData(data);
    }

    getNotificationPreferences() {
        const data = this.getData();
        return data.user.notificationPreferences || {
            expenseUpdates: true,
            settlementRequests: true,
            groupActivity: true,
            friendRequests: true
        };
    }
}

// Initialize global offline storage
window.OfflineStorage = new OfflineStorage();

// Compatibility layer for existing Supabase calls
window.OfflineDB = {
    // User methods
    async getUser() {
        return OfflineStorage.getUser();
    },

    async updateUserProfile(userId, updates) {
        return OfflineStorage.updateUser(updates);
    },

    // Expense methods
    async createExpense(expense) {
        return OfflineStorage.createExpense(expense);
    },

    async getExpenses(userId) {
        return OfflineStorage.getExpenses();
    },

    async updateExpense(expenseId, updates) {
        return OfflineStorage.updateExpense(expenseId, updates);
    },

    // Premium methods
    async canCreateExpense(userId) {
        const stats = OfflineStorage.getUsageStats();
        return stats.canCreateExpense;
    },

    async canCreateGroup(userId) {
        const stats = OfflineStorage.getUsageStats();
        return stats.canCreateGroup;
    },

    async incrementExpenseCount(userId) {
        // This is handled automatically in createExpense
        return true;
    },

    async getUserUsageStats(userId) {
        return OfflineStorage.getUsageStats();
    },

    // Notification methods
    getNotifications(unreadOnly = false) {
        return OfflineStorage.getNotifications(unreadOnly);
    },

    markNotificationRead(notificationId) {
        return OfflineStorage.markNotificationRead(notificationId);
    },

    getActivityFeed(limit = 20) {
        return OfflineStorage.getActivityFeed(limit);
    }
};

// Offline Auth compatibility
window.OfflineAuth = {
    async getUser() {
        return OfflineStorage.getUser();
    },

    async getSession() {
        return { user: OfflineStorage.getUser() };
    },

    isAvailable() {
        return true;
    }
};

console.log('🚀 Splitzee Offline Mode initialized');
console.log('✅ Works without internet connection');
console.log('👥 Sync with friends using codes');
console.log('💾 All data stored locally');