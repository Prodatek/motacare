import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

// ============================================================
// REQUEST LOGGER
// Logs every request that passes through the gateway with:
//   - method, path, status code, response time
//   - authenticated user ID (if present)
//   - upstream service that handled it
//   - client IP
//
// In production these logs are picked up by the Loki agent.
// In development pino-pretty formats them for readability.
// ============================================================

export async function registerRequestLogger(fastify: FastifyInstance) {
  // Log when request comes in
  fastify.addHook('onRequest', async (request: FastifyRequest) => {
    request.log.info({
      event: 'request_received',
      method: request.method,
      url: request.url,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });
  });

  // Log when response goes out — includes timing and status
  fastify.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    // Try to extract userId from JWT if present (best effort — don't block)
    let userId: string | undefined;
    try {
      const user = request.user as { sub?: string } | undefined;
      userId = user?.sub;
    } catch {
      // No token — anonymous request
    }

    const responseTime = reply.elapsedTime;

    request.log.info({
      event: 'request_completed',
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      responseTimeMs: Math.round(responseTime),
      userId,
      ip: request.ip,
    });

    // Warn on slow responses (>3s) — useful for identifying bottlenecks
    if (responseTime > 3000) {
      request.log.warn({
        event: 'slow_request',
        method: request.method,
        url: request.url,
        responseTimeMs: Math.round(responseTime),
        threshold: 3000,
      });
    }
  });

  // Log errors that bubble up to the gateway level
  fastify.addHook('onError', async (request: FastifyRequest, _reply: FastifyReply, error: Error) => {
    request.log.error({
      event: 'gateway_error',
      method: request.method,
      url: request.url,
      error: error.message,
      stack: error.stack,
    });
  });
}