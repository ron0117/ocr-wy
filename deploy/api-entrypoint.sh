#!/bin/sh
set -eu

export npm_config_verify_deps_before_run=false

echo "Applying database migrations..."
cd /app
./node_modules/.bin/prisma migrate deploy --schema prisma/schema.prisma

if [ "${SEED_DATABASE:-false}" = "true" ]; then
  echo "Seeding initial demo data..."
  pnpm --filter @ocr/api seed
fi

mkdir -p /app/data/storage
chown -R node:node /app/data /app/.env

exec setpriv --reuid=node --regid=node --init-groups -- "$@"

