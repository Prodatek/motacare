import 'fastify';
import type { FastifyRequest, FastifyReply } from 'fastify';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void>;
    optionalAuth(request: FastifyRequest, reply: FastifyReply): Promise<void>;
    requireRole(...roles: string[]): (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }

  interface FastifyRequest {
    user: {
      sub: string;
      role: string;
      iat: number;
      exp: number;
    };
  }
}