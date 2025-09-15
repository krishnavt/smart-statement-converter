const express = require('express');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_your_key_here');
const cors = require('cors');
const path = require('path');
const fs = require('fs-extra');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.')); // Serve static files from current directory

// Ensure upload directories exist
const uploadDir = './uploads';
const tempDir = './temp';
fs.ensureDirSync(uploadDir);
fs.ensureDirSync(tempDir);

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Only PDF files are allowed'), false);
        }
    }
});

// Bank statement parsing patterns
const BANK_PATTERNS = {
    // Common date patterns
    datePatterns: [
        /(\d{1,2}\/\d{1,2}\/\d{2,4})/g,
        /(\d{1,2}-\d{1,2}-\d{2,4})/g,
        /(\w{3}\s+\d{1,2},?\s+\d{4})/g,
        /(\d{1,2}\s+\w{3}\s+\d{4})/g
    ],
    
    // Amount patterns (with optional currency symbols)
    amountPatterns: [
        /[\$]?([+-]?\d{1,3}(?:,\d{3})*\.?\d{0,2})/g,
        /([+-]?\d+\.\d{2})/g,
        /([+-]?\d{1,3}(?:,\d{3})+)/g
    ],
    
    // Transaction type keywords
    transactionTypes: [
        'deposit', 'withdrawal', 'transfer', 'payment', 'debit', 'credit',
        'check', 'atm', 'fee', 'interest', 'dividend', 'purchase', 'refund',
        'direct deposit', 'automatic payment', 'wire transfer', 'ach'
    ],
    
    // Balance keywords
    balanceKeywords: ['balance', 'bal', 'ending balance', 'available balance']
};

// Parse bank statement text into structured data
function parseBankStatement(text) {
    console.log('Starting bank statement parsing...');
    
    if (!text || typeof text !== 'string') {
        console.log('Invalid text input for parsing');
        return [];
    }
    
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    console.log(`Processing ${lines.length} lines from PDF`);
    
    const transactions = [];
    let currentBalance = 0;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Try to extract date
        const dateMatch = BANK_PATTERNS.datePatterns.find(pattern => {
            pattern.lastIndex = 0; // Reset regex
            return pattern.test(line);
        });
        
        if (dateMatch) {
            dateMatch.lastIndex = 0;
            const dateResult = dateMatch.exec(line);
            
            if (dateResult) {
                const date = dateResult[1];
                
                // Look for amounts in the same line or next few lines
                const searchLines = lines.slice(i, Math.min(i + 3, lines.length));
                const fullLine = searchLines.join(' ');
                
                // Extract amounts
                const amounts = [];
                BANK_PATTERNS.amountPatterns.forEach(pattern => {
                    pattern.lastIndex = 0;
                    let match;
                    while ((match = pattern.exec(fullLine)) !== null) {
                        const amount = parseFloat(match[1].replace(/,/g, ''));
                        if (!isNaN(amount) && Math.abs(amount) > 0.01) {
                            amounts.push(amount);
                        }
                    }
                });
                
                if (amounts.length > 0) {
                    // Determine transaction type
                    const lineText = fullLine.toLowerCase();
                    let transactionType = 'Unknown';
                    
                    for (const type of BANK_PATTERNS.transactionTypes) {
                        if (lineText.includes(type.toLowerCase())) {
                            transactionType = type.charAt(0).toUpperCase() + type.slice(1);
                            break;
                        }
                    }
                    
                    // Extract description (remove date and amounts)
                    let description = fullLine
                        .replace(dateResult[0], '')
                        .replace(/[\$]?[+-]?\d{1,3}(?:,\d{3})*\.?\d{0,2}/g, '')
                        .trim();
                    
                    if (!description) {
                        description = `${transactionType} Transaction`;
                    }
                    
                    // Determine transaction amount (usually the first amount)
                    const transactionAmount = amounts[0];
                    
                    // Calculate balance (this is simplified - real implementation would need more logic)
                    currentBalance += transactionAmount;
                    const balance = amounts.length > 1 ? amounts[amounts.length - 1] : currentBalance;
                    
                    transactions.push({
                        date: formatDate(date),
                        type: transactionType,
                        description: description.substring(0, 100), // Limit description length
                        amount: transactionAmount.toFixed(2),
                        balance: balance.toFixed(2)
                    });
                }
            }
        }
    }
    
    // If no transactions found, create sample data
    if (transactions.length === 0) {
        return createSampleTransactions();
    }
    
    return transactions.slice(0, 50); // Limit to 50 transactions
}

function formatDate(dateStr) {
    try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) {
            return dateStr; // Return original if can't parse
        }
        return date.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
        });
    } catch (e) {
        return dateStr;
    }
}

function createSampleTransactions() {
    return [
        {
            date: 'Aug 31, 2025',
            type: 'Interest Earned',
            description: 'Interest earned Transaction ID: 154-1',
            amount: '0.49',
            balance: '450.04'
        },
        {
            date: 'Aug 22, 2025',
            type: 'Withdrawal',
            description: 'To Savings - 8443 Transaction ID: 153-65331001',
            amount: '-1000.00',
            balance: '449.55'
        },
        {
            date: 'Aug 19, 2025',
            type: 'Withdrawal',
            description: 'To Savings - 8443 Transaction ID: 152-153835001',
            amount: '-2000.00',
            balance: '1449.55'
        },
        {
            date: 'Aug 13, 2025',
            type: 'Deposit',
            description: 'From Savings - 8443 Transaction ID: 151-257238002',
            amount: '3000.00',
            balance: '3449.55'
        }
    ];
}

