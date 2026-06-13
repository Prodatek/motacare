import Fastify from 'fastify';
import fastifyJwt from '@fastify/jwt';
import fastifyCors from '@fastify/cors';
import fastifyHelmet from '@fastify/helmet';
import fastifyRateLimit from '@fastify/rate-limit';
import { env } from './config/env';
import { checkDatabaseConnection } from './db';
import { registerAuthMiddleware } from './middleware/authenticate';
import { subscriptionRoutes } from './modules/subscriptions/subscriptions.routes';
import { registerStripeWebhook } from './webhooks/stripe.webhook';

export async function buildServer() {
  const fastify = Fastify({
    logger: {
      level: env.NODE_ENV === 'production' ? 'warn' : 'info',
      transport: env.NODE_ENV === 'development'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
    },
    trustProxy: true,
  });

  await fastify.register(fastifyHelmet, { contentSecurityPolicy: false });
  await fastify.register(fastifyCors, {
    origin: env.NODE_ENV === 'production' ? ['https://motacare.app'] : true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  });
  await fastify.register(fastifyRateLimit, {
    max: 100, timeWindow: '1 minute',
    errorResponseBuilder: () => ({ statusCode: 429, error: 'Too Many Requests', message: 'Rate limit exceeded' }),
  });

  await fastify.register(fastifyJwt, { secret: env.JWT_SECRET });
  await registerAuthMiddleware(fastify);

  await registerStripeWebhook(fastify);

  fastify.get('/health', async (_req, reply) => {
    const dbHealthy = await checkDatabaseConnection();
    return reply.status(dbHealthy ? 200 : 503).send({
      status: dbHealthy ? 'ok' : 'degraded',
      service: 'subscription-service',
      timestamp: new Date().toISOString(),
      database: dbHealthy ? 'connected' : 'unreachable',
    });
  });

  await fastify.register(subscriptionRoutes, { prefix: '/subscriptions' });

  return fastify;
}

async function start() {
  const server = await buildServer();
  try {
    await server.listen({ port: env.PORT, host: '0.0.0.0' });
    console.log(`
╔══════════════════════════════════════════╗
║      💳 Motacare Subscription Service    ║
╠══════════════════════════════════════════╣
║  Port   : ${env.PORT}                         ║
║  Env    : ${env.NODE_ENV.padEnd(14)}          ║
║  Health : http://localhost:${env.PORT}/health ║
╚══════════════════════════════════════════╝
    `);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

start();
