# Production Readiness Checklist

## ✅ Completed Security Improvements

### Critical Security Fixes
- [x] **Removed hardcoded secrets from vercel.json** - No longer exposing credentials in git
- [x] **Environment variable validation** - Server fails fast if required variables are missing
- [x] **Security headers (helmet.js)** - CSP, HSTS, XSS protection, frame guards
- [x] **Rate limiting** - IP-based protection for API, auth, and upload endpoints
- [x] **Input sanitization** - XSS attack prevention
- [x] **CORS hardening** - Whitelist-based origin validation
- [x] **Sentry integration** - Privacy-aware error tracking and monitoring
- [x] **File upload validation** - Size limits, type checking, suspicious filename detection

### New Modules Created
- `lib/env-validator.js` - Validates all required environment variables on startup
- `lib/sentry.js` - Sentry error tracking with PII filtering
- `lib/security.js` - Security middleware (helmet, rate limiting, sanitization)
- `.env.example` - Template for environment variables
- `DEPLOYMENT.md` - Detailed deployment instructions

## ⚠️ CRITICAL: Required Actions Before Deployment

### 1. Configure Environment Variables in Vercel

You **MUST** add these to Vercel Dashboard > Settings > Environment Variables:

```bash
# Supabase (REQUIRED)
SUPABASE_URL=https://korlxghajrdussqbxqth.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# JWT (REQUIRED - generate a secure random string)
JWT_SECRET=<generate-secure-random-32-char-string>

# Google OAuth (REQUIRED for login)
GOOGLE_CLIENT_ID=<your-google-oauth-client-id>
GOOGLE_CLIENT_SECRET=<your-google-oauth-secret>

# Stripe (REQUIRED for payments)
STRIPE_SECRET_KEY=<your-stripe-secret-key>
STRIPE_PUBLISHABLE_KEY=<your-stripe-publishable-key>
STRIPE_WEBHOOK_SECRET=<your-stripe-webhook-secret>

# Sentry (RECOMMENDED for error tracking)
SENTRY_DSN=<your-sentry-dsn>
SENTRY_ENVIRONMENT=production
```

**Generate JWT_SECRET:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2. Rotate Supabase Keys (CRITICAL)

Your Supabase keys were exposed in git history. You **MUST** rotate them:

1. Go to [Supabase Dashboard](https://app.supabase.com) > Your Project > Settings > API
2. Click "Reset database password"
3. Generate new service role key
4. Update environment variables in Vercel with new keys
5. Update local `.env` file

### 3. Set Up Sentry (Recommended)

1. Create account at [sentry.io](https://sentry.io)
2. Create new project for your app
3. Copy the DSN
4. Add to Vercel environment variables:
   - `SENTRY_DSN=<your-dsn>`
   - `SENTRY_ENVIRONMENT=production`

### 4. Consider Making Repository Private

Since secrets were in git history, consider:
- Making the repository private, OR
- Cleaning git history (see DEPLOYMENT.md for instructions)

## 📋 Deployment Steps

1. **Configure environment variables** (see above)
2. **Test locally first:**
   ```bash
   cp .env.example .env
   # Fill in .env with your values
   npm install
   npm run dev
   ```

3. **Deploy to Vercel:**
   ```bash
   vercel --prod
   ```

4. **Verify deployment:**
   - Test authentication flow
   - Test PDF conversion
   - Test payment flow
   - Check Sentry for any errors
   - Verify rate limiting is working

## 🔍 Testing Checklist

After deployment, test these critical flows:

- [ ] Homepage loads correctly
- [ ] Google OAuth login works
- [ ] PDF upload and conversion works
- [ ] Rate limiting returns 429 when exceeded
- [ ] Stripe payment flow works
- [ ] Conversion history loads
- [ ] Credits/usage tracking works
- [ ] Sentry captures errors (test with intentional error)
- [ ] CORS allows your frontend domain
- [ ] Security headers present (check browser DevTools)

## 📊 Monitoring Setup

### Vercel Dashboard
- Monitor deployment logs
- Check function invocations
- Watch for errors

### Sentry Dashboard
- Set up alerts for high error rates
- Monitor performance metrics
- Review error trends

### Recommended Additions
- [ ] Uptime monitoring (UptimeRobot, Better Uptime)
- [ ] Performance monitoring (Vercel Analytics already enabled)
- [ ] Database monitoring (Supabase dashboard)
- [ ] Log aggregation (optional: Logtail, Datadog)

## 🚀 Performance Optimizations (Future)

Not critical but recommended:
- [ ] Add Redis for rate limiting (for multi-server setups)
- [ ] Implement request caching
- [ ] Add CDN for static assets
- [ ] Optimize database queries
- [ ] Add database connection pooling
- [ ] Implement job queue for background tasks

## 🧪 Testing Infrastructure (Future)

Currently missing:
- [ ] Unit tests (Jest/Vitest)
- [ ] Integration tests
- [ ] E2E tests (Playwright/Cypress)
- [ ] CI/CD pipeline (GitHub Actions)
- [ ] Automated security scanning

## 📝 Documentation Improvements (Future)

- [ ] API documentation (Swagger/OpenAPI)
- [ ] Architecture diagrams
- [ ] Runbook for common issues
- [ ] Contribution guidelines

## 🔐 Additional Security Hardening (Future)

- [ ] Add CSRF protection
- [ ] Implement API key rotation
- [ ] Add virus scanning for uploads
- [ ] Set up Web Application Firewall (Cloudflare)
- [ ] Implement audit logging
- [ ] Add penetration testing
- [ ] Set up security scanning (Snyk, Dependabot)

## 📞 Support

If you encounter issues:
1. Check Vercel deployment logs
2. Check Sentry for errors
3. Review DEPLOYMENT.md
4. Verify all environment variables are set

## Summary

**Status**: ✅ Production-ready after environment variable configuration

**Immediate blockers**:
1. Add environment variables to Vercel
2. Rotate Supabase keys

**Time to deploy**: ~15 minutes after env vars configured

**Security level**: Significantly improved ✅
- Secrets removed from code
- Rate limiting active
- Input sanitization active
- Security headers configured
- Error tracking ready

**Next steps**:
1. Configure environment variables (5 min)
2. Rotate Supabase keys (3 min)
3. Set up Sentry (5 min)
4. Deploy (2 min)
5. Test (15 min)
