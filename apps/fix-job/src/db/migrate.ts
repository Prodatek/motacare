import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db, pool } from './index';
import path from 'path';

async function runMigrations() {
  console.log('🔄 Running fix-jobs database migrations...');
  try {
    await migrate(db, { migrationsFolder: path.join(__dirname, '../../drizzle') });
    console.log('✅ Migrations complete');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigrations();