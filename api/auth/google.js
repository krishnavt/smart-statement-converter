const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');

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
        const userId = payload['sub'];
        const email = payload['email'];
        const name = payload['name'];
        const picture = payload['picture'];
        const emailVerified = payload['email_verified'];
        
        // Create user data
        const userData = {
            id: userId,
            email: email,
            name: name,
            picture: picture,
            emailVerified: emailVerified,
            provider: 'google',
            loginAt: new Date().toISOString()
        };
        
        // Create JWT token for session
        const sessionToken = jwt.sign(
            { 
                userId: userData.id, 
                email: userData.email,
                name: userData.name,
                googleId: userData.id
            },
            process.env.JWT_SECRET || 'fallback-secret-change-in-production',
            { expiresIn: '7d' }
        );
        
        console.log('Google authentication successful for:', email);
        
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