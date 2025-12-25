/**
 * Sentry Error Tracking Configuration
 * Initializes Sentry for production error monitoring
 */

const Sentry = require('@sentry/node');

/**
 * Initialize Sentry error tracking
 * @param {Object} app - Express app instance
 */
function initSentry(app) {
  // Only initialize if DSN is provided
  if (!process.env.SENTRY_DSN) {
    console.log('ℹ️  Sentry DSN not configured - error tracking disabled');
    return;
  }

  const environment = process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development';

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment,

    // Performance Monitoring
    tracesSampleRate: environment === 'production' ? 0.1 : 1.0, // 10% in prod, 100% in dev

    // Profiling disabled to reduce bundle size
    // profilesSampleRate: environment === 'production' ? 0.1 : 1.0,

    // Release tracking
    release: process.env.VERCEL_GIT_COMMIT_SHA || 'development',

    // Filter out sensitive data
    beforeSend(event, hint) {
      // Remove sensitive headers
      if (event.request) {
        if (event.request.headers) {
          delete event.request.headers.authorization;
          delete event.request.headers.cookie;
        }

        // Remove query parameters that might contain tokens
        if (event.request.query_string) {
          const sensitiveParams = ['token', 'key', 'secret', 'password'];
          sensitiveParams.forEach(param => {
            if (event.request.query_string.includes(param)) {
              event.request.query_string = event.request.query_string
                .replace(new RegExp(`${param}=[^&]*`, 'gi'), `${param}=REDACTED`);
            }
          });
        }
      }

      // Sanitize user data
      if (event.user) {
        // Keep user ID for tracking but remove sensitive info
        delete event.user.email;
        delete event.user.ip_address;
      }

      // Remove sensitive context data
      if (event.contexts) {
        delete event.contexts.device;
      }

      return event;
    },

    // Ignore certain errors
    ignoreErrors: [
      // Browser/network errors
      'Network request failed',
      'NetworkError',
      'Failed to fetch',
      'Load failed',

      // User cancellations
      'AbortError',
      'The operation was aborted',

      // Known false positives
      'ResizeObserver loop limit exceeded',
      'Non-Error promise rejection captured',

      // Bot/crawler errors
      /^Blocked a frame with origin/,
    ],

    // Don't send PII
    sendDefaultPii: false,

    // Sample rate for error events
    sampleRate: 1.0,

    // Maximum breadcrumbs
    maxBreadcrumbs: 50,

    // Attach stack traces to all messages
    attachStacktrace: true,

    // Don't capture console logs as breadcrumbs in production
    integrations: function(integrations) {
      return integrations.filter(integration => {
        return environment !== 'production' || integration.name !== 'Console';
      });
    },
  });

  if (app) {
    // Request handler must be the first middleware
    app.use(Sentry.Handlers.requestHandler());

    // TracingHandler creates a trace for every incoming request
    app.use(Sentry.Handlers.tracingHandler());
  }

  console.log(`✅ Sentry initialized for environment: ${environment}`);

  return Sentry;
}

/**
 * Error handler middleware for Express
 * Must be used after all routes but before other error handlers
 */
function sentryErrorHandler() {
  // Return no-op middleware if Sentry is not configured
  if (!process.env.SENTRY_DSN) {
    return (req, res, next) => next();
  }

  return Sentry.Handlers.errorHandler({
    shouldHandleError(error) {
      // Capture all errors with status >= 500
      if (error.status && error.status >= 500) {
        return true;
      }

      // Capture all errors without status (unexpected errors)
      if (!error.status) {
        return true;
      }

      return false;
    }
  });
}

/**
 * Capture exception with context
 * @param {Error} error - Error object
 * @param {Object} context - Additional context
 */
function captureException(error, context = {}) {
  if (!process.env.SENTRY_DSN) {
    console.error('Error (Sentry not configured):', error);
    return;
  }

  Sentry.withScope((scope) => {
    // Add custom context
    Object.keys(context).forEach(key => {
      scope.setContext(key, context[key]);
    });

    // Add tags
    if (context.tags) {
      Object.keys(context.tags).forEach(key => {
        scope.setTag(key, context.tags[key]);
      });
    }

    // Set user if provided
    if (context.user) {
      scope.setUser({
        id: context.user.id,
        // Don't send email or other PII
      });
    }

    Sentry.captureException(error);
  });
}

/**
 * Capture message with severity
 * @param {string} message - Message to log
 * @param {string} level - Severity level (info, warning, error)
 * @param {Object} context - Additional context
 */
function captureMessage(message, level = 'info', context = {}) {
  if (!process.env.SENTRY_DSN) {
    console.log(`${level.toUpperCase()}: ${message}`);
    return;
  }

  Sentry.withScope((scope) => {
    // Add custom context
    Object.keys(context).forEach(key => {
      scope.setContext(key, context[key]);
    });

    Sentry.captureMessage(message, level);
  });
}

/**
 * Add breadcrumb for tracking user actions
 * @param {Object} breadcrumb - Breadcrumb data
 */
function addBreadcrumb(breadcrumb) {
  if (!process.env.SENTRY_DSN) {
    return;
  }

  Sentry.addBreadcrumb(breadcrumb);
}

module.exports = {
  initSentry,
  sentryErrorHandler,
  captureException,
  captureMessage,
  addBreadcrumb,
  Sentry
};
