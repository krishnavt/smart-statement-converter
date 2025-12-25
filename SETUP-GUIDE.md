# Quick Setup Guide - Get Production Ready in 10 Minutes

## Prerequisites

You'll need:
- [ ] Google OAuth credentials (from Google Cloud Console)
- [ ] Stripe API keys (from Stripe Dashboard)
- [ ] Sentry account (optional but recommended - free tier available)

## Step 1: Authenticate with Vercel (1 min)

```bash
vercel login
```

This will open your browser. Log in to Vercel and authorize the CLI.

## Step 2: Run the Automated Setup Script (5 min)

I've created an automated setup script that will:
- Configure all environment variables in Vercel
- Create a local .env file for development
- Deploy to production

```bash
./setup-production.sh
```

The script will prompt you for:
- Google OAuth Client ID & Secret
- Stripe API keys
- Sentry DSN (optional)

### Where to Get These Credentials:

#### Google OAuth (Required for Login)
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing
3. Enable Google+ API
4. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client ID"
5. Application type: Web application
6. Authorized redirect URIs: `https://your-domain.vercel.app/api/auth/google`
7. Copy the Client ID and Client Secret

#### Stripe (Required for Payments)
1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Click "Developers" → "API keys"
3. Copy:
   - Publishable key (starts with `pk_test_` or `pk_live_`)
   - Secret key (starts with `sk_test_` or `sk_live_`)
4. Go to "Webhooks" → Add endpoint
5. Endpoint URL: `https://your-domain.vercel.app/api/stripe/webhook`
6. Select events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
7. Copy the webhook secret (starts with `whsec_`)

#### Sentry (Optional but Recommended)
1. Go to [sentry.io](https://sentry.io/signup/)
2. Create free account
3. Create new project → Select "Node.js"
4. Copy the DSN (looks like `https://abc123@o123.ingest.sentry.io/456`)

## Step 3: Alternative - Manual Setup

If you prefer to set up manually:

### 3a. Link to Vercel Project

```bash
vercel link
```

### 3b. Add Environment Variables

```bash
# Supabase (use existing keys for now, rotate later)
echo "https://korlxghajrdussqbxqth.supabase.co" | vercel env add SUPABASE_URL production
echo "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtvcmx4Z2hhanJkdXNzcWJ4cXRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgwNjc3ODksImV4cCI6MjA3MzY0Mzc4OX0.23QlojDnvFpkF9tM1AMo-FY8CaM7flMlg2uWrrjxYSw" | vercel env add SUPABASE_ANON_KEY production
echo "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtvcmx4Z2hhanJkdXNzcWJ4cXRoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODA2Nzc4OSwiZXhwIjoyMDczNjQzNzg5fQ.3-YXsJlIqv7uWeKOA4zNKAn7vGa3AEgOkpfJYpXCaiA" | vercel env add SUPABASE_SERVICE_ROLE_KEY production

# JWT Secret (newly generated)
echo "44e0a9ce05b718544269ba6951f819fd2117e5612470d1ac05d282bf07978d22" | vercel env add JWT_SECRET production

# Add your Google OAuth credentials
vercel env add GOOGLE_CLIENT_ID production
# Paste your Google Client ID when prompted

vercel env add GOOGLE_CLIENT_SECRET production
# Paste your Google Client Secret when prompted

# Add your Stripe credentials
vercel env add STRIPE_SECRET_KEY production
# Paste your Stripe Secret Key when prompted

vercel env add STRIPE_PUBLISHABLE_KEY production
# Paste your Stripe Publishable Key when prompted

vercel env add STRIPE_WEBHOOK_SECRET production
# Paste your Stripe Webhook Secret when prompted

# Optional: Add Sentry
vercel env add SENTRY_DSN production
# Paste your Sentry DSN when prompted

vercel env add SENTRY_ENVIRONMENT production
# Type: production
```

### 3c. Deploy

```bash
vercel --prod
```

## Step 4: Rotate Supabase Keys (CRITICAL - 3 min)

Your Supabase keys were exposed in git history. You **MUST** rotate them:

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Settings → API
4. Click "Reset database password"
5. Copy the new `anon` key
6. Generate new `service_role` key

Update Vercel:
```bash
# Remove old keys
vercel env rm SUPABASE_ANON_KEY production
vercel env rm SUPABASE_SERVICE_ROLE_KEY production

# Add new keys
vercel env add SUPABASE_ANON_KEY production
# Paste new anon key

vercel env add SUPABASE_SERVICE_ROLE_KEY production
# Paste new service role key

# Redeploy with new keys
vercel --prod
```

## Step 5: Test Deployment (5 min)

After deployment, test these critical features:

```bash
# Get your deployment URL
vercel ls
```

Visit your URL and test:
- [ ] Homepage loads
- [ ] Google Sign-In works
- [ ] Upload a PDF bank statement
- [ ] Conversion works
- [ ] Download CSV
- [ ] Check Sentry dashboard for any errors

## Troubleshooting

### "Environment validation failed"
- Check all environment variables are set in Vercel
- Run `vercel env ls` to see configured variables

### "Google OAuth not working"
- Verify GOOGLE_CLIENT_ID is set
- Check authorized redirect URIs in Google Cloud Console
- Make sure redirect URI matches your Vercel domain

### "Stripe not working"
- Verify STRIPE_SECRET_KEY starts with `sk_test_` or `sk_live_`
- Check webhook URL in Stripe Dashboard matches your deployment

### "Database connection failed"
- Verify Supabase credentials are correct
- Check Supabase project is not paused
- Ensure service role key has correct permissions

## Quick Commands Reference

```bash
# Check who you're logged in as
vercel whoami

# List all environment variables
vercel env ls

# Pull environment variables to local .env
vercel env pull

# View deployment logs
vercel logs

# List all deployments
vercel ls

# Redeploy
vercel --prod

# Open Vercel dashboard for this project
vercel inspect
```

## What's Already Done ✅

- [x] Security headers configured (helmet.js)
- [x] Rate limiting implemented
- [x] Input sanitization active
- [x] Sentry integration ready
- [x] Environment validation on startup
- [x] CORS configured
- [x] Error tracking ready
- [x] All secrets removed from code

## What You Need To Do

1. Authenticate with Vercel: `vercel login`
2. Run setup script: `./setup-production.sh` OR configure manually
3. Rotate Supabase keys
4. Test deployment
5. Monitor in Sentry dashboard

## Estimated Time

- **With automated script**: ~10 minutes
- **Manual setup**: ~15 minutes

## Support

If you get stuck:
1. Check `vercel logs` for errors
2. Review `DEPLOYMENT.md` for detailed instructions
3. Check `PRODUCTION-CHECKLIST.md` for complete checklist
4. Look at Sentry dashboard for runtime errors
