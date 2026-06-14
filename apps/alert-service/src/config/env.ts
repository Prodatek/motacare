import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3005),

  // Redis — BullMQ uses this for the queue store
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional(),

  // Internal service URLs — for fetching job/user data
  FIX_JOBS_SERVICE_URL: z.string().url().default('http://localhost:3004'),
  AUTH_SERVICE_URL: z.string().url().default('http://localhost:3001'),

  // Email (Nodemailer — use Mailtrap in dev, real SMTP in prod)
  SMTP_HOST: z.string().default('smtp.mailtrap.io'),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string(),
  SMTP_PASS: z.string(),
  EMAIL_FROM: z.string().default('noreply@motacare.app'),
  EMAIL_FROM_NAME: z.string().default('Motacare'),

  // App URL — used in email links
  APP_URL: z.string().url().default('http://localhost:3005'),

  // Alert timing offsets in milliseconds
  ALERT_THRESHOLD_24H_MS: z.coerce.number().default(24 * 60 * 60 * 1000),
  ALERT_THRESHOLD_1H_MS: z.coerce.number().default(60 * 60 * 1000),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;