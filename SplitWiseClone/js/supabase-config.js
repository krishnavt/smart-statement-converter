// Supabase Configuration for SplitWise Production Backend
// This file contains the Supabase client setup and authentication utilities

console.log('🚀 SUPABASE CONFIG LOADING...');

// Supabase Configuration
const SUPABASE_CONFIG = {
    // Your Supabase project URL
    url: 'https://gvuptjfmskvttcysxprw.supabase.co',
    // Your Supabase anon/public key
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd2dXB0amZtc2t2dHRjeXN4cHJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwNjE3MjEsImV4cCI6MjA3MDYzNzcyMX0.mYBDc2DRSMFE0VbTYl3qGAQ2B8XriSsRNbdw0xdm3Sg',
    // Optional: Custom configuration
    options: {
        auth: {
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: true,
            flowType: 'pkce'
        },
        realtime: {
            params: {
                eventsPerSecond: 10
            }
        }
    }
};

// Initialize Supabase client
let supabase = null;

// Initialize Supabase with error handling
function initializeSupabase() {
    console.log('🚀 Starting Supabase initialization...');
    console.log('   - window defined:', typeof window !== 'undefined');
    console.log('   - window.supabase available:', !!window.supabase);
    
    try {
        if (typeof window !== 'undefined' && window.supabase) {
            supabase = window.supabase.createClient(
                SUPABASE_CONFIG.url,
                SUPABASE_CONFIG.anonKey,
                SUPABASE_CONFIG.options
            );
            console.log('✅ Supabase initialized successfully');
            console.log('   - Client created:', !!supabase);
            return true;
        } else {
            console.warn('⚠️ Supabase SDK not loaded, falling back to demo mode');
            console.log('   - Checking for CDN script...');
            const scripts = document.querySelectorAll('script[src*="supabase"]');
            console.log('   - Supabase scripts found:', scripts.length);
            return false;
        }
    } catch (error) {
        console.error('❌ Failed to initialize Supabase:', error);
        return false;
    }
}

// Authentication utilities
const SupabaseAuth = {
    // Check if Supabase is available
    isAvailable() {
        return supabase !== null;
    },

    // Sign up new user
    async signUp(email, password, metadata = {}) {
        if (!this.isAvailable()) {
            throw new Error('Supabase not available');
        }

        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: metadata
            }
        });

        if (error) throw error;
        return data;
    },

    // Sign in user
    async signIn(email, password) {
        if (!this.isAvailable()) {
            throw new Error('Supabase not available');
        }

        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) throw error;
        return data;
    },

    // Sign in with OAuth (Google, Apple, etc.)
    async signInWithOAuth(provider) {
        if (!this.isAvailable()) {
            throw new Error('Supabase not available');
        }

        const { data, error } = await supabase.auth.signInWithOAuth({
            provider,
            options: {
                redirectTo: window.location.origin + '/production-app.html'
            }
        });

        if (error) throw error;
        return data;
    },

    // Sign out user
    async signOut() {
        if (!this.isAvailable()) {
            // Fallback to local storage cleanup
            localStorage.removeItem('splitwise_session');
            sessionStorage.removeItem('splitwise_session');
            return;
        }

        const { error } = await supabase.auth.signOut();
        if (error) throw error;
    },

    // Get current session
    async getSession() {
        if (!this.isAvailable()) {
            // Fallback to local storage
            const session = localStorage.getItem('splitwise_session') || 
                           sessionStorage.getItem('splitwise_session');
            return session ? JSON.parse(session) : null;
        }

        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        return session;
    },

    // Get current user
    async getUser() {
        if (!this.isAvailable()) {
            const session = await this.getSession();
            return session?.user || null;
        }

        const { data: { user }, error } = await supabase.auth.getUser();
        if (error) throw error;
        return user;
    },

    // Update user metadata
    async updateUser(updates) {
        if (!this.isAvailable()) {
            throw new Error('Supabase not available');
        }

        const { data, error } = await supabase.auth.updateUser(updates);
        if (error) throw error;
        return data;
    },

    // Reset password
    async resetPassword(email) {
        if (!this.isAvailable()) {
            throw new Error('Supabase not available');
        }

        const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin + '/reset-password.html'
        });

        if (error) throw error;
        return data;
    },

    // Listen to auth state changes
    onAuthStateChange(callback) {
        if (!this.isAvailable()) {
            return () => {}; // Return empty unsubscribe function
        }

        const { data: { subscription } } = supabase.auth.onAuthStateChange(callback);
        return () => subscription.unsubscribe();
    }
};

