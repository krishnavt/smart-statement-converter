require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'demo-key-for-testing';

let supabase = null;

// Only initialize Supabase if credentials are provided
if (supabaseUrl && supabaseKey && 
    supabaseUrl !== 'your_supabase_url_here' && 
    supabaseKey !== 'your_supabase_anon_key_here' && 
    supabaseKey !== 'your_supabase_service_role_key_here') {
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

// Helper function to convert Google ID to UUID format
function googleIdToUuid(googleId) {
  const crypto = require('crypto');
  // Create a consistent UUID from Google ID using MD5 hash
  const hash = crypto.createHash('md5').update(`google_${googleId}`).digest('hex');
  // Format as UUID v4
  return [
    hash.substr(0, 8),
    hash.substr(8, 4),
    '4' + hash.substr(12, 3), // Version 4 UUID
    ((parseInt(hash.substr(16, 1), 16) & 3) | 8).toString(16) + hash.substr(17, 3), // Variant bits
    hash.substr(20, 12)
  ].join('-');
}

// Database operations
const db = {
  // User operations
  async createUser(userData) {
    if (!supabase) {
      throw new Error('Supabase not configured');
    }
    
    const uuid = googleIdToUuid(userData.id);
    const { data, error } = await supabase
      .from('users')
      .insert([{
        id: uuid,
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

  async getUserById(userId) {
    if (!supabase) {
      throw new Error('Supabase not configured');
    }
    
    const uuid = googleIdToUuid(userId);
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
      .eq('id', uuid)
      .single();
    
    if (error) throw error;
    return data;
  },

  async updateUser(userId, updates) {
    if (!supabase) {
      throw new Error('Supabase not configured');
    }
    
    const uuid = googleIdToUuid(userId);
    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', uuid)
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
    
    const uuid = googleIdToUuid(userId);
    console.log('🔍 Fetching subscription for user:', userId, '-> UUID:', uuid);
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', uuid)
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
    
    const uuid = googleIdToUuid(conversionData.userId);
    const { data, error } = await supabase
      .from('conversions')
      .insert([{
        user_id: uuid,
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
    
    const uuid = googleIdToUuid(userId);
    const { data, error } = await supabase
      .from('conversions')
      .select('id, filename, original_filename, transaction_count, file_size, created_at')
      .eq('user_id', uuid)
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
    
    const uuid = googleIdToUuid(userId);
    const { data, error } = await supabase
      .from('conversions')
      .delete()
      .eq('id', conversionId)
      .eq('user_id', uuid)
      .select();
    
    if (error) throw error;
    return data;
  },

  // Credit usage operations
  async createCreditUsage(creditData) {
    if (!supabase) {
      throw new Error('Supabase not configured');
    }
    
    const uuid = googleIdToUuid(creditData.userId);
    const { data, error } = await supabase
      .from('credit_usage')
      .insert([{
        user_id: uuid,
        file_name: creditData.fileName,
        page_count: creditData.pageCount,
        credits_used: creditData.creditsUsed,
        description: creditData.description
      }])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async getCreditUsageByUserId(userId, limit = 50) {
    if (!supabase) {
      throw new Error('Supabase not configured');
    }
    
    const uuid = googleIdToUuid(userId);
    // Get credit usage from the last 28 days
    const twentyEightDaysAgo = new Date();
    twentyEightDaysAgo.setDate(twentyEightDaysAgo.getDate() - 28);
    
    const { data, error } = await supabase
      .from('credit_usage')
      .select('*')
      .eq('user_id', uuid)
      .gte('created_at', twentyEightDaysAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    return data || [];
  },

  // Credit limit checking
  // Conversion history operations (alias for frontend compatibility)
  async getConversionHistory(userId, limit = 50) {
    const data = await this.getConversionsByUserId(userId, limit);
    // Transform data to match frontend expectations
    return data.map(conversion => ({
      id: conversion.id,
      filename: conversion.original_filename || conversion.filename,
      timestamp: conversion.created_at,
      transactionCount: conversion.transaction_count,
      fileSize: conversion.file_size
    }));
  },

  async checkCreditLimits(userId) {
    if (!supabase) {
      // Fallback limits when no database
      return {
        isRegistered: !!userId && userId !== 'anonymous',
        dailyLimit: !!userId && userId !== 'anonymous' ? 5 : 1,
        currentUsage: 0,
        remaining: !!userId && userId !== 'anonymous' ? 5 : 1,
        canConvert: true
      };
    }
    
    const uuid = googleIdToUuid(userId);
    const today = new Date().toISOString().split('T')[0];
    
    // Check if user has subscription (for unlimited plans)
    let subscription = null;
    try {
      const { data: subData } = await supabase
        .from('subscriptions')
        .select('plan_type')
        .eq('user_id', uuid)
        .eq('status', 'active')
        .single();
      subscription = subData;
    } catch (subError) {
      // No subscription found
    }
    
    // Determine limits based on user type
    let dailyLimit;
    const isRegistered = userId && userId !== 'anonymous';
    
    if (subscription) {
      // Paid users get higher limits
      switch (subscription.plan_type) {
        case 'starter': dailyLimit = 50; break;
        case 'professional': dailyLimit = 200; break;
        default: dailyLimit = isRegistered ? 5 : 1;
      }
    } else {
      // Free users
      dailyLimit = isRegistered ? 5 : 1;
    }
    
    // Get today's usage
    const { data: todayUsage, error } = await supabase
      .from('credit_usage')
      .select('credits_used')
      .eq('user_id', uuid)
      .gte('created_at', `${today}T00:00:00`)
      .lt('created_at', `${today}T23:59:59`);
    
    if (error) throw error;
    
    const currentUsage = (todayUsage || []).reduce((sum, usage) => sum + usage.credits_used, 0);
    const remaining = Math.max(0, dailyLimit - currentUsage);
    const canConvert = remaining > 0;
    
    return {
      isRegistered,
      dailyLimit,
      currentUsage,
      remaining,
      canConvert,
      subscription: subscription?.plan_type || 'free'
    };
  }
};

module.exports = { supabase, db };