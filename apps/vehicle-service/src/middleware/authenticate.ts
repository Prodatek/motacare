import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

// ============================================================
// AUTHENTICATE MIDDLEWARE
// Same pattern as auth-service but this service ONLY verifies
// tokens — it never issues them. The JWT_SECRET must match
// the auth-service secret exactly (shared via environment).
// ============================================================

export async function registerAuthMiddleware(fastify: FastifyInstance) {
  // Basic JWT verification — attached to any protected route
  fastify.decorate(
    'authenticate',
    async function (request: FastifyRequest, reply: FastifyReply) {
      try {
        await request.jwtVerify();
      } catch {
        return reply.status(401).send({
          statusCode: 401,
          error: 'Unauthorized',
          message: 'Access token is missing or invalid',
        });
      }
    },
  );

  // Role-based guard factory
  // Usage: { onRequest: [fastify.requireRole('OWNER', 'ADMIN')] }
  fastify.decorate(
    'requireRole',
    function (...roles: string[]) {
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
        } catch {
          return reply.status(401).send({
            statusCode: 401,
            error: 'Unauthorized',
            message: 'Access token is missing or invalid',
          });
        }
      };
    },
  );
}