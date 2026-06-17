import type { FastifyInstance } from 'fastify';
import { env } from '../config/env';
import { proxyRequest } from './auth.proxy';
 
export async function registerWorkshopProxy(fastify: FastifyInstance) {
  const up  = env.WORKSHOP_SERVICE_URL;
  const tag = { schema: { tags: ['Workshops'], security: [{ bearerAuth: [] }] } };
  const pub = { schema: { tags: ['Workshops'] } };
 
  // Public routes
  fastify.get('/workshops',             pub, (req, rep) => {
    const q = new URLSearchParams(req.query as any).toString();
    return proxyRequest(req, rep, `${up}/workshops${q ? `?${q}` : ''}`, 'GET');
  });
  fastify.get('/workshops/featured',    pub, (req, rep) => proxyRequest(req, rep, `${up}/workshops/featured`, 'GET'));
  fastify.get('/workshops/slug/:slug',  pub, (req: any, rep) => proxyRequest(req, rep, `${up}/workshops/slug/${req.params.slug}`, 'GET'));
  fastify.get('/workshops/:id',         pub, (req: any, rep) => proxyRequest(req, rep, `${up}/workshops/${req.params.id}`, 'GET'));
 
  // Auth required
  fastify.post('/workshops',            { onRequest: [fastify.requireRole('FIXER','WORKSHOP_ADMIN','ADMIN')], ...tag },
    (req, rep) => proxyRequest(req, rep, `${up}/workshops`, 'POST'));
 
  fastify.post('/workshops/join',       { onRequest: [fastify.requireRole('FIXER','WORKSHOP_ADMIN','ADMIN')], ...tag },
    (req, rep) => proxyRequest(req, rep, `${up}/workshops/join`, 'POST'));
 
  fastify.post('/workshops/:id/leave',  { onRequest: [fastify.authenticate], ...tag },
    (req: any, rep) => proxyRequest(req, rep, `${up}/workshops/${req.params.id}/leave`, 'POST'));
 
  fastify.patch('/workshops/:id',       { onRequest: [fastify.requireRole('WORKSHOP_ADMIN','ADMIN')], ...tag },
    (req: any, rep) => proxyRequest(req, rep, `${up}/workshops/${req.params.id}`, 'PATCH'));
 
  fastify.get('/workshops/:id/members/pending', { onRequest: [fastify.requireRole('WORKSHOP_ADMIN','ADMIN')], ...tag },
    (req: any, rep) => proxyRequest(req, rep, `${up}/workshops/${req.params.id}/members/pending`, 'GET'));
 
  fastify.post('/workshops/:id/members/:memberId', { onRequest: [fastify.requireRole('WORKSHOP_ADMIN','ADMIN')], ...tag },
    (req: any, rep) => proxyRequest(req, rep, `${up}/workshops/${req.params.id}/members/${req.params.memberId}`, 'POST'));
 
  fastify.get('/workshops/:id/stats',   { onRequest: [fastify.requireRole('WORKSHOP_ADMIN','ADMIN')], ...tag },
    (req: any, rep) => {
      const q = new URLSearchParams(req.query as any).toString();
      return proxyRequest(req, rep, `${up}/workshops/${req.params.id}/stats${q ? `?${q}` : ''}`, 'GET');
    });
}