#!/bin/bash

# scripts/post-merge.sh
#
# PURPOSE
#   Installs dependencies and pushes the Drizzle schema to the database after
#   a task-agent branch is merged via the Replit task system.  It is NOT
#   installed as a git hook and must never run automatically in CI or
#   production environments.
#
# SAFETY GUARD
#   This script will refuse to run unless the environment variable
#   ALLOW_DB_PUSH=true is explicitly set.  This prevents accidental
#   execution — for example via a mis-configured CI runner or a leftover
#   git hook — from running destructive schema migrations against the wrong
#   database.
#
# LOCAL INSTALLATION (optional)
#   If you want this script to run automatically on "git merge" in your local
#   development checkout, install it as a git hook:
#
#     cp scripts/post-merge.sh .git/hooks/post-merge
#     chmod +x .git/hooks/post-merge
#
#   Do NOT commit .git/hooks/.  Git hooks are local-only by design.
#   When installing locally, set ALLOW_DB_PUSH=true in your shell profile
#   or prefix each git merge call:
#
#     ALLOW_DB_PUSH=true git merge origin/main
#
# IMPLICATIONS
#   "npm run db:push" calls Drizzle's schema-push command which may prompt to
#   drop columns or tables when destructive changes are detected.  Always
#   review schema diffs before running this in any environment that holds
#   real data.

set -e

if [ "${ALLOW_DB_PUSH}" != "true" ]; then
  echo ""
  echo "ERROR: scripts/post-merge.sh refused to run."
  echo "  This script runs 'npm run db:push', which can make destructive"
  echo "  schema changes.  Set ALLOW_DB_PUSH=true to proceed deliberately:"
  echo ""
  echo "    ALLOW_DB_PUSH=true bash scripts/post-merge.sh"
  echo ""
  exit 1
fi

npm install
npm run db:push