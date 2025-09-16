export default function handler(req, res) {
    console.log('🔧 Config endpoint called');
    console.log('🔧 Request method:', req.method);
    console.log('🔧 Request headers:', req.headers);
    
    // Set comprehensive CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.setHeader('Access-Control-Allow-Credentials', 'false');
    
    if (req.method === 'OPTIONS') {
        console.log('🔧 OPTIONS request - returning 200');
        res.status(200).end();
        return;
    }
    
    if (req.method !== 'GET') {
        console.log('🔧 Invalid method:', req.method);
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    const googleClientId = process.env.GOOGLE_CLIENT_ID || '';
    const stripeKey = process.env.STRIPE_PUBLISHABLE_KEY || '';
    
    console.log('🔧 Environment variables:');
    console.log('🔑 GOOGLE_CLIENT_ID exists:', !!process.env.GOOGLE_CLIENT_ID);
    console.log('🔑 GOOGLE_CLIENT_ID length:', googleClientId.length);
    console.log('🔑 GOOGLE_CLIENT_ID first 20 chars:', googleClientId.substring(0, 20));
    console.log('🔑 STRIPE_PUBLISHABLE_KEY exists:', !!process.env.STRIPE_PUBLISHABLE_KEY);
    
    const responseData = {
        googleClientId: googleClientId,
        stripePublishableKey: stripeKey
    };
    
    console.log('🔧 Sending response:', responseData);
    res.json(responseData);
}