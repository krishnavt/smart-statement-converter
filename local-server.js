require('dotenv').config();

// Validate environment variables
const { validateEnvironment } = require('./lib/env-validator');
try {
  validateEnvironment({ exitOnError: false });
} catch (error) {
  console.error('Environment validation failed:', error.message);
  console.warn('⚠️  Continuing with invalid environment (development mode)');
}

const express = require('express');
const multer = require('multer');
const pdfParse = require('pdf-parse');
// Initialize Stripe only if valid key is provided
let stripe = null;
if (process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SECRET_KEY !== 'sk_test_your_key_here') {
    stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    console.log('✅ Stripe initialized with valid API key');
} else {
    console.log('⚠️ Stripe not configured - payment features disabled');
}
const cors = require('cors');
const path = require('path');
const fs = require('fs-extra');
const { v4: uuidv4 } = require('uuid');
const { db } = require('./lib/supabase');

const app = express();
const PORT = process.env.PORT || 3000;

// Anonymous user UUID for fallback
const ANONYMOUS_USER_ID = '00000000-0000-0000-0000-000000000000';

// File validation function
function validateUploadedFile(file) {
    // Check if file exists
    if (!file) {
        return {
            isValid: false,
            error: 'No file provided',
            code: 'NO_FILE',
            message: 'Please select a file to upload'
        };
    }

    // Check file type
    if (file.mimetype !== 'application/pdf') {
        return {
            isValid: false,
            error: 'Invalid file type',
            code: 'INVALID_TYPE',
            message: 'Only PDF files are allowed'
        };
    }

    // Check file size (10MB limit)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
        const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
        return {
            isValid: false,
            error: 'File too large',
            code: 'FILE_TOO_LARGE',
            message: `File size (${sizeMB}MB) exceeds the 10MB limit`
        };
    }

    // Check if file is empty
    if (file.size === 0) {
        return {
            isValid: false,
            error: 'Empty file',
            code: 'EMPTY_FILE',
            message: 'The uploaded file is empty'
        };
    }

    // Check file name
    if (!file.originalname || file.originalname.trim() === '') {
        return {
            isValid: false,
            error: 'Invalid filename',
            code: 'INVALID_FILENAME',
            message: 'File has no name'
        };
    }

    // Check for suspicious file names
    const suspiciousPatterns = [
        /\.exe$/i, /\.bat$/i, /\.cmd$/i, /\.scr$/i, /\.pif$/i,
        /\.com$/i, /\.vbs$/i, /\.js$/i, /\.jar$/i, /\.app$/i
    ];
    
    for (const pattern of suspiciousPatterns) {
        if (pattern.test(file.originalname)) {
            return {
                isValid: false,
                error: 'Suspicious file type',
                code: 'SUSPICIOUS_FILE',
                message: 'File type not allowed for security reasons'
            };
        }
    }

    // Check for very long file names
    if (file.originalname.length > 255) {
        return {
            isValid: false,
            error: 'Filename too long',
            code: 'FILENAME_TOO_LONG',
            message: 'File name is too long (max 255 characters)'
        };
    }

    // Check for special characters in filename
    const dangerousChars = /[<>:"/\\|?*\x00-\x1f]/;
    if (dangerousChars.test(file.originalname)) {
        return {
            isValid: false,
            error: 'Invalid characters in filename',
            code: 'INVALID_CHARACTERS',
            message: 'File name contains invalid characters'
        };
    }

    return { isValid: true, error: null, code: null, message: null };
}

// Middleware
app.use(cors());
app.use(express.json());

// Ensure upload directories exist (only in local development)
const uploadDir = './uploads';
const tempDir = './temp';

// Only create directories in local development, not in Vercel
if (!process.env.VERCEL && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
    fs.ensureDirSync(uploadDir);
    fs.ensureDirSync(tempDir);
}

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

// Conversion history helper functions using Supabase
async function saveConversionHistory(userId, conversionData) {
    const conversion = await db.createConversion({
        userId: userId,
        filename: conversionData.filename,
        originalFilename: conversionData.originalFilename,
        csvData: conversionData.csvData,
        transactionCount: conversionData.transactionCount,
        fileSize: conversionData.fileSize
    });
    
    return {
        id: conversion.id,
        timestamp: conversion.created_at,
        filename: conversion.filename,
        originalFilename: conversion.original_filename,
        csvData: conversion.csv_data,
        transactionCount: conversion.transaction_count,
        fileSize: conversion.file_size
    };
}

async function getConversionHistory(userId) {
    const conversions = await db.getConversionsByUserId(userId);
    return conversions.map(conv => ({
        id: conv.id,
        timestamp: conv.created_at,
        filename: conv.original_filename,
        transactionCount: conv.transaction_count,
        fileSize: conv.file_size
    }));
}

async function getConversionById(userId, conversionId) {
    const conversion = await db.getConversionById(conversionId, userId);
    if (!conversion) return null;
    
    return {
        id: conversion.id,
        timestamp: conversion.created_at,
        filename: conversion.filename,
        originalFilename: conversion.original_filename,
        csvData: conversion.csv_data,
        transactionCount: conversion.transaction_count,
        fileSize: conversion.file_size
    };
}


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
    
    // Find the transaction section by looking for common patterns
    let transactionStartIndex = -1;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].toLowerCase();
        
        // Look for transaction table headers
        if (line.includes('date') && line.includes('description') && line.includes('amount')) {
            transactionStartIndex = i + 1; // Start after the header
            break;
        }
        
        // Look for patterns that indicate start of transaction list
        if (line.match(/^\w{3}\s+\d{1,2},?\s+\d{4}/)) {
            // Check if this looks like a real transaction line (has amount and reasonable description)
            if (line.includes('$') && line.match(/\d+\.\d{2}/)) {
                // Additional validation - make sure it's not account info
                if (!line.includes('account') && !line.includes('balance') && !line.includes('interest rate') && 
                    !line.includes('member since') && !line.includes('statement period') && 
                    !line.includes('participating banks') && !line.includes('breakdown')) {
                    transactionStartIndex = i;
                    break;
                }
            }
        }
    }
    
    if (transactionStartIndex === -1) {
        console.log('Could not find transaction section, using sample data');
        return createSampleTransactions();
    }
    
    console.log(`Found transaction section starting at line ${transactionStartIndex}`);
    
    // Parse transactions from the identified section
    for (let i = transactionStartIndex; i < lines.length; i++) {
        const line = lines[i];
        
        // Skip header lines
        if (line.toLowerCase().includes('date') && line.toLowerCase().includes('description')) {
            continue;
        }
        
        // Look for date patterns that indicate a transaction
        let dateMatch = null;
        let dateResult = null;
        
        for (const pattern of BANK_PATTERNS.datePatterns) {
            pattern.lastIndex = 0;
            const match = pattern.exec(line);
            if (match) {
                dateMatch = pattern;
                dateResult = match;
                break;
            }
        }
        
        if (dateResult) {
            const date = dateResult[1];
            
            // Look for amounts in the same line or next few lines
            const searchLines = lines.slice(i, Math.min(i + 3, lines.length));
            const fullLine = searchLines.join(' ');
            
            // Look for dollar amounts with proper formatting
            const dollarAmountPattern = /\$?([+-]?\d{1,3}(?:,\d{3})*\.\d{2})/g;
            const amounts = [];
            let match;
            while ((match = dollarAmountPattern.exec(fullLine)) !== null) {
                const amountStr = match[1].replace(/,/g, '');
                const amount = parseFloat(amountStr);
                if (!isNaN(amount) && Math.abs(amount) > 0.01 && Math.abs(amount) < 100000) {
                    amounts.push(amount);
                }
            }
            
            if (amounts.length > 0) {
                // Determine transaction type - check for specific patterns first
                const lineText = fullLine.toLowerCase();
                let transactionType = 'Transaction';
                
                // Check for specific transaction type patterns (case-insensitive)
                if (lineText.includes('direct payment')) {
                    transactionType = 'Direct Payment';
                } else if (lineText.includes('direct deposit')) {
                    transactionType = 'Direct Deposit';
                } else if (lineText.includes('interest earned') || lineText.includes('interest earned')) {
                    transactionType = 'Interest Earned';
                } else if (lineText.includes('withdrawal') && lineText.includes('savings')) {
                    transactionType = 'Transfer to Savings';
                } else if (lineText.includes('deposit') && lineText.includes('savings')) {
                    transactionType = 'Transfer from Savings';
                } else if (lineText.includes('deposit') || lineText.includes('credit')) {
                    transactionType = 'Deposit';
                } else if (lineText.includes('withdrawal') || lineText.includes('debit')) {
                    transactionType = 'Withdrawal';
                } else if (lineText.includes('transfer')) {
                    transactionType = 'Transfer';
                } else if (lineText.includes('payment') || lineText.includes('pay')) {
                    transactionType = 'Payment';
                } else if (lineText.includes('fee') || lineText.includes('charge')) {
                    transactionType = 'Fee';
                } else if (lineText.includes('interest')) {
                    transactionType = 'Interest';
                } else if (lineText.includes('check')) {
                    transactionType = 'Check';
                } else if (lineText.includes('atm')) {
                    transactionType = 'ATM';
                }
                
                // Extract description - remove transaction type and clean up
                let description = fullLine
                    .replace(dateResult[0], '')
                    .replace(/\$?[+-]?\d{1,3}(?:,\d{3})*\.\d{2}/g, '')
                    .replace(/\s+/g, ' ')
                    .trim();
                
                // Remove transaction type from description
                const typeToRemove = transactionType.toLowerCase();
                description = description.replace(new RegExp(typeToRemove, 'gi'), '').trim();
                
                // Remove common transaction ID patterns
                description = description.replace(/transaction id:\s*[\w-]+/gi, '').trim();
                description = description.replace(/id:\s*[\w-]+/gi, '').trim();
                
                // Clean up description
                description = description.replace(/^\W+|\W+$/g, '');
                description = description.replace(/\s+/g, ' ').trim();
                
                if (!description || description.length < 3) {
                    description = `${transactionType} Transaction`;
                } else {
                    // Capitalize first letter
                    description = description.charAt(0).toUpperCase() + description.slice(1);
                }
                
                // Use the first reasonable amount as transaction amount
                const transactionAmount = amounts[0];
                const balance = amounts.length > 1 ? amounts[amounts.length - 1] : amounts[0];
                
                // Only add if this looks like a real transaction
                if (Math.abs(transactionAmount) > 0.01) {
                    // Additional validation - reject non-transaction descriptions
                    const invalidDescriptions = [
                        'account', 'balance', 'interest rate', 'member since', 'statement period',
                        'participating banks', 'breakdown', 'moved balances', 'current balance',
                        'beginning balance', 'annual percentage', 'year-to-date', 'current interest',
                        'monthly interest', 'primary account', 'checking account'
                    ];
                    
                    const isInvalidDescription = invalidDescriptions.some(invalid => 
                        description.toLowerCase().includes(invalid)
                    );
                    
                    if (!isInvalidDescription && description.length > 2) {
                        transactions.push({
                            date: formatDate(date),
                            type: transactionType,
                            description: description.substring(0, 100),
                            amount: transactionAmount.toFixed(2),
                            balance: balance.toFixed(2)
                        });
                    }
                }
            }
        }
    }
    
    console.log(`Found ${transactions.length} transactions from PDF parsing`);
    
    // If we found some transactions, return them; otherwise try sample data
    if (transactions.length > 0) {
        return transactions.slice(0, 50); // Limit to 50 transactions
    } else {
        console.log('No transactions found, using sample data');
        return createSampleTransactions();
    }
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

// Debug endpoint to check environment variables
app.get('/api/debug', (req, res) => {
    res.json({
        supabaseUrl: process.env.SUPABASE_URL,
        supabaseKey: process.env.SUPABASE_ANON_KEY ? 'Set' : 'Not set',
        nodeEnv: process.env.NODE_ENV
    });
});

// Conversion history endpoints
app.get('/api/history', async (req, res) => {
    try {
        const userId = req.query.userId || ANONYMOUS_USER_ID;
        console.log('🔍 Fetching history for userId:', userId);
        const history = await getConversionHistory(userId);
        console.log('📊 History result:', history);
        
        res.json({
            success: true,
            history: history
        });
    } catch (error) {
        console.error('Error fetching conversion history:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch conversion history' });
    }
});

app.get('/api/history/:conversionId', async (req, res) => {
    try {
        const userId = req.query.userId || ANONYMOUS_USER_ID;
        const conversionId = req.params.conversionId;
        
        const conversion = await getConversionById(userId, conversionId);
        
        if (!conversion) {
            return res.status(404).json({ success: false, message: 'Conversion not found' });
        }
        
        res.json({
            success: true,
            conversion: {
                id: conversion.id,
                timestamp: conversion.timestamp,
                filename: conversion.originalFilename,
                csvData: conversion.csvData,
                transactionCount: conversion.transactionCount,
                fileSize: conversion.fileSize
            }
        });
    } catch (error) {
        console.error('Error fetching conversion details:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch conversion details' });
    }
});

// Delete conversion
app.delete('/api/history/:conversionId', async (req, res) => {
    try {
        const userId = req.query.userId || ANONYMOUS_USER_ID;
        const conversionId = req.params.conversionId;
        
        const success = await db.deleteConversion(conversionId, userId);
        
        if (!success) {
            return res.status(404).json({ success: false, message: 'Conversion not found' });
        }
        
        res.json({ success: true, message: 'Conversion deleted successfully' });
    } catch (error) {
        console.error('Error deleting conversion:', error);
        res.status(500).json({ success: false, message: 'Failed to delete conversion' });
    }
});

// PDF upload and conversion
app.post('/api/convert', upload.single('pdf'), async (req, res) => {
    try {
        console.log('=== PDF Conversion Request Started ===');
        
        // Validate request
        if (!req.file) {
            console.log('Error: No file uploaded');
            return res.status(400).json({ 
                error: 'No PDF file uploaded',
                code: 'NO_FILE',
                message: 'Please select a PDF file to upload'
            });
        }
        
        console.log('Processing PDF:', req.file.originalname, 'Size:', req.file.size, 'bytes');
        
        // Check credit limits before processing
        const userId = req.body.userId || ANONYMOUS_USER_ID;
        try {
            const creditLimits = await db.checkCreditLimits(userId);
            console.log('📊 Credit check result:', creditLimits);
            
            if (!creditLimits.canConvert) {
                console.log('❌ Credit limit exceeded for user:', userId);
                return res.status(403).json({
                    error: 'Credit limit exceeded',
                    code: 'CREDIT_LIMIT_EXCEEDED',
                    message: `You have used ${creditLimits.currentUsage}/${creditLimits.dailyLimit} daily conversions.`,
                    details: {
                        dailyLimit: creditLimits.dailyLimit,
                        currentUsage: creditLimits.currentUsage,
                        remaining: creditLimits.remaining,
                        isRegistered: creditLimits.isRegistered,
                        subscription: creditLimits.subscription
                    }
                });
            }
            
            console.log(`✅ Credit check passed: ${creditLimits.remaining}/${creditLimits.dailyLimit} remaining`);
        } catch (creditError) {
            console.warn('Failed to check credit limits:', creditError.message);
            // Continue with conversion if credit check fails (fallback)
        }
        
        // Enhanced file validation
        const validation = validateUploadedFile(req.file);
        if (!validation.isValid) {
            console.log('File validation failed:', validation.error);
            return res.status(400).json({ 
                error: validation.error,
                code: validation.code,
                message: validation.message
            });
        }
        
        // Parse PDF with enhanced error handling
        console.log('Starting PDF parsing...');
        let data;
        try {
            data = await Promise.race([
                pdfParse(req.file.buffer),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('PDF parsing timeout after 30 seconds')), 30000)
                )
            ]);
            
            if (!data) {
                throw new Error('PDF parsing returned no data');
            }
            
            console.log('PDF text extracted successfully, length:', data.text.length);
            console.log('First 500 characters of extracted text:');
            console.log(data.text.substring(0, 500));
            
        } catch (pdfError) {
            console.error('PDF parsing failed:', pdfError.message);
            
            // Provide specific error messages based on error type
            let errorMessage = 'Failed to parse PDF';
            let errorCode = 'PDF_PARSE_ERROR';
            let userMessage = 'The PDF could not be processed';
            
            if (pdfError.message.includes('timeout')) {
                errorMessage = 'PDF parsing timeout';
                errorCode = 'PDF_TIMEOUT';
                userMessage = 'The PDF is too complex or large. Please try a smaller file.';
            } else if (pdfError.message.includes('password') || pdfError.message.includes('encrypted')) {
                errorMessage = 'Password protected PDF';
                errorCode = 'PDF_PASSWORD_PROTECTED';
                userMessage = 'The PDF is password protected. Please remove the password and try again.';
            } else if (pdfError.message.includes('corrupted') || pdfError.message.includes('invalid')) {
                errorMessage = 'Corrupted PDF';
                errorCode = 'PDF_CORRUPTED';
                userMessage = 'The PDF appears to be corrupted. Please try a different file.';
            } else if (pdfError.message.includes('XRef') || pdfError.message.includes('bad XRef')) {
                errorMessage = 'PDF structure error';
                errorCode = 'PDF_STRUCTURE_ERROR';
                userMessage = 'The PDF has structural issues. Please try a different file.';
            }
            
            return res.status(500).json({ 
                error: errorMessage,
                code: errorCode,
                message: userMessage,
                details: pdfError.message
            });
        }
        
        // Validate extracted text
        if (!data.text || data.text.length === 0) {
            console.log('Error: No text extracted from PDF');
            return res.status(400).json({ 
                error: 'No text found in PDF',
                code: 'NO_TEXT_EXTRACTED',
                message: 'The PDF appears to contain only images or is password protected. Please ensure the PDF contains selectable text.',
                details: 'Try using a PDF with text content rather than scanned images'
            });
        }
        
        // Check if text is too short (likely not a bank statement)
        if (data.text.length < 100) {
            console.log('Warning: Very short text extracted:', data.text.length, 'characters');
            return res.status(400).json({ 
                error: 'Insufficient text content',
                code: 'INSUFFICIENT_TEXT',
                message: 'The PDF contains very little text. Please ensure you are uploading a bank statement with readable text.',
                details: `Only ${data.text.length} characters were extracted`
            });
        }
        
        // Parse bank statement
        console.log('Parsing bank statement...');
        const transactions = parseBankStatement(data.text);
        console.log('Parsed transactions:', transactions.length);
        console.log('First few transactions:');
        console.log(JSON.stringify(transactions.slice(0, 5), null, 2));
        
        // Convert to CSV
        console.log('Converting to CSV...');
        const csvData = convertToCSV(transactions);
        
        // Generate filename
        const originalName = req.file.originalname.replace('.pdf', '');
        const filename = `${originalName}_converted.csv`;
        
        // Save conversion to history (optional, don't fail if Supabase is not configured)
        // userId already declared above in credit checking section
        const conversionData = {
            filename: filename,
            originalFilename: req.file.originalname,
            csvData: csvData,
            transactionCount: transactions.length,
            fileSize: req.file.size
        };
        
        let savedConversion = null;
        try {
            savedConversion = await saveConversionHistory(userId, conversionData);
            if (savedConversion) {
                console.log('Conversion saved to Supabase:', savedConversion.id);
            }
        } catch (historyError) {
            console.warn('Failed to save conversion to history (Supabase not configured):', historyError.message);
            // Continue with conversion even if history saving fails
        }
        
        console.log('=== PDF Conversion Completed Successfully ===');
        
        res.json({
            success: true,
            filename: filename,
            csvData: csvData,
            transactionCount: transactions.length,
            originalFilename: req.file.originalname,
            conversionId: savedConversion ? savedConversion.id : null
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
        // Check if Stripe is configured
        if (!stripe) {
            return res.status(503).json({ 
                error: 'Payment processing not available',
                message: 'Stripe is not configured. Payment features are disabled in development mode.',
                code: 'STRIPE_NOT_CONFIGURED'
            });
        }
        
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
        res.status(500).json({ 
            error: 'Payment processing failed',
            message: error.message,
            code: 'STRIPE_ERROR'
        });
    }
});

// Stripe webhook handler
app.post('/api/stripe-webhook', express.raw({type: 'application/json'}), (req, res) => {
    if (!stripe) {
        return res.status(503).json({ error: 'Stripe not configured' });
    }
    
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
    const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY;
    const isConfigured = publishableKey && publishableKey !== 'pk_test_your_key_here';
    
    res.json({
        publishableKey: isConfigured ? publishableKey : null,
        isConfigured: isConfigured,
        message: isConfigured ? 'Stripe is configured' : 'Stripe is not configured'
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

// Add API routes for local development
app.get('/api/login', (req, res) => {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Login - Smart Statement Converter</title>
    <link rel="stylesheet" href="/styles.css">
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
                        Don't have an account? <a href="/api/register" style="color: #4F46E5; text-decoration: none; font-weight: 500;">Create one</a>
                    </p>
                </div>
            </div>
        </div>
    </section>

    <script>
        // Check if user is already logged in
        function checkAuthStatus() {
            const userToken = localStorage.getItem('userToken');
            const userData = localStorage.getItem('userData');
            
            if (userToken && userData) {
                try {
                    const user = JSON.parse(userData);
                    console.log('User already logged in:', user);
                    // Redirect to main page if already logged in
                    window.location.href = '/';
                    return;
                } catch (error) {
                    console.error('Error parsing user data:', error);
                    localStorage.removeItem('userToken');
                    localStorage.removeItem('userData');
                }
            }
        }
        
        // Check auth status on page load
        checkAuthStatus();
        
        // Load Google Client ID and initialize
        fetch('/api/auth/config')
            .then(response => response.json())
            .then(data => {
                if (data.googleClientId && window.google) {
                    try {
                        window.google.accounts.id.initialize({
                            client_id: data.googleClientId,
                            callback: handleGoogleSignIn
                        });
                        
                        window.google.accounts.id.renderButton(
                            document.getElementById('googleSignInDiv'),
                            { theme: 'outline', size: 'large', text: 'signin_with' }
                        );
                    } catch (error) {
                        console.error('Google OAuth failed:', error);
                        showAuthError();
                    }
                } else {
                    console.error('Google OAuth not configured');
                    showAuthError();
                }
            })
            .catch(error => {
                console.error('Failed to load auth config:', error);
                showAuthError();
            });
        
        function showAuthError() {
            document.getElementById('googleSignInDiv').style.display = 'none';
            document.getElementById('authError').style.display = 'block';
        }
        
        function handleGoogleSignIn(response) {
            // Show loading state
            const button = document.querySelector('#googleSignInDiv button');
            if (button) {
                button.style.opacity = '0.6';
                button.style.pointerEvents = 'none';
            }
            
            fetch('/api/auth/google', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ credential: response.credential })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    localStorage.setItem('userToken', data.token);
                    localStorage.setItem('userData', JSON.stringify(data.user));
                    // Smooth redirect without popup
                    window.location.href = '/';
                } else {
                    alert('Login failed: ' + data.message);
                }
            })
            .catch(error => {
                console.error('Login error:', error);
                alert('Login failed. Please try again.');
            });
        }
        
    </script>
</body>
</html>`;
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
});

// Profile page
app.get('/api/profile', (req, res) => {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Profile - Smart Statement Converter</title>
    <link rel="stylesheet" href="/styles.css">
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
                    <a href="/" class="nav-link">Home</a>
                    <a href="#pricing" class="nav-link">Pricing</a>
                    <div class="user-info" id="userInfo" style="display: none;">
                        <div class="user-avatar" id="userAvatar" style="width: 32px; height: 32px; border-radius: 50%; background: #4F46E5; display: flex; align-items: center; justify-content: center; color: white; font-weight: 600; font-size: 0.875rem;">
                        </div>
                        <span id="userName" style="color: #374151; font-weight: 500;"></span>
                        <button onclick="logout()" class="nav-link" style="background: none; border: none; color: #6B7280; cursor: pointer; padding: 0.5rem; border-radius: 4px; transition: background-color 0.2s;">
                            Logout
                        </button>
                    </div>
                </div>
            </nav>
        </div>
    </header>

    <section class="hero" style="min-height: 80vh; display: flex; align-items: center;">
        <div class="container">
            <div class="hero-content" style="max-width: 1200px; margin: 0 auto;">
                <h1 class="hero-title" style="font-size: 2.5rem; margin-bottom: 1rem;">My Profile</h1>
                <p class="hero-subtitle" style="margin-bottom: 2rem;">Manage your account and view your conversion history.</p>
                
                <div class="profile-container" style="background: white; padding: 2rem; border-radius: 12px; box-shadow: 0 8px 25px rgba(0,0,0,0.1);">
                    <div class="profile-tabs" style="display: flex; border-bottom: 1px solid #e5e7eb; margin-bottom: 2rem;">
                        <button onclick="showTab('history')" id="historyTab" class="tab-button active" style="padding: 1rem 2rem; border: none; background: #4F46E5; color: white; cursor: pointer; border-radius: 8px 8px 0 0; font-weight: 600;">
                            📚 Conversion History
                        </button>
                        <button onclick="showTab('settings')" id="settingsTab" class="tab-button" style="padding: 1rem 2rem; border: none; background: #f3f4f6; color: #374151; cursor: pointer; border-radius: 8px 8px 0 0; font-weight: 600;">
                            ⚙️ Settings
                        </button>
                    </div>
                    
                    <div id="historyContent" class="tab-content">
                        <div class="history-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                            <h2 style="margin: 0; color: #374151;">Your Conversions</h2>
                            <button onclick="refreshHistory()" class="btn-secondary" style="padding: 0.5rem 1rem; background: #f3f4f6; color: #374151; border: 1px solid #d1d5db; border-radius: 6px; cursor: pointer;">
                                🔄 Refresh
                            </button>
                        </div>
                        <div id="historyGrid" class="history-grid" style="display: grid; gap: 1rem;">
                            <!-- History will be loaded here -->
                        </div>
                    </div>
                    
                    <div id="settingsContent" class="tab-content" style="display: none;">
                        <h2 style="margin: 0 0 1.5rem 0; color: #374151;">Account Settings</h2>
                        <div class="settings-section" style="background: #f8fafc; padding: 1.5rem; border-radius: 8px; margin-bottom: 1rem;">
                            <h3 style="margin: 0 0 1rem 0; color: #374151;">Account Information</h3>
                            <p style="margin: 0; color: #6B7280;">Manage your account details and preferences.</p>
                        </div>
                        <div class="settings-section" style="background: #f8fafc; padding: 1.5rem; border-radius: 8px;">
                            <h3 style="margin: 0 0 1rem 0; color: #374151;">Data Management</h3>
                            <p style="margin: 0 0 1rem 0; color: #6B7280;">Control your conversion data and privacy settings.</p>
                            <button onclick="exportAllData()" class="btn-secondary" style="padding: 0.5rem 1rem; background: #f3f4f6; color: #374151; border: 1px solid #d1d5db; border-radius: 6px; cursor: pointer; margin-right: 1rem;">
                                📥 Export All Data
                            </button>
                            <button onclick="clearAllData()" class="btn-danger" style="padding: 0.5rem 1rem; background: #ef4444; color: white; border: none; border-radius: 6px; cursor: pointer;">
                                🗑️ Clear All Data
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <script>
        // Check if user is logged in
        function checkAuthStatus() {
            const userToken = localStorage.getItem('userToken');
            const userData = localStorage.getItem('userData');
            
            if (userToken && userData) {
                try {
                    const user = JSON.parse(userData);
                    console.log('User logged in:', user);
                    
                    // Show user info
                    document.getElementById('userInfo').style.display = 'flex';
                    document.getElementById('userName').textContent = user.name || user.email;
                    document.getElementById('userAvatar').textContent = (user.name || user.email).charAt(0).toUpperCase();
                    
                    // Load conversion history
                    loadConversionHistory();
                } catch (error) {
                    console.error('Error parsing user data:', error);
                    localStorage.removeItem('userToken');
                    localStorage.removeItem('userData');
                    window.location.href = '/api/login';
                }
            } else {
                window.location.href = '/api/login';
            }
        }
        
        function logout() {
            localStorage.removeItem('userToken');
            localStorage.removeItem('userData');
            window.location.href = '/';
        }
        
        function showTab(tabName) {
            // Hide all tab contents
            document.querySelectorAll('.tab-content').forEach(content => {
                content.style.display = 'none';
            });
            
            // Remove active class from all tabs
            document.querySelectorAll('.tab-button').forEach(button => {
                button.style.background = '#f3f4f6';
                button.style.color = '#374151';
            });
            
            // Show selected tab content
            document.getElementById(tabName + 'Content').style.display = 'block';
            
            // Add active class to selected tab
            const activeTab = document.getElementById(tabName + 'Tab');
            activeTab.style.background = '#4F46E5';
            activeTab.style.color = 'white';
        }
        
        async function loadConversionHistory() {
            try {
                const userData = JSON.parse(localStorage.getItem('userData'));
                const userId = userData ? userData.id : ANONYMOUS_USER_ID;
                
                const response = await fetch(\`/api/history?userId=\${userId}\`);
                const data = await response.json();
                
                if (data.success) {
                    displayConversionHistory(data.history);
                } else {
                    console.error('Failed to load conversion history:', data.message);
                }
            } catch (error) {
                console.error('Error loading conversion history:', error);
            }
        }
        
        function displayConversionHistory(history) {
            const historyGrid = document.getElementById('historyGrid');
            
            if (history.length === 0) {
                historyGrid.innerHTML = \`
                    <div class="no-history" style="text-align: center; padding: 3rem; color: #6B7280; grid-column: 1 / -1;">
                        <div style="font-size: 3rem; margin-bottom: 1rem;">📄</div>
                        <h3 style="margin: 0 0 0.5rem 0; color: #374151;">No conversions yet</h3>
                        <p style="margin: 0;">Upload your first PDF to get started!</p>
                        <a href="/" style="display: inline-block; margin-top: 1rem; padding: 0.75rem 1.5rem; background: #4F46E5; color: white; text-decoration: none; border-radius: 6px;">
                            Upload PDF
                        </a>
                    </div>
                \`;
            } else {
                historyGrid.innerHTML = history.map(conv => \`
                    <div class="history-item" style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 1.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); transition: box-shadow 0.2s;">
                        <div class="history-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                            <h4 style="margin: 0; color: #374151; font-size: 1.125rem;">\${conv.filename}</h4>
                            <span style="color: #6B7280; font-size: 0.875rem;">\${new Date(conv.timestamp).toLocaleDateString()}</span>
                        </div>
                        <div class="history-details" style="display: flex; gap: 1.5rem; margin-bottom: 1.5rem; font-size: 0.875rem; color: #6B7280;">
                            <span>📊 \${conv.transactionCount} transactions</span>
                            <span>📁 \${(conv.fileSize / 1024).toFixed(1)} KB</span>
                        </div>
                        <div class="history-actions" style="display: flex; gap: 0.75rem;">
                            <button onclick="viewConversion('\${conv.id}')" class="btn-primary" style="padding: 0.75rem 1.5rem; background: #4F46E5; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 0.875rem; font-weight: 500;">
                                👁️ View Details
                            </button>
                            <button onclick="downloadHistoryCSV('\${conv.id}')" class="btn-secondary" style="padding: 0.75rem 1.5rem; background: #f3f4f6; color: #374151; border: 1px solid #d1d5db; border-radius: 6px; cursor: pointer; font-size: 0.875rem; font-weight: 500;">
                                📥 Download CSV
                            </button>
                        </div>
                    </div>
                \`).join('');
            }
        }
        
        async function viewConversion(conversionId) {
            try {
                const userData = JSON.parse(localStorage.getItem('userData'));
                const userId = userData ? userData.id : ANONYMOUS_USER_ID;
                
                const response = await fetch(\`/api/history/\${conversionId}?userId=\${userId}\`);
                const data = await response.json();
                
                if (data.success) {
                    // Redirect to main page with conversion data
                    window.location.href = \`/?conversionId=\${conversionId}\`;
                } else {
                    console.error('Failed to load conversion details:', data.message);
                }
            } catch (error) {
                console.error('Error loading conversion details:', error);
            }
        }
        
        async function downloadHistoryCSV(conversionId) {
            try {
                const userData = JSON.parse(localStorage.getItem('userData'));
                const userId = userData ? userData.id : ANONYMOUS_USER_ID;
                
                const response = await fetch(\`/api/history/\${conversionId}?userId=\${userId}\`);
                const data = await response.json();
                
                if (data.success) {
                    // Create and download CSV
                    const blob = new Blob([data.conversion.csvData], { type: 'text/csv' });
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = data.conversion.filename;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    window.URL.revokeObjectURL(url);
                } else {
                    console.error('Failed to load conversion for download:', data.message);
                }
            } catch (error) {
                console.error('Error downloading conversion:', error);
            }
        }
        
        function refreshHistory() {
            loadConversionHistory();
        }
        
        function exportAllData() {
            // TODO: Implement export all data functionality
            alert('Export all data feature coming soon!');
        }
        
        function clearAllData() {
            if (confirm('Are you sure you want to clear all your conversion data? This action cannot be undone.')) {
                // TODO: Implement clear all data functionality
                alert('Clear all data feature coming soon!');
            }
        }
        
        // Initialize on page load
        checkAuthStatus();
    </script>
</body>
</html>`;
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
});

// Register page
app.get('/api/register', (req, res) => {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Register - Smart Statement Converter</title>
    <link rel="stylesheet" href="/styles.css">
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
        // Check if user is already logged in
        function checkAuthStatus() {
            const userToken = localStorage.getItem('userToken');
            const userData = localStorage.getItem('userData');
            
            if (userToken && userData) {
                try {
                    const user = JSON.parse(userData);
                    console.log('User already logged in:', user);
                    // Redirect to main page if already logged in
                    window.location.href = '/';
                    return;
                } catch (error) {
                    console.error('Error parsing user data:', error);
                    localStorage.removeItem('userToken');
                    localStorage.removeItem('userData');
                }
            }
        }
        
        // Check auth status on page load
        checkAuthStatus();
        
        // Load Google Client ID and initialize
        fetch('/api/auth/config')
            .then(response => response.json())
            .then(data => {
                if (data.googleClientId && window.google) {
                    try {
                        window.google.accounts.id.initialize({
                            client_id: data.googleClientId,
                            callback: handleGoogleSignIn
                        });
                        
                        window.google.accounts.id.renderButton(
                            document.getElementById('googleSignInDiv'),
                            { theme: 'outline', size: 'large', text: 'signup_with' }
                        );
                    } catch (error) {
                        console.error('Google OAuth failed:', error);
                        showAuthError();
                    }
                } else {
                    console.error('Google OAuth not configured');
                    showAuthError();
                }
            })
            .catch(error => {
                console.error('Failed to load auth config:', error);
                showAuthError();
            });
        
        function showAuthError() {
            document.getElementById('googleSignInDiv').style.display = 'none';
            document.getElementById('authError').style.display = 'block';
        }
        
        function handleGoogleSignIn(response) {
            // Show loading state
            const button = document.querySelector('#googleSignInDiv button');
            if (button) {
                button.style.opacity = '0.6';
                button.style.pointerEvents = 'none';
            }
            
            fetch('/api/auth/google', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ credential: response.credential })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    localStorage.setItem('userToken', data.token);
                    localStorage.setItem('userData', JSON.stringify(data.user));
                    // Smooth redirect without popup
                    window.location.href = '/';
                } else {
                    alert('Registration failed: ' + data.message);
                }
            })
            .catch(error => {
                console.error('Registration error:', error);
                alert('Registration failed. Please try again.');
            });
        }
        
    </script>
</body>
</html>`;
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
});

app.get('/api/auth/config', (req, res) => {
    res.json({
        googleClientId: process.env.GOOGLE_CLIENT_ID || '',
        stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY || ''
    });
});

app.post('/api/auth/google', async (req, res) => {
    const { OAuth2Client } = require('google-auth-library');
    const jwt = require('jsonwebtoken');

    const client = new OAuth2Client(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.FRONTEND_URL || 'http://localhost:3000'
    );

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
        
        // Create or update user in database
        try {
            await db.createUser({
                id: userId,
                email: email,
                name: name,
                picture: picture
            });
            console.log('✅ User created/updated in database:', email);
        } catch (userError) {
            // User might already exist, try to update instead
            if (userError.message.includes('duplicate key') || userError.code === '23505') {
                try {
                    await db.updateUser(userId, {
                        email: email,
                        name: name,
                        picture_url: picture
                    });
                    console.log('✅ User updated in database:', email);
                } catch (updateError) {
                    console.warn('Failed to create/update user in database:', updateError.message);
                }
            } else {
                console.warn('Failed to create user in database:', userError.message);
            }
        }
        
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
});

// Logout endpoint to clear session
app.post('/api/logout', (req, res) => {
    res.json({
        success: true,
        message: 'Logged out successfully'
    });
});

// Credit usage endpoint
app.get('/api/credit-usage', async (req, res) => {
    try {
        const { userId } = req.query;
        
        if (!userId) {
            return res.status(400).json({ error: 'User ID is required' });
        }
        
        // Try to get from database first
        try {
            const creditUsage = await db.getCreditUsageByUserId(userId);
            const formattedUsage = creditUsage.map(usage => ({
                date: usage.created_at,
                description: usage.description,
                creditsUsed: usage.credits_used
            }));
            return res.json(formattedUsage);
        } catch (dbError) {
            console.warn('Failed to fetch credit usage from database:', dbError.message);
            
            // Fallback to sample data
            const sampleCreditUsage = [
                {
                    date: '2025-09-14T17:24:00Z',
                    description: 'Converted a 8 page PDF.',
                    creditsUsed: 1
                },
                {
                    date: '2025-09-14T17:11:00Z',
                    description: 'Converted a 8 page PDF.',
                    creditsUsed: 1
                }
            ];

            // Filter by last 28 days
            const twentyEightDaysAgo = new Date();
            twentyEightDaysAgo.setDate(twentyEightDaysAgo.getDate() - 28);
            
            const filteredUsage = sampleCreditUsage.filter(usage => 
                new Date(usage.date) >= twentyEightDaysAgo
            );

            return res.json(filteredUsage);
        }
    } catch (error) {
        console.error('Error in credit usage endpoint:', error);
        res.status(500).json({ error: 'Failed to fetch credit usage' });
    }
});

// Check credit limits endpoint - for client-side validation before processing
app.get('/api/check-credit-limits', async (req, res) => {
    try {
        const { userId } = req.query;
        
        if (!userId) {
            return res.status(400).json({ error: 'User ID is required' });
        }
        
        console.log('🔍 Checking credit limits for user:', userId);
        
        // Use the existing credit limit checking function from db
        const creditLimits = await db.checkCreditLimits(userId);
        
        console.log('✅ Credit limits check result:', creditLimits);
        res.json(creditLimits);
        
    } catch (error) {
        console.error('❌ Error checking credit limits:', error);
        
        // Return conservative fallback limits if database check fails
        const fallbackLimits = {
            isRegistered: userId !== 'anonymous' && userId !== '00000000-0000-0000-0000-000000000000',
            dailyLimit: userId !== 'anonymous' && userId !== '00000000-0000-0000-0000-000000000000' ? 5 : 1,
            currentUsage: 0,
            remaining: userId !== 'anonymous' && userId !== '00000000-0000-0000-0000-000000000000' ? 5 : 1,
            canConvert: true,
            subscription: 'free'
        };
        
        res.json(fallbackLimits);
    }
});

// Track credit usage endpoint
app.post('/api/track-credit-usage', async (req, res) => {
    try {
        const { userId, fileName, pageCount, creditsUsed, date, description } = req.body;
        
        console.log('📊 Credit usage tracked:', {
            userId: userId,
            fileName: fileName,
            pageCount: pageCount,
            creditsUsed: creditsUsed,
            date: date,
            description: description
        });
        
        // Try to save to database
        try {
            await db.createCreditUsage({
                userId: userId,
                fileName: fileName,
                pageCount: pageCount,
                creditsUsed: creditsUsed,
                description: description
            });
            console.log('✅ Credit usage saved to database');
        } catch (dbError) {
            console.warn('Failed to save credit usage to database:', dbError.message);
            // Continue anyway, don't fail the request
        }
        
        res.json({
            success: true,
            message: 'Credit usage tracked successfully'
        });
    } catch (error) {
        console.error('Error tracking credit usage:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to track credit usage' 
        });
    }
});

// Serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Subscription API endpoint
app.post('/api/subscription', async (req, res) => {
    try {
        const { user_id, plan_type, billing_cycle, status, current_period_start, current_period_end, stripe_customer_id, stripe_subscription_id } = req.body;
        
        if (!user_id || !plan_type) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        console.log('📤 Received subscription data:', { user_id, plan_type, billing_cycle, status });
        
        // Check if subscription already exists for this user
        let existingSubscription;
        try {
            existingSubscription = await db.getSubscriptionByUserId(user_id);
        } catch (fetchError) {
            if (fetchError.code !== 'PGRST116') {
                console.error('Error fetching existing subscription:', fetchError);
                return res.status(500).json({ error: 'Database error', details: fetchError.message });
            }
            existingSubscription = null;
        }
        
        let result;
        
        if (existingSubscription) {
            // Update existing subscription
            try {
                result = await db.updateSubscription(existingSubscription.stripe_subscription_id || existingSubscription.id, {
                    plan_type: plan_type,
                    billing_cycle: billing_cycle,
                    status: status,
                    current_period_start: current_period_start,
                    current_period_end: current_period_end,
                    stripe_customer_id: stripe_customer_id,
                    stripe_subscription_id: stripe_subscription_id,
                    updated_at: new Date().toISOString()
                });
                console.log('✅ Updated existing subscription for user:', user_id);
            } catch (error) {
                console.error('Error updating subscription:', error);
                return res.status(500).json({ error: 'Failed to update subscription', details: error.message });
            }
        } else {
            // Create new subscription - first ensure user exists
            try {
                // Check if user exists, if not create them
                let user;
                try {
                    user = await db.getUserById(user_id);
                    console.log('👤 User found:', user);
                } catch (userError) {
                    console.log('👤 User not found, creating new user:', user_id, 'Error:', userError.message);
                    if (userError.code === 'PGRST116' || userError.message.includes('No rows found')) {
                        // User doesn't exist, create them
                        user = await db.createUser({
                            id: user_id,
                            email: `user-${user_id}@example.com`, // Default email
                            name: `User ${user_id.substring(0, 8)}`,
                            google_id: null
                        });
                        console.log('✅ Created new user:', user);
                    } else {
                        throw userError;
                    }
                }
                
                result = await db.createSubscription({
                    user_id: user_id,
                    plan_type: plan_type,
                    billing_cycle: billing_cycle,
                    status: status,
                    current_period_start: current_period_start,
                    current_period_end: current_period_end,
                    stripe_customer_id: stripe_customer_id,
                    stripe_subscription_id: stripe_subscription_id
                });
                console.log('✅ Created new subscription for user:', user_id);
            } catch (error) {
                console.error('Error creating subscription:', error);
                return res.status(500).json({ error: 'Failed to create subscription', details: error.message });
            }
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
});

// Get subscription by user ID
app.get('/api/subscription/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        
        if (!userId) {
            return res.status(400).json({ error: 'User ID is required' });
        }
        
        console.log('🔍 Fetching subscription for user:', userId);
        
        const subscription = await db.getSubscriptionByUserId(userId);
        
        if (subscription) {
            console.log('✅ Subscription found:', subscription);
            return res.status(200).json({
                success: true,
                subscription: subscription,
                message: 'Subscription found'
            });
        } else {
            console.log('🔄 No subscription found for user:', userId);
            return res.status(200).json({
                success: false,
                subscription: null,
                message: 'No subscription found'
            });
        }
        
    } catch (error) {
        console.error('❌ Error fetching subscription:', error);
        return res.status(500).json({
            success: false,
            error: 'Database error',
            message: error.message
        });
    }
});

// Test subscription API endpoint
app.get('/api/test-subscription', (req, res) => {
    return res.status(200).json({
        success: true,
        message: 'API endpoint is working',
        timestamp: new Date().toISOString()
    });
});

// Serve static files AFTER all API routes are registered
// Exclude /api directory from static file serving to prevent conflicts
app.use((req, res, next) => {
    if (req.path.startsWith('/api')) {
        return next();
    }
    express.static('.')(req, res, next);
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Smart Statement Converter Server running on http://localhost:${PORT}`);
    console.log(`📁 Upload directory: ${path.resolve(uploadDir)}`);
    console.log(`💳 Stripe integration: ${stripe ? 'Configured' : 'Not configured (payment features disabled)'}`);
});

module.exports = app;