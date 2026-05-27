// Note: zod is not in api-gateway package.json by default — added below
import { z } from 'zod';

// ============================================================
// ENV VALIDATION
// The gateway needs to know where every downstream service is.
// All URLs are required — a missing service URL means the
// gateway can't start, which is better than routing to nothing.
// ============================================================

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),

  // JWT secret — must match auth-service exactly
  // The gateway verifies tokens on certain routes before proxying
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),

  // Downstream service URLs — internal Docker network in staging/prod
  AUTH_SERVICE_URL: z.string().url().default('http://localhost:3001'),
  VEHICLE_SERVICE_URL: z.string().url().default('http://localhost:3002'),
  INSPECTION_SERVICE_URL: z.string().url().default('http://localhost:3003'),
  FIX_JOBS_SERVICE_URL: z.string().url().default('http://localhost:3004'),

  // CORS — comma-separated allowed origins in production
  ALLOWED_ORIGINS: z.string().default('http://localhost:3005'),

  // Request timeout — how long to wait for a downstream response (ms)
  PROXY_TIMEOUT_MS: z.coerce.number().default(30000),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;