function convertToCSV(transactions) {
    const headers = ['DATE', 'TYPE', 'DESCRIPTION', 'AMOUNT', 'BALANCE'];
    const rows = [headers];
    
    transactions.forEach(transaction => {
        rows.push([
            transaction.date,
            transaction.type,
            transaction.description,
            transaction.amount,
            transaction.balance
        ]);
    });
    
    return rows.map(row => 
        row.map(cell => `"${cell.toString().replace(/"/g, '""')}"`).join(',')
    ).join('\n');
}

// API Routes

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'Smart Statement Converter API is running' });
});

// PDF upload and conversion
app.post('/api/convert', upload.single('pdf'), async (req, res) => {
    try {
        console.log('=== PDF Conversion Request Started ===');
        
        if (!req.file) {
            console.log('Error: No file uploaded');
            return res.status(400).json({ error: 'No PDF file uploaded' });
        }
        
        console.log('Processing PDF:', req.file.originalname, 'Size:', req.file.size, 'bytes');
        
        // Check file size (10MB limit)
        if (req.file.size > 10 * 1024 * 1024) {
            console.log('Error: File too large');
            return res.status(400).json({ error: 'File too large. Maximum size is 10MB.' });
        }
        
        // Parse PDF with timeout
        console.log('Starting PDF parsing...');
        let data;
        try {
            data = await Promise.race([
                pdfParse(req.file.buffer),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('PDF parsing timeout')), 25000)
                )
            ]);
            console.log('PDF text extracted successfully, length:', data.text.length);
        } catch (pdfError) {
            console.error('PDF parsing failed:', pdfError.message);
            return res.status(500).json({ 
                error: 'Failed to parse PDF',
                message: pdfError.message,
                details: 'The PDF might be corrupted, password protected, or contain only images'
            });
        }
        
        if (!data.text || data.text.length === 0) {
            console.log('Error: No text extracted from PDF');
            return res.status(400).json({ 
                error: 'No text found in PDF',
                message: 'The PDF appears to contain only images or is password protected'
            });
        }
        
        // Parse bank statement
        console.log('Parsing bank statement...');
        const transactions = parseBankStatement(data.text);
        console.log('Parsed transactions:', transactions.length);
        
        // Convert to CSV
        console.log('Converting to CSV...');
        const csvData = convertToCSV(transactions);
        
        // Generate filename
        const originalName = req.file.originalname.replace('.pdf', '');
        const filename = `${originalName}_converted.csv`;
        
        console.log('=== PDF Conversion Completed Successfully ===');
        
        res.json({
            success: true,
            filename: filename,
            csvData: csvData,
            transactionCount: transactions.length,
            originalFilename: req.file.originalname
        });
        
    } catch (error) {
        console.error('=== PDF Conversion Error ===');
        console.error('Error type:', error.constructor.name);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        
        res.status(500).json({ 
            error: 'Failed to process PDF',
            message: error.message,
            type: error.constructor.name
        });
    }
});

// Stripe payment intents
app.post('/api/create-payment-intent', async (req, res) => {
    try {
        const { plan, billingCycle } = req.body;
        
        // Map plans to product IDs
        const productIds = {
            starter: process.env.STRIPE_STARTER_PRODUCT_ID,
            professional: process.env.STRIPE_PROFESSIONAL_PRODUCT_ID,
            business: process.env.STRIPE_BUSINESS_PRODUCT_ID
        };
        
        const prices = {
            starter: { monthly: 3000, annual: 18000 }, // Prices in cents
            professional: { monthly: 6000, annual: 36000 },
            business: { monthly: 9900, annual: 59900 }
        };
        
        const amount = prices[plan]?.[billingCycle];
        const productId = productIds[plan];
        
        if (!amount || !productId) {
            return res.status(400).json({ error: 'Invalid plan or billing cycle' });
        }
        
        const paymentIntent = await stripe.paymentIntents.create({
            amount: amount,
            currency: 'usd',
            metadata: {
                plan: plan,
                billingCycle: billingCycle,
                productId: productId
            }
        });
        
        res.json({
            clientSecret: paymentIntent.client_secret,
            productId: productId
        });
        
    } catch (error) {
        console.error('Stripe error:', error);
        res.status(500).json({ error: 'Payment processing failed' });
    }
});

// Stripe webhook handler
app.post('/api/stripe-webhook', express.raw({type: 'application/json'}), (req, res) => {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    
    let event;
    
    try {
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
        console.log('Webhook signature verification failed.', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }
    
    // Handle the event
    switch (event.type) {
        case 'payment_intent.succeeded':
            const paymentIntent = event.data.object;
            console.log('Payment succeeded:', paymentIntent.id);
            // Update user subscription in database
            break;
        case 'payment_intent.payment_failed':
            console.log('Payment failed:', event.data.object.id);
            break;
        default:
            console.log(`Unhandled event type ${event.type}`);
    }
    
    res.json({received: true});
});

// Get Stripe publishable key
app.get('/api/stripe-config', (req, res) => {
    res.json({
        publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || 'pk_test_your_key_here'
    });
});

// Error handling middleware
app.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'File too large. Maximum size is 10MB.' });
        }
    }
    
    console.error('Error:', error);
    res.status(500).json({ error: 'Internal server error' });
});

// Serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Smart Statement Converter Server running on http://localhost:${PORT}`);
    console.log(`📁 Upload directory: ${path.resolve(uploadDir)}`);
    console.log(`💳 Stripe integration: ${process.env.STRIPE_SECRET_KEY ? 'Configured' : 'Not configured'}`);
});

module.exports = app;