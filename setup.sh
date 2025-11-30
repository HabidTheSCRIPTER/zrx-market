#!/bin/bash
# Bash setup script for ZRX Market
# Run this script to install dependencies and seed the database

echo "Installing dependencies..."
npm install || exit 1

echo "Installing backend dependencies..."
cd backend && npm install || exit 1 && cd ..

echo "Installing bot dependencies..."
cd bot && npm install || exit 1 && cd ..

echo "Installing frontend dependencies..."
cd frontend && npm install || exit 1 && cd ..

echo "Seeding database..."
cd backend && node scripts/seed.js || exit 1 && cd ..

echo ""
echo "✅ Setup complete! Run 'npm run dev' to start the application."





