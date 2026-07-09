import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3009),

  JWT_SECRET: z.string().min(32),

  // Internal service URLs — admin service orchestrates all of them
  AUTH_SERVICE_URL:         z.string().url().default('http://localhost:3001'),
  VEHICLE_SERVICE_URL:      z.string().url().default('http://localhost:3002'),
  INSPECTION_SERVICE_URL:   z.string().url().default('http://localhost:3003'),
  FIX_JOBS_SERVICE_URL:     z.string().url().default('http://localhost:3004'),
  SUBSCRIPTION_SERVICE_URL: z.string().url().default('http://localhost:3007'),
  WORKSHOP_SERVICE_URL:     z.string().url().default('http://localhost:3008'),

  // Prodatek master admin secret — required to bootstrap the first ADMIN user
  // Generate with: openssl rand -base64 32
  ADMIN_BOOTSTRAP_SECRET: z.string().min(16).optional(),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;