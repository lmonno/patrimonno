#!/bin/sh
set -e

echo "Attendo che il database sia pronto..."
# Simple wait loop for PostgreSQL
for i in $(seq 1 30); do
  if node -e "
    const { Client } = require('pg');
    const c = new Client({ connectionString: process.env.DATABASE_URL });
    c.connect().then(() => { c.end(); process.exit(0); }).catch(() => process.exit(1));
  " 2>/dev/null; then
    echo "Database pronto!"
    break
  fi
  echo "Tentativo $i/30 - database non ancora pronto..."
  sleep 2
done

echo "Esecuzione migrazioni Prisma..."
npx prisma migrate deploy

echo "Esecuzione seed base..."
npx tsx prisma/seed.ts 2>&1 || echo "Seed base fallito o già eseguito"

if [ "$SEED_DEV" = "true" ]; then
  echo "Esecuzione seed di sviluppo..."
  npx tsx prisma/seed-dev.ts 2>&1 || echo "Seed dev fallito"
else
  echo "Seed di sviluppo saltato (SEED_DEV non impostato)"
fi

echo "Avvio applicazione..."
exec "$@"
