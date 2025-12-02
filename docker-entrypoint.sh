#!/bin/sh
set -e

echo "Waiting for database to be ready..."
sleep 5

echo "Running database migrations..."
if [ -f "./node_modules/.bin/prisma" ]; then
  ./node_modules/.bin/prisma migrate deploy || echo "Migration failed or already up to date"
elif command -v prisma > /dev/null 2>&1; then
  prisma migrate deploy || echo "Migration failed or already up to date"
else
  echo "Prisma CLI not found, skipping migrations"
fi

echo "Starting application..."
exec node server.js

