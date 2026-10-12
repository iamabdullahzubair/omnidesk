#!/bin/sh
set -e

echo "⏳ Checking database connection..."
node scripts/wait-for-db.js

echo "📦 Running database migrations..."
npm run db:migrate

echo "🌱 Seeding default support agent..."
node scripts/seed-agent.js || true

echo "🚀 Starting backend server..."
exec npm start
