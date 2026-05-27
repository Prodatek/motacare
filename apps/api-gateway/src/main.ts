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
import { buildRateLimitErrorResponse } from './middleware/rate-limit';

// ============================================================
// SERVER FACTORY — exported for testing
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
    trustProxy: true,
    // Generate unique request IDs for distributed tracing
    genReqId: () => crypto.randomUUID(),
  });

  // ----------------------------------------------------------
  // SECURITY
  // ----------------------------------------------------------

  await fastify.register(fastifyHelmet, {
    contentSecurityPolicy: false, // Swagger UI needs this off
  });

  // Parse allowed origins from env (comma-separated in production)
  const origins = env.NODE_ENV === 'production'
    ? env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
    : true;

  await fastify.register(fastifyCors, {
    origin: origins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Global rate limit — individual routes can override with tighter limits
  await fastify.register(fastifyRateLimit, {
    global: true,
    max: 200,
    timeWindow: '1 minute',
    errorResponseBuilder: buildRateLimitErrorResponse,
  });

  // ----------------------------------------------------------
  // JWT — for gateway-level verification
  // ----------------------------------------------------------

  await fastify.register(fastifyJwt, {
    secret: env.JWT_SECRET,
  });

  // ----------------------------------------------------------
  // REQUEST LOGGING
  // ----------------------------------------------------------

  await registerRequestLogger(fastify);

  // ----------------------------------------------------------
  // SWAGGER DOCS (dev + staging only)
  // Aggregates all service routes into a single API reference
  // ----------------------------------------------------------

  if (env.NODE_ENV !== 'production') {
    await fastify.register(fastifySwagger, {
      openapi: {
        openapi: '3.0.0',
        info: {
          title: 'Motacare API',
          description: 'Unified API gateway for all Motacare services',
          version: '1.0.0',
        },
        servers: [{ url: `http://localhost:${env.PORT}`, description: 'Gateway' }],
        components: {
          securitySchemes: {
            bearerAuth: {
              type: 'http',
              scheme: 'bearer',
              bearerFormat: 'JWT',
            },
          },
        },
        tags: [
          { name: 'Auth', description: 'Authentication and user management' },
          { name: 'Vehicles', description: 'Vehicle registration and management' },
          { name: 'Inspections', description: 'Inspection sessions and checklists' },
          { name: 'Fix Jobs', description: 'Fix job lifecycle management' },
        ],
      },
    });

    await fastify.register(fastifySwaggerUi, {
      routePrefix: '/docs',
      uiConfig: { docExpansion: 'list', deepLinking: true },
    });
  }

  // ----------------------------------------------------------
  // AUTH MIDDLEWARE (decorates fastify.authenticate etc.)
  // Must be registered BEFORE routes
  // ----------------------------------------------------------

  await registerAuthMiddleware(fastify);

  // ----------------------------------------------------------
  // HEALTH CHECK
  // Checks all downstream services and returns aggregate status
  // ----------------------------------------------------------

  fastify.get('/health', async (_request, reply) => {
    const checks = await Promise.allSettled([
      fetch(`${env.AUTH_SERVICE_URL}/health`).then((r) => ({ service: 'auth', ok: r.ok })),
      fetch(`${env.VEHICLE_SERVICE_URL}/health`).then((r) => ({ service: 'vehicle', ok: r.ok })),
      fetch(`${env.INSPECTION_SERVICE_URL}/health`).then((r) => ({ service: 'inspection', ok: r.ok })),
      fetch(`${env.FIX_JOBS_SERVICE_URL}/health`).then((r) => ({ service: 'fix-jobs', ok: r.ok })),
    ]);

    const results = checks.map((c) =>
      c.status === 'fulfilled'
        ? c.value
        : { service: 'unknown', ok: false },
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

  // ----------------------------------------------------------
  // PROXY ROUTES
  // Order matters — more specific paths must come before wildcards
  // ----------------------------------------------------------

  await registerAuthProxy(fastify);
  await registerVehicleProxy(fastify);
  await registerInspectionProxy(fastify);
  await registerFixJobsProxy(fastify);

  // ----------------------------------------------------------
  // 404 HANDLER — catches any unmatched route
  // ----------------------------------------------------------

  fastify.setNotFoundHandler((_request, reply) => {
    reply.status(404).send({
      statusCode: 404,
      error: 'Not Found',
      message: 'The requested endpoint does not exist',
    });
  });

  // ----------------------------------------------------------
  // GLOBAL ERROR HANDLER
  // ----------------------------------------------------------

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

// ============================================================
// STARTUP
// ============================================================

async function start() {
  const server = await buildServer();

  try {
    await server.listen({ port: env.PORT, host: '0.0.0.0' });
    console.log(`
╔══════════════════════════════════════════════╗
║       🌐 Motacare API Gateway                ║
╠══════════════════════════════════════════════╣
║  Port        : ${env.PORT}                          ║
║  Env         : ${env.NODE_ENV.padEnd(16)}          ║
║  Docs        : http://localhost:${env.PORT}/docs   ║
║  Health      : http://localhost:${env.PORT}/health ║
╠══════════════════════════════════════════════╣
║  → auth-service      : ${env.AUTH_SERVICE_URL.padEnd(20)}║
║  → vehicle-service   : ${env.VEHICLE_SERVICE_URL.padEnd(20)}║
║  → inspection-service: ${env.INSPECTION_SERVICE_URL.padEnd(20)}║
╚══════════════════════════════════════════════╝
    `);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

start();