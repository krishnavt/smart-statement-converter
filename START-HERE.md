# 🚀 START HERE - Production Deployment in 3 Steps

Your app is ready to deploy! I've done all the hard work. You just need to follow these 3 simple steps:

## Prerequisites (Gather These First)

Before you start, make sure you have:

1. **Google OAuth Credentials** - [Get them here](https://console.cloud.google.com/apis/credentials)
2. **Stripe API Keys** - [Get them here](https://dashboard.stripe.com/apikeys)
3. **Vercel Account** - [Sign up here](https://vercel.com/signup) (free)

## Step 1: Authenticate with Vercel (1 minute)

Open your terminal and run:

```bash
vercel login
```

This will open your browser. Log in to Vercel and authorize the CLI.

## Step 2: Choose Your Setup Method

### Option A: Fully Automated Setup (Recommended - 5 minutes)

Run the interactive setup script:

```bash
./setup-production.sh
```

It will ask you for:
- Google OAuth Client ID & Secret
- Stripe API keys
- Sentry DSN (optional - skip by pressing Enter)

Then it will:
- ✅ Configure all environment variables in Vercel
- ✅ Create local .env file
- ✅ Deploy to production
- ✅ Give you the live URL

### Option B: Quick Deploy with Minimal Config (3 minutes)

Deploy now with basic config (you can add Google/Stripe later):

```bash
./deploy-now.sh
```

This will:
- ✅ Set up Supabase and JWT credentials
- ✅ Deploy to production
- ⚠️ Login and payments won't work until you add Google/Stripe credentials

## Step 3: Add Missing Credentials (if using Option B)

If you used Option B, add the remaining credentials:

```bash
# Google OAuth
vercel env add GOOGLE_CLIENT_ID production
# Paste your Google Client ID

vercel env add GOOGLE_CLIENT_SECRET production
# Paste your Google Client Secret

# Stripe
vercel env add STRIPE_SECRET_KEY production
# Paste your Stripe Secret Key (starts with sk_test_ or sk_live_)

vercel env add STRIPE_PUBLISHABLE_KEY production
# Paste your Stripe Publishable Key (starts with pk_test_ or pk_live_)

vercel env add STRIPE_WEBHOOK_SECRET production
# Paste your Stripe Webhook Secret (starts with whsec_)

# Optional: Sentry for error tracking
vercel env add SENTRY_DSN production
# Paste your Sentry DSN

# Redeploy with new credentials
vercel --prod
```

## 🎉 You're Done!

Your app is now live! Test it at your Vercel URL (shown after deployment).

## ⚠️ IMPORTANT: Security Follow-up

After deployment, you MUST rotate your Supabase keys (they were exposed in git):

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project → Settings → API
3. Click "Reset database password"
4. Generate new service role key
5. Update in Vercel:
   ```bash
   vercel env rm SUPABASE_ANON_KEY production
   vercel env rm SUPABASE_SERVICE_ROLE_KEY production
   vercel env add SUPABASE_ANON_KEY production  # paste new key
   vercel env add SUPABASE_SERVICE_ROLE_KEY production  # paste new key
   vercel --prod  # redeploy
   ```

## 📊 What's Been Improved

I've productionized your app with:

- ✅ **Security**: Removed all hardcoded secrets
- ✅ **Rate Limiting**: Prevents abuse (100 req/15min general, 5 req/15min auth, 50 uploads/hour)
- ✅ **Error Tracking**: Sentry integration ready
- ✅ **Security Headers**: helmet.js with CSP, HSTS, XSS protection
- ✅ **Input Sanitization**: XSS attack prevention
- ✅ **CORS Protection**: Whitelist-based origin validation
- ✅ **Environment Validation**: Fails fast if required vars missing
- ✅ **File Validation**: Size limits, type checking, suspicious filename detection

## 📝 Helpful Files

- `SETUP-GUIDE.md` - Detailed step-by-step guide
- `DEPLOYMENT.md` - Complete deployment documentation
- `PRODUCTION-CHECKLIST.md` - Full production readiness checklist
- `.env.example` - Template for environment variables

## 🆘 Troubleshooting

### "Not authenticated with Vercel"
Run: `vercel login`

### "Google OAuth not working"
- Make sure GOOGLE_CLIENT_ID is set
- Add your Vercel domain to authorized redirect URIs in Google Cloud Console

### "Stripe not working"
- Verify STRIPE_SECRET_KEY is set correctly
- Add webhook URL in Stripe Dashboard: `https://your-domain.vercel.app/api/stripe/webhook`

### "Environment validation failed"
- Check all required environment variables are set
- Run: `vercel env ls` to see what's configured

## 🎯 Quick Reference

```bash
# Check authentication
vercel whoami

# List environment variables
vercel env ls

# View logs
vercel logs

# Redeploy
vercel --prod

# Open Vercel dashboard
vercel inspect
```

## Ready? Let's Go! 🚀

Run this now:
```bash
vercel login && ./setup-production.sh
```

That's it! Your productionized app will be live in 5 minutes.
