const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs-extra');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Import existing modules
const { db } = require('../lib/supabase');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Create Express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Content Security Policy for Google Sign-In
app.use((req, res, next) => {
    res.setHeader('Content-Security-Policy', 
        "default-src 'self'; " +
        "script-src 'self' 'unsafe-inline' https://accounts.google.com https://js.stripe.com; " +
        "style-src 'self' 'unsafe-inline' https://accounts.google.com; " +
        "style-src-elem 'self' 'unsafe-inline' https://accounts.google.com; " +
        "frame-src 'self' https://accounts.google.com https://js.stripe.com; " +
        "connect-src 'self' https://accounts.google.com https://api.stripe.com; " +
        "img-src 'self' data: https:; " +
        "font-src 'self' data:; " +
        "frame-ancestors 'self';"
    );
    next();
});

// Manual static file serving for Vercel
const serveStaticFile = (req, res, next) => {
    const filePath = req.path;
    
    // Skip API routes
    if (filePath.startsWith('/api/')) {
        return next();
    }
    
    let fullPath;
    let contentType;
    
    // Remove leading slash for path.join
    const cleanPath = filePath.startsWith('/') ? filePath.substring(1) : filePath;
    
    // Determine file type and set content type
    if (filePath.endsWith('.css')) {
        fullPath = path.join(__dirname, '..', cleanPath);
        contentType = 'text/css';
    } else if (filePath.endsWith('.js')) {
        fullPath = path.join(__dirname, '..', cleanPath);
        contentType = 'application/javascript';
    } else if (filePath.endsWith('.json')) {
        fullPath = path.join(__dirname, '..', cleanPath);
        contentType = 'application/json';
    } else if (filePath.match(/\.(png|jpg|jpeg|gif|ico|svg)$/)) {
        fullPath = path.join(__dirname, '..', cleanPath);
        const extension = filePath.split('.').pop().toLowerCase();
        if (extension === 'svg') {
            contentType = 'image/svg+xml';
        } else if (extension === 'ico') {
            contentType = 'image/x-icon';
        } else {
            contentType = 'image/' + extension;
        }
    } else if (filePath.endsWith('.html')) {
        fullPath = path.join(__dirname, '..', cleanPath);
        contentType = 'text/html';
    } else if (filePath.endsWith('.txt')) {
        fullPath = path.join(__dirname, '..', cleanPath);
        contentType = 'text/plain';
    } else {
        return next();
    }
    
    try {
        console.log('Trying to serve:', fullPath, 'exists:', fs.existsSync(fullPath));
        if (fs.existsSync(fullPath)) {
            const fileContent = fs.readFileSync(fullPath);
            res.setHeader('Content-Type', contentType);
            res.setHeader('Cache-Control', 'public, max-age=3600');
            
            // Add additional headers for JS files to prevent CORS issues
            if (filePath.endsWith('.js')) {
                res.setHeader('Access-Control-Allow-Origin', '*');
            }
            
            res.send(fileContent);
        } else {
            console.log('File not found:', fullPath);
            next();
        }
    } catch (error) {
        console.log('Static file error:', error.message);
        next();
    }
};

app.use(serveStaticFile);

