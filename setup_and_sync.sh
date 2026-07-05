#!/bin/bash

# Exit on error
set -e

echo "🩺 Setting up Clinical Insight Engine..."

# 1. Setup environment file
if [ ! -f .env ]; then
  echo "📄 Creating .env file from .env.example..."
  cp .env.example .env
  echo "✅ Created .env file."
else
  echo "ℹ️ .env file already exists."
fi

# 2. Initialize Git and sync with GitHub
if [ ! -d .git ]; then
  echo "🐙 Initializing Git repository..."
  git init
  git checkout -b main || git checkout -b master
  git add .
  git commit -m "Initial commit of Clinical Insight Engine"
  
  echo "🔗 Adding GitHub remote origin..."
  git remote add origin https://github.com/gopaljilab/Clinical-Insight-Engine.git
  
  echo "✅ Git repository initialized."
else
  echo "ℹ️ Git repository is already initialized."
  # Check if remote exists, if not add it
  if ! git remote | grep -q "origin"; then
    echo "🔗 Adding GitHub remote origin..."
    git remote add origin https://github.com/gopaljilab/Clinical-Insight-Engine.git
  fi
fi

echo "============================================="
echo "🎉 Setup complete! Here is how to sync and run:"
echo "============================================="
echo "1. To sync/push to GitHub:"
echo "   git push -u origin main (or your preferred branch)"
echo ""
echo "2. To run the project (Using Docker - Recommended):"
echo "   docker compose up"
echo ""
echo "3. To run the project (Manually):"
echo "   - Ensure PostgreSQL is running and update DATABASE_URL in .env"
echo "   - Run: npm install"
echo "   - Run: npm run db:push"
echo "   - Run: npm run dev"
echo "============================================="
