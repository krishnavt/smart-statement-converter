#!/usr/bin/env node

/**
 * SplitWise Supabase Setup Automation Script
 * This script helps you set up Supabase for SplitWise production backend
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Colors for console output
const colors = {
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    reset: '\x1b[0m'
};

function colorLog(color, message) {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function askQuestion(question) {
    return new Promise((resolve) => {
        rl.question(question, resolve);
    });
}

async function main() {
    console.clear();
    colorLog('cyan', '🚀 SplitWise Supabase Setup Wizard');
    console.log('='.repeat(50));
    
    colorLog('yellow', '\n📋 What this script will help you do:');
    console.log('  1. Create Supabase project configuration');
    console.log('  2. Generate SQL setup commands');
    console.log('  3. Update configuration files');
    console.log('  4. Test the connection');
    
    const proceed = await askQuestion('\n🤔 Ready to proceed? (y/n): ');
    if (proceed.toLowerCase() !== 'y') {
        colorLog('red', '❌ Setup cancelled');
        rl.close();
        return;
    }

    // Step 1: Get Supabase credentials
    colorLog('\n🔧 Step 1: Supabase Configuration');
    console.log('Go to https://supabase.com and create a new project');
    console.log('Then go to Settings → API to get your credentials\n');
    
    const supabaseUrl = await askQuestion('📍 Enter your Supabase URL (e.g., https://abc123.supabase.co): ');
    const supabaseKey = await askQuestion('🔑 Enter your Supabase anon key: ');
    
    if (!supabaseUrl || !supabaseKey) {
        colorLog('red', '❌ URL and Key are required!');
        rl.close();
        return;
    }

    // Step 2: Validate inputs
    if (!supabaseUrl.includes('supabase.co')) {
        colorLog('yellow', '⚠️  Warning: URL doesn\'t look like a Supabase URL');
    }

    // Step 3: Update configuration file
    colorLog('\n📝 Step 2: Updating Configuration');
    
    try {
        const configPath = path.join(__dirname, 'supabase-config.js');
        let configContent = fs.readFileSync(configPath, 'utf8');
        
        // Replace placeholder values
        configContent = configContent.replace(
            'url: \'https://your-project-ref.supabase.co\'',
            `url: '${supabaseUrl}'`
        );
        configContent = configContent.replace(
            'anonKey: \'your-anon-key-here\'',
            `anonKey: '${supabaseKey}'`
        );
        
        fs.writeFileSync(configPath, configContent);
        colorLog('green', '✅ Configuration file updated!');
        
    } catch (error) {
        colorLog('red', '❌ Error updating config file: ' + error.message);
        rl.close();
        return;
    }

    // Step 4: Generate SQL setup
    colorLog('\n🗃️ Step 3: Database Setup');
    console.log('Copy and run these SQL commands in your Supabase SQL Editor:');
    console.log('Go to https://supabase.com/dashboard → SQL Editor → New Query\n');
    
    const sqlSetup = generateSQLSetup();
    
    // Save SQL to file
    const sqlPath = path.join(__dirname, 'supabase-setup.sql');
    fs.writeFileSync(sqlPath, sqlSetup);
    
    colorLog('cyan', '📁 SQL setup saved to: supabase-setup.sql');
    console.log('\n' + '='.repeat(70));
    colorLog('yellow', 'SQL COMMANDS TO RUN IN SUPABASE:');
    console.log('='.repeat(70));
    console.log(sqlSetup);
    console.log('='.repeat(70));

    // Step 5: Environment setup
    colorLog('\n🌍 Step 4: Environment Configuration');
    const envContent = generateEnvFile(supabaseUrl, supabaseKey);
    const envPath = path.join(__dirname, '.env');
    fs.writeFileSync(envPath, envContent);
    colorLog('green', '✅ .env file created');

    // Step 6: Authentication setup
    colorLog('\n🔐 Step 5: Authentication Settings');
    console.log('In your Supabase dashboard, go to Authentication → Settings:');
    console.log(`  • Site URL: http://localhost:8000`);
    console.log(`  • Redirect URLs: http://localhost:8000/production-app.html`);
    console.log('  • Enable email confirmations if desired');

    // Step 7: Test connection
    colorLog('\n🧪 Step 6: Testing Connection');
    const testScript = generateTestScript(supabaseUrl, supabaseKey);
    const testPath = path.join(__dirname, 'test-supabase.html');
    fs.writeFileSync(testPath, testScript);
    colorLog('green', '✅ Test file created: test-supabase.html');

    // Final instructions
    colorLog('\n🎉 Setup Complete!');
    console.log('\n📋 Next Steps:');
    console.log('  1. ✅ Configuration updated');
    console.log('  2. 🗃️  Run the SQL commands in Supabase SQL Editor');
    console.log('  3. 🔐 Configure authentication settings in Supabase dashboard');
    console.log('  4. 🧪 Open test-supabase.html to test the connection');
    console.log('  5. 🚀 Start your app with: python3 -m http.server 8000');
    
    colorLog('\n💡 Tips:');
    console.log('  • Visit http://localhost:8000/test-supabase.html to test');
    console.log('  • Check browser console for connection status');
    console.log('  • App will show "✅ Production mode" when working');
    
    const openTest = await askQuestion('\n🔍 Open test file now? (y/n): ');
    if (openTest.toLowerCase() === 'y') {
        const { exec } = require('child_process');
        exec(`open ${testPath}`, (err) => {
            if (err) {
                console.log(`📁 Manually open: ${testPath}`);
            }
        });
    }

    rl.close();
}

function generateSQLSetup() {
    return `-- SplitWise Database Setup for Supabase
-- Run these commands in your Supabase SQL Editor

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create user profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
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

-- Create policies for user_profiles
CREATE POLICY "Users can view own profile" ON user_profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON user_profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON user_profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Create groups table
CREATE TABLE IF NOT EXISTS groups (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    created_by UUID REFERENCES auth.users(id) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for groups
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;

-- Create policies for groups
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

-- Create group members table
CREATE TABLE IF NOT EXISTS group_members (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(group_id, user_id)
);

-- Enable RLS for group_members
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;

-- Create policies for group_members
CREATE POLICY "Users can view group memberships" ON group_members
    FOR SELECT USING (
        user_id = auth.uid() OR 
        group_id IN (
            SELECT group_id FROM group_members 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can join groups" ON group_members
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- Create expenses table
CREATE TABLE IF NOT EXISTS expenses (
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

-- Enable RLS for expenses
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- Create policies for expenses
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

-- Create expense splits table
CREATE TABLE IF NOT EXISTS expense_splits (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    expense_id UUID REFERENCES expenses(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    settled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for expense_splits
ALTER TABLE expense_splits ENABLE ROW LEVEL SECURITY;

-- Create policies for expense_splits
CREATE POLICY "Users can view their expense splits" ON expense_splits
    FOR SELECT USING (
        user_id = auth.uid() OR
        expense_id IN (
            SELECT id FROM expenses WHERE paid_by = auth.uid()
        )
    );

-- Create function to update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER update_user_profiles_updated_at 
    BEFORE UPDATE ON user_profiles 
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_groups_updated_at ON groups;
CREATE TRIGGER update_groups_updated_at 
    BEFORE UPDATE ON groups 
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_expenses_updated_at ON expenses;
CREATE TRIGGER update_expenses_updated_at 
    BEFORE UPDATE ON expenses 
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Insert some sample data (optional)
-- This will be created when users sign up, but useful for testing
INSERT INTO user_profiles (id, full_name, email, avatar_url) 
SELECT 
    auth.uid(),
    'Demo User',
    'demo@splitwise.com',
    'https://ui-avatars.com/api/?name=Demo%20User&background=6200EE&color=fff'
WHERE NOT EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid());

-- Success message
SELECT 'SplitWise database setup completed successfully! 🎉' as status;`;
}

function generateEnvFile(url, key) {
    return `# SplitWise Production Environment Configuration
# Generated by setup script

# Supabase Configuration
SUPABASE_URL=${url}
SUPABASE_ANON_KEY=${key}

# Site Configuration
SITE_URL=http://localhost:8000
REDIRECT_URL=http://localhost:8000/production-app.html

# Feature Flags
ENABLE_EMAIL_CONFIRMATION=false
ENABLE_SOCIAL_LOGIN=true
DEBUG_MODE=true

# Generated on: ${new Date().toISOString()}`;
}

function generateTestScript(url, key) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SplitWise Supabase Connection Test</title>
    <script src="https://unpkg.com/@supabase/supabase-js@2"></script>
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, sans-serif; 
            max-width: 800px; 
            margin: 50px auto; 
            padding: 20px;
            background: #f5f5f5;
        }
        .card { 
            background: white; 
            padding: 30px; 
            border-radius: 12px; 
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            margin-bottom: 20px;
        }
        .success { color: #4CAF50; }
        .error { color: #f44336; }
        .warning { color: #ff9800; }
        .info { color: #2196F3; }
        button { 
            background: #6200EE; 
            color: white; 
            border: none; 
            padding: 12px 24px; 
            border-radius: 8px; 
            cursor: pointer; 
            margin: 5px;
        }
        button:hover { background: #3700B3; }
        pre { 
            background: #f0f0f0; 
            padding: 15px; 
            border-radius: 8px; 
            overflow-x: auto;
        }
        .status { 
            padding: 10px; 
            border-radius: 8px; 
            margin: 10px 0;
        }
        .status.success { background: #e8f5e8; }
        .status.error { background: #ffeaea; }
        .status.info { background: #e3f2fd; }
    </style>
</head>
<body>
    <div class="card">
        <h1>🧪 SplitWise Supabase Connection Test</h1>
        <p>This page tests your Supabase configuration for SplitWise.</p>
        
        <div id="results"></div>
        
        <h3>Test Actions:</h3>
        <button onclick="testConnection()">🔗 Test Connection</button>
        <button onclick="testAuth()">🔐 Test Authentication</button>
        <button onclick="testDatabase()">🗃️ Test Database</button>
        <button onclick="clearResults()">🧹 Clear Results</button>
        
        <h3>Configuration:</h3>
        <pre id="config"></pre>
    </div>

    <script>
        const supabaseUrl = '${url}';
        const supabaseKey = '${key}';
        
        // Initialize Supabase
        const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);
        
        function addResult(message, type = 'info') {
            const results = document.getElementById('results');
            const div = document.createElement('div');
            div.className = \`status \${type}\`;
            div.innerHTML = \`<strong>\${new Date().toLocaleTimeString()}</strong>: \${message}\`;
            results.appendChild(div);
            results.scrollTop = results.scrollHeight;
        }
        
        async function testConnection() {
            addResult('🔗 Testing Supabase connection...', 'info');
            
            try {
                const { data, error } = await supabase
                    .from('user_profiles')
                    .select('count')
                    .limit(1);
                
                if (error) {
                    if (error.message.includes('relation "user_profiles" does not exist')) {
                        addResult('⚠️ Database tables not created yet. Run the SQL setup!', 'warning');
                    } else {
                        addResult(\`❌ Connection error: \${error.message}\`, 'error');
                    }
                } else {
                    addResult('✅ Connection successful!', 'success');
                }
            } catch (err) {
                addResult(\`❌ Connection failed: \${err.message}\`, 'error');
            }
        }
        
        async function testAuth() {
            addResult('🔐 Testing authentication...', 'info');
            
            try {
                const { data: { session }, error } = await supabase.auth.getSession();
                
                if (error) {
                    addResult(\`❌ Auth error: \${error.message}\`, 'error');
                } else if (session) {
                    addResult(\`✅ User logged in: \${session.user.email}\`, 'success');
                } else {
                    addResult('ℹ️ No user logged in (normal for test)', 'info');
                }
            } catch (err) {
                addResult(\`❌ Auth test failed: \${err.message}\`, 'error');
            }
        }
        
        async function testDatabase() {
            addResult('🗃️ Testing database tables...', 'info');
            
            const tables = ['user_profiles', 'groups', 'group_members', 'expenses', 'expense_splits'];
            
            for (const table of tables) {
                try {
                    const { error } = await supabase
                        .from(table)
                        .select('count')
                        .limit(1);
                    
                    if (error) {
                        addResult(\`❌ Table '\${table}' error: \${error.message}\`, 'error');
                    } else {
                        addResult(\`✅ Table '\${table}' exists\`, 'success');
                    }
                } catch (err) {
                    addResult(\`❌ Table '\${table}' test failed: \${err.message}\`, 'error');
                }
            }
        }
        
        function clearResults() {
            document.getElementById('results').innerHTML = '';
        }
        
        // Show configuration
        document.getElementById('config').textContent = \`URL: \${supabaseUrl}
Key: \${supabaseKey.substring(0, 20)}...
\`;
        
        // Auto-test on load
        setTimeout(() => {
            addResult('🚀 SplitWise Supabase Test initialized', 'info');
            testConnection();
        }, 500);
    </script>
</body>
</html>`;
}

// Handle errors
process.on('uncaughtException', (err) => {
    colorLog('red', '❌ Error: ' + err.message);
    rl.close();
});

// Run the setup
main().catch((err) => {
    colorLog('red', '❌ Setup failed: ' + err.message);
    rl.close();
});