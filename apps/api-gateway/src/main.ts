import Fastify from 'fastify';
import fastifyJwt from '@fastify/jwt';
import fastifyCors from '@fastify/cors';
import fastifyHelmet from '@fastify/helmet';
import fastifyRateLimit from '@fastify/rate-limit';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import { env } from './config/env';
import { registerAuthMiddleware } from './middleware/authenticate';
import { registerRequestLogger } from './middleware/request-logger';
import { registerAuthProxy } from './routes/auth.proxy';
import { registerVehicleProxy } from './routes/vehicle.proxy';
import { registerInspectionProxy } from './routes/inspection.proxy';
import { registerFixJobsProxy } from './routes/fix-jobs.proxy';
import { registerSubscriptionProxy } from './routes/subscription.proxy';
import { registerWorkshopProxy } from './routes/workshop.proxy';
import { buildRateLimitErrorResponse } from './middleware/rate-limit';

export async function buildServer() {
  const fastify = Fastify({
    logger: {
      level: env.NODE_ENV === 'production' ? 'warn' : 'info',
      transport:
        env.NODE_ENV === 'development'
          ? { target: 'pino-pretty', options: { colorize: true } }
          : undefined,
    },
    trustProxy: true,
    genReqId: () => crypto.randomUUID(),
  });

  // ── Security ─────────────────────────────────────────────

  await fastify.register(fastifyHelmet, { contentSecurityPolicy: false });

  const origins = env.NODE_ENV === 'production'
    ? env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
    : true;

  await fastify.register(fastifyCors, {
    origin: origins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  await fastify.register(fastifyRateLimit, {
    global: true,
    max: 200,
    timeWindow: '1 minute',
    errorResponseBuilder: buildRateLimitErrorResponse,
  });

  // ── JWT ──────────────────────────────────────────────────

  await fastify.register(fastifyJwt, { secret: env.JWT_SECRET });

  // ── Request logging ──────────────────────────────────────

  await registerRequestLogger(fastify);

  // ── Swagger docs ─────────────────────────────────────────

  if (env.NODE_ENV !== 'production') {
    await fastify.register(fastifySwagger, {
      openapi: {
        openapi: '3.0.0',
        info: { title: 'Motacare API', description: 'Unified API gateway', version: '1.0.0' },
        servers: [{ url: `http://localhost:${env.PORT}`, description: 'Gateway' }],
        components: {
          securitySchemes: {
            bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
          },
        },
        tags: [
          { name: 'Auth',          description: 'Authentication and user management' },
          { name: 'Vehicles',      description: 'Vehicle registration and management' },
          { name: 'Inspections',   description: 'Inspection sessions and checklists' },
          { name: 'Fix Jobs',      description: 'Fix job lifecycle management' },
          { name: 'Subscriptions', description: 'Plan management and billing' },
          { name: 'Workshops',     description: 'Workshop profiles and membership' },
        ],
      },
    });

    await fastify.register(fastifySwaggerUi, {
      routePrefix: '/docs',
      uiConfig: { docExpansion: 'list', deepLinking: true },
    });
  }

  // ── Auth middleware ──────────────────────────────────────

  await registerAuthMiddleware(fastify);

  // ── Health check ─────────────────────────────────────────
  // Checks all downstream services. Uses Promise.allSettled so
  // one unreachable service doesn't prevent the others from reporting.

  fastify.get('/health', async (_request, reply) => {
    const checks = await Promise.allSettled([
      fetch(`${env.AUTH_SERVICE_URL}/health`).then((r) => ({ service: 'auth', ok: r.ok })),
      fetch(`${env.VEHICLE_SERVICE_URL}/health`).then((r) => ({ service: 'vehicle', ok: r.ok })),
      fetch(`${env.INSPECTION_SERVICE_URL}/health`).then((r) => ({ service: 'inspection', ok: r.ok })),
      fetch(`${env.FIX_JOBS_SERVICE_URL}/health`).then((r) => ({ service: 'fix-jobs', ok: r.ok })),
      fetch(`${env.SUBSCRIPTION_SERVICE_URL}/health`).then((r) => ({ service: 'subscription', ok: r.ok })),
      fetch(`${env.WORKSHOP_SERVICE_URL}/health`).then((r) => ({ service: 'workshop', ok: r.ok })),
    ]);

    const results = checks.map((c) =>
      c.status === 'fulfilled' ? c.value : { service: 'unknown', ok: false },
    );

    const allHealthy = results.every((r) => r.ok);

    return reply.status(allHealthy ? 200 : 503).send({
      status: allHealthy ? 'ok' : 'degraded',
      service: 'api-gateway',
      timestamp: new Date().toISOString(),
      upstream: results.reduce<Record<string, string>>((acc, r) => {
        acc[r.service] = r.ok ? 'healthy' : 'unreachable';
        return acc;
      }, {}),
    });
  });

  // ── Proxy routes ─────────────────────────────────────────
  // Order matters — more specific paths must come before wildcards.
  // Workshop routes include public GET routes so must be registered
  // WITHOUT requiring authentication on those specific paths.

  await registerAuthProxy(fastify);
  await registerVehicleProxy(fastify);
  await registerInspectionProxy(fastify);
  await registerFixJobsProxy(fastify);
  await registerSubscriptionProxy(fastify);
  await registerWorkshopProxy(fastify);    

  // ── 404 handler ──────────────────────────────────────────

  fastify.setNotFoundHandler((_request, reply) => {
    reply.status(404).send({
      statusCode: 404,
      error: 'Not Found',
      message: 'The requested endpoint does not exist',
    });
  });

  // ── Global error handler ─────────────────────────────────

  fastify.setErrorHandler((error, _request, reply) => {
    fastify.log.error(error);
    reply.status(error.statusCode ?? 500).send({
      statusCode: error.statusCode ?? 500,
      error: error.name ?? 'Internal Server Error',
      message: error.message ?? 'An unexpected error occurred',
    });
  });

  return fastify;
}

async function start() {
  const server = await buildServer();

  try {
    await server.listen({ port: env.PORT, host: '0.0.0.0' });
    console.log(`
╔══════════════════════════════════════════════╗
║       🌐 Motacare API Gateway                ║
╠══════════════════════════════════════════════╣
║  Port   : ${env.PORT}                               ║
║  Env    : ${env.NODE_ENV.padEnd(20)}            ║
║  Docs   : http://localhost:${env.PORT}/docs        ║
║  Health : http://localhost:${env.PORT}/health      ║
╠══════════════════════════════════════════════╣
║  Services registered:                        ║
║  auth · vehicle · inspection · fix-jobs      ║
║  subscription · workshop                     ║
╚══════════════════════════════════════════════╝
    `);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

start();