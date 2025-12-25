/**
 * Environment Variable Validator
 * Validates required environment variables on application startup
 * Fails fast if critical variables are missing
 */

const REQUIRED_VARS = {
  // Supabase
  SUPABASE_URL: {
    required: true,
    description: 'Supabase project URL',
    validator: (val) => val.startsWith('https://') && val.includes('supabase.co')
  },
  SUPABASE_ANON_KEY: {
    required: true,
    description: 'Supabase anonymous key',
    validator: (val) => val.startsWith('eyJ') && val.length > 100
  },
  SUPABASE_SERVICE_ROLE_KEY: {
    required: true,
    description: 'Supabase service role key (use with caution)',
    validator: (val) => val.startsWith('eyJ') && val.length > 100
  },

  // JWT
  JWT_SECRET: {
    required: true,
    description: 'Secret for JWT token signing',
    validator: (val) => {
      if (val === 'fallback-secret-change-in-production') {
        throw new Error('JWT_SECRET is using insecure fallback value. Set a secure secret.');
      }
      if (val.length < 32) {
        throw new Error('JWT_SECRET must be at least 32 characters long');
      }
      return true;
    }
  },

  // Google OAuth
  GOOGLE_CLIENT_ID: {
    required: false,
    description: 'Google OAuth client ID (required for authentication)',
    validator: (val) => val && val.includes('.apps.googleusercontent.com')
  },

  // Stripe
  STRIPE_SECRET_KEY: {
    required: false,
    description: 'Stripe secret key (required for payments)',
    validator: (val) => val && (val.startsWith('sk_test_') || val.startsWith('sk_live_'))
  },
  STRIPE_PUBLISHABLE_KEY: {
    required: false,
    description: 'Stripe publishable key',
    validator: (val) => val && (val.startsWith('pk_test_') || val.startsWith('pk_live_'))
  }
};

const OPTIONAL_VARS = {
  SENTRY_DSN: {
    description: 'Sentry error tracking DSN',
    validator: (val) => val.startsWith('https://')
  },
  SENTRY_ENVIRONMENT: {
    description: 'Sentry environment name',
    validator: (val) => ['development', 'staging', 'production'].includes(val)
  },
  NODE_ENV: {
    description: 'Node environment',
    validator: (val) => ['development', 'production', 'test'].includes(val)
  }
};

class EnvironmentValidationError extends Error {
  constructor(message, errors = []) {
    super(message);
    this.name = 'EnvironmentValidationError';
    this.errors = errors;
  }
}

/**
 * Validates environment variables
 * @param {Object} options - Validation options
 * @param {boolean} options.strict - Fail on warnings (optional vars)
 * @param {boolean} options.exitOnError - Exit process on validation failure
 * @returns {Object} Validation result with status and errors
 */
function validateEnvironment(options = {}) {
  const { strict = false, exitOnError = true } = options;
  const errors = [];
  const warnings = [];

  console.log('\n🔍 Validating environment variables...\n');

  // Validate required variables
  for (const [varName, config] of Object.entries(REQUIRED_VARS)) {
    const value = process.env[varName];

    if (!value && config.required) {
      errors.push({
        variable: varName,
        message: `Missing required environment variable: ${varName}`,
        description: config.description,
        severity: 'error'
      });
      console.error(`❌ ${varName}: MISSING (${config.description})`);
      continue;
    }

    if (!value && !config.required) {
      warnings.push({
        variable: varName,
        message: `Optional environment variable not set: ${varName}`,
        description: config.description,
        severity: 'warning'
      });
      console.warn(`⚠️  ${varName}: NOT SET (${config.description})`);
      continue;
    }

    // Validate value format
    if (value && config.validator) {
      try {
        config.validator(value);
        console.log(`✅ ${varName}: OK`);
      } catch (err) {
        errors.push({
          variable: varName,
          message: `Invalid format for ${varName}: ${err.message}`,
          description: config.description,
          severity: 'error'
        });
        console.error(`❌ ${varName}: INVALID - ${err.message}`);
      }
    } else if (value) {
      console.log(`✅ ${varName}: OK`);
    }
  }

  // Validate optional variables
  for (const [varName, config] of Object.entries(OPTIONAL_VARS)) {
    const value = process.env[varName];

    if (!value) {
      console.log(`ℹ️  ${varName}: NOT SET (optional - ${config.description})`);
      continue;
    }

    if (config.validator) {
      try {
        config.validator(value);
        console.log(`✅ ${varName}: OK`);
      } catch (err) {
        warnings.push({
          variable: varName,
          message: `Invalid format for ${varName}: ${err.message}`,
          description: config.description,
          severity: 'warning'
        });
        console.warn(`⚠️  ${varName}: INVALID - ${err.message}`);
      }
    } else {
      console.log(`✅ ${varName}: OK`);
    }
  }

  // Print summary
  console.log('\n' + '='.repeat(60));
  if (errors.length === 0 && warnings.length === 0) {
    console.log('✅ Environment validation passed!');
  } else {
    if (errors.length > 0) {
      console.error(`❌ Found ${errors.length} error(s)`);
    }
    if (warnings.length > 0) {
      console.warn(`⚠️  Found ${warnings.length} warning(s)`);
    }
  }
  console.log('='.repeat(60) + '\n');

  // Handle errors
  if (errors.length > 0) {
    const errorMessage = `Environment validation failed with ${errors.length} error(s).\n\n` +
      'Please check DEPLOYMENT.md for setup instructions.\n\n' +
      'Missing/Invalid variables:\n' +
      errors.map(e => `  - ${e.variable}: ${e.message}`).join('\n');

    if (exitOnError) {
      console.error(errorMessage);
      process.exit(1);
    } else {
      throw new EnvironmentValidationError(errorMessage, errors);
    }
  }

  // Handle warnings in strict mode
  if (strict && warnings.length > 0) {
    const warningMessage = `Environment validation failed in strict mode with ${warnings.length} warning(s).\n\n` +
      'Warnings:\n' +
      warnings.map(w => `  - ${w.variable}: ${w.message}`).join('\n');

    if (exitOnError) {
      console.error(warningMessage);
      process.exit(1);
    } else {
      throw new EnvironmentValidationError(warningMessage, warnings);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Get environment info for debugging (sanitized)
 */
function getEnvironmentInfo() {
  return {
    nodeVersion: process.version,
    platform: process.platform,
    env: process.env.NODE_ENV || 'development',
    hasSupabase: !!(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY),
    hasGoogleOAuth: !!process.env.GOOGLE_CLIENT_ID,
    hasStripe: !!(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PUBLISHABLE_KEY),
    hasSentry: !!process.env.SENTRY_DSN,
    // Never log actual secret values
    configuredVars: Object.keys(process.env).filter(key =>
      Object.keys({...REQUIRED_VARS, ...OPTIONAL_VARS}).includes(key)
    )
  };
}

module.exports = {
  validateEnvironment,
  getEnvironmentInfo,
  EnvironmentValidationError
};
