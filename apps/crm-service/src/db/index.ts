import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool }    from 'pg';
import { env }     from '../config/env';
import * as schema from './schema';

const pool = new Pool({
  host:                    env.POSTGRES_HOST,
  port:                    env.POSTGRES_PORT,
  user:                    env.POSTGRES_USER,
  password:                env.POSTGRES_PASSWORD,
  database:                env.POSTGRES_DB,
  max:                     10,
  idleTimeoutMillis:       30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on('error', (err) => console.error('[crm-service] Pool error:', err));

export const db = drizzle(pool, { schema });

export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    return true;
  } catch {
    return false;
  }
}

export { pool };