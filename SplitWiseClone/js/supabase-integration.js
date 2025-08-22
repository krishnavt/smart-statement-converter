// Supabase Integration for Real-Time Notifications
// This bridges offline-first approach with real Supabase sync

// Note: Supabase client is loaded via CDN in HTML

class SupabaseSync {
    constructor() {
        // Enable Supabase for online-only mode
        console.log('🌐 Supabase enabled - running in online-only mode');
        
        this.userId = null;
        this.isOnline = navigator.onLine;
        this.syncQueue = [];
        this.subscriptions = new Map();
        this.supabaseDisabled = false;
        
        this.setupEventListeners();
        // Initialize Supabase for online mode
        this.initializeUser();
    }

    async initializeUser() {
        // Wait for Supabase to be initialized
        if (!window.supabase || !window.initializeSupabase) {
            console.warn('⚠️ Supabase not available');
            return;
        }
        
        // Initialize the client if not already done
        window.initializeSupabase();
        
        // Check if user already has a Supabase session
        const session = await window.SupabaseAuth.getSession();
        
        if (session && session.user) {
            this.userId = session.user.id;
            console.log('✅ User authenticated with Supabase:', this.userId);
            await this.setupRealtimeSubscriptions();
            await this.syncUserProfile(session.user);
        } else {
            console.log('👤 No Supabase session found, creating anonymous user');
            await this.createSupabaseUser();
        }
    }