// Database utilities
const SupabaseDB = {
    // Check if Supabase is available
    isAvailable() {
        return supabase !== null;
    },

    // User Profiles
    async getUserProfile(userId) {
        if (!this.isAvailable()) return null;

        const { data, error } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', userId)
            .single();

        if (error && error.code !== 'PGRST116') throw error;
        return data;
    },

    async updateUserProfile(userId, updates) {
        if (!this.isAvailable()) return null;

        // Try to update first
        const { data: updateData, error: updateError } = await supabase
            .from('user_profiles')
            .update(updates)
            .eq('id', userId)
            .select()
            .single();

        if (updateError && updateError.code === 'PGRST116') {
            // Profile doesn't exist, create it
            const { data: insertData, error: insertError } = await supabase
                .from('user_profiles')
                .insert({ id: userId, ...updates })
                .select()
                .single();

            if (insertError) throw insertError;
            return insertData;
        }

        if (updateError) throw updateError;
        return updateData;
    },

    // Expenses
    async getExpenses(userId) {
        if (!this.isAvailable()) return [];

        const { data, error } = await supabase
            .from('expenses')
            .select(`
                *,
                expense_splits (
                    *,
                    user_profiles (id, full_name, email)
                )
            `)
            .or(`paid_by.eq.${userId},expense_splits.user_id.eq.${userId}`);

        if (error) throw error;
        return data || [];
    },

    async createExpense(expense) {
        if (!this.isAvailable()) return null;

        const { data, error } = await supabase
            .from('expenses')
            .insert(expense)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    // Groups
    async getUserGroups(userId) {
        if (!this.isAvailable()) return [];

        const { data, error } = await supabase
            .from('group_members')
            .select(`
                groups (
                    id,
                    name,
                    description,
                    created_by,
                    created_at
                )
            `)
            .eq('user_id', userId);

        if (error) throw error;
        return data?.map(item => item.groups) || [];
    },

    async createGroup(group) {
        if (!this.isAvailable()) return null;

        const { data, error } = await supabase
            .from('groups')
            .insert(group)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    // Friends/Users
    async searchUsers(query) {
        if (!this.isAvailable()) return [];

        const { data, error } = await supabase
            .from('user_profiles')
            .select('id, full_name, email, avatar_url')
            .or(`full_name.ilike.%${query}%,email.ilike.%${query}%`)
            .limit(10);

        if (error) throw error;
        return data || [];
    },

    // Premium/Subscription functions
    async canCreateExpense(userId) {
        if (!this.isAvailable()) return false;

        const { data, error } = await supabase
            .rpc('can_create_expense', { user_id: userId });

        if (error) throw error;
        return data;
    },

    async canCreateGroup(userId) {
        if (!this.isAvailable()) return false;

        const { data, error } = await supabase
            .rpc('can_create_group', { user_id: userId });

        if (error) throw error;
        return data;
    },

    async incrementExpenseCount(userId) {
        if (!this.isAvailable()) return null;

        // First get current count
        const profile = await this.getUserProfile(userId);
        const currentCount = profile?.monthly_expense_count || 0;

        // Update with incremented count
        const { data, error } = await supabase
            .from('user_profiles')
            .update({ 
                monthly_expense_count: currentCount + 1
            })
            .eq('id', userId)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async getUserUsageStats(userId) {
        if (!this.isAvailable()) return null;

        // Get user profile with subscription info
        const profile = await this.getUserProfile(userId);
        
        // Get current month's expense count
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);
        
        const { data: expenses } = await supabase
            .from('expenses')
            .select('id')
            .eq('paid_by', userId)
            .gte('created_at', startOfMonth.toISOString());

        // Get group count
        const { data: groups } = await supabase
            .from('groups')
            .select('id')
            .eq('created_by', userId);

        return {
            subscriptionTier: profile?.subscription_tier || 'free',
            monthlyExpenseCount: expenses?.length || 0,
            groupCount: groups?.length || 0,
            expenseLimit: profile?.subscription_tier === 'premium' ? 'unlimited' : 50,
            groupLimit: profile?.subscription_tier === 'premium' ? 'unlimited' : 10
        };
    }
};

// Test if Supabase is available immediately
console.log('🧪 Initial Supabase check:', !!window.supabase);

// Initialize on load
document.addEventListener('DOMContentLoaded', function() {
    console.log('📄 DOM Content Loaded - checking Supabase again:', !!window.supabase);
    initializeSupabase();
    
    // If Supabase still not available, try again after a delay
    if (!window.supabase) {
        console.log('⏱️ Supabase not ready, retrying in 1 second...');
        setTimeout(() => {
            console.log('🔄 Retry - Supabase available:', !!window.supabase);
            if (window.supabase) {
                initializeSupabase();
            }
        }, 1000);
    }
});

// Export for use in other files
window.SupabaseAuth = SupabaseAuth;
window.SupabaseDB = SupabaseDB;
window.initializeSupabase = initializeSupabase;
window.getSupabaseClient = () => {
    console.log('📱 getSupabaseClient called, returning:', !!supabase);
    return supabase;
};
window.SUPABASE_CONFIG = SUPABASE_CONFIG;

console.log('📦 Supabase config exports set on window object');
console.log('   - SupabaseAuth:', !!window.SupabaseAuth);
console.log('   - SupabaseDB:', !!window.SupabaseDB);
console.log('   - initializeSupabase:', !!window.initializeSupabase);
console.log('   - getSupabaseClient:', !!window.getSupabaseClient);