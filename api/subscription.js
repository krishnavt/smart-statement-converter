import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    try {
        // Verify JWT token
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
        
        if (!token) {
            return res.status(401).json({ error: 'No authorization token provided' });
        }
        
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret-change-in-production');
        } catch (jwtError) {
            console.error('JWT verification error:', jwtError);
            return res.status(401).json({ error: 'Invalid or expired token' });
        }
        
        const { user_id, plan_type, billing_cycle, status, current_period_start, current_period_end, stripe_customer_id, stripe_subscription_id } = req.body;
        
        if (!user_id || !plan_type) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        // Verify that the user_id in the request matches the JWT token
        if (decoded.userId && decoded.userId !== user_id) {
            return res.status(403).json({ error: 'User ID mismatch' });
        }
        
        // Check if subscription already exists for this user
        const { data: existingSubscription, error: fetchError } = await supabase
            .from('subscriptions')
            .select('*')
            .eq('user_id', user_id)
            .eq('status', 'active')
            .single();
        
        if (fetchError && fetchError.code !== 'PGRST116') {
            console.error('Error fetching existing subscription:', fetchError);
            return res.status(500).json({ error: 'Database error' });
        }
        
        let result;
        
        if (existingSubscription) {
            // Update existing subscription
            const { data, error } = await supabase
                .from('subscriptions')
                .update({
                    plan_type: plan_type,
                    billing_cycle: billing_cycle,
                    status: status,
                    current_period_start: current_period_start,
                    current_period_end: current_period_end,
                    stripe_customer_id: stripe_customer_id,
                    stripe_subscription_id: stripe_subscription_id,
                    updated_at: new Date().toISOString()
                })
                .eq('id', existingSubscription.id)
                .select()
                .single();
            
            if (error) {
                console.error('Error updating subscription:', error);
                return res.status(500).json({ error: 'Failed to update subscription' });
            }
            
            result = data;
            console.log('✅ Updated existing subscription for user:', user_id);
        } else {
            // Create new subscription
            const { data, error } = await supabase
                .from('subscriptions')
                .insert([{
                    user_id: user_id,
                    plan_type: plan_type,
                    billing_cycle: billing_cycle,
                    status: status,
                    current_period_start: current_period_start,
                    current_period_end: current_period_end,
                    stripe_customer_id: stripe_customer_id,
                    stripe_subscription_id: stripe_subscription_id
                }])
                .select()
                .single();
            
            if (error) {
                console.error('Error creating subscription:', error);
                return res.status(500).json({ error: 'Failed to create subscription' });
            }
            
            result = data;
            console.log('✅ Created new subscription for user:', user_id);
        }
        
        return res.status(200).json({
            success: true,
            subscription: result,
            message: 'Subscription saved successfully'
        });
        
    } catch (error) {
        console.error('Subscription API error:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message
        });
    }
}