import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production', 'test']).default('development'),
  PORT:     z.coerce.number().default(3010),

  JWT_SECRET: z.string().min(32),

  // PostgreSQL — owns the motacare_crm database
  POSTGRES_HOST:     z.string().default('localhost'),
  POSTGRES_PORT:     z.coerce.number().default(5432),
  POSTGRES_USER:     z.string(),
  POSTGRES_PASSWORD: z.string(),
  POSTGRES_DB:       z.string().default('motacare_crm'),

  // Upstream services (CRM aggregates data from these)
  AUTH_SERVICE_URL:        z.string().url().default('http://localhost:3001'),
  VEHICLE_SERVICE_URL:     z.string().url().default('http://localhost:3002'),
  INSPECTION_SERVICE_URL:  z.string().url().default('http://localhost:3003'),
  FIX_JOBS_SERVICE_URL:    z.string().url().default('http://localhost:3004'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;