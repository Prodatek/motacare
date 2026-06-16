import Fastify from 'fastify';
import fastifyHelmet from '@fastify/helmet';
import fastifyCors from '@fastify/cors';
import { env } from './config/env';
import { redisConnection, fixJobAlertsQueue, emailQueue } from './queues';
import { alertWorker, emailWorker } from './workers';

// ============================================================
// ALERT SERVICE ENTRY POINT
//
// This service has two responsibilities:
//  1. Expose an HTTP endpoint so other services can schedule
//     and cancel alerts (POST /alerts/schedule, DELETE /alerts/:jobId)
//  2. Run BullMQ workers that process the alert and email queues
// ============================================================

async function buildServer() {
  const fastify = Fastify({
    logger: {
      level: env.NODE_ENV === 'production' ? 'warn' : 'info',
      transport: env.NODE_ENV === 'development'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
    },
  });

  await fastify.register(fastifyHelmet);
  await fastify.register(fastifyCors, { origin: false }); // Internal service only

  // ----------------------------------------------------------
  // HEALTH CHECK
  // ----------------------------------------------------------

  fastify.get('/health', async (_req, reply) => {
    const redisOk = redisConnection.status === 'ready';
    return reply.status(redisOk ? 200 : 503).send({
      status: redisOk ? 'ok' : 'degraded',
      service: 'alert-service',
      timestamp: new Date().toISOString(),
      redis: redisOk ? 'connected' : 'unreachable',
      workers: {
        alert: alertWorker.isRunning() ? 'running' : 'stopped',
        email: emailWorker.isRunning() ? 'running' : 'stopped',
      },
    });
  });

  // ----------------------------------------------------------
  // SCHEDULE ALERTS — called by fix-jobs service when a job
  // is created or its estimated completion time changes
  // ----------------------------------------------------------

  fastify.post('/alerts/schedule', async (request, reply) => {
    const body = request.body as {
      fixJobId: string;
      estimatedCompletionAt: string;
      vehicleHash: string;
      fixerId: string;
      ownerId: string;
      description: string;
    };

    if (!body.fixJobId || !body.estimatedCompletionAt) {
      return reply.status(400).send({ error: 'fixJobId and estimatedCompletionAt are required' });
    }

    const { scheduleFixJobAlerts } = await import('./queues');
    await scheduleFixJobAlerts(
      body.fixJobId,
      new Date(body.estimatedCompletionAt),
      {
        fixJobId: body.fixJobId,
        vehicleHash: body.vehicleHash,
        fixerId: body.fixerId,
        ownerId: body.ownerId,
        description: body.description,
        estimatedCompletionAt: body.estimatedCompletionAt,
      },
    );

    return reply.status(200).send({ message: 'Alerts scheduled' });
  });

  // ----------------------------------------------------------
  // CANCEL ALERTS — called when a fix job is completed early
  // or cancelled, so alerts don't fire unnecessarily
  // ----------------------------------------------------------

  fastify.delete('/alerts/:fixJobId', async (request, reply) => {
    const { fixJobId } = request.params as { fixJobId: string };
    const { removeFixJobAlerts } = await import('./queues');
    await removeFixJobAlerts(fixJobId);
    return reply.status(200).send({ message: 'Alerts cancelled' });
  });

  // ----------------------------------------------------------
  // QUEUE STATS — useful for monitoring dashboards
  // ----------------------------------------------------------

  fastify.get('/stats', async (_req, reply) => {
    const [alertCounts, emailCounts] = await Promise.all([
      fixJobAlertsQueue.getJobCounts('waiting', 'delayed', 'active', 'failed'),
      emailQueue.getJobCounts('waiting', 'active', 'failed'),
    ]);

    return reply.send({
      queues: {
        fixJobAlerts: alertCounts,
        email: emailCounts,
      },
    });
  });

  return fastify;
}

async function start() {
  const server = await buildServer();

  try {
    await server.listen({ port: env.PORT, host: '0.0.0.0' });
    console.log(`
╔══════════════════════════════════════════╗
║     🔔 Motacare Alert Service            ║
╠══════════════════════════════════════════╣
║  Port    : ${env.PORT}                        ║
║  Env     : ${env.NODE_ENV.padEnd(14)}         ║
║  Health  : http://localhost:${env.PORT}/health║
╠══════════════════════════════════════════╣
║  Workers: alert ✓  email ✓               ║
╚══════════════════════════════════════════╝
    `);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[alert-service] Shutting down gracefully...');
  await Promise.all([alertWorker.close(), emailWorker.close()]);
  await redisConnection.quit();
  process.exit(0);
});

start();