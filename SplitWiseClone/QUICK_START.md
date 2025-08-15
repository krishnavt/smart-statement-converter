# 🚀 SplitWise Quick Start Guide

**Get SplitWise running with production Supabase backend in 5 minutes!**

## 🎯 Two Options: Demo vs Production

### Option 1: Demo Mode (0 minutes) ✨
```bash
# Just run the app - works immediately!
python3 -m http.server 8000
# Open http://localhost:8000
# Login with: demo@splitwise.com / demo123
```

### Option 2: Production Mode (5 minutes) 🚀
Follow steps below for real authentication and database storage.

---

## 🛠️ Production Setup (5 Minutes)

### Step 1: Create Supabase Account (2 minutes)
1. Go to [supabase.com](https://supabase.com)
2. Click "Start your project" → Sign in with GitHub
3. Create new project:
   - Name: `splitwise-production`
   - Password: Generate strong password
   - Region: Choose closest to you
4. Wait ~2 minutes for setup

### Step 2: Get Your Credentials (1 minute)
1. In Supabase dashboard → Settings → API
2. Copy these values:
   - **Project URL**: `https://abc123.supabase.co`
   - **anon public key**: `eyJhbGciOiJIUzI1NiIs...`

### Step 3: Run Setup Script (1 minute)
```bash
# Navigate to your SplitWise directory
cd SplitWiseClone

# Run the automated setup
node setup-supabase.js
```

The script will:
- ✅ Update configuration files
- ✅ Generate SQL setup commands  
- ✅ Create test files
- ✅ Show you exactly what to do next

### Step 4: Database Setup (1 minute)
1. Copy the SQL commands the script shows you
2. Go to Supabase dashboard → SQL Editor → New Query
3. Paste and run the SQL commands
4. You'll see "Setup completed successfully! 🎉"

### Step 5: Test & Launch (30 seconds)
```bash
# Start the app
python3 -m http.server 8000

# Test connection
open http://localhost:8000/test-supabase.html

# Use the app
open http://localhost:8000
```

---

## 🎉 You're Done!

**Demo Mode Signs:**
- ⚠️ "Demo mode" notifications
- Local storage authentication
- Demo accounts work

**Production Mode Signs:**
- ✅ "Production mode" notifications  
- Real email registration
- Supabase authentication
- Database storage

---

## 🆘 Troubleshooting

### "Connection failed"
- Double-check your Supabase URL and key
- Make sure you're using the **anon** key, not the secret key

### "Table does not exist"
- Run the SQL commands in Supabase SQL Editor
- Make sure all commands executed successfully

### "Invalid API key"
- Check for extra spaces in your key
- Copy the key again from Supabase dashboard

### Still not working?
1. Check browser console (F12) for errors
2. Visit `http://localhost:8000/test-supabase.html`
3. The app works in demo mode regardless!

---

## 📱 Features You Get

### Demo Mode:
- ✅ Full UI and functionality
- ✅ Local data storage
- ✅ Demo user accounts
- ✅ All expense splitting features

### Production Mode (All above plus):
- ✅ Real user registration
- ✅ Email verification
- ✅ Password reset
- ✅ Secure authentication
- ✅ Database persistence
- ✅ Social login ready
- ✅ Multi-user support

---

## 🔧 Configuration Files

After setup, you'll have:
- `supabase-config.js` - Main configuration
- `.env` - Environment variables
- `supabase-setup.sql` - Database schema
- `test-supabase.html` - Connection tester

---

## 💡 Pro Tips

1. **Start with Demo** - See all features working first
2. **Test Connection** - Use the test page to verify setup
3. **Check Console** - Browser F12 shows connection status
4. **Free Tier** - Supabase free tier is generous for development
5. **Fallback** - App automatically falls back to demo if Supabase unavailable

---

## 🎯 What's Next?

- **Customize** - Update colors, add features
- **Deploy** - Host on Vercel, Netlify, or GitHub Pages
- **Scale** - Supabase handles production traffic
- **Monetize** - Add premium features with Supabase billing

**Happy expense splitting! 💰**