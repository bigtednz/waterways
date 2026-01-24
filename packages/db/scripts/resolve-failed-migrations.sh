#!/bin/sh
# Script to resolve failed Prisma migrations
# This marks failed migrations as rolled back so they can be retried

set -e

echo "Checking for failed migrations..."

# Try to resolve the failed migration as rolled back
# This allows migrate deploy to retry it
npx prisma migrate resolve --rolled-back 20240124000000_init || {
  echo "Migration resolve failed (may already be resolved or not exist)"
  # Continue anyway - migrate deploy will handle it
}

echo "Resolved failed migrations, proceeding with deploy..."
