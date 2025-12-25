#!/bin/bash

# Quick Deployment Script - Non-Interactive Version
# Run this after you've authenticated with: vercel login

set -e

echo "🚀 Quick Production Deployment"
echo "==============================="
echo ""

# Check authentication
if ! vercel whoami &> /dev/null; then
    echo "❌ Not authenticated with Vercel"
    echo ""
    echo "Please run first:"
    echo "  vercel login"
    echo ""
    echo "Then run this script again."
    exit 1
fi

echo "✅ Authenticated as: $(vercel whoami)"
echo ""

# Link project or use existing
echo "Linking to Vercel project..."
vercel link --yes || true
echo ""

# Set environment variables using a file
echo "Creating environment variables file..."
cat > /tmp/vercel-env-setup.sh << 'ENVEOF'
#!/bin/bash

# Supabase
echo "https://korlxghajrdussqbxqth.supabase.co" | vercel env add SUPABASE_URL production --force 2>/dev/null || true
echo "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtvcmx4Z2hhanJkdXNzcWJ4cXRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgwNjc3ODksImV4cCI6MjA3MzY0Mzc4OX0.23QlojDnvFpkF9tM1AMo-FY8CaM7flMlg2uWrrjxYSw" | vercel env add SUPABASE_ANON_KEY production --force 2>/dev/null || true
echo "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtvcmx4Z2hhanJkdXNzcWJ4cXRoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODA2Nzc4OSwiZXhwIjoyMDczNjQzNzg5fQ.3-YXsJlIqv7uWeKOA4zNKAn7vGa3AEgOkpfJYpXCaiA" | vercel env add SUPABASE_SERVICE_ROLE_KEY production --force 2>/dev/null || true

# JWT
echo "44e0a9ce05b718544269ba6951f819fd2117e5612470d1ac05d282bf07978d22" | vercel env add JWT_SECRET production --force 2>/dev/null || true

echo "✅ Basic environment variables configured"
echo ""
echo "⚠️  You still need to add:"
echo "  - GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET"
echo "  - STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY, STRIPE_WEBHOOK_SECRET"
echo "  - SENTRY_DSN (optional)"
echo ""
echo "Add them with:"
echo "  vercel env add GOOGLE_CLIENT_ID production"
echo "  vercel env add GOOGLE_CLIENT_SECRET production"
echo "  vercel env add STRIPE_SECRET_KEY production"
echo "  vercel env add STRIPE_PUBLISHABLE_KEY production"
echo "  vercel env add STRIPE_WEBHOOK_SECRET production"
echo "  vercel env add SENTRY_DSN production"
echo ""
ENVEOF

chmod +x /tmp/vercel-env-setup.sh
/tmp/vercel-env-setup.sh

# Create local .env
echo "Creating local .env file..."
cat > .env << 'EOF'
NODE_ENV=development
PORT=3000

# Supabase
SUPABASE_URL=https://korlxghajrdussqbxqth.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtvcmx4Z2hhanJkdXNzcWJ4cXRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgwNjc3ODksImV4cCI6MjA3MzY0Mzc4OX0.23QlojDnvFpkF9tM1AMo-FY8CaM7flMlg2uWrrjxYSw
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtvcmx4Z2hhanJkdXNzcWJ4cXRoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODA2Nzc4OSwiZXhwIjoyMDczNjQzNzg5fQ.3-YXsJlIqv7uWeKOA4zNKAn7vGa3AEgOkpfJYpXCaiA

# JWT
JWT_SECRET=44e0a9ce05b718544269ba6951f819fd2117e5612470d1ac05d282bf07978d22

# Add your credentials below:
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

STRIPE_SECRET_KEY=
STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=

SENTRY_DSN=
SENTRY_ENVIRONMENT=development
EOF

echo "✅ Created .env file (fill in your Google/Stripe/Sentry credentials)"
echo ""

# Deploy
echo "🚀 Deploying to production..."
echo "⚠️  Note: App will work but login/payments won't until you add Google/Stripe credentials"
echo ""

vercel --prod

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📋 Next steps:"
echo "1. Add missing environment variables (Google OAuth, Stripe)"
echo "2. Rotate your Supabase keys (they were exposed in git)"
echo "3. Test your deployment"
echo ""
echo "See SETUP-GUIDE.md for detailed instructions"
