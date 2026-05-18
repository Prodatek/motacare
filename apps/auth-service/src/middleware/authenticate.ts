import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

// ============================================================
// AUTHENTICATE MIDDLEWARE
// Decorates Fastify with `fastify.authenticate`
// Usage: { onRequest: [fastify.authenticate] } on any route
// ============================================================

export async function registerAuthMiddleware(fastify: FastifyInstance) {
  fastify.decorate(
    'authenticate',
    async function (request: FastifyRequest, reply: FastifyReply) {
      try {
        await request.jwtVerify();
      } catch (err) {
        reply.status(401).send({
          statusCode: 401,
          error: 'Unauthorized',
          message: 'Access token is missing or invalid',
        });
      }
    },
  );
}

// ============================================================
// ROLE GUARD — factory that returns a middleware for a specific role
// Usage: { onRequest: [requireRole('ADMIN')] }
// ============================================================

export function requireRole(...roles: string[]) {
  return async function (request: FastifyRequest, reply: FastifyReply) {
    try {
      await request.jwtVerify();

      const user = request.user as { sub: string; role: string };
      if (!roles.includes(user.role)) {
        return reply.status(403).send({
          statusCode: 403,
          error: 'Forbidden',
          message: `This action requires one of the following roles: ${roles.join(', ')}`,
        });
      }
    } catch (err) {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Access token is missing or invalid',
      });
    }
  };
}