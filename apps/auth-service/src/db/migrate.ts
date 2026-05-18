import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db, pool } from './index';
import path from 'path';

// ============================================================
// MIGRATION RUNNER
// Run with: npm run db:migrate
// Drizzle reads migration files from ./drizzle/ folder
// ============================================================

async function runMigrations() {
  console.log('🔄 Running database migrations...');

  try {
    await migrate(db, {
      migrationsFolder: path.join(__dirname, '../../drizzle'),
    });
    console.log('✅ Migrations complete');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigrations();