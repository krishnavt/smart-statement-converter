const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const { db } = require('../../lib/supabase.js');

const client = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.FRONTEND_URL || 'http://localhost:3000'
);

export default async function handler(req, res) {
    // Set comprehensive CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.setHeader('Access-Control-Allow-Credentials', 'false');
    
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }
    
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    try {
        const { credential } = req.body;
        
        if (!credential) {
            return res.status(400).json({ error: 'Missing Google credential' });
        }
        
        // Verify the Google token
        const ticket = await client.verifyIdToken({
            idToken: credential,
            audience: process.env.GOOGLE_CLIENT_ID,
        });
        
        const payload = ticket.getPayload();
        const googleUserData = {
            id: payload['sub'],
            email: payload['email'],
            name: payload['name'],
            picture: payload['picture'],
            emailVerified: payload['email_verified']
        };
        
        // Check if user exists in our database
        let user = await db.getUserByGoogleId(googleUserData.id);
        
        if (!user) {
            // Create new user
            user = await db.createUser(googleUserData);
            console.log('Created new user:', user.email);
        } else {
            // Update user info (in case name or picture changed)
            user = await db.updateUser(user.id, {
                name: googleUserData.name,
                picture_url: googleUserData.picture
            });
            console.log('Updated existing user:', user.email);
        }
        
        // Get user's current subscription
        const subscription = await db.getSubscriptionByUserId(user.id);
        
        // Create user data for frontend
        const userData = {
            id: user.id,
            googleId: user.google_id,
            email: user.email,
            name: user.name,
            picture: user.picture_url,
            provider: 'google',
            subscription: subscription ? {
                planType: subscription.plan_type,
                billingCycle: subscription.billing_cycle,
                status: subscription.status,
                currentPeriodEnd: subscription.current_period_end
            } : {
                planType: 'free',
                billingCycle: 'monthly',
                status: 'active',
                currentPeriodEnd: null
            },
            loginAt: new Date().toISOString()
        };
        
        // Create JWT token for session
        const sessionToken = jwt.sign(
            { 
                userId: user.id, 
                email: user.email,
                name: user.name,
                googleId: user.google_id
            },
            process.env.JWT_SECRET || 'fallback-secret-change-in-production',
            { expiresIn: '7d' }
        );
        
        console.log('Google authentication successful for:', user.email);
        
        // Return success response
        res.json({
            success: true,
            user: userData,
            token: sessionToken,
            message: 'Authentication successful'
        });
        
    } catch (error) {
        console.error('Google authentication error:', error);
        
        res.status(401).json({
            success: false,
            error: 'Authentication failed',
            message: error.message
        });
    }
}