// Health check endpoint
app.get('/api/health', async (req, res) => {
    try {
        res.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            services: {
                database: true,
                stripe: !!stripe
            }
        });
    } catch (error) {
        res.status(503).json({
            status: 'unhealthy',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Debug endpoint to check file structure
app.get('/api/debug-files', (req, res) => {
    try {
        const rootDir = path.join(__dirname, '..');
        const files = fs.readdirSync(rootDir);
        
        const fileInfo = {
            currentDir: __dirname,
            parentDir: rootDir,
            files: files,
            stylesExist: fs.existsSync(path.join(rootDir, 'styles.css')),
            jsDir: fs.existsSync(path.join(rootDir, 'js')) ? fs.readdirSync(path.join(rootDir, 'js')) : 'js directory not found'
        };
        
        res.json(fileInfo);
    } catch (error) {
        res.json({ error: error.message });
    }
});

// File upload endpoint (simplified for Vercel)
app.post('/api/upload', async (req, res) => {
    try {
        const multer = require('multer');
        const upload = multer({
            dest: '/tmp/',
            limits: {
                fileSize: 10 * 1024 * 1024, // 10MB
                files: 1
            },
            fileFilter: (req, file, cb) => {
                if (file.mimetype === 'application/pdf') {
                    cb(null, true);
                } else {
                    cb(new Error('Only PDF files are allowed'), false);
                }
            }
        });

        upload.single('file')(req, res, async (err) => {
            if (err) {
                return res.status(400).json({ error: err.message });
            }

            if (!req.file) {
                return res.status(400).json({ error: 'No file uploaded' });
            }

            try {
                // Process PDF directly (simplified for Vercel)
                const pdfBuffer = await fs.readFile(req.file.path);
                const pdfParse = require('pdf-parse');
                const pdfData = await pdfParse(pdfBuffer);
                
                // Clean up temp file
                await fs.unlink(req.file.path);
                
                // Process bank statement data
                const processedData = processBankStatement(pdfData.text);
                
                res.json({
                    success: true,
                    data: processedData,
                    message: 'File processed successfully'
                });
            } catch (error) {
                // Clean up temp file on error
                if (req.file && await fs.pathExists(req.file.path)) {
                    await fs.unlink(req.file.path);
                }
                res.status(500).json({ error: 'File processing failed' });
            }
        });
    } catch (error) {
        res.status(500).json({ error: 'Upload failed' });
    }
});

// Process bank statement text
function processBankStatement(text) {
    const lines = text.split('\n').filter(line => line.trim());
    const transactions = [];
    const patterns = {
        date: /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/,
        amount: /([+-]?\$?\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/,
        description: /([A-Za-z\s]+)/
    };
    
    for (const line of lines) {
        const dateMatch = line.match(patterns.date);
        const amountMatch = line.match(patterns.amount);
        const descMatch = line.match(patterns.description);
        
        if (dateMatch && amountMatch) {
            transactions.push({
                date: dateMatch[1],
                amount: amountMatch[1],
                description: descMatch ? descMatch[1].trim() : '',
                raw: line.trim()
            });
        }
    }
    
    return {
        totalTransactions: transactions.length,
        transactions,
        metadata: {
            processedAt: new Date().toISOString(),
            textLength: text.length
        }
    };
}

// Auth config endpoint
app.get('/api/auth/config', (req, res) => {
    res.json({
        googleClientId: process.env.GOOGLE_CLIENT_ID || '',
        stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY || ''
    });
});

// Login page endpoint
app.get('/api/login', (req, res) => {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Login - Smart Statement Converter</title>
    <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline' https://accounts.google.com; style-src 'self' 'unsafe-inline' https://accounts.google.com; style-src-elem 'self' 'unsafe-inline' https://accounts.google.com; frame-src 'self' https://accounts.google.com; connect-src 'self' https://accounts.google.com; img-src 'self' data: https:;">
    <link rel="stylesheet" href="/styles.css">
    <script src="https://accounts.google.com/gsi/client" async defer></script>
</head>
<body>
    <header class="header">
        <div class="container">
            <nav class="navbar">
                <div class="nav-brand">
                    <div class="logo">
                        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                            <rect x="4" y="8" width="24" height="16" rx="2" stroke="#4F46E5" stroke-width="2" fill="#4F46E5"/>
                            <rect x="6" y="10" width="20" height="2" fill="white"/>
                            <rect x="6" y="14" width="12" height="2" fill="white"/>
                            <rect x="6" y="18" width="16" height="2" fill="white"/>
                        </svg>
                        <a href="/" style="text-decoration: none; color: inherit;">
                            <span>SMART STATEMENT CONVERTER</span>
                        </a>
                    </div>
                </div>
                <div class="nav-menu">
                    <a href="/#pricing" class="nav-link">Pricing</a>
                    <a href="/api/login" class="nav-link">Login</a>
                    <a href="/api/register" class="nav-link primary">Register</a>
                </div>
            </nav>
        </div>
    </header>
    <section class="hero" style="min-height: 80vh; display: flex; align-items: center;">
        <div class="container">
            <div class="hero-content" style="max-width: 400px; margin: 0 auto;">
                <h1 class="hero-title" style="font-size: 2.5rem; margin-bottom: 1rem;">Welcome Back</h1>
                <p class="hero-subtitle" style="margin-bottom: 2rem;">Sign in to your account to continue converting your bank statements.</p>
                
                <div class="login-form-container" style="background: white; padding: 2rem; border-radius: 12px; box-shadow: 0 8px 25px rgba(0,0,0,0.1);">
                    <div id="googleSignInDiv" style="display: flex; justify-content: center; margin-bottom: 2rem;"></div>
                    
                    <div id="authError" style="display: none; text-align: center; color: #dc2626; margin-top: 1rem;">
                        <p>Google OAuth authentication is required. Please ensure it's properly configured.</p>
                    </div>
                    
                    <p style="text-align: center; margin-top: 2rem; color: #6B7280;">
                        Don't have an account? <a href="/api/register" style="color: #4F46E5; text-decoration: none; font-weight: 500;">Sign up here</a>
                    </p>
                </div>
            </div>
        </div>
    </section>

    <script>
        let isGoogleLoaded = false;
        let pendingCredentialResponse = null;
        
        function handleCredentialResponse(response) {
            pendingCredentialResponse = response;
            if (isGoogleLoaded) {
                submitGoogleAuth(response);
            }
        }
        
        function submitGoogleAuth(response) {
            console.log('🔑 Submitting Google authentication...');
            fetch('/api/auth/google', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    credential: response.credential
                })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    console.log('✅ Authentication successful:', data.user);
                    localStorage.setItem('userData', JSON.stringify(data.user));
                    localStorage.setItem('userToken', data.token);
                    window.location.href = '/';
                } else {
                    console.error('❌ Authentication failed:', data.error);
                    alert('Authentication failed: ' + data.error);
                }
            })
            .catch(error => {
                console.error('❌ Network error:', error);
                alert('Network error during authentication. Please try again.');
            });
        }
        
        // Function to initialize Google Sign-In
        function initializeGoogleSignIn(clientId) {
            console.log('🔍 Initializing Google Sign-In with client ID:', clientId.substring(0, 20) + '...');
            
            // Check if Google Sign-In library is loaded
            if (typeof google !== 'undefined' && google.accounts && google.accounts.id) {
                try {
                    google.accounts.id.initialize({
                        client_id: clientId,
                        callback: handleCredentialResponse,
                        auto_select: false,
                        cancel_on_tap_outside: true
                    });
                    
                    const signInDiv = document.getElementById('googleSignInDiv');
                    if (signInDiv) {
                        google.accounts.id.renderButton(signInDiv, { 
                            theme: 'outline', 
                            size: 'large',
                            text: 'signin_with'
                        });
                        
                        console.log('✅ Google Sign-In button rendered successfully');
                    } else {
                        console.error('❌ googleSignInDiv element not found');
                        document.getElementById('authError').style.display = 'block';
                    }
                    
                    isGoogleLoaded = true;
                    
                    if (pendingCredentialResponse) {
                        submitGoogleAuth(pendingCredentialResponse);
                        pendingCredentialResponse = null;
                    }
                } catch (error) {
                    console.error('❌ Error initializing Google Sign-In:', error);
                    document.getElementById('authError').style.display = 'block';
                }
            } else {
                console.log('⏳ Google Sign-In library not ready, retrying in 100ms...');
                setTimeout(() => initializeGoogleSignIn(clientId), 100);
            }
        }
        
        // Check auth status and initialize Google Sign-In
        fetch('/api/auth/config')
            .then(response => response.json())
            .then(config => {
                if (config.googleClientId) {
                    // Wait for DOM to be ready
                    if (document.readyState === 'loading') {
                        document.addEventListener('DOMContentLoaded', () => {
                            initializeGoogleSignIn(config.googleClientId);
                        });
                    } else {
                        initializeGoogleSignIn(config.googleClientId);
                    }
                } else {
                    console.error('❌ No Google Client ID configured');
                    document.getElementById('authError').style.display = 'block';
                }
            })
            .catch(error => {
                console.error('Failed to load auth config:', error);
                document.getElementById('authError').style.display = 'block';
            });
    </script>
</body>
</html>
    `;
    res.send(html);
});

// Register page endpoint
app.get('/api/register', (req, res) => {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Register - Smart Statement Converter</title>
    <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline' https://accounts.google.com; style-src 'self' 'unsafe-inline' https://accounts.google.com; style-src-elem 'self' 'unsafe-inline' https://accounts.google.com; frame-src 'self' https://accounts.google.com; connect-src 'self' https://accounts.google.com; img-src 'self' data: https:;">
    <link rel="stylesheet" href="/styles.css">
    <script src="https://accounts.google.com/gsi/client" async defer></script>
</head>
<body>
    <header class="header">
        <div class="container">
            <nav class="navbar">
                <div class="nav-brand">
                    <div class="logo">
                        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                            <rect x="4" y="8" width="24" height="16" rx="2" stroke="#4F46E5" stroke-width="2" fill="#4F46E5"/>
                            <rect x="6" y="10" width="20" height="2" fill="white"/>
                            <rect x="6" y="14" width="12" height="2" fill="white"/>
                            <rect x="6" y="18" width="16" height="2" fill="white"/>
                        </svg>
                        <a href="/" style="text-decoration: none; color: inherit;">
                            <span>SMART STATEMENT CONVERTER</span>
                        </a>
                    </div>
                </div>
                <div class="nav-menu">
                    <a href="/#pricing" class="nav-link">Pricing</a>
                    <a href="/api/login" class="nav-link">Login</a>
                    <a href="/api/register" class="nav-link primary">Register</a>
                </div>
            </nav>
        </div>
    </header>
    <section class="hero" style="min-height: 80vh; display: flex; align-items: center;">
        <div class="container">
            <div class="hero-content" style="max-width: 400px; margin: 0 auto;">
                <h1 class="hero-title" style="font-size: 2.5rem; margin-bottom: 1rem;">Create Account</h1>
                <p class="hero-subtitle" style="margin-bottom: 2rem;">Sign up for a free account to get started with converting your bank statements.</p>
                
                <div class="login-form-container" style="background: white; padding: 2rem; border-radius: 12px; box-shadow: 0 8px 25px rgba(0,0,0,0.1);">
                    <div id="googleSignInDiv" style="display: flex; justify-content: center; margin-bottom: 2rem;"></div>
                    
                    <div id="authError" style="display: none; text-align: center; color: #dc2626; margin-top: 1rem;">
                        <p>Google OAuth authentication is required. Please ensure it's properly configured.</p>
                    </div>
                    
                    <p style="text-align: center; margin-top: 2rem; color: #6B7280;">
                        Already have an account? <a href="/api/login" style="color: #4F46E5; text-decoration: none; font-weight: 500;">Sign in</a>
                    </p>
                </div>
            </div>
        </div>
    </section>

    <script>
        let isGoogleLoaded = false;
        let pendingCredentialResponse = null;
        
        function handleCredentialResponse(response) {
            pendingCredentialResponse = response;
            if (isGoogleLoaded) {
                submitGoogleAuth(response);
            }
        }
        
        function submitGoogleAuth(response) {
            console.log('🔑 Submitting Google authentication...');
            fetch('/api/auth/google', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    credential: response.credential
                })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    console.log('✅ Authentication successful:', data.user);
                    localStorage.setItem('userData', JSON.stringify(data.user));
                    localStorage.setItem('userToken', data.token);
                    window.location.href = '/';
                } else {
                    console.error('❌ Authentication failed:', data.error);
                    alert('Authentication failed: ' + data.error);
                }
            })
            .catch(error => {
                console.error('❌ Network error:', error);
                alert('Network error during authentication. Please try again.');
            });
        }
        
        // Function to initialize Google Sign-In
        function initializeGoogleSignIn(clientId) {
            console.log('🔍 Initializing Google Sign-In with client ID:', clientId.substring(0, 20) + '...');
            
            // Check if Google Sign-In library is loaded
            if (typeof google !== 'undefined' && google.accounts && google.accounts.id) {
                try {
                    google.accounts.id.initialize({
                        client_id: clientId,
                        callback: handleCredentialResponse,
                        auto_select: false,
                        cancel_on_tap_outside: true
                    });
                    
                    const signInDiv = document.getElementById('googleSignInDiv');
                    if (signInDiv) {
                        google.accounts.id.renderButton(signInDiv, { 
                            theme: 'outline', 
                            size: 'large',
                            text: 'signup_with'
                        });
                        
                        console.log('✅ Google Sign-In button rendered successfully');
                    } else {
                        console.error('❌ googleSignInDiv element not found');
                        document.getElementById('authError').style.display = 'block';
                    }
                    
                    isGoogleLoaded = true;
                    
                    if (pendingCredentialResponse) {
                        submitGoogleAuth(pendingCredentialResponse);
                        pendingCredentialResponse = null;
                    }
                } catch (error) {
                    console.error('❌ Error initializing Google Sign-In:', error);
                    document.getElementById('authError').style.display = 'block';
                }
            } else {
                console.log('⏳ Google Sign-In library not ready, retrying in 100ms...');
                setTimeout(() => initializeGoogleSignIn(clientId), 100);
            }
        }
        
        // Check auth status and initialize Google Sign-In
        fetch('/api/auth/config')
            .then(response => response.json())
            .then(config => {
                if (config.googleClientId) {
                    // Wait for DOM to be ready
                    if (document.readyState === 'loading') {
                        document.addEventListener('DOMContentLoaded', () => {
                            initializeGoogleSignIn(config.googleClientId);
                        });
                    } else {
                        initializeGoogleSignIn(config.googleClientId);
                    }
                } else {
                    console.error('❌ No Google Client ID configured');
                    document.getElementById('authError').style.display = 'block';
                }
            })
            .catch(error => {
                console.error('Error loading auth config:', error);
                document.getElementById('authError').style.display = 'block';
            });
    </script>
</body>
</html>
    `;
    res.send(html);
});

