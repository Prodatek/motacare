import Fastify from 'fastify';
import fastifyJwt from '@fastify/jwt';
import fastifyCors from '@fastify/cors';
import fastifyHelmet from '@fastify/helmet';
import fastifyRateLimit from '@fastify/rate-limit';
import { env } from './config/env';
import { checkDatabaseConnection } from './db';
import { workshopRoutes } from './modules/workshops/workshops.routes';

async function registerAuthMiddleware(fastify: any) {
  fastify.decorate('authenticate', async (req: any, rep: any) => {
    try { await req.jwtVerify(); }
    catch { return rep.status(401).send({ statusCode: 401, error: 'Unauthorized', message: 'Invalid or missing token' }); }
  });
  fastify.decorate('requireRole', function (...roles: string[]) {
    return async (req: any, rep: any) => {
      try {
        await req.jwtVerify();
        if (!roles.includes(req.user.role)) {
          return rep.status(403).send({ statusCode: 403, error: 'Forbidden', message: `Requires: ${roles.join(', ')}` });
        }
      } catch {
        return rep.status(401).send({ statusCode: 401, error: 'Unauthorized', message: 'Invalid or missing token' });
      }
    };
  });
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
  await fastify.register(fastifyCors, {
    origin: env.NODE_ENV === 'production' ? ['https://app.motacare.ng'] : true,
  });
  await fastify.register(fastifyRateLimit, { max: 100, timeWindow: '1 minute' });
  await fastify.register(fastifyJwt, { secret: env.JWT_SECRET });
  await registerAuthMiddleware(fastify);

  fastify.get('/health', async (_req, reply) => {
    const dbOk = await checkDatabaseConnection();
    return reply.status(dbOk ? 200 : 503).send({
      status: dbOk ? 'ok' : 'degraded',
      service: 'workshop-service',
      timestamp: new Date().toISOString(),
    });
  });

  await fastify.register(workshopRoutes, { prefix: '/workshops' });

  return fastify;
}

async function start() {
  const server = await buildServer();
  try {
    await server.listen({ port: env.PORT, host: '0.0.0.0' });
    console.log(`
╔═══════════════════════════════════════════╗
║     🔧 Motacare Workshop Service          ║
╠═══════════════════════════════════════════╣
║  Port   : ${env.PORT}                          ║
║  Health : http://localhost:${env.PORT}/health  ║
╚═══════════════════════════════════════════╝
    `);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

start();