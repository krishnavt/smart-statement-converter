/**
 * Security Middleware Configuration
 * Implements security best practices using helmet and custom middleware
 */

const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

/**
 * Configure helmet security headers
 */
function configureHelmet() {
  return helmet({
    // Content Security Policy
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'", // Required for inline scripts - consider using nonces in production
          "https://accounts.google.com",
          "https://js.stripe.com",
          "https://www.googletagmanager.com",
        ],
        styleSrc: [
          "'self'",
          "'unsafe-inline'", // Required for inline styles - consider using nonces in production
          "https://accounts.google.com",
        ],
        fontSrc: ["'self'", "data:"],
        imgSrc: ["'self'", "data:", "https:", "blob:"],
        connectSrc: [
          "'self'",
          "https://accounts.google.com",
          "https://api.stripe.com",
          "https://*.supabase.co",
          "wss://*.supabase.co",
        ],
        frameSrc: [
          "'self'",
          "https://accounts.google.com",
          "https://js.stripe.com",
        ],
        frameAncestors: ["'self'"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },

    // HTTP Strict Transport Security
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true,
    },

    // Prevent clickjacking
    frameguard: {
      action: 'sameorigin',
    },

    // Prevent MIME type sniffing
    noSniff: true,

    // Disable X-Powered-By header
    hidePoweredBy: true,

    // XSS Protection (legacy, but doesn't hurt)
    xssFilter: true,

    // Referrer Policy
    referrerPolicy: {
      policy: 'strict-origin-when-cross-origin',
    },

    // Permissions Policy (formerly Feature Policy)
    permittedCrossDomainPolicies: {
      permittedPolicies: 'none',
    },
  });
}

/**
 * Configure CORS with security best practices
 */
function configureCORS() {
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:5173',
    process.env.FRONTEND_URL,
  ].filter(Boolean);

  return {
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or curl)
      if (!origin) {
        return callback(null, true);
      }

      // In development, allow all origins
      if (process.env.NODE_ENV !== 'production') {
        return callback(null, true);
      }

      // In production, check against whitelist
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} not allowed by CORS`));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
    maxAge: 86400, // 24 hours
  };
}

/**
 * General API rate limiter
 */
function createGeneralRateLimiter() {
  return rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: {
      error: 'Too many requests from this IP, please try again later.',
      retryAfter: '15 minutes',
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    // Store rate limit data in memory (consider Redis for production with multiple servers)
    handler: (req, res) => {
      res.status(429).json({
        error: 'Too many requests',
        message: 'You have exceeded the rate limit. Please try again later.',
        retryAfter: Math.ceil(req.rateLimit.resetTime.getTime() / 1000),
      });
    },
  });
}

/**
 * Strict rate limiter for authentication endpoints
 */
function createAuthRateLimiter() {
  return rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit each IP to 5 auth requests per windowMs
    skipSuccessfulRequests: true, // Don't count successful auth attempts
    message: {
      error: 'Too many authentication attempts, please try again later.',
      retryAfter: '15 minutes',
    },
  });
}

/**
 * Rate limiter for file upload endpoints
 */
function createUploadRateLimiter() {
  return rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 50, // Limit each IP to 50 uploads per hour
    message: {
      error: 'Too many upload requests, please try again later.',
      retryAfter: '1 hour',
    },
  });
}

/**
 * Sanitize user input to prevent XSS attacks
 * This middleware should be applied selectively to routes that accept user input
 */
function sanitizeInput(req, res, next) {
  const sanitizeObject = (obj) => {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }

    const sanitized = Array.isArray(obj) ? [] : {};

    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const value = obj[key];

        if (typeof value === 'string') {
          // Remove script tags and dangerous HTML
          sanitized[key] = value
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/javascript:/gi, '')
            .replace(/on\w+\s*=/gi, '')
            .trim();
        } else if (typeof value === 'object' && value !== null) {
          sanitized[key] = sanitizeObject(value);
        } else {
          sanitized[key] = value;
        }
      }
    }

    return sanitized;
  };

  // Sanitize request body
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }

  // Sanitize query parameters
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }

  // Sanitize URL parameters
  if (req.params) {
    req.params = sanitizeObject(req.params);
  }

  next();
}

/**
 * Validate file uploads
 */
function validateFileUpload(req, res, next) {
  if (!req.file) {
    return next();
  }

  const file = req.file;

  // Check file size (10MB max)
  const maxSize = 10 * 1024 * 1024;
  if (file.size > maxSize) {
    return res.status(400).json({
      error: 'File too large',
      message: 'Maximum file size is 10MB',
    });
  }

  // Check file type
  const allowedTypes = ['application/pdf'];
  if (!allowedTypes.includes(file.mimetype)) {
    return res.status(400).json({
      error: 'Invalid file type',
      message: 'Only PDF files are allowed',
    });
  }

  // Check for suspicious filenames
  const suspiciousPatterns = [
    /\.\./,  // Directory traversal
    /[<>:"|?*]/,  // Invalid characters
    /^\./, // Hidden files
  ];

  if (suspiciousPatterns.some(pattern => pattern.test(file.originalname))) {
    return res.status(400).json({
      error: 'Invalid filename',
      message: 'Filename contains invalid characters',
    });
  }

  next();
}

/**
 * Security headers middleware for API responses
 */
function securityHeaders(req, res, next) {
  // Prevent caching of sensitive data
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  // Additional security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');

  next();
}

module.exports = {
  configureHelmet,
  configureCORS,
  createGeneralRateLimiter,
  createAuthRateLimiter,
  createUploadRateLimiter,
  sanitizeInput,
  validateFileUpload,
  securityHeaders,
};
