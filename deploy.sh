#!/bin/bash

# ZRX Market Deployment Script
# Run this script on your production server after initial setup

set -e  # Exit on error

echo "🚀 Starting ZRX Market deployment..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Are you in the project root?"
    exit 1
fi

# Install/update dependencies
echo "📦 Installing dependencies..."
npm run install:all

# Build frontend
echo "🏗️  Building frontend..."
cd frontend
npm run build
cd ..

# Create logs directory if it doesn't exist
mkdir -p logs

# Restart PM2 processes
echo "🔄 Restarting services..."
pm2 restart ecosystem.config.js || pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

echo "✅ Deployment complete!"
echo ""
echo "📊 Check status with: pm2 status"
echo "📝 View logs with: pm2 logs"
echo ""

