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
 
  // ── DB readiness check ────────────────────────────────────
  const { checkDatabaseConnection, pool } = await import('./db');
 
  const dbOk = await checkDatabaseConnection();
  if (!dbOk) {
    console.error(`
╔══════════════════════════════════════════════╗
║  ❌ workshop-service: DB connection failed   ║
╠══════════════════════════════════════════════╣
║  Cannot reach PostgreSQL at:                 ║
║    host: ${process.env.POSTGRES_HOST ?? 'localhost'}
║    db:   ${process.env.POSTGRES_DB ?? '?'}
║                                              ║
║  Make sure you have run:                     ║
║    ./run-auth-migration.sh                   ║
║    npm run db:migrate --workspace=apps/workshop-service
╚══════════════════════════════════════════════╝
    `);
    process.exit(1);
  }
 
  // ── Check the workshops table exists (migration ran) ────────
  try {
    const client = await pool.connect();
    await client.query('SELECT 1 FROM workshops LIMIT 1');
    client.release();
  } catch (err: any) {
    if (err.code === '42P01') {
      // 42P01 = "relation does not exist" — migration not run
      console.error(`
╔══════════════════════════════════════════════╗
║  ❌ workshop-service: migration not run      ║
╠══════════════════════════════════════════════╣
║  The "workshops" table does not exist.       ║
║  Run the migration first:                    ║
║                                              ║
║    npm run db:generate \\                    ║
║      --workspace=apps/workshop-service       ║
║    npm run db:migrate \\                     ║
║      --workspace=apps/workshop-service       ║
╚══════════════════════════════════════════════╝
      `);
      process.exit(1);
    }
    // Other DB errors (permissions etc) — log and continue
    console.warn('[workshop-service] DB check warning:', err.message);
  }
  // ── End DB readiness check ────────────────────────────────
 
  try {
    await server.listen({ port: env.PORT, host: '0.0.0.0' });
    console.log('✅ workshop-service listening on port', env.PORT);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }

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