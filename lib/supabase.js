const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || 'your-supabase-url';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'your-supabase-anon-key';

const supabase = createClient(supabaseUrl, supabaseKey);

// Database operations
const db = {
  // User operations
  async createUser(userData) {
    const { data, error } = await supabase
      .from('users')
      .insert([{
        google_id: userData.id,
        email: userData.email,
        name: userData.name,
        picture_url: userData.picture
      }])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async getUserByGoogleId(googleId) {
    const { data, error } = await supabase
      .from('users')
      .select(`
        *,
        subscriptions (
          id,
          plan_type,
          billing_cycle,
          status,
          current_period_end
        )
      `)
      .eq('google_id', googleId)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  async updateUser(userId, updates) {
    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Subscription operations
  async createSubscription(subscriptionData) {
    const { data, error } = await supabase
      .from('subscriptions')
      .insert([subscriptionData])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async updateSubscription(subscriptionId, updates) {
    const { data, error } = await supabase
      .from('subscriptions')
      .update(updates)
      .eq('stripe_subscription_id', subscriptionId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async getSubscriptionByUserId(userId) {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  // Usage tracking
  async logUsage(userId, actionType, metadata = {}) {
    const { data, error } = await supabase
      .from('usage_logs')
      .insert([{
        user_id: userId,
        action_type: actionType,
        file_size_mb: metadata.fileSizeMb,
        pages_processed: metadata.pagesProcessed
      }])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async getUserUsageToday(userId) {
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('usage_logs')
      .select('action_type')
      .eq('user_id', userId)
      .gte('created_at', `${today}T00:00:00`)
      .lt('created_at', `${today}T23:59:59`);
    
    if (error) throw error;
    return data;
  },

  // Plan limits
  async getPlanLimits(planType) {
    const { data, error } = await supabase
      .from('plan_limits')
      .select('*')
      .eq('plan_type', planType)
      .single();
    
    if (error) throw error;
    return data;
  }
};

module.exports = { supabase, db };