    async createSupabaseUser() {
        console.log('🔐 ONLINE-ONLY AUTH - Starting real Supabase user creation...');
        
        try {
            // Get current custom user data
            const customSession = localStorage.getItem('splitwise_session');
            if (!customSession) {
                throw new Error('No custom session found');
            }
            
            const userData = JSON.parse(customSession).user;
            console.log('👤 Custom user data:', userData);
            
            // Create a proper unique email format for real authentication
            const timestamp = Date.now().toString();
            const userIdentifier = userData.name.toLowerCase().replace(/[^a-z0-9]/g, '');
            const workingEmail = `${userIdentifier}.${timestamp.slice(-8)}@gmail.com`;
            const workingPassword = `SecurePass123!${timestamp.slice(-4)}`;
            
            console.log('📧 Using Supabase email:', workingEmail);
            
            // Direct signup attempt
            console.log('📡 Attempting Supabase signup...');
            console.log('🔍 SupabaseAuth available:', !!window.SupabaseAuth);
            console.log('🔍 SupabaseAuth.signUp available:', !!window.SupabaseAuth?.signUp);
            
            if (!window.SupabaseAuth || !window.SupabaseAuth.signUp) {
                throw new Error('SupabaseAuth not properly initialized');
            }
            
            // Call signUp with proper awaiting
            console.log('📡 Calling SupabaseAuth.signUp...');
            const result = await window.SupabaseAuth.signUp(workingEmail, workingPassword, {
                full_name: userData.name,
                avatar_url: userData.avatar || '👤'
            });
            
            console.log('📊 Raw signup result:', result);
            console.log('📊 Result type:', typeof result);
            console.log('📊 Result keys:', result ? Object.keys(result) : 'null');
            
            // Handle the actual Supabase response format
            let data, error;
            if (result && typeof result === 'object') {
                if ('data' in result && 'error' in result) {
                    // Standard Supabase response format
                    data = result.data;
                    error = result.error;
                } else if ('user' in result || 'session' in result) {
                    // Direct response format
                    data = result;
                    error = null;
                } else {
                    // Unknown format
                    console.warn('⚠️ Unexpected response format:', result);
                    data = result;
                    error = null;
                }
            } else {
                data = null;
                error = new Error('Invalid response from SupabaseAuth.signUp');
            }
            
            console.log('📊 Signup response:', { data, error });
            console.log('📊 Signup data details:', data);
            console.log('📊 User in data:', data?.user);
            
            if (error) {
                console.error('❌ Signup error:', error);
                
                // If user exists, try signin
                if (error.message.includes('already') || error.message.includes('exist')) {
                    console.log('🔄 User exists, trying signin...');
                    const signInResult = await window.SupabaseAuth.signIn(workingEmail, workingPassword);
                    console.log('📊 Sign in result:', signInResult);
                    
                    let signInData, signInError;
                    if (signInResult && 'data' in signInResult) {
                        signInData = signInResult.data;
                        signInError = signInResult.error;
                    } else {
                        signInData = signInResult;
                        signInError = null;
                    }
                    
                    if (!signInError && signInData?.user?.id) {
                        this.userId = signInData.user.id;
                        console.log('✅ Signed in existing user:', this.userId);
                        // Sync profile but don't block on it
                        this.syncUserProfile(signInData.user).catch(error => 
                            console.warn('⚠️ Profile sync failed (non-blocking):', error.message)
                        );
                    } else {
                        throw new Error('Signin failed: ' + (signInError?.message || 'No user ID'));
                    }
                } else {
                    throw error;
                }
            } else if (data?.user?.id) {
                this.userId = data.user.id;
                console.log('✅ Created new user successfully:', this.userId);
                
                // Check if we got a session from signup
                if (data.session) {
                    console.log('✅ Session created during signup');
                } else {
                    console.log('⚠️ No session from signup, but user created - proceeding anyway');
                }
                
                // Store user credentials for later use (development only)
                localStorage.setItem('supabase_temp_creds', JSON.stringify({
                    email: workingEmail,
                    password: workingPassword,
                    userId: this.userId
                }));
                
                // Sync profile but don't block on it
                this.syncUserProfile(data.user).catch(error => 
                    console.warn('⚠️ Profile sync failed (non-blocking):', error.message)
                );
            } else if (data?.user) {
                // User created but may need confirmation - this is normal for Supabase
                console.log('⏳ User created, checking for ID...');
                console.log('📧 User email:', data.user.email);
                console.log('📧 User ID exists:', !!data.user.id);
                
                // Wait a moment and try to get the session
                await new Promise(resolve => setTimeout(resolve, 1000));
                const session = await window.SupabaseAuth.getSession();
                
                if (session && session.user && session.user.id) {
                    this.userId = session.user.id;
                    console.log('✅ Retrieved user ID from session:', this.userId);
                    // Sync profile but don't block on it
                    this.syncUserProfile(session.user).catch(error => 
                        console.warn('⚠️ Profile sync failed (non-blocking):', error.message)
                    );
                } else {
                    throw new Error('User created but ID not available - email confirmation may be required');
                }
            } else {
                console.log('📊 Full response data:', JSON.stringify(data, null, 2));
                throw new Error('Invalid signup response - no user data');
            }
            
            // Setup subscriptions
            if (this.userId) {
                await this.setupRealtimeSubscriptions();
            }
            
        } catch (error) {
            console.error('❌ Authentication failed completely:', error);
            console.error('⚠️ ONLINE-ONLY MODE: Authentication is required for friend features');
            throw new Error('Authentication required for online-only mode: ' + error.message);
        }
    }

    async tryAnonymousAuth() {
        try {
            console.log('🆔 Attempting anonymous authentication...');
            const supabaseClient = window.getSupabaseClient();
            if (!supabaseClient) {
                console.error('❌ Supabase client not available for anonymous auth');
                return false;
            }
            
            console.log('📡 Calling signInAnonymously...');
            const result = await supabaseClient.auth.signInAnonymously();
            console.log('📊 Anonymous auth result:', result);
            
            const { data: anonData, error: anonError } = result;
            
            if (anonError) {
                console.error('❌ Anonymous auth error:', anonError);
                return false;
            }
            
            if (anonData?.user?.id) {
                this.userId = anonData.user.id;
                console.log('✅ Anonymous user created successfully:', this.userId);
                console.log('👤 Anonymous user data:', anonData.user);
                return true;
            } else {
                console.error('❌ Anonymous auth succeeded but no user ID returned');
                console.log('📊 Anonymous data received:', anonData);
                return false;
            }
        } catch (error) {
            console.error('❌ Anonymous authentication exception:', error);
            return false;
        }
    }

    async syncUserProfile(supabaseUser) {
        try {
            const supabaseClient = window.getSupabaseClient();
            
            // Update or create user profile in user_profiles table
            const { error } = await supabaseClient
                .from('user_profiles')
                .upsert({
                    id: supabaseUser.id,
                    email: supabaseUser.email,
                    full_name: supabaseUser.user_metadata?.full_name || supabaseUser.email,
                    avatar_url: supabaseUser.user_metadata?.avatar_url || '👤',
                    updated_at: new Date().toISOString()
                });
                
            if (error) {
                console.warn('Warning: Could not sync user profile:', error);
            } else {
                console.log('✅ User profile synced');
            }
            
        } catch (error) {
            console.warn('Warning: Error syncing user profile:', error);
        }
    }

    checkCustomAuth() {
        console.log('🔍 Checking custom auth...');
        try {
            const session = localStorage.getItem('splitwise_session');
            console.log('📱 splitwise_session found:', !!session);
            
            if (session) {
                const sessionData = JSON.parse(session);
                console.log('📱 Session data:', sessionData);
                
                if (sessionData.user && sessionData.user.id) {
                    // Convert custom ID to UUID format for Supabase compatibility
                    this.userId = this.convertToUUID(sessionData.user.id);
                    console.log('✅ Using UUID-compatible user ID:', this.userId);
                    console.log('   Original ID:', sessionData.user.id);
                    return true;
                } else {
                    console.warn('❌ No user ID found in session data');
                }
            } else {
                console.warn('❌ No splitwise_session found');
            }
        } catch (error) {
            console.warn('❌ Error checking custom auth:', error);
        }
        console.log('❌ Custom auth check failed');
        return false;
    }

    // Convert custom user ID to UUID format
    convertToUUID(customId) {
        // Create a deterministic UUID from the custom ID
        // This ensures the same custom ID always produces the same UUID
        const crypto = window.crypto || window.msCrypto;
        
        if (crypto && crypto.subtle) {
            // Use a simple deterministic approach
            const hash = this.simpleHash(customId);
            return this.formatAsUUID(hash);
        } else {
            // Fallback: create a pseudo-UUID from the custom ID
            return this.createPseudoUUID(customId);
        }
    }

    // Simple hash function for deterministic UUID generation
    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash).toString(16).padStart(8, '0');
    }

    // Format hash as UUID
    formatAsUUID(hash) {
        // Pad or truncate to get 32 hex characters
        const padded = (hash + hash + hash + hash).substring(0, 32);
        return `${padded.substring(0, 8)}-${padded.substring(8, 12)}-${padded.substring(12, 16)}-${padded.substring(16, 20)}-${padded.substring(20, 32)}`;
    }

    // Create pseudo-UUID as fallback
    createPseudoUUID(customId) {
        // Use the custom ID to seed a deterministic UUID
        const seed = customId.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        const padded = (seed + '00000000000000000000000000000000').substring(0, 32);
        return `${padded.substring(0, 8)}-${padded.substring(8, 12)}-${padded.substring(12, 16)}-${padded.substring(16, 20)}-${padded.substring(20, 32)}`;
    }

    // Create a consistent hash from email for user identification
    createHashFromEmail(email) {
        // Create a deterministic UUID-like ID from email
        const normalizedEmail = email.toLowerCase().trim();
        const hash = this.simpleHash(normalizedEmail);
        
        // Create a UUID-like format for consistency with Supabase UUIDs
        return this.formatAsUUID(hash);
    }

    // Generate a proper UUID from any string input
    generateUUIDFromString(input) {
        // Create a deterministic UUID from any string input
        const normalizedInput = input.toLowerCase().trim();
        const hash = this.simpleHash(normalizedInput);
        
        // Create a proper UUID format for Supabase compatibility
        return this.formatAsUUID(hash);
    }

    // Generate a local sync code for fallback users
    generateLocalSyncCode() {
        // Generate a 6-character alphanumeric code
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code = '';
        for (let i = 0; i < 6; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }

    // Add a friend to local storage
    addLocalFriend(friendData) {
        try {
            const data = JSON.parse(localStorage.getItem('splitzee_data') || '{}');
            if (!data.friends) data.friends = {};
            
            // Add the friend
            data.friends[friendData.id] = {
                id: friendData.id,
                name: friendData.name,
                avatar: friendData.avatar,
                addedAt: friendData.addedAt || Date.now(),
                isLocal: friendData.isLocal || false
            };
            
            localStorage.setItem('splitzee_data', JSON.stringify(data));
            console.log('✅ Friend added to local storage:', friendData.name);
            
        } catch (error) {
            console.error('❌ Error adding local friend:', error);
            throw error;
        }
    }

    // Get current user's name for notifications
    getUserName() {
        try {
            // Try stored credentials first
            const storedCreds = localStorage.getItem('supabase_temp_creds');
            if (storedCreds) {
                const creds = JSON.parse(storedCreds);
                return creds.email.split('@')[0] || 'Unknown User';
            }
            
            // Try local session
            const customSession = localStorage.getItem('splitwise_session');
            if (customSession) {
                const userData = JSON.parse(customSession).user;
                return userData.name || 'Unknown User';
            }
            
            return 'Unknown User';
        } catch {
            return 'Unknown User';
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

        // Get the supabase client
        const supabaseClient = window.getSupabaseClient();
        if (!supabaseClient) {
            console.warn('⚠️ Supabase client not available for realtime subscriptions');
            return;
        }

        // Subscribe to notifications
        const notificationSubscription = supabaseClient
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
        const activitySubscription = supabaseClient
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

        // Subscribe to friend relationships (for real-time friend additions)
        // Listen for cases where current user is either user_id OR friend_id
        console.log('🔔 Setting up friend relationship subscriptions for user:', this.userId);
        
        const friendSubscription1 = supabaseClient
            .channel('friend_relationships_user')
            .on('postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'friend_relationships',
                    filter: `user_id=eq.${this.userId}`
                },
                (payload) => {
                    console.log('🔔 Friend subscription 1 triggered (user_id):', payload);
                    this.handleFriendAdded(payload.new);
                }
            )
            .subscribe((status) => {
                console.log('🔔 Friend subscription 1 status:', status);
            });

        const friendSubscription2 = supabaseClient
            .channel('friend_relationships_friend')
            .on('postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'friend_relationships',
                    filter: `friend_id=eq.${this.userId}`
                },
                (payload) => {
                    console.log('🔔 Friend subscription 2 triggered (friend_id):', payload);
                    this.handleFriendAdded(payload.new);
                }
            )
            .subscribe((status) => {
                console.log('🔔 Friend subscription 2 status:', status);
            });

        // Subscribe to expenses (for real-time expense updates)
        const expenseSubscription = supabaseClient
            .channel('expenses')
            .on('postgres_changes',
                {
                    event: '*', // INSERT, UPDATE, DELETE
                    schema: 'public',
                    table: 'expenses'
                },
                (payload) => this.handleExpenseChange(payload)
            )
            .subscribe((status) => {
                console.log('🔔 Expense subscription status:', status);
            });

        this.subscriptions.set('notifications', notificationSubscription);
        this.subscriptions.set('activity', activitySubscription);
        this.subscriptions.set('friends_user', friendSubscription1);
        this.subscriptions.set('friends_friend', friendSubscription2);
        this.subscriptions.set('expenses', expenseSubscription);

        console.log('🔔 Real-time subscriptions active');
        
        // Also set up a fallback polling mechanism in case realtime doesn't work
        this.setupFallbackPolling();
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

        // Handle specific notification types
        if (notification.type === 'friend_added') {
            console.log('🔄 Friend added notification received, refreshing friends list...');
            
            // Refresh friends list after a short delay
            setTimeout(() => {
                this.loadFriendsFromSupabase().then(friends => {
                    console.log('✅ Friends list refreshed via notification:', friends.length, 'friends');
                    
                    // Trigger UI updates
                    if (window.loadGroupMembers) {
                        window.loadGroupMembers();
                    }
                    if (window.updateFriendsList) {
                        window.updateFriendsList(friends);
                    }
                }).catch(err => {
                    console.warn('⚠️ Could not refresh friends list from notification:', err);
                });
            }, 1000);
        }

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

    handleFriendAdded(friendRelationship) {
        console.log('🔄 Friend relationship added via real-time subscription:', friendRelationship);
        
        // Refresh friends list immediately
        this.loadFriendsFromSupabase().then(friends => {
            console.log('✅ Friends list refreshed via friend subscription:', friends.length, 'friends');
            
            // Trigger UI updates
            if (window.loadGroupMembers) {
                window.loadGroupMembers();
            }
            if (window.updateFriendsList) {
                window.updateFriendsList(friends);
            }
        }).catch(err => {
            console.warn('⚠️ Could not refresh friends list from friend subscription:', err);
        });
    }

    setupFallbackPolling() {
        // Store initial friends count for comparison
        let lastFriendsCount = this.getFriends().length;
        
        // Poll every 5 seconds to check for friend changes
        setInterval(async () => {
            try {
                const currentFriends = await this.loadFriendsFromSupabase();
                
                if (currentFriends.length !== lastFriendsCount) {
                    console.log('🔄 Friends list changed detected via polling:', lastFriendsCount, '->', currentFriends.length);
                    lastFriendsCount = currentFriends.length;
                    
                    // Trigger UI updates
                    if (window.loadGroupMembers) {
                        window.loadGroupMembers();
                    }
                    if (window.updateFriendsList) {
                        window.updateFriendsList(currentFriends);
                    }
                }
            } catch (error) {
                console.warn('⚠️ Fallback polling error:', error);
            }
        }, 5000); // Poll every 5 seconds
        
        console.log('🔄 Fallback friend polling enabled (5s interval)');
    }

    handleExpenseChange(payload) {
        console.log('🔄 Expense change detected:', payload.eventType, payload);
        
        // Refresh expenses from Supabase
        this.loadExpensesFromSupabase().then(expenses => {
            console.log('✅ Expenses refreshed via real-time:', expenses.length, 'expenses');
            
            // Update local storage with synced expenses
            window.OfflineStorage.syncExpensesFromSupabase(expenses);
            
            // Trigger UI updates
            if (window.loadExpenses) {
                window.loadExpenses();
            }
            if (window.updateExpensesList) {
                window.updateExpensesList();
            }
            if (window.updateBalances) {
                window.updateBalances();
            }
        }).catch(err => {
            console.warn('⚠️ Could not refresh expenses from real-time update:', err);
        });
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
    
    // Data access methods for compatibility
    getUser() {
        try {
            const data = JSON.parse(localStorage.getItem('splitzee_data') || '{}');
            return data.user || null;
        } catch { return null; }
    }
    
    getExpenses() {
        try {
            const data = JSON.parse(localStorage.getItem('splitzee_data') || '{}');
            return Object.values(data.expenses || {});
        } catch { return []; }
    }
    
    // Generate a sync code for friend invitations (Online-only)
    async generateFriendCode() {
        console.log('🔗 Generating friend invitation code (Online-only)...');
        console.log('🔍 Checking authentication state:');
        console.log('   - this.userId:', this.userId);
        
        // Ensure user is authenticated
        if (!this.userId) {
            console.log('🔄 No userId found, attempting re-initialization...');
            await this.initializeUser();
            
            if (!this.userId) {
                throw new Error('User not authenticated with Supabase. Please refresh the page and try again.');
            }
        }
        
        try {
            const supabaseClient = window.getSupabaseClient();
            if (!supabaseClient) {
                throw new Error('Supabase client not initialized - online mode required');
            }
            
            // Get user info from multiple sources
            let user, userName, userAvatar;
            
            // First try session
            const session = await window.SupabaseAuth.getSession();
            if (session && session.user) {
                user = session.user;
                userName = user.user_metadata?.full_name || user.email || 'Unknown User';
                userAvatar = user.user_metadata?.avatar_url || '👤';
                console.log('👤 Using session user:', userName);
            } else {
                console.log('⚠️ No session found, using stored credentials...');
                
                // Try stored credentials
                const storedCreds = localStorage.getItem('supabase_temp_creds');
                if (storedCreds) {
                    const creds = JSON.parse(storedCreds);
                    userName = creds.email.split('@')[0] || 'Unknown User';
                    userAvatar = '👤';
                    console.log('👤 Using stored credentials for:', userName);
                } else {
                    // Final fallback: use local session info
                    const customSession = localStorage.getItem('splitwise_session');
                    if (customSession) {
                        const userData = JSON.parse(customSession).user;
                        userName = userData.name || 'Unknown User';
                        userAvatar = userData.avatar || '👤';
                        console.log('👤 Using local session for:', userName);
                    } else {
                        userName = 'Unknown User';
                        userAvatar = '👤';
                        console.log('👤 Using fallback user info');
                    }
                }
            }
            
            console.log('👤 Generating code for authenticated user:', userName);
            
            // Generate sync code using database function
            const { data: codeResult, error: codeError } = await supabaseClient
                .rpc('generate_sync_code');
                
            if (codeError) {
                console.error('❌ RPC error:', codeError);
                throw new Error('Failed to generate sync code: ' + codeError.message);
            }
            
            if (!codeResult) {
                throw new Error('No sync code returned from database function');
            }
            
            const syncCode = codeResult;
            
            // Create sync code entry
            const { error: insertError } = await supabaseClient
                .from('sync_codes')
                .insert([{
                    code: syncCode,
                    user_id: this.userId,
                    user_name: userName,
                    user_avatar: userAvatar,
                    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
                    used: false
                }]);
                
            if (insertError) {
                console.error('❌ Insert error:', insertError);
                throw new Error('Failed to store sync code: ' + insertError.message);
            }
            
            console.log('✅ Friend code generated and stored in Supabase:', syncCode);
            return {
                code: syncCode,
                expiresIn: '24 hours',
                userName: userName
            };
            
        } catch (error) {
            console.error('❌ Error generating friend code:', error);
            throw error;
        }
    }

    // Add friend using their sync code (Online-only)
    async addFriendByCode(syncCode) {
        console.log('🤝 Adding friend by code (Online-only):', syncCode);
        
        if (!this.userId) {
            throw new Error('User not authenticated');
        }
        
        try {
            const supabaseClient = window.getSupabaseClient();
            if (!supabaseClient) {
                throw new Error('Supabase client not initialized - online mode required');
            }
            
            // Find the sync code in Supabase database
            const { data: syncData, error: syncError } = await supabaseClient
                .from('sync_codes')
                .select('*')
                .eq('code', syncCode.toUpperCase())
                .eq('used', false)
                .gt('expires_at', new Date().toISOString())
                .single();
                
            if (syncError || !syncData) {
                console.error('❌ Sync code lookup error:', syncError);
                throw new Error('Invalid or expired friend code');
            }
            
            console.log('✅ Found valid sync code for user:', syncData.user_name);
            
            if (syncData.user_id === this.userId) {
                throw new Error('Cannot add yourself as a friend');
            }
            
            // Create friendship directly using database inserts
            console.log('🤝 Creating Supabase friend relationship...');
            
            // Insert bidirectional friendship
            const { error: friendError } = await supabaseClient
                .from('friend_relationships')
                .insert([
                    {
                        user_id: this.userId,
                        friend_id: syncData.user_id,
                        sync_code_used: syncCode.toUpperCase(),
                        status: 'active'
                    },
                    {
                        user_id: syncData.user_id,
                        friend_id: this.userId,
                        sync_code_used: syncCode.toUpperCase(),
                        status: 'active'
                    }
                ]);
                
            if (friendError) {
                console.error('❌ Friend relationship error:', friendError);
                throw new Error('Failed to create friendship: ' + friendError.message);
            }
            
            // Mark sync code as used
            const { error: updateError } = await supabaseClient
                .from('sync_codes')
                .update({ 
                    used: true, 
                    used_by: this.userId, 
                    used_at: new Date().toISOString() 
                })
                .eq('code', syncCode.toUpperCase());
                
            if (updateError) {
                console.warn('⚠️ Could not mark sync code as used:', updateError);
            }
            
            // Create notifications for both users about the new friendship
            const notifications = [
                {
                    user_id: this.userId,
                    type: 'friend_added',
                    title: 'New Friend Added',
                    message: `You're now connected with ${syncData.user_name}`,
                    icon: '👥',
                    from_user_id: syncData.user_id,
                    from_user_name: syncData.user_name
                },
                {
                    user_id: syncData.user_id,
                    type: 'friend_added', 
                    title: 'New Friend Added',
                    message: `Someone added you as a friend using your invite code`,
                    icon: '👥',
                    from_user_id: this.userId,
                    from_user_name: this.getUserName() || 'Someone'
                }
            ];
            
            // Insert notifications
            const { error: notificationError } = await supabaseClient
                .from('notifications')
                .insert(notifications);
                
            if (notificationError) {
                console.warn('⚠️ Could not create friend notifications:', notificationError);
            }
            
            console.log('✅ Supabase friend relationship created with:', syncData.user_name);
            
            // Refresh the friends list to show the new friend
            setTimeout(() => {
                this.loadFriendsFromSupabase().then(friends => {
                    console.log('🔄 Friends list refreshed, found:', friends.length, 'friends');
                    
                    // Trigger various UI update methods
                    if (window.updateFriendsList) {
                        window.updateFriendsList(friends);
                    }
                    if (window.loadGroupMembers) {
                        window.loadGroupMembers();
                    }
                    
                    // Force a page refresh to ensure friends list updates
                    console.log('🔄 Refreshing page to show new friend...');
                    window.location.reload();
                }).catch(err => {
                    console.warn('⚠️ Could not refresh friends list:', err);
                });
            }, 1000);
            
            return {
                friendId: syncData.user_id,
                friendName: syncData.user_name,
                friendAvatar: syncData.user_avatar,
                code: syncCode
            };
            
        } catch (error) {
            console.error('❌ Error adding friend by code:', error);
            throw error;
        }
    }

    // Legacy addFriend method - now redirects to proper system
    async addFriend(friendData) {
        console.log('📢 Use generateFriendCode() and addFriendByCode() for proper user relationships');
        throw new Error('Please use the new friend invitation system: generateFriendCode() and addFriendByCode()');
    }

    async loadFriendsFromSupabase() {
        if (!window.getSupabaseClient || !this.userId) {
            console.log('📱 Supabase not available or user not authenticated, using local friends only');
            return this.getFriendsLocal();
        }
        
        try {
            const supabaseClient = window.getSupabaseClient();
            if (!supabaseClient) {
                console.warn('Supabase client not initialized');
                return this.getFriendsLocal();
            }
            
            // Load real friend relationships from Supabase
            const { data: relationships, error } = await supabaseClient
                .from('friend_relationships')
                .select(`
                    friend_id,
                    created_at,
                    status
                `)
                .eq('user_id', this.userId)
                .eq('status', 'active');
                
            if (error) {
                console.warn('Failed to load friend relationships from Supabase:', error);
                return this.getFriendsLocal();
            }
            
            if (!relationships || relationships.length === 0) {
                console.log('📭 No friends found in Supabase');
                return this.getFriendsLocal();
            }
            
            // Get friend user profiles
            const friendIds = relationships.map(rel => rel.friend_id);
            const { data: friendProfiles, error: profileError } = await supabaseClient
                .from('user_profiles')
                .select('id, full_name, email, avatar_url')
                .in('id', friendIds);
                
            if (profileError) {
                console.warn('Failed to load friend profiles:', profileError);
                return this.getFriendsLocal();
            }
            
            // Convert to friend format
            const friends = friendProfiles.map(profile => ({
                id: profile.id,
                name: profile.full_name || profile.email,
                email: profile.email,
                avatar: profile.avatar_url || '👤',
                added: relationships.find(rel => rel.friend_id === profile.id)?.created_at,
                userId: this.userId,
                isRealUser: true
            }));
            
            console.log(`✅ Loaded ${friends.length} real user friends from Supabase`);
            
            // Also maintain local friends for backward compatibility
            const localData = JSON.parse(localStorage.getItem('splitzee_data') || '{}');
            if (!localData.friends) localData.friends = {};
            
            // Add real friends to local storage with special marking
            friends.forEach(friend => {
                localData.friends[friend.id] = friend;
            });
            
            localStorage.setItem('splitzee_data', JSON.stringify(localData));
            
            return friends;
        } catch (error) {
            console.error('Error loading friends from Supabase:', error);
            return this.getFriendsLocal();
        }
    }

    getFriendsLocal() {
        try {
            const data = JSON.parse(localStorage.getItem('splitzee_data') || '{}');
            return Object.values(data.friends || {});
        } catch { return []; }
    }

    getFriends() {
        // This method returns local friends synchronously
        // Use loadFriendsFromSupabase() for initial load with cloud sync
        return this.getFriendsLocal();
    }

    async loadExpensesFromSupabase() {
        if (!window.getSupabaseClient || !this.userId) {
            console.log('📱 Supabase not available or user not authenticated, using local expenses only');
            return this.getExpenses();
        }

        try {
            const supabaseClient = window.getSupabaseClient();
            
            // Load expenses where user is creator, payer, or participant
            const { data: expenses, error } = await supabaseClient
                .from('expenses')
                .select('*')
                .or(`created_by.eq.${this.userId},paid_by.eq.${this.userId},participants.cs.{${this.userId}}`);
                
            if (error) {
                console.warn('Failed to load expenses from Supabase:', error);
                return this.getExpenses();
            }
            
            console.log(`✅ Loaded ${expenses.length} expenses from Supabase`);
            return expenses || [];
        } catch (error) {
            console.error('Error loading expenses from Supabase:', error);
            return this.getExpenses();
        }
    }
    
    getGroups() {
        try {
            const data = JSON.parse(localStorage.getItem('splitzee_data') || '{}');
            return Object.values(data.groups || {});
        } catch { return []; }
    }
    
    getUsageStats() {
        try {
            const expenses = this.getExpenses();
            const groups = this.getGroups();
            const now = new Date();
            const thisMonth = now.getMonth();
            const thisYear = now.getFullYear();
            
            const expensesThisMonth = expenses.filter(expense => {
                const expenseDate = new Date(expense.createdAt);
                return expenseDate.getMonth() === thisMonth && expenseDate.getFullYear() === thisYear;
            }).length;
            
            const groupsThisMonth = groups.filter(group => {
                const groupDate = new Date(group.createdAt || Date.now());
                return groupDate.getMonth() === thisMonth && groupDate.getFullYear() === thisYear;
            }).length;
            
            return { expensesThisMonth, groupsThisMonth };
        } catch { return { expensesThisMonth: 0, groupsThisMonth: 0 }; }
    }
    
    updateUser(user) {
        try {
            const data = JSON.parse(localStorage.getItem('splitzee_data') || '{}');
            data.user = user;
            localStorage.setItem('splitzee_data', JSON.stringify(data));
        } catch (error) {
            console.error('Error updating user:', error);
        }
    }
    
    async deleteExpense(expenseId) {
        try {
            const data = JSON.parse(localStorage.getItem('splitzee_data') || '{}');
            if (data.expenses && data.expenses[expenseId]) {
                delete data.expenses[expenseId];
                localStorage.setItem('splitzee_data', JSON.stringify(data));
                return { success: true };
            }
            return { success: false, error: 'Expense not found' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
}

// Initialize Supabase integration (online-only mode)
window.SupabaseSync = new SupabaseSync();

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