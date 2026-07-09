import Fastify from 'fastify';
import fastifyJwt from '@fastify/jwt';
import fastifyCors from '@fastify/cors';
import fastifyHelmet from '@fastify/helmet';
import fastifyRateLimit from '@fastify/rate-limit';
import { env } from './config/env';
import { PlatformService } from './modules/platform/platform.service';
import { UserManagementService, ForbiddenError, NotFoundError, BadRequestError } from './modules/users/users.service';
import { z } from 'zod';

// ============================================================
// ADMIN SERVICE (port 3009)
//
// All routes require ADMIN role in the JWT.
// The gateway enforces this before proxying here.
// We double-check on each route as a defense-in-depth measure.
// ============================================================

function requireAdmin(req: any, rep: any) {
  const user = req.user as { sub: string; role: string };
  if (!user || user.role !== 'ADMIN') {
    return rep.status(403).send({ statusCode: 403, error: 'Forbidden', message: 'Admin access required' });
  }
}

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

  await fastify.register(fastifyHelmet, { contentSecurityPolicy: false });
  await fastify.register(fastifyCors, { origin: env.NODE_ENV === 'production' ? false : true });
  await fastify.register(fastifyRateLimit, { max: 60, timeWindow: '1 minute' });
  await fastify.register(fastifyJwt, { secret: env.JWT_SECRET });

  const platform = new PlatformService();
  const users    = new UserManagementService();

  // ----------------------------------------------------------
  // HEALTH
  // ----------------------------------------------------------
  fastify.get('/health', async (_req, reply) => {
    return reply.send({ status: 'ok', service: 'admin-service', timestamp: new Date().toISOString() });
  });

  // ── AUTH HOOK — all /admin/* routes require ADMIN role ────
  fastify.addHook('onRequest', async (req: any, rep) => {
    if (req.url === '/health') return;
    try {
      await req.jwtVerify();
      if (req.user.role !== 'ADMIN') {
        return rep.status(403).send({ statusCode: 403, error: 'Forbidden', message: 'Admin access only' });
      }
    } catch {
      return rep.status(401).send({ statusCode: 401, error: 'Unauthorized', message: 'Valid JWT required' });
    }
  });

  // ----------------------------------------------------------
  // PLATFORM METRICS
  // ----------------------------------------------------------

  fastify.get('/admin/platform/metrics', async (_req, reply) => {
    const metrics = await platform.getMetrics();
    return reply.send({ statusCode: 200, data: metrics });
  });

  // ----------------------------------------------------------
  // USER MANAGEMENT
  // ----------------------------------------------------------

  fastify.get('/admin/users', async (req, reply) => {
    const query = req.query as any;
    const result = await users.listUsers({
      page:     query.page ? Number(query.page) : 1,
      limit:    query.limit ? Number(query.limit) : 20,
      role:     query.role,
      search:   query.search,
      isActive: query.isActive !== undefined ? query.isActive === 'true' : undefined,
    });
    return reply.send({ statusCode: 200, data: result });
  });

  fastify.get('/admin/users/:id', async (req: any, reply) => {
    const detail = await users.getUserDetail(req.params.id);
    return reply.send({ statusCode: 200, data: detail });
  });

  fastify.post('/admin/users/:id/suspend', async (req: any, reply) => {
    try {
      await users.setUserActive(req.params.id, false, req.user.sub);
      return reply.send({ statusCode: 200, message: 'User suspended' });
    } catch (e: any) {
      if (e instanceof ForbiddenError) return reply.status(403).send({ statusCode: 403, error: 'Forbidden', message: e.message });
      return reply.status(500).send({ statusCode: 500, message: e.message });
    }
  });

  fastify.post('/admin/users/:id/reactivate', async (req: any, reply) => {
    try {
      await users.setUserActive(req.params.id, true, req.user.sub);
      return reply.send({ statusCode: 200, message: 'User reactivated' });
    } catch (e: any) {
      return reply.status(500).send({ statusCode: 500, message: e.message });
    }
  });

  fastify.post('/admin/users/:id/role', async (req: any, reply) => {
    const parsed = z.object({ role: z.string() }).safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ statusCode: 400, error: 'Validation Error' });
    try {
      await users.setUserRole(req.params.id, parsed.data.role, req.user.sub);
      return reply.send({ statusCode: 200, message: 'Role updated' });
    } catch (e: any) {
      if (e instanceof ForbiddenError) return reply.status(403).send({ statusCode: 403, error: 'Forbidden', message: e.message });
      if (e instanceof BadRequestError) return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: e.message });
      return reply.status(500).send({ statusCode: 500, message: e.message });
    }
  });

  // ----------------------------------------------------------
  // WORKSHOP MANAGEMENT
  // ----------------------------------------------------------

  // Set featured flag — surfaces workshop on landing page
  fastify.post('/admin/workshops/:id/featured', async (req: any, reply) => {
    const { featured } = req.body as { featured: boolean };
    const res = await fetch(`${env.WORKSHOP_SERVICE_URL}/workshops/internal/${req.params.id}/featured`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ featured }),
    });
    const data = (await res.json()) as any;
    return reply.status(res.ok ? 200 : 500).send(data);
  });

  // Suspend workshop
  fastify.post('/admin/workshops/:id/suspend', async (req: any, reply) => {
    const res = await fetch(`${env.WORKSHOP_SERVICE_URL}/workshops/internal/${req.params.id}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'SUSPENDED' }),
    });
    const data = (await res.json()) as any;
    return reply.status(res.ok ? 200 : 500).send(data);
  });

  // Reactivate workshop
  fastify.post('/admin/workshops/:id/activate', async (req: any, reply) => {
    const res = await fetch(`${env.WORKSHOP_SERVICE_URL}/workshops/internal/${req.params.id}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'ACTIVE' }),
    });
    const data = (await res.json()) as any;
    return reply.status(res.ok ? 200 : 500).send(data);
  });

  // ----------------------------------------------------------
  // SUBSCRIPTION OVERVIEW
  // ----------------------------------------------------------

  fastify.get('/admin/billing/subscriptions', async (req: any, reply) => {
    const query = req.query as any;
    const qs = new URLSearchParams({ page: query.page ?? '1', limit: query.limit ?? '20' });
    if (query.tier) qs.set('tier', query.tier);
    const res = await fetch(`${env.SUBSCRIPTION_SERVICE_URL}/internal/subscriptions?${qs}`);
    const data = (await res.json()) as any;
    return reply.status(res.ok ? 200 : 500).send(data);
  });

  return fastify;
}

async function start() {
  const server = await buildServer();
  try {
    await server.listen({ port: env.PORT, host: '0.0.0.0' });
    console.log(`
╔══════════════════════════════════════════╗
║     🛡️  Motacare Admin Service           ║
╠══════════════════════════════════════════╣
║  Port   : ${env.PORT}                         ║
║  Env    : ${env.NODE_ENV.padEnd(14)}          ║
╚══════════════════════════════════════════╝
    `);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

start();