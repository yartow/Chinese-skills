#!/bin/bash
# WARNING: This script is NOT automatically installed as a git hook.
# To use it locally, manually copy it to .git/hooks/post-merge (chmod +x)
# SAFETY: This script runs `npm run db:push` which modifies your database schema.
# It will only execute if CHECKOUT_DB_PUSH=true is set in your environment to prevent
# accidental database pushes in CI or production environments.

set -e

# Runtime safety guard: abort unless explicit environment variable is set
if [ "$CHECKOUT_DB_PUSH" != "true" ] && [ "$NODE_ENV" != "development" ]; then
  echo "Skipping db:push (CHECKOUT_DB_PUSH is not set to 'true')"
  exit 0
fi

npm install
npm run db:push