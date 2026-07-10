import Fastify          from 'fastify';
import fastifyJwt       from '@fastify/jwt';
import fastifyCors      from '@fastify/cors';
import fastifyHelmet    from '@fastify/helmet';
import fastifyRateLimit from '@fastify/rate-limit';
import { z }            from 'zod';
import { env }          from './config/env';
import { PlatformService }                                   from './modules/platform/platform.service';
import { UserManagementService, ForbiddenError, BadRequestError } from './modules/users/users.service';
import { WorkshopAdminService }                              from './modules/workshops/workshops.service';
import { BillingAdminService }                               from './modules/billing/billing.service';

// ============================================================
// ADMIN SERVICE (port 3009)
//
// All routes double-check ADMIN role here AND at the gateway.
// No DB — admin-service is a pure orchestrator that calls
// internal routes on the other microservices.
// ============================================================

async function buildServer() {
  const fastify = Fastify({
    logger: {
      level:     env.NODE_ENV === 'production' ? 'warn' : 'info',
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
  await fastify.register(fastifyRateLimit, { max: 60, timeWindow: '1 minute' });
  await fastify.register(fastifyJwt, { secret: env.JWT_SECRET });

  // ── Services ───────────────────────────────────────────────
  const platform  = new PlatformService();
  const userSvc   = new UserManagementService();
  const workshopSvc = new WorkshopAdminService();
  const billingSvc  = new BillingAdminService();

  // ── ADMIN-ONLY hook — runs on every request ─────────────────
  // This is the second line of defence; the gateway is the first.
  fastify.addHook('onRequest', async (req: any, rep) => {
    if (req.url === '/health') return;   // health is always public
    try {
      await req.jwtVerify();
      if (req.user.role !== 'ADMIN') {
        return rep.status(403).send({
          statusCode: 403,
          error:      'Forbidden',
          message:    'Prodatek admin access only',
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

  // ── Health ─────────────────────────────────────────────────
  fastify.get('/health', async (_req, reply) => {
    return reply.send({
      status:    'ok',
      service:   'admin-service',
      timestamp: new Date().toISOString(),
    });
  });

  // ──────────────────────────────────────────────────────────
  // PLATFORM METRICS
  // ──────────────────────────────────────────────────────────

  fastify.get('/admin/platform/metrics', async (_req, reply) => {
    const metrics = await platform.getMetrics();
    return reply.send({ statusCode: 200, data: metrics });
  });

  // ──────────────────────────────────────────────────────────
  // USER MANAGEMENT
  // ──────────────────────────────────────────────────────────

  fastify.get('/admin/users', async (req, reply) => {
    const q = req.query as any;
    try {
      const result = await userSvc.listUsers({
        page:     q.page     ? Number(q.page)  : 1,
        limit:    q.limit    ? Number(q.limit) : 20,
        role:     q.role     || undefined,
        search:   q.search   || undefined,
        isActive: q.isActive !== undefined ? q.isActive === 'true' : undefined,
      });
      return reply.send({ statusCode: 200, ...result });
    } catch (err: any) {
      return reply.status(500).send({ statusCode: 500, message: err.message });
    }
  });

  fastify.get('/admin/users/:id', async (req: any, reply) => {
    try {
      const detail = await userSvc.getUserDetail(req.params.id);
      return reply.send({ statusCode: 200, data: detail });
    } catch (err: any) {
      return reply.status(500).send({ statusCode: 500, message: err.message });
    }
  });

  fastify.post('/admin/users/:id/suspend', async (req: any, reply) => {
    try {
      await userSvc.setUserActive(req.params.id, false, req.user.sub);
      return reply.send({ statusCode: 200, message: 'User suspended' });
    } catch (err: any) {
      if (err instanceof ForbiddenError) return reply.status(403).send({ statusCode: 403, error: 'Forbidden', message: err.message });
      return reply.status(500).send({ statusCode: 500, message: err.message });
    }
  });

  fastify.post('/admin/users/:id/reactivate', async (req: any, reply) => {
    try {
      await userSvc.setUserActive(req.params.id, true, req.user.sub);
      return reply.send({ statusCode: 200, message: 'User reactivated' });
    } catch (err: any) {
      return reply.status(500).send({ statusCode: 500, message: err.message });
    }
  });

  fastify.post('/admin/users/:id/role', async (req: any, reply) => {
    const parsed = z.object({ role: z.string().min(1) }).safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ statusCode: 400, error: 'Validation Error', message: 'role is required' });
    }
    try {
      await userSvc.setUserRole(req.params.id, parsed.data.role, req.user.sub);
      return reply.send({ statusCode: 200, message: 'Role updated' });
    } catch (err: any) {
      if (err instanceof ForbiddenError)  return reply.status(403).send({ statusCode: 403, error: 'Forbidden',   message: err.message });
      if (err instanceof BadRequestError) return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: err.message });
      return reply.status(500).send({ statusCode: 500, message: err.message });
    }
  });

  // ──────────────────────────────────────────────────────────
  // WORKSHOP MANAGEMENT
  // ──────────────────────────────────────────────────────────

  fastify.post('/admin/workshops/:id/featured', async (req: any, reply) => {
    const parsed = z.object({ featured: z.boolean() }).safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ statusCode: 400, message: 'featured (boolean) required' });
    try {
      await workshopSvc.setFeatured(req.params.id, parsed.data.featured);
      return reply.send({ statusCode: 200, message: `Workshop ${parsed.data.featured ? 'added to' : 'removed from'} featured` });
    } catch (err: any) {
      return reply.status(500).send({ statusCode: 500, message: err.message });
    }
  });

  fastify.post('/admin/workshops/:id/suspend', async (req: any, reply) => {
    try {
      await workshopSvc.setStatus(req.params.id, 'SUSPENDED');
      return reply.send({ statusCode: 200, message: 'Workshop suspended' });
    } catch (err: any) {
      return reply.status(500).send({ statusCode: 500, message: err.message });
    }
  });

  fastify.post('/admin/workshops/:id/activate', async (req: any, reply) => {
    try {
      await workshopSvc.setStatus(req.params.id, 'ACTIVE');
      return reply.send({ statusCode: 200, message: 'Workshop activated' });
    } catch (err: any) {
      return reply.status(500).send({ statusCode: 500, message: err.message });
    }
  });

  // ──────────────────────────────────────────────────────────
  // BILLING / SUBSCRIPTIONS
  // ──────────────────────────────────────────────────────────

  fastify.get('/admin/billing/subscriptions', async (req: any, reply) => {
    const q = req.query as any;
    try {
      const result = await billingSvc.listSubscriptions({
        page:  q.page  ? Number(q.page)  : 1,
        limit: q.limit ? Number(q.limit) : 25,
        tier:  q.tier  || undefined,
      });
      return reply.send({ statusCode: 200, ...result });
    } catch (err: any) {
      return reply.status(500).send({ statusCode: 500, message: err.message });
    }
  });

  fastify.get('/admin/billing/stats', async (_req, reply) => {
    try {
      const stats = await billingSvc.getBillingStats();
      return reply.send({ statusCode: 200, data: stats });
    } catch (err: any) {
      return reply.status(500).send({ statusCode: 500, message: err.message });
    }
  });

  // ── 404 ────────────────────────────────────────────────────
  fastify.setNotFoundHandler((_req, reply) => {
    reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Endpoint not found' });
  });

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

// ──────────────────────────────────────────────────────────────
// STARTUP
// ──────────────────────────────────────────────────────────────

async function start() {
  const server = await buildServer();
  try {
    await server.listen({ port: env.PORT, host: '0.0.0.0' });
    console.log(`
╔══════════════════════════════════════════════╗
║     🛡️  Motacare Admin Service               ║
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