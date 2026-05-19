import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

// ============================================================
// GATEWAY AUTHENTICATE MIDDLEWARE
//
// The gateway optionally verifies JWTs on certain routes.
// Most proxied routes rely on downstream services to verify —
// but the gateway can be a first line of defence for clearly
// unauthenticated requests (saves the round-trip downstream).
//
// authenticate     → hard block: 401 if no valid token
// optionalAuth     → soft check: extracts user if token present, proceeds either way
// requireRole      → role guard: 403 if wrong role
// ============================================================

export async function registerAuthMiddleware(fastify: FastifyInstance) {

  // Hard auth check — must have a valid JWT
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

  // Soft auth — extracts user from token if present, never blocks
  fastify.decorate(
    'optionalAuth',
    async function (request: FastifyRequest, _reply: FastifyReply) {
      try {
        await request.jwtVerify();
      } catch {
        // No token or invalid — proceed as anonymous
      }
    },
  );

  // Role guard factory
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