require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'demo-key-for-testing';

let supabase = null;

// Only initialize Supabase if credentials are provided
if (supabaseUrl && supabaseKey && supabaseUrl !== 'your_supabase_url_here' && supabaseKey !== 'your_supabase_anon_key_here') {
    try {
        supabase = createClient(supabaseUrl, supabaseKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        });
        console.log('✅ Supabase initialized successfully with service role key');
    } catch (error) {
        console.warn('⚠️ Supabase initialization failed:', error.message);
        supabase = null;
    }
} else {
    console.log('ℹ️ Supabase not configured, using file storage fallback');
}

// Database operations
const db = {
  // User operations
  async createUser(userData) {
    const { data, error } = await supabase
      .from('users')
      .insert([{
        id: userData.id,
        google_id: userData.google_id,
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

  async getUserById(userId) {
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
      .eq('id', userId)
      .single();
    
    if (error) throw error;
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
    if (!supabase) {
      throw new Error('Supabase not available');
    }
    
    console.log('📤 Creating subscription in database:', subscriptionData);
    const { data, error } = await supabase
      .from('subscriptions')
      .insert([subscriptionData])
      .select()
      .single();
    
    if (error) {
      console.error('❌ Error creating subscription:', error);
      throw error;
    }
    
    console.log('✅ Subscription created successfully:', data);
    return data;
  },

  async updateSubscription(subscriptionId, updates) {
    console.log('🔄 Updating subscription:', subscriptionId, updates);
    const { data, error } = await supabase
      .from('subscriptions')
      .update(updates)
      .eq('id', subscriptionId)
      .select()
      .single();
    
    if (error) {
      console.error('❌ Error updating subscription:', error);
      throw error;
    }
    
    console.log('✅ Subscription updated successfully:', data);
    return data;
  },

  async getSubscriptionByUserId(userId) {
    if (!supabase) {
      throw new Error('Supabase not available');
    }
    
    console.log('🔍 Fetching subscription for user:', userId);
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();
    
    if (error && error.code !== 'PGRST116') {
      console.error('❌ Error fetching subscription:', error);
      throw error;
    }
    
    console.log('✅ Subscription found:', data);
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
  },

  // Conversion operations
  async createConversion(conversionData) {
    if (!supabase) {
      throw new Error('Supabase not configured');
    }
    
    const { data, error } = await supabase
      .from('conversions')
      .insert([{
        user_id: conversionData.userId,
        filename: conversionData.filename,
        original_filename: conversionData.originalFilename,
        csv_data: conversionData.csvData,
        transaction_count: conversionData.transactionCount,
        file_size: conversionData.fileSize
      }])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async getConversionsByUserId(userId, limit = 50) {
    if (!supabase) {
      throw new Error('Supabase not configured');
    }
    
    const { data, error } = await supabase
      .from('conversions')
      .select('id, filename, original_filename, transaction_count, file_size, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    return data;
  },

  async getConversionById(conversionId, userId) {
    if (!supabase) {
      throw new Error('Supabase not configured');
    }
    
    const { data, error } = await supabase
      .from('conversions')
      .select('*')
      .eq('id', conversionId)
      .eq('user_id', userId)
      .single();
    
    if (error) throw error;
    return data;
  },

  async deleteConversion(conversionId, userId) {
    if (!supabase) {
      throw new Error('Supabase not configured');
    }
    
    const { data, error } = await supabase
      .from('conversions')
      .delete()
      .eq('id', conversionId)
      .eq('user_id', userId)
      .select();
    
    if (error) throw error;
    return data;
  }
};

module.exports = { supabase, db };