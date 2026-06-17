#!/usr/bin/env bash
# ============================================================
# RUN THIS BEFORE restarting $service after the workshop
# feature is applied. Postgres enum types are immutable —
# they CANNOT be altered by Drizzle's normal migration.
# This script does the ALTER TYPE manually, then runs Drizzle.
#
# Usage:
#   chmod +x run-auth-migration.sh
#   ./run-auth-migration.sh
# ============================================================

set -euo pipefail
service="auth-service"
CONTAINER="motacare-postgres"
DB="motacare_auth"
USER="motacare"

echo "1/3 — Adding WORKSHOP_ADMIN to user_role enum..."
docker compose exec postgres psql -U "$USER" -d "$DB" -c \
  "ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'WORKSHOP_ADMIN';"

echo "2/3 — Adding workshopId column to users table..."
docker compose exec postgres psql -U "$USER" -d "$DB" -c \
  "ALTER TABLE users ADD COLUMN IF NOT EXISTS workshop_id UUID;"

docker compose exec postgres psql -U "$USER" -d "$DB" -c \
  "CREATE INDEX IF NOT EXISTS users_workshop_idx ON users (workshop_id);"

echo "3/3 — Creating motacare_workshops database..."
docker compose exec postgres psql -U "$USER" -d postgres -c \
  "CREATE DATABASE motacare_workshops;" 2>/dev/null || echo "  (already exists — skipping)"
docker compose exec postgres psql -U "$USER" -d postgres -c \
  "GRANT ALL PRIVILEGES ON DATABASE motacare_workshops TO $USER;" 2>/dev/null || true

echo ""
echo "✅ Database migration complete."
echo ""
echo "Now run:"
echo "  npm run db:generate --workspace=apps/$service"
echo "  npm run db:migrate  --workspace=apps/$service"
echo "  docker compose restart $service"