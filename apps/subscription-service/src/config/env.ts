import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3007),

  JWT_SECRET: z.string().min(32),

  // PostgreSQL
  POSTGRES_HOST: z.string().default('localhost'),
  POSTGRES_PORT: z.coerce.number().default(5432),
  POSTGRES_USER: z.string(),
  POSTGRES_PASSWORD: z.string(),
  POSTGRES_DB: z.string(),

  // Stripe
  STRIPE_SECRET_KEY: z.string().startsWith('sk_'),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith('whsec_'),

  // Stripe Price IDs — set these in your Stripe dashboard
  // and copy the price_xxx IDs here
  STRIPE_PRICE_PRO_MONTHLY: z.string(),
  STRIPE_PRICE_PRO_YEARLY: z.string(),
  STRIPE_PRICE_WORKSHOP_MONTHLY: z.string(),
  STRIPE_PRICE_WORKSHOP_YEARLY: z.string(),

  // Internal service URLs
  AUTH_SERVICE_URL: z.string().url().default('http://localhost:3001'),

  // App URL — used in Stripe redirect URLs
  APP_URL: z.string().url().default('http://localhost:3005'),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;