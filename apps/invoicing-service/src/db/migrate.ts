import { drizzle }  from 'drizzle-orm/node-postgres';
import { migrate }   from 'drizzle-orm/node-postgres/migrator';
import { Pool }      from 'pg';
import path          from 'path';

// Run as a standalone script: tsx src/db/migrate.ts
// Or via: npm run db:migrate --workspace=apps/invoicing-service

async function runMigrations() {
  const pool = new Pool({
    host:     process.env.POSTGRES_HOST     ?? 'localhost',
    port:     Number(process.env.POSTGRES_PORT ?? 5432),
    user:     process.env.POSTGRES_USER     ?? 'motacare',
    password: process.env.POSTGRES_PASSWORD ?? '',
    database: process.env.POSTGRES_DB       ?? 'motacare_invoicing',
  });

  const db = drizzle(pool);

  console.log('[invoicing-service] Running migrations…');

  await migrate(db, {
    migrationsFolder: path.join(__dirname, '../../drizzle'),
  });

  console.log('[invoicing-service] ✅ Migrations complete');
  await pool.end();
}

runMigrations().catch((err) => {
  console.error('[invoicing-service] ❌ Migration failed:', err);
  process.exit(1);
});
