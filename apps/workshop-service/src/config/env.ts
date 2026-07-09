import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3008),

  JWT_SECRET: z.string().min(32),

  POSTGRES_HOST: z.string().default('localhost'),
  POSTGRES_PORT: z.coerce.number().default(5432),
  POSTGRES_USER: z.string(),
  POSTGRES_PASSWORD: z.string(),
  POSTGRES_DB: z.string(),

  // Internal services
  AUTH_SERVICE_URL:        z.string().url().default('http://localhost:3001'),
  INSPECTION_SERVICE_URL:  z.string().url().default('http://localhost:3003'),
  FIX_JOBS_SERVICE_URL:    z.string().url().default('http://localhost:3004'),

  // Max fixers allowed per workshop
  MAX_FIXERS_PER_WORKSHOP: z.coerce.number().default(5),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;