#!/bin/bash
# Generate a new migration for the project tables

echo "Generating migration for project management tables..."
npm run db:generate

echo ""
echo "To apply the migration, run:"
echo "npm run db:migrate"