import type { FastifyInstance } from 'fastify';
import { env } from '../config/env';
import { proxyRequest } from './auth.proxy';

// ============================================================
// FIX JOBS PROXY
// Routes /fix-jobs/* to the dedicated fix-jobs service.
// The inspection proxy handled fix-jobs before this service
// existed — this now takes over as the canonical handler.
// ============================================================

export async function registerFixJobsProxy(fastify: FastifyInstance) {

  // POST /fix-jobs — create (FIXER only)
  fastify.post('/fix-jobs', {
    onRequest: [fastify.requireRole('FIXER', 'ADMIN')],
    schema: { tags: ['Fix Jobs'], summary: 'Create a new fix job', security: [{ bearerAuth: [] }] },
  }, async (request, reply) => {
    return proxyRequest(request, reply, `${env.FIX_JOBS_SERVICE_URL}/fix-jobs`, 'POST');
  });

  // GET /fix-jobs — list (role-scoped)
  fastify.get('/fix-jobs', {
    onRequest: [fastify.authenticate],
    schema: { tags: ['Fix Jobs'], summary: 'List fix jobs', security: [{ bearerAuth: [] }] },
  }, async (request, reply) => {
    const query = new URLSearchParams(request.query as any).toString();
    return proxyRequest(request, reply, `${env.FIX_JOBS_SERVICE_URL}/fix-jobs${query ? `?${query}` : ''}`, 'GET');
  });

  // GET /fix-jobs/:id — single job with history
  fastify.get('/fix-jobs/:id', {
    onRequest: [fastify.authenticate],
    schema: { tags: ['Fix Jobs'], summary: 'Get a fix job with status history', security: [{ bearerAuth: [] }] },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    return proxyRequest(request, reply, `${env.FIX_JOBS_SERVICE_URL}/fix-jobs/${id}`, 'GET');
  });

  // PATCH /fix-jobs/:id — update (FIXER only)
  fastify.patch('/fix-jobs/:id', {
    onRequest: [fastify.requireRole('FIXER', 'ADMIN')],
    schema: { tags: ['Fix Jobs'], summary: 'Update fix job status or details', security: [{ bearerAuth: [] }] },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    return proxyRequest(request, reply, `${env.FIX_JOBS_SERVICE_URL}/fix-jobs/${id}`, 'PATCH');
  });

  // GET /fix-jobs/:id/history — status audit log
  fastify.get('/fix-jobs/:id/history', {
    onRequest: [fastify.authenticate],
    schema: { tags: ['Fix Jobs'], summary: 'Get fix job status change history', security: [{ bearerAuth: [] }] },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    return proxyRequest(request, reply, `${env.FIX_JOBS_SERVICE_URL}/fix-jobs/${id}/history`, 'GET');
  });
}