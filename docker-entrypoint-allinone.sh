#!/bin/bash
set -e

echo "🐘 Initializing & Starting PostgreSQL service..."
service postgresql start

# Wait for postgres to be ready
until su - postgres -c "psql -c 'SELECT 1'" > /dev/null 2>&1; do
  echo "Waiting for PostgreSQL socket..."
  sleep 1
done

echo "🔧 Setting up database and user..."
su - postgres -c "psql -tc \"SELECT 1 FROM pg_roles WHERE rolname='admin'\" | grep -q 1 || psql -c \"CREATE USER admin WITH ENCRYPTED PASSWORD 'admin123' SUPERUSER;\""
su - postgres -c "psql -tc \"SELECT 1 FROM pg_database WHERE datname='support_chat'\" | grep -q 1 || psql -c \"CREATE DATABASE support_chat OWNER admin;\""

echo "📦 Running backend database migrations..."
cd /app/backend
npm run db:migrate

echo "🌱 Seeding initial support agent..."
npm run db:seed || true

echo "🌐 Starting Nginx for frontend..."
nginx

echo "=========================================================="
echo "🎉 OmniDesk All-in-One Container is UP and RUNNING!"
echo "👉 Frontend (Chat UI):  http://localhost:5173"
echo "👉 Backend (REST & WS): http://localhost:5000"
echo "👉 Database:            localhost:5432 (support_chat)"
echo "=========================================================="

# Graceful cleanup trap
trap "nginx -s stop; service postgresql stop; exit 0" SIGINT SIGTERM

# Start backend server in foreground
exec node src/server.js