// Google OAuth endpoint
app.post('/api/auth/google', async (req, res) => {
    try {
        console.log('🔍 Google OAuth request received');
        const { credential } = req.body;
        
        if (!credential) {
            console.error('❌ Missing Google credential in request');
            return res.status(400).json({ error: 'Missing Google credential' });
        }
        
        console.log('🔑 Verifying Google token...');
        
        // Verify Google token
        const { OAuth2Client } = require('google-auth-library');
        const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
        
        const ticket = await client.verifyIdToken({
            idToken: credential,
            audience: process.env.GOOGLE_CLIENT_ID,
        });
        
        console.log('✅ Google token verified successfully');
        
        const payload = ticket.getPayload();
        const userData = {
            id: payload['sub'],
            email: payload['email'],
            name: payload['name'],
            picture: payload['picture'],
            emailVerified: payload['email_verified'],
            provider: 'google',
            loginAt: new Date().toISOString()
        };
        
        console.log('👤 User data extracted:', userData.email);
        
        // Create or update user
        try {
            await db.createUser(userData);
            console.log('💾 User created/updated in database');
        } catch (dbError) {
            console.error('❌ Database error:', dbError.message);
            // Continue with authentication even if DB fails
        }
        
        // Create JWT token
        const jwt = require('jsonwebtoken');
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
        
        console.log('🎟️ JWT token created successfully');
        
        res.json({
            success: true,
            user: userData,
            token: sessionToken,
            message: 'Authentication successful'
        });
    } catch (error) {
        console.error('❌ Google OAuth error:', error.message);
        console.error('Error details:', error);
        res.status(401).json({ 
            error: 'Authentication failed',
            message: error.message,
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// Subscription endpoint
app.post('/api/subscription', async (req, res) => {
    try {
        const { userId, planType, billingCycle, stripeCustomerId, stripeSubscriptionId } = req.body;
        
        if (!userId || !planType) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        // Create subscription
        const subscription = await db.createSubscription({
            userId,
            planType,
            billingCycle: billingCycle || 'monthly',
            stripeCustomerId,
            stripeSubscriptionId,
            status: 'active',
            currentPeriodStart: new Date(),
            currentPeriodEnd: new Date(Date.now() + (billingCycle === 'annual' ? 365 : 30) * 24 * 60 * 60 * 1000)
        });
        
        res.json({
            success: true,
            subscription,
            message: 'Subscription created successfully'
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to create subscription' });
    }
});

// Stripe payment intent
app.post('/api/create-payment-intent', async (req, res) => {
    try {
        if (!stripe) {
            return res.status(503).json({ 
                error: 'Payment processing not available',
                message: 'Stripe is not configured'
            });
        }
        
        const { plan, billingCycle } = req.body;
        
        const prices = {
            starter: { monthly: 3000, annual: 18000 },
            professional: { monthly: 6000, annual: 36000 },
            business: { monthly: 9900, annual: 59900 }
        };
        
        const amount = prices[plan]?.[billingCycle];
        
        if (!amount) {
            return res.status(400).json({ error: 'Invalid plan or billing cycle' });
        }
        
        const paymentIntent = await stripe.paymentIntents.create({
            amount: amount,
            currency: 'usd',
            metadata: {
                plan: plan,
                billingCycle: billingCycle
            }
        });
        
        res.json({
            clientSecret: paymentIntent.client_secret
        });
        
    } catch (error) {
        res.status(500).json({ 
            error: 'Payment processing failed',
            message: error.message
        });
    }
});

// Get subscription by user ID
app.get('/api/subscription/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        console.log('💳 Fetching subscription for userId:', userId);
        
        // Check if database is available
        if (!db || typeof db.getSubscriptionByUserId !== 'function') {
            console.warn('⚠️ Database not available, returning default subscription');
            return res.json({
                success: true,
                subscription: {
                    plan_type: 'free',
                    billing_cycle: 'monthly',
                    status: 'active',
                    creditsRemaining: 1
                }
            });
        }
        
        const subscription = await db.getSubscriptionByUserId(userId);
        
        if (!subscription) {
            console.log('💳 No subscription found, returning default');
            return res.json({
                success: true,
                subscription: {
                    plan_type: 'free',
                    billing_cycle: 'monthly',
                    status: 'active',
                    creditsRemaining: 1
                }
            });
        }
        
        console.log('💳 Subscription found:', subscription.plan_type || subscription.planType);
        res.json({
            success: true,
            subscription: subscription
        });
    } catch (error) {
        console.error('❌ Subscription fetch error:', error.message);
        console.error('Error details:', error);
        // Return default subscription instead of error
        res.json({
            success: true,
            subscription: {
                plan_type: 'free',
                billing_cycle: 'monthly',
                status: 'active',
                creditsRemaining: 1
            }
        });
    }
});

// Check credit limits endpoint
app.get('/api/check-credit-limits', async (req, res) => {
    try {
        const { userId } = req.query;
        
        if (!userId) {
            return res.status(400).json({ error: 'User ID is required' });
        }
        
        const creditLimits = await db.checkCreditLimits(userId);
        res.json(creditLimits);
    } catch (error) {
        console.error('Credit limits check error:', error);
        res.status(500).json({ error: 'Failed to check credit limits' });
    }
});

// Track credit usage endpoint
app.post('/api/track-credit-usage', async (req, res) => {
    try {
        const { userId, fileName, pageCount, creditsUsed, date, description } = req.body;
        
        const result = await db.trackCreditUsage({
            userId,
            fileName,
            pageCount,
            creditsUsed,
            date,
            description
        });
        
        res.json({ success: true, result });
    } catch (error) {
        console.error('Credit usage tracking error:', error);
        res.status(500).json({ error: 'Failed to track credit usage' });
    }
});

// History endpoints
app.get('/api/history', async (req, res) => {
    try {
        const userId = req.query.userId || 'anonymous';
        console.log('📊 Fetching history for userId:', userId);
        
        // Check if database is available
        if (!db || typeof db.getConversionHistory !== 'function') {
            console.warn('⚠️ Database not available, returning empty history');
            return res.json({ success: true, history: [] });
        }
        
        const history = await db.getConversionHistory(userId);
        console.log('📊 History fetched successfully, count:', history?.length || 0);
        res.json({ success: true, history: history || [] });
    } catch (error) {
        console.error('❌ History fetch error:', error.message);
        console.error('Error details:', error);
        // Return empty array instead of error to prevent frontend issues
        res.json({ success: true, history: [] });
    }
});

app.get('/api/history/:conversionId', async (req, res) => {
    try {
        const userId = req.query.userId || 'anonymous';
        const conversionId = req.params.conversionId;
        
        const conversion = await db.getConversionById(userId, conversionId);
        if (!conversion) {
            return res.status(404).json({ error: 'Conversion not found' });
        }
        
        res.json(conversion);
    } catch (error) {
        console.error('Conversion fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch conversion' });
    }
});

app.delete('/api/history/:conversionId', async (req, res) => {
    try {
        const userId = req.query.userId || 'anonymous';
        const conversionId = req.params.conversionId;
        
        const success = await db.deleteConversion(conversionId, userId);
        if (!success) {
            return res.status(404).json({ error: 'Conversion not found' });
        }
        
        res.json({ success: true });
    } catch (error) {
        console.error('Conversion delete error:', error);
        res.status(500).json({ error: 'Failed to delete conversion' });
    }
});

// Stripe config endpoint
app.get('/api/stripe-config', (req, res) => {
    const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY;
    const isConfigured = publishableKey && publishableKey !== 'pk_test_your_key_here';
    
    res.json({
        publishableKey: isConfigured ? publishableKey : null,
        isConfigured: isConfigured
    });
});

// Convert endpoint (simplified for Vercel)
app.post('/api/convert', async (req, res) => {
    try {
        const multer = require('multer');
        const upload = multer({
            dest: '/tmp/',
            limits: {
                fileSize: 10 * 1024 * 1024, // 10MB
                files: 1
            },
            fileFilter: (req, file, cb) => {
                if (file.mimetype === 'application/pdf') {
                    cb(null, true);
                } else {
                    cb(new Error('Only PDF files are allowed'), false);
                }
            }
        });

        upload.single('pdf')(req, res, async (err) => {
            if (err) {
                return res.status(400).json({ error: err.message });
            }

            if (!req.file) {
                return res.status(400).json({ error: 'No file uploaded' });
            }

            try {
                // Process PDF
                const pdfBuffer = await fs.readFile(req.file.path);
                const pdfParse = require('pdf-parse');
                const pdfData = await pdfParse(pdfBuffer);
                
                // Clean up temp file
                await fs.unlink(req.file.path);
                
                // Process bank statement data
                const processedData = processBankStatement(pdfData.text);
                
                // Generate CSV data
                const csvData = generateCSV(processedData.transactions);
                
                res.json({
                    success: true,
                    filename: req.file.originalname.replace('.pdf', '.csv'),
                    csvData: csvData,
                    transactionCount: processedData.transactions.length,
                    originalFilename: req.file.originalname
                });
            } catch (error) {
                // Clean up temp file on error
                if (req.file && await fs.pathExists(req.file.path)) {
                    await fs.unlink(req.file.path);
                }
                res.status(500).json({ error: 'File processing failed', message: error.message });
            }
        });
    } catch (error) {
        res.status(500).json({ error: 'Upload failed' });
    }
});

// Generate CSV function
function generateCSV(transactions) {
    const headers = ['Date', 'Type', 'Description', 'Amount', 'Balance'];
    const csvRows = [headers.join(',')];
    
    transactions.forEach(transaction => {
        const row = [
            transaction.date,
            transaction.type,
            `"${transaction.description.replace(/"/g, '""')}"`,
            transaction.amount,
            transaction.balance
        ];
        csvRows.push(row.join(','));
    });
    
    return csvRows.join('\n');
}

// Analytics endpoint
app.post('/api/analytics', async (req, res) => {
    try {
        console.log('📈 Analytics data received:', req.body);
        // For now, just acknowledge the analytics data
        // In the future, this could store analytics in a database
        res.json({ success: true, message: 'Analytics data received' });
    } catch (error) {
        console.error('❌ Analytics error:', error.message);
        res.status(500).json({ error: 'Failed to process analytics data' });
    }
});

// Serve main pages
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'index.html'));
});

app.get('/profile', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'profile.html'));
});

app.get('/privacy', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'privacy.html'));
});

app.get('/terms', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'terms.html'));
});

// Error handling middleware
app.use((error, req, res, next) => {
    res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
});

module.exports = app;