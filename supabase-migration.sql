-- Smart Statement Converter Database Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  google_id TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  picture_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Subscriptions table
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  plan_type TEXT NOT NULL DEFAULT 'free', -- 'free', 'pro', 'enterprise'
  billing_cycle TEXT NOT NULL DEFAULT 'monthly', -- 'monthly', 'annual'
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'canceled', 'past_due', 'trialing'
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Usage tracking table
CREATE TABLE usage_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL, -- 'pdf_conversion', 'csv_download'
  file_size_mb DECIMAL,
  pages_processed INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Plan limits table
CREATE TABLE plan_limits (
  plan_type TEXT PRIMARY KEY,
  max_conversions_per_day INTEGER NOT NULL,
  max_file_size_mb INTEGER NOT NULL,
  features JSONB DEFAULT '{}'::jsonb
);

-- Insert default plan limits
INSERT INTO plan_limits (plan_type, max_conversions_per_day, max_file_size_mb, features) VALUES
('free', 5, 10, '{"priority_support": false, "bulk_processing": false}'),
('pro', 100, 50, '{"priority_support": true, "bulk_processing": true, "api_access": false}'),
('enterprise', -1, 100, '{"priority_support": true, "bulk_processing": true, "api_access": true, "custom_branding": true}');

-- Create indexes for performance
CREATE INDEX idx_users_google_id ON users(google_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_stripe_customer_id ON subscriptions(stripe_customer_id);
CREATE INDEX idx_subscriptions_stripe_subscription_id ON subscriptions(stripe_subscription_id);
CREATE INDEX idx_usage_logs_user_id ON usage_logs(user_id);
CREATE INDEX idx_usage_logs_created_at ON usage_logs(created_at);

-- Row Level Security (RLS) policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;

-- Users can only see their own data
CREATE POLICY "Users can view own profile" ON users FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (true);

-- Subscriptions policies
CREATE POLICY "Users can view own subscriptions" ON subscriptions FOR SELECT USING (true);

-- Usage logs policies  
CREATE POLICY "Users can view own usage" ON usage_logs FOR SELECT USING (true);
CREATE POLICY "System can insert usage logs" ON usage_logs FOR INSERT WITH CHECK (true);

-- Plan limits are public read-only
ALTER TABLE plan_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Plan limits are public" ON plan_limits FOR SELECT USING (true);

-- Functions for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();