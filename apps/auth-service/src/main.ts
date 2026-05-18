import Fastify from 'fastify';
import fastifyJwt from '@fastify/jwt';
import fastifyCors from '@fastify/cors';
import fastifyHelmet from '@fastify/helmet';
import fastifyRateLimit from '@fastify/rate-limit';
import { env } from './config/env';
import { checkDatabaseConnection } from './db';
import { registerSwagger } from './plugins/swagger';
import { registerAuthMiddleware } from './middleware/authenticate';
import { authRoutes } from './modules/auth/auth.routes';

// ============================================================
// SERVER FACTORY
// Exported for testing (allows test files to spin up the server)
// ============================================================

export async function buildServer() {
  const fastify = Fastify({
    logger: {
      level: env.NODE_ENV === 'production' ? 'warn' : 'info',
      transport:
        env.NODE_ENV === 'development'
          ? { target: 'pino-pretty', options: { colorize: true } }
          : undefined,
    },
    trustProxy: true, // Needed to read real IP behind docker/nginx
  });

  // ----------------------------------------------------------
  // SECURITY PLUGINS
  // ----------------------------------------------------------

  await fastify.register(fastifyHelmet, {
    contentSecurityPolicy: false, // Swagger UI needs this off
  });

  await fastify.register(fastifyCors, {
    origin: env.NODE_ENV === 'production' ? ['https://motacare.app'] : true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  });

  await fastify.register(fastifyRateLimit, {
    max: 100,
    timeWindow: '1 minute',
    errorResponseBuilder: () => ({
      statusCode: 429,
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Please wait before retrying.',
    }),
  });

  // ----------------------------------------------------------
  // JWT PLUGIN
  // ----------------------------------------------------------

  await fastify.register(fastifyJwt, {
    secret: env.JWT_SECRET,
  });

  // ----------------------------------------------------------
  // SWAGGER DOCS (dev + staging only)
  // ----------------------------------------------------------

  if (env.NODE_ENV !== 'production') {
    await registerSwagger(fastify);
  }

  // ----------------------------------------------------------
  // MIDDLEWARE
  // ----------------------------------------------------------

  await registerAuthMiddleware(fastify);

  // ----------------------------------------------------------
  // HEALTH CHECK
  // ----------------------------------------------------------

  fastify.get(
    '/health',
    {
      schema: {
        tags: ['Health'],
        summary: 'Service health check',
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string' },
              service: { type: 'string' },
              timestamp: { type: 'string' },
              database: { type: 'string' },
            },
          },
        },
      },
    },
    async (_request, reply) => {
      const dbHealthy = await checkDatabaseConnection();
      const status = dbHealthy ? 'ok' : 'degraded';

      return reply.status(dbHealthy ? 200 : 503).send({
        status,
        service: 'auth-service',
        timestamp: new Date().toISOString(),
        database: dbHealthy ? 'connected' : 'unreachable',
      });
    },
  );

  // ----------------------------------------------------------
  // ROUTES
  // ----------------------------------------------------------

  await fastify.register(authRoutes, { prefix: '/auth' });

  return fastify;
}

// ============================================================
// STARTUP
// ============================================================

async function start() {
  const server = await buildServer();

  try {
    await server.listen({ port: env.PORT, host: '0.0.0.0' });
    console.log(`
╔══════════════════════════════════════════╗
║       🔐 Motacare Auth Service           ║
╠══════════════════════════════════════════╣
║  Port     : ${env.PORT}                         ║
║  Env      : ${env.NODE_ENV.padEnd(12)}            ║
║  Docs     : http://localhost:${env.PORT}/docs  ║
║  Health   : http://localhost:${env.PORT}/health║
╚══════════════════════════════════════════╝
    `);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

start();