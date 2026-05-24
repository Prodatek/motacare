import type { FastifyInstance } from 'fastify';
import { env } from '../config/env';
import { proxyRequest } from './auth.proxy';

// ============================================================
// INSPECTION + FIX JOB PROXY
// Routes /inspections/* and /fix-jobs/* to inspection-service.
// ============================================================

export async function registerInspectionProxy(fastify: FastifyInstance) {

  // GET /inspections/checklist — public (any authenticated user)
  fastify.get('/inspections/checklist', {
    onRequest: [fastify.authenticate],
    schema: { tags: ['Inspections'], summary: 'Get inspection checklist template', security: [{ bearerAuth: [] }] },
  }, async (request, reply) => {
    return proxyRequest(request, reply, `${env.INSPECTION_SERVICE_URL}/inspections/checklist`, 'GET');
  });

  // POST /inspections — create session (FIXER only)
  fastify.post('/inspections', {
    onRequest: [fastify.requireRole('FIXER', 'ADMIN')],
    schema: { tags: ['Inspections'], summary: 'Start a new inspection session', security: [{ bearerAuth: [] }] },
  }, async (request, reply) => {
    return proxyRequest(request, reply, `${env.INSPECTION_SERVICE_URL}/inspections`, 'POST');
  });

  // GET /inspections — list inspections
  fastify.get('/inspections', {
    onRequest: [fastify.authenticate],
    schema: { tags: ['Inspections'], summary: 'List inspections', security: [{ bearerAuth: [] }] },
  }, async (request, reply) => {
    const query = new URLSearchParams(request.query as any).toString();
    return proxyRequest(request, reply, `${env.INSPECTION_SERVICE_URL}/inspections${query ? `?${query}` : ''}`, 'GET');
  });

  // GET /inspections/:id
  fastify.get('/inspections/:id', {
    onRequest: [fastify.authenticate],
    schema: { tags: ['Inspections'], summary: 'Get inspection with checklist items', security: [{ bearerAuth: [] }] },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    return proxyRequest(request, reply, `${env.INSPECTION_SERVICE_URL}/inspections/${id}`, 'GET');
  });

  // PATCH /inspections/:id/items — update single item
  fastify.patch('/inspections/:id/items', {
    onRequest: [fastify.requireRole('FIXER', 'ADMIN')],
    schema: { tags: ['Inspections'], summary: 'Update a checklist item', security: [{ bearerAuth: [] }] },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    return proxyRequest(request, reply, `${env.INSPECTION_SERVICE_URL}/inspections/${id}/items`, 'PATCH');
  });

  // PATCH /inspections/:id/items/batch — batch update
  fastify.patch('/inspections/:id/items/batch', {
    onRequest: [fastify.requireRole('FIXER', 'ADMIN')],
    schema: { tags: ['Inspections'], summary: 'Batch update checklist items', security: [{ bearerAuth: [] }] },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    return proxyRequest(request, reply, `${env.INSPECTION_SERVICE_URL}/inspections/${id}/items/batch`, 'PATCH');
  });

  // POST /inspections/:id/complete
  fastify.post('/inspections/:id/complete', {
    onRequest: [fastify.requireRole('FIXER', 'ADMIN')],
    schema: { tags: ['Inspections'], summary: 'Complete an inspection', security: [{ bearerAuth: [] }] },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    return proxyRequest(request, reply, `${env.INSPECTION_SERVICE_URL}/inspections/${id}/complete`, 'POST');
  });

  // POST /inspections/:id/fix-jobs
  fastify.post('/inspections/:id/fix-jobs', {
    onRequest: [fastify.requireRole('FIXER', 'ADMIN')],
    schema: { tags: ['Inspections'], summary: 'Create a fix job from inspection', security: [{ bearerAuth: [] }] },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    return proxyRequest(request, reply, `${env.INSPECTION_SERVICE_URL}/inspections/${id}/fix-jobs`, 'POST');
  });

  // ──────────────────────────────────────────────────────────
  // FIX JOBS
  // ──────────────────────────────────────────────────────────

  // GET /fix-jobs
  fastify.get('/fix-jobs', {
    onRequest: [fastify.authenticate],
    schema: { tags: ['Fix Jobs'], summary: 'List fix jobs', security: [{ bearerAuth: [] }] },
  }, async (request, reply) => {
    const query = new URLSearchParams(request.query as any).toString();
    return proxyRequest(request, reply, `${env.INSPECTION_SERVICE_URL}/fix-jobs${query ? `?${query}` : ''}`, 'GET');
  });

  // GET /fix-jobs/:id
  fastify.get('/fix-jobs/:id', {
    onRequest: [fastify.authenticate],
    schema: { tags: ['Fix Jobs'], summary: 'Get a fix job', security: [{ bearerAuth: [] }] },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    return proxyRequest(request, reply, `${env.INSPECTION_SERVICE_URL}/fix-jobs/${id}`, 'GET');
  });

  // PATCH /fix-jobs/:id
  fastify.patch('/fix-jobs/:id', {
    onRequest: [fastify.requireRole('FIXER', 'ADMIN')],
    schema: { tags: ['Fix Jobs'], summary: 'Update fix job status', security: [{ bearerAuth: [] }] },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    return proxyRequest(request, reply, `${env.INSPECTION_SERVICE_URL}/fix-jobs/${id}`, 'PATCH');
  });
}