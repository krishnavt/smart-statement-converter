#!/bin/bash

# Production Setup Script
# This script configures environment variables in Vercel and deploys the app

set -e  # Exit on error

echo "🚀 Smart Statement Converter - Production Setup"
echo "================================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Generated JWT Secret
JWT_SECRET="44e0a9ce05b718544269ba6951f819fd2117e5612470d1ac05d282bf07978d22"

# Existing Supabase credentials (NEED TO BE ROTATED!)
SUPABASE_URL="https://korlxghajrdussqbxqth.supabase.co"
SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtvcmx4Z2hhanJkdXNzcWJ4cXRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgwNjc3ODksImV4cCI6MjA3MzY0Mzc4OX0.23QlojDnvFpkF9tM1AMo-FY8CaM7flMlg2uWrrjxYSw"
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtvcmx4Z2hhanJkdXNzcWJ4cXRoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODA2Nzc4OSwiZXhwIjoyMDczNjQzNzg5fQ.3-YXsJlIqv7uWeKOA4zNKAn7vGa3AEgOkpfJYpXCaiA"

echo -e "${YELLOW}⚠️  WARNING: These Supabase keys were exposed in git history${NC}"
echo -e "${YELLOW}   You should rotate them after this setup${NC}"
echo ""

# Check if vercel CLI is authenticated
echo "Checking Vercel CLI authentication..."
if ! vercel whoami &> /dev/null; then
    echo -e "${RED}❌ Not logged in to Vercel${NC}"
    echo "Please run: vercel login"
    echo "Then run this script again."
    exit 1
fi

echo -e "${GREEN}✅ Logged in to Vercel as: $(vercel whoami)${NC}"
echo ""

# Prompt for missing credentials
echo "Please provide the following credentials:"
echo ""

read -p "Google OAuth Client ID: " GOOGLE_CLIENT_ID
read -p "Google OAuth Client Secret: " GOOGLE_CLIENT_SECRET
echo ""

read -p "Stripe Secret Key (sk_test_... or sk_live_...): " STRIPE_SECRET_KEY
read -p "Stripe Publishable Key (pk_test_... or pk_live_...): " STRIPE_PUBLISHABLE_KEY
read -p "Stripe Webhook Secret (whsec_...): " STRIPE_WEBHOOK_SECRET
echo ""

read -p "Sentry DSN (optional, press Enter to skip): " SENTRY_DSN
echo ""

# Confirm before proceeding
echo "Ready to configure Vercel with the following:"
echo "  - Supabase credentials (from old config - ROTATE THESE!)"
echo "  - JWT Secret (newly generated)"
echo "  - Google OAuth credentials"
echo "  - Stripe credentials"
if [ ! -z "$SENTRY_DSN" ]; then
    echo "  - Sentry DSN"
fi
echo ""

read -p "Continue? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 1
fi

echo ""
echo "Adding environment variables to Vercel..."

# Add environment variables to Vercel
# The syntax is: vercel env add <name> production

add_env() {
    local name=$1
    local value=$2
    local environment=${3:-production}

    echo "Adding $name..."
    echo "$value" | vercel env add "$name" "$environment" --force || {
        echo -e "${YELLOW}⚠️  Failed to add $name (it may already exist)${NC}"
    }
}

# Supabase
add_env "SUPABASE_URL" "$SUPABASE_URL" "production"
add_env "SUPABASE_ANON_KEY" "$SUPABASE_ANON_KEY" "production"
add_env "SUPABASE_SERVICE_ROLE_KEY" "$SUPABASE_SERVICE_ROLE_KEY" "production"

# JWT
add_env "JWT_SECRET" "$JWT_SECRET" "production"

# Google OAuth
add_env "GOOGLE_CLIENT_ID" "$GOOGLE_CLIENT_ID" "production"
add_env "GOOGLE_CLIENT_SECRET" "$GOOGLE_CLIENT_SECRET" "production"

# Stripe
add_env "STRIPE_SECRET_KEY" "$STRIPE_SECRET_KEY" "production"
add_env "STRIPE_PUBLISHABLE_KEY" "$STRIPE_PUBLISHABLE_KEY" "production"
add_env "STRIPE_WEBHOOK_SECRET" "$STRIPE_WEBHOOK_SECRET" "production"

# Sentry (optional)
if [ ! -z "$SENTRY_DSN" ]; then
    add_env "SENTRY_DSN" "$SENTRY_DSN" "production"
    add_env "SENTRY_ENVIRONMENT" "production" "production"
fi

echo ""
echo -e "${GREEN}✅ Environment variables configured!${NC}"
echo ""

# Create local .env file for development
echo "Creating local .env file..."
cat > .env << EOF
# Local Development Environment Variables
NODE_ENV=development
PORT=3000

# Supabase Configuration
SUPABASE_URL=$SUPABASE_URL
SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY

# JWT Authentication
JWT_SECRET=$JWT_SECRET

# Google OAuth
GOOGLE_CLIENT_ID=$GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET=$GOOGLE_CLIENT_SECRET

# Stripe Payment Processing
STRIPE_SECRET_KEY=$STRIPE_SECRET_KEY
STRIPE_PUBLISHABLE_KEY=$STRIPE_PUBLISHABLE_KEY
STRIPE_WEBHOOK_SECRET=$STRIPE_WEBHOOK_SECRET

# Sentry Error Tracking
SENTRY_DSN=$SENTRY_DSN
SENTRY_ENVIRONMENT=development
EOF

echo -e "${GREEN}✅ Created .env file for local development${NC}"
echo ""

# Deploy to production
echo "Ready to deploy to production..."
read -p "Deploy now? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "🚀 Deploying to production..."
    vercel --prod

    echo ""
    echo -e "${GREEN}✅ Deployment complete!${NC}"
else
    echo "Skipping deployment. You can deploy later with: vercel --prod"
fi

echo ""
echo "================================================"
echo -e "${GREEN}Setup Complete!${NC}"
echo ""
echo -e "${RED}⚠️  CRITICAL: Rotate your Supabase keys!${NC}"
echo "1. Go to https://app.supabase.com"
echo "2. Select your project"
echo "3. Settings > API"
echo "4. Click 'Reset database password'"
echo "5. Generate new service role key"
echo "6. Update Vercel env vars with new keys:"
echo "   vercel env rm SUPABASE_ANON_KEY production"
echo "   vercel env add SUPABASE_ANON_KEY production"
echo "   vercel env rm SUPABASE_SERVICE_ROLE_KEY production"
echo "   vercel env add SUPABASE_SERVICE_ROLE_KEY production"
echo ""
echo "Next steps:"
echo "  - Test your deployment"
echo "  - Set up monitoring in Sentry dashboard"
echo "  - Review PRODUCTION-CHECKLIST.md"
echo ""
