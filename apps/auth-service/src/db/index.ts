import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { env } from '../config/env';
import * as schema from './schema';

// ============================================================
// CONNECTION POOL
// Pool manages multiple connections efficiently.
// max: 10 connections in dev, tune higher for production.
// ============================================================

const pool = new Pool({
  host: env.POSTGRES_HOST,
  port: env.POSTGRES_PORT,
  user: env.POSTGRES_USER,
  password: env.POSTGRES_PASSWORD,
  database: env.POSTGRES_DB,
  max: env.NODE_ENV === 'production' ? 20 : 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Log connection errors without crashing
pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool error:', err);
});

export const db = drizzle(pool, { schema });

// ============================================================
// HEALTH CHECK — used by the service startup check
// ============================================================

export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
}

export { pool };