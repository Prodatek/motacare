import Fastify          from 'fastify';
import fastifyJwt       from '@fastify/jwt';
import fastifyCors      from '@fastify/cors';
import fastifyHelmet    from '@fastify/helmet';
import fastifyRateLimit from '@fastify/rate-limit';
import { env }                     from './config/env';
import { checkDatabaseConnection } from './db';
import { catalogRoutes }  from './modules/catalog/catalog.routes';
import { quotesRoutes }   from './modules/quotes/quotes.routes';
import { invoicesRoutes } from './modules/invoices/invoices.routes';
import { paymentsRoutes } from './modules/payments/payments.routes';
import { reportsRoutes }  from './modules/reports/reports.routes';
import { pdfRoutes }      from './modules/pdf/pdf.routes';

// ============================================================
// AUTH MIDDLEWARE
// Adds fastify.authenticate and fastify.requireRole decorators.
// invoicing-service re-verifies the JWT (same JWT_SECRET as
// auth-service) as a defense-in-depth check.
// ============================================================

async function registerAuthMiddleware(fastify: any) {
  fastify.decorate('authenticate', async (req: any, rep: any) => {
    try {
      await req.jwtVerify();
    } catch {
      return rep.status(401).send({
        statusCode: 401,
        error:      'Unauthorized',
        message:    'Valid JWT required',
      });
    }
  });

  fastify.decorate('requireRole', (...roles: string[]) => async (req: any, rep: any) => {
    try {
      await req.jwtVerify();
      if (!roles.includes(req.user.role)) {
        return rep.status(403).send({
          statusCode: 403,
          error:      'Forbidden',
          message:    `This endpoint requires one of: ${roles.join(', ')}`,
        });
      }
    } catch {
      return rep.status(401).send({
        statusCode: 401,
        error:      'Unauthorized',
        message:    'Valid JWT required',
      });
    }
  });
}

// ============================================================
// SERVER FACTORY
// ============================================================

async function buildServer() {
  const fastify = Fastify({
    logger: {
      level: env.NODE_ENV === 'production' ? 'warn' : 'info',
      transport: env.NODE_ENV === 'development'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
    },
    trustProxy: true,
  });

  // ── Plugins ────────────────────────────────────────────────
  await fastify.register(fastifyHelmet, { contentSecurityPolicy: false });
  await fastify.register(fastifyCors, {
    origin: env.NODE_ENV === 'production'
      ? ['https://app.motacare.ng']
      : true,
    credentials: true,
  });
  await fastify.register(fastifyRateLimit, { max: 120, timeWindow: '1 minute' });
  await fastify.register(fastifyJwt,  { secret: env.JWT_SECRET });
  await registerAuthMiddleware(fastify);

  // ── Health check ───────────────────────────────────────────
  fastify.get('/health', async (_req, reply) => {
    const dbOk = await checkDatabaseConnection();
    return reply.status(dbOk ? 200 : 503).send({
      status:    dbOk ? 'ok' : 'degraded',
      service:   'invoicing-service',
      timestamp: new Date().toISOString(),
    });
  });

  // ── Routes — all under /invoicing ───────────────────────────
  await fastify.register(catalogRoutes,  { prefix: '/invoicing/catalog' });
  await fastify.register(quotesRoutes,   { prefix: '/invoicing/quotes' });
  await fastify.register(invoicesRoutes, { prefix: '/invoicing/invoices' });
  await fastify.register(paymentsRoutes, { prefix: '/invoicing' });
  await fastify.register(reportsRoutes,  { prefix: '/invoicing/reports' });
  await fastify.register(pdfRoutes,      { prefix: '/invoicing' });

  // ── 404 handler ────────────────────────────────────────────
  fastify.setNotFoundHandler((_req, reply) => {
    reply.status(404).send({
      statusCode: 404,
      error:      'Not Found',
      message:    'The requested endpoint does not exist',
    });
  });

  // ── Global error handler ────────────────────────────────────
  fastify.setErrorHandler((error, _req, reply) => {
    fastify.log.error(error);
    reply.status(error.statusCode ?? 500).send({
      statusCode: error.statusCode ?? 500,
      error:      error.name ?? 'Internal Server Error',
      message:    error.message ?? 'An unexpected error occurred',
    });
  });

  return fastify;
}

// ============================================================
// STARTUP
// ============================================================

async function start() {
  const server = await buildServer();

  // DB readiness check — fail fast instead of crash-looping
  const dbOk = await checkDatabaseConnection();
  if (!dbOk) {
    console.error(`
╔══════════════════════════════════════════════╗
║  ❌ invoicing-service: DB connection failed   ║
╠══════════════════════════════════════════════╣
║  Cannot reach: ${env.POSTGRES_DB.padEnd(29)}║
║  Run: npm run db:migrate --workspace=apps/invoicing-service
╚══════════════════════════════════════════════╝
    `);
    process.exit(1);
  }

  try {
    await server.listen({ port: env.PORT, host: '0.0.0.0' });
    console.log(`
╔══════════════════════════════════════════════╗
║     🧾 Motacare Invoicing Service             ║
╠══════════════════════════════════════════════╣
║  Port   : ${env.PORT}                             ║
║  Env    : ${env.NODE_ENV.padEnd(19)}         ║
║  Health : http://localhost:${env.PORT}/health     ║
╚══════════════════════════════════════════════╝
    `);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

start();
