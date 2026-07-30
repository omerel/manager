#!/bin/bash
# Container boot: wait for DB → migrate (first-init == upgrade) → bootstrap admin → serve.
# Any failure exits loudly — never serve a half-migrated app.
set -euo pipefail
cd /app

echo "[entrypoint] waiting for database…"
node docker/wait-for-db.mjs

echo "[entrypoint] applying migrations (prisma migrate deploy)…"
node_modules/.bin/prisma migrate deploy

echo "[entrypoint] bootstrap admin (if user table is empty)…"
node docker/bootstrap-admin.mjs

echo "[entrypoint] starting app on ${HOST:-0.0.0.0}:${PORT:-3000}…"
exec node_modules/.bin/next start -H "${HOST:-0.0.0.0}" -p "${PORT:-3000}"
