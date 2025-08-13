# 🚀 Supabase Backend Setup Guide for SplitWise

This guide will help you set up Supabase as the production backend for SplitWise authentication and data storage.

## 📋 Prerequisites

- A GitHub account (for Supabase signup)
- Basic understanding of SQL (for database setup)

## 🔧 Step 1: Create Supabase Project

1. **Go to** [supabase.com](https://supabase.com)
2. **Click** "Start your project"
3. **Sign in** with GitHub
4. **Click** "New Project"
5. **Fill out:**
   - Organization: Create new or select existing
   - Project name: `splitwise-clone`
   - Database password: Generate a strong password
   - Region: Choose closest to your users
6. **Click** "Create new project"
7. **Wait** for setup to complete (~2 minutes)

## 🔑 Step 2: Get Your Credentials

1. **Go to** Settings → API
2. **Copy** these values:
   - **Project URL**: `https://your-project-ref.supabase.co`
   - **anon/public key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

## 📁 Step 3: Update Configuration

1. **Open** `supabase-config.js`
2. **Replace** the placeholder values:

```javascript
const SUPABASE_CONFIG = {
    url: 'https://your-actual-project-ref.supabase.co',
    anonKey: 'your-actual-anon-key-here',
    // ... rest stays the same
};
```

## 🗃️ Step 4: Create Database Tables

**Go to** SQL Editor in Supabase and run these commands:

### User Profiles Table
```sql
-- Create user profiles table
CREATE TABLE user_profiles (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    full_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS (Row Level Security)
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view own profile" ON user_profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON user_profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON user_profiles
    FOR INSERT WITH CHECK (auth.uid() = id);
```

### Groups Table
```sql
-- Create groups table
CREATE TABLE groups (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    created_by UUID REFERENCES auth.users(id) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view groups they belong to" ON groups
    FOR SELECT USING (
        created_by = auth.uid() OR 
        id IN (
            SELECT group_id FROM group_members 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create groups" ON groups
    FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY "Group creators can update groups" ON groups
    FOR UPDATE USING (created_by = auth.uid());
```

### Group Members Table
```sql
-- Create group members table
CREATE TABLE group_members (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(group_id, user_id)
);

-- Enable RLS
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view group memberships" ON group_members
    FOR SELECT USING (
        user_id = auth.uid() OR 
        group_id IN (
            SELECT group_id FROM group_members 
            WHERE user_id = auth.uid()
        )
    );
```

### Expenses Table
```sql
-- Create expenses table
CREATE TABLE expenses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    description TEXT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    paid_by UUID REFERENCES auth.users(id) NOT NULL,
    group_id UUID REFERENCES groups(id),
    category TEXT,
    date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view expenses in their groups" ON expenses
    FOR SELECT USING (
        paid_by = auth.uid() OR
        group_id IN (
            SELECT group_id FROM group_members 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create expenses" ON expenses
    FOR INSERT WITH CHECK (paid_by = auth.uid());
```

### Expense Splits Table
```sql
-- Create expense splits table
CREATE TABLE expense_splits (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    expense_id UUID REFERENCES expenses(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    settled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE expense_splits ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their expense splits" ON expense_splits
    FOR SELECT USING (
        user_id = auth.uid() OR
        expense_id IN (
            SELECT id FROM expenses WHERE paid_by = auth.uid()
        )
    );
```

### Triggers for Updated At
```sql
-- Create function to update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers
CREATE TRIGGER update_user_profiles_updated_at 
    BEFORE UPDATE ON user_profiles 
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_groups_updated_at 
    BEFORE UPDATE ON groups 
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_expenses_updated_at 
    BEFORE UPDATE ON expenses 
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
```

## 🔐 Step 5: Configure Authentication

1. **Go to** Authentication → Settings
2. **Enable** these providers:
   - Email (already enabled)
   - Google (optional)
   - Apple (optional)

3. **Site URL:** Set to your domain (e.g., `http://localhost:8000` for development)
4. **Redirect URLs:** Add your app URLs

## 🔗 Step 6: Add Supabase SDK

Add this to the `<head>` section of your HTML files:

```html
<!-- Supabase JavaScript SDK -->
<script src="https://unpkg.com/@supabase/supabase-js@2"></script>
<!-- Your config file -->
<script src="supabase-config.js"></script>
```

## ✅ Step 7: Test the Setup

1. **Open** your app in the browser
2. **Check** the browser console for:
   ```
   ✅ Supabase initialized successfully
   ```
3. **Try** registering a new user
4. **Check** the Authentication tab in Supabase dashboard

## 🚨 Common Issues

### "Invalid API key"
- Double-check your `anon` key in `supabase-config.js`
- Make sure there are no extra spaces or quotes

### "Failed to fetch"
- Check your project URL is correct
- Verify your internet connection
- Check browser console for CORS errors

### RLS Blocking Queries
- Make sure you're authenticated
- Check your RLS policies are correct
- Test with RLS disabled temporarily (for debugging only)

## 📱 Development vs Production

### Development
- Use `http://localhost:8000` as Site URL
- Enable all authentication methods for testing

### Production
- Use your actual domain as Site URL
- Configure proper redirect URLs
- Enable only needed authentication methods
- Consider enabling email confirmation

## 🔒 Security Best Practices

1. **Never** commit your Supabase keys to public repositories
2. **Use** environment variables in production
3. **Enable** Row Level Security (RLS) on all tables
4. **Test** your RLS policies thoroughly
5. **Use** HTTPS in production
6. **Enable** email confirmation for production

## 🆘 Need Help?

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase Discord](https://discord.supabase.com)
- [GitHub Issues](https://github.com/krishnavt/split/issues)

---

**Next:** Once Supabase is set up, the app will automatically use real authentication instead of demo mode! 🎉