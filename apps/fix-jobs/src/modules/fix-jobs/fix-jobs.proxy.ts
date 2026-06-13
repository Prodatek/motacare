import type { FastifyInstance } from 'fastify';
import { env } from '../../config/env';
import { proxyRequest } from './auth.proxy';

// ============================================================
// FIX JOBS PROXY — routes all /fix-jobs/* to fix-jobs service
// ============================================================

export async function registerFixJobsProxy(fastify: FastifyInstance) {
  const up = env.FIX_JOBS_SERVICE_URL;
  const tag: any = { schema: { tags: ['Fix Jobs'], security: [{ bearerAuth: [] }] } };

  // Core CRUD
  fastify.post('/fix-jobs',    { onRequest: [fastify.requireRole('FIXER', 'ADMIN')], ...tag },
    (req, rep) => proxyRequest(req, rep, `${up}/fix-jobs`, 'POST'));

  fastify.get('/fix-jobs',     { onRequest: [fastify.authenticate], ...tag },
    (req, rep) => {
      const q = new URLSearchParams(req.query as any).toString();
      return proxyRequest(req, rep, `${up}/fix-jobs${q ? `?${q}` : ''}`, 'GET');
    });

  fastify.get('/fix-jobs/:id', { onRequest: [fastify.authenticate], ...tag },
    (req, rep) => proxyRequest(req, rep, `${up}/fix-jobs/${(req.params as any).id}`, 'GET'));

  fastify.patch('/fix-jobs/:id', { onRequest: [fastify.requireRole('FIXER', 'ADMIN')], ...tag },
    (req, rep) => proxyRequest(req, rep, `${up}/fix-jobs/${(req.params as any).id}`, 'PATCH'));

  // Cancel — any authenticated user (owner or fixer)
  fastify.post('/fix-jobs/:id/cancel', { onRequest: [fastify.authenticate], ...tag },
    (req, rep) => proxyRequest(req, rep, `${up}/fix-jobs/${(req.params as any).id}/cancel`, 'POST'));

  // Parts
  fastify.post('/fix-jobs/:id/parts', { onRequest: [fastify.requireRole('FIXER', 'ADMIN')], ...tag },
    (req, rep) => proxyRequest(req, rep, `${up}/fix-jobs/${(req.params as any).id}/parts`, 'POST'));

  fastify.delete('/fix-jobs/:id/parts/:index', { onRequest: [fastify.requireRole('FIXER', 'ADMIN')], ...tag },
    (req, rep) => proxyRequest(req, rep, `${up}/fix-jobs/${(req.params as any).id}/parts/${(req.params as any).index}`, 'DELETE'));

  // History
  fastify.get('/fix-jobs/:id/history', { onRequest: [fastify.authenticate], ...tag },
    (req, rep) => proxyRequest(req, rep, `${up}/fix-jobs/${(req.params as any).id}/history`, 'GET'));
}