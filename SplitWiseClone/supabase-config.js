// Supabase Configuration for SplitWise Production Backend
// This file contains the Supabase client setup and authentication utilities

// Supabase Configuration
const SUPABASE_CONFIG = {
    // Replace with your Supabase project URL
    url: 'https://your-project-ref.supabase.co',
    // Replace with your Supabase anon/public key
    anonKey: 'your-anon-key-here',
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
    try {
        if (typeof window !== 'undefined' && window.supabase) {
            supabase = window.supabase.createClient(
                SUPABASE_CONFIG.url,
                SUPABASE_CONFIG.anonKey,
                SUPABASE_CONFIG.options
            );
            console.log('✅ Supabase initialized successfully');
            return true;
        } else {
            console.warn('⚠️ Supabase SDK not loaded, falling back to demo mode');
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

        const { data, error } = await supabase
            .from('user_profiles')
            .upsert({ id: userId, ...updates })
            .select()
            .single();

        if (error) throw error;
        return data;
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
    }
};

// Initialize on load
document.addEventListener('DOMContentLoaded', function() {
    initializeSupabase();
});

// Export for use in other files
window.SupabaseAuth = SupabaseAuth;
window.SupabaseDB = SupabaseDB;
window.initializeSupabase = initializeSupabase;