# Production Deployment Guide

## CRITICAL: Environment Variables Setup

Your secrets have been removed from `vercel.json` for security. You MUST configure them in Vercel's dashboard.

### Step 1: Add Environment Variables to Vercel

1. Go to your Vercel project dashboard
2. Navigate to **Settings** > **Environment Variables**
3. Add the following variables:

#### Required Variables:

```
SUPABASE_URL=https://korlxghajrdussqbxqth.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtvcmx4Z2hhanJkdXNzcWJ4cXRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgwNjc3ODksImV4cCI6MjA3MzY0Mzc4OX0.23QlojDnvFpkF9tM1AMo-FY8CaM7flMlg2uWrrjxYSw
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtvcmx4Z2hhanJkdXNzcWJ4cXRoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODA2Nzc4OSwiZXhwIjoyMDczNjQzNzg5fQ.3-YXsJlIqv7uWeKOA4zNKAn7vGa3AEgOkpfJYpXCaiA
```

#### Recommended: Rotate Your Supabase Keys

Since your keys were exposed in git history, you should:
1. Go to Supabase Dashboard > Settings > API
2. Click "Reset database password" and "Generate new keys"
3. Update the environment variables above with the new keys

#### Additional Required Variables:

```
JWT_SECRET=<generate-a-secure-random-string-min-32-chars>
GOOGLE_CLIENT_ID=<your-google-oauth-client-id>
GOOGLE_CLIENT_SECRET=<your-google-oauth-secret>
STRIPE_SECRET_KEY=<your-stripe-secret-key>
STRIPE_PUBLISHABLE_KEY=<your-stripe-publishable-key>
STRIPE_WEBHOOK_SECRET=<your-stripe-webhook-secret>
```

#### Optional (Error Tracking):

```
SENTRY_DSN=<your-sentry-dsn>
SENTRY_ENVIRONMENT=production
```

### Step 2: Set Environment Scope

For each variable, select the appropriate environments:
- Production ✓
- Preview ✓ (recommended)
- Development ✓ (recommended)

### Step 3: Redeploy

After adding all environment variables:
```bash
vercel --prod
```

Or trigger a redeploy from the Vercel dashboard.

## Security Recommendations

### Immediate Actions:
1. ✅ Secrets removed from vercel.json
2. ⚠️ **Rotate your Supabase keys** (they were in git history)
3. ⚠️ Consider making your repository private if it's currently public
4. ⚠️ If repository is public, consider changing the git history to remove exposed secrets

### To Remove Secrets from Git History:

**WARNING:** This rewrites git history. Coordinate with your team first.

```bash
# Install BFG Repo-Cleaner
brew install bfg  # or download from https://rtyley.github.io/bfg-repo-cleaner/

# Backup your repo first
cp -r . ../smart-statement-converter-backup

# Remove the secrets file from history
bfg --delete-files vercel.json

# Clean up
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# Force push (WARNING: affects all collaborators)
git push --force --all
```

## Local Development Setup

1. Copy the example environment file:
```bash
cp .env.example .env
```

2. Fill in your local development credentials in `.env`

3. Run locally:
```bash
npm run dev
```

## Monitoring & Alerts

After deployment, set up monitoring:

1. **Vercel Analytics**: Already enabled
2. **Sentry**: Configure in dashboard after setting SENTRY_DSN
3. **Uptime Monitoring**: Consider services like:
   - Better Uptime
   - UptimeRobot
   - Pingdom

## Deployment Checklist

- [ ] All environment variables added to Vercel
- [ ] Supabase keys rotated (if exposed)
- [ ] JWT_SECRET is strong (32+ characters)
- [ ] Sentry DSN configured
- [ ] Stripe keys are production keys
- [ ] Google OAuth configured for production domain
- [ ] Redeployed to production
- [ ] Tested authentication flow
- [ ] Tested payment flow
- [ ] Tested PDF conversion
- [ ] Verified error tracking is working

## Troubleshooting

### "Database connection failed"
- Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set correctly
- Verify Supabase project is not paused

### "Google OAuth not working"
- Ensure GOOGLE_CLIENT_ID is set
- Add production domain to Google OAuth allowed origins

### "Stripe payments failing"
- Verify STRIPE_SECRET_KEY is the production key (starts with `sk_live_`)
- Check webhook secret matches Stripe dashboard

### "Application not starting"
- Check Vercel deployment logs
- Ensure all required environment variables are set
- Look for startup validation errors
