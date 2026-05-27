import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

export async function registerAuthMiddleware(fastify: FastifyInstance) {
  fastify.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    try { await request.jwtVerify(); }
    catch { return reply.status(401).send({ statusCode: 401, error: 'Unauthorized', message: 'Access token is missing or invalid' }); }
  });

  fastify.decorate('optionalAuth', async (request: FastifyRequest, _reply: FastifyReply) => {
    try { await request.jwtVerify(); } catch { /* anonymous */ }
  });

  fastify.decorate('requireRole', function (...roles: string[]) {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        await request.jwtVerify();
        const user = request.user as { sub: string; role: string };
        if (!roles.includes(user.role)) {
          return reply.status(403).send({ statusCode: 403, error: 'Forbidden', message: `Requires one of: ${roles.join(', ')}` });
        }
      } catch {
        return reply.status(401).send({ statusCode: 401, error: 'Unauthorized', message: 'Access token is missing or invalid' });
      }
    };
  });
}