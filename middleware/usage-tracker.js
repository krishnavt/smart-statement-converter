const jwt = require('jsonwebtoken');
const { db } = require('../lib/supabase.js');

// Middleware to track user usage
const trackUsage = (actionType) => {
    return async (req, res, next) => {
        try {
            // Extract user from JWT token
            const authHeader = req.headers.authorization;
            const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
            
            if (token) {
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                req.userId = decoded.userId;
            }
            
            // Store action metadata for logging after request
            req.usageMetadata = {
                actionType,
                fileSizeMb: req.file ? (req.file.size / (1024 * 1024)).toFixed(2) : null,
                pagesProcessed: null // Will be set by the conversion logic
            };
            
            next();
        } catch (error) {
            console.error('Usage tracking middleware error:', error);
            next(); // Continue even if usage tracking fails
        }
    };
};

// Function to check user limits before allowing action
const checkUserLimits = async (req, res, next) => {
    try {
        const userId = req.userId;
        
        if (!userId) {
            // Anonymous user - check basic limits
            const today = new Date().toDateString();
            const lastUpload = req.session?.lastAnonymousUpload || localStorage?.getItem('lastAnonymousUpload');
            
            if (lastUpload === today) {
                return res.status(429).json({
                    error: 'Rate limit exceeded',
                    message: 'Anonymous users can only convert 1 file per 24 hours. Please register for more conversions.'
                });
            }
            
            // Set anonymous usage
            if (req.session) req.session.lastAnonymousUpload = today;
            
        } else {
            // Registered user - check plan limits
            const user = await db.getUserByGoogleId(userId);
            const subscription = user?.subscriptions?.[0];
            const planType = subscription?.plan_type || 'free';
            
            // Get plan limits
            const planLimits = await db.getPlanLimits(planType);
            
            // Check today's usage
            const todaysUsage = await db.getUserUsageToday(userId);
            const conversionsToday = todaysUsage.filter(log => log.action_type === 'pdf_conversion').length;
            
            if (planLimits.max_conversions_per_day !== -1 && conversionsToday >= planLimits.max_conversions_per_day) {
                return res.status(429).json({
                    error: 'Daily limit exceeded',
                    message: `You've reached your daily limit of ${planLimits.max_conversions_per_day} conversions. Upgrade your plan for more.`,
                    currentUsage: conversionsToday,
                    limit: planLimits.max_conversions_per_day,
                    planType
                });
            }
            
            // Check file size limits
            if (req.file && req.file.size > (planLimits.max_file_size_mb * 1024 * 1024)) {
                return res.status(413).json({
                    error: 'File too large',
                    message: `File size exceeds your plan limit of ${planLimits.max_file_size_mb}MB. Upgrade your plan for larger files.`,
                    fileSize: (req.file.size / (1024 * 1024)).toFixed(2),
                    limit: planLimits.max_file_size_mb,
                    planType
                });
            }
            
            // Store user info for usage logging
            req.user = user;
        }
        
        next();
    } catch (error) {
        console.error('User limits check error:', error);
        next(); // Continue even if limits check fails
    }
};

// Function to log usage after successful action
const logUsageAfterAction = async (req, res, actionResult) => {
    try {
        if (req.userId && req.usageMetadata) {
            // Update metadata with action results
            if (actionResult.transactionCount) {
                req.usageMetadata.pagesProcessed = actionResult.transactionCount;
            }
            
            // Log the usage
            await db.logUsage(req.userId, req.usageMetadata.actionType, {
                fileSizeMb: req.usageMetadata.fileSizeMb,
                pagesProcessed: req.usageMetadata.pagesProcessed
            });
            
            console.log(`Logged usage for user ${req.userId}: ${req.usageMetadata.actionType}`);
        }
    } catch (error) {
        console.error('Usage logging error:', error);
        // Don't throw - this shouldn't break the main flow
    }
};

module.exports = {
    trackUsage,
    checkUserLimits,
    logUsageAfterAction
};