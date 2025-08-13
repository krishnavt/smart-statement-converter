#!/bin/bash

echo "🚀 Setting up SplitWise Clone for iOS..."

# Create a fresh Expo project
echo "📱 Creating fresh Expo project..."
cd ..
npx create-expo-app@latest SplitWiseIOS --template blank-typescript

# Copy our working app code
echo "📋 Copying your SplitWise app code..."
cp SplitWiseClone/App.tsx SplitWiseIOS/App.tsx

# Start the development server
echo "⚡ Starting development server..."
cd SplitWiseIOS
npx expo start --tunnel

echo "✅ Ready! Scan the QR code with Expo Go app on your iPhone"