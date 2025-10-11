#!/bin/bash
# sync-env.sh - Sync .env to .dev.vars for Wrangler

if [ -f .env ]; then
  echo "Syncing .env to .dev.vars..."
  cp .env .dev.vars
  echo "✅ Environment variables synced"
else
  echo "❌ .env file not found"
  exit 1
fi
