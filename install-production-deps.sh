#!/bin/bash

# Install production dependencies for security and reliability
echo "Installing production dependencies..."

# Security and validation
npm install --save lru-cache zod

# For proper types
npm install --save-dev @types/crypto

echo "Dependencies installed!"
echo ""
echo "Make sure to also set these environment variables:"
echo "- GITHUB_WEBHOOK_SECRET: Your webhook secret"
echo "- FLY_API_TOKEN: Your Fly.io API token (when ready)"
echo "- NEXT_PUBLIC_APP_VERSION: Your app version"