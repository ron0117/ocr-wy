#!/bin/sh
set -eu

export npm_config_verify_deps_before_run=false

echo "Applying guide database migrations..."
cd /app
./node_modules/.bin/prisma migrate deploy --schema prisma/guide/schema.prisma

if [ "${SEED_GUIDE:-false}" = "true" ]; then
  echo "Importing guide data (manifest + data/sources)..."
  pnpm --filter @ocr/guide-types build
  pnpm exec tsx scripts/guide-import.ts
fi

exec "$@"
