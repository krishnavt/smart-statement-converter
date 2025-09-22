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

// Static files - serve from root directory
app.use(express.static(path.join(__dirname, '..'), {
    setHeaders: (res, path) => {
        if (path.endsWith('.css')) {
            res.setHeader('Content-Type', 'text/css');
        } else if (path.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript');
        } else if (path.endsWith('.json')) {
            res.setHeader('Content-Type', 'application/json');
        }
    }
}));

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

// Google OAuth endpoint
app.post('/api/auth/google', async (req, res) => {
    try {
        const { credential } = req.body;
        
        if (!credential) {
            return res.status(400).json({ error: 'Missing Google credential' });
        }
        
        // Verify Google token
        const { OAuth2Client } = require('google-auth-library');
        const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
        
        const ticket = await client.verifyIdToken({
            idToken: credential,
            audience: process.env.GOOGLE_CLIENT_ID,
        });
        
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
        
        // Create or update user
        await db.createUser(userData);
        
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
        
        res.json({
            success: true,
            user: userData,
            token: sessionToken,
            message: 'Authentication successful'
        });
    } catch (error) {
        res.status(401).json({ error: 'Authentication failed' });
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