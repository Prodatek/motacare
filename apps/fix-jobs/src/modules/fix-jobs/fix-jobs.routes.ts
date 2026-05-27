import type { FastifyInstance } from 'fastify';
import { FixJobController } from './fix-jobs.controller';
import { FixJobService } from './fix-jobs.service';

// ============================================================
// FIX JOB ROUTES
// Prefix: /fix-jobs (set in main.ts)
//
// Role matrix:
//   FIXER  — create, update status, add repair notes
//   OWNER  — read their own jobs
//   ADMIN  — full access
// ============================================================

export async function fixJobRoutes(fastify: FastifyInstance) {
  const service = new FixJobService();
  const controller = new FixJobController(service);

  const auth = { onRequest: [fastify.authenticate] };
  const fixerOrAdmin = { onRequest: [fastify.requireRole('FIXER', 'ADMIN')] };

  // POST /fix-jobs — create a new fix job
  fastify.post('/', {
    ...fixerOrAdmin,
    schema: { tags: ['Fix Jobs'], summary: 'Create a new fix job', security: [{ bearerAuth: [] }] },
  }, (req, rep) => controller.create(req, rep));

  // GET /fix-jobs — list jobs (scoped to caller's role)
  fastify.get('/', {
    ...auth,
    schema: { tags: ['Fix Jobs'], summary: 'List fix jobs for the authenticated user', security: [{ bearerAuth: [] }] },
  }, (req, rep) => controller.list(req, rep));

  // GET /fix-jobs/:id — get a single job with status history
  fastify.get('/:id', {
    ...auth,
    schema: { tags: ['Fix Jobs'], summary: 'Get a fix job with full status history', security: [{ bearerAuth: [] }] },
  }, (req, rep) => controller.getOne(req as any, rep));

  // PATCH /fix-jobs/:id — update status, cost, notes
  fastify.patch('/:id', {
    ...fixerOrAdmin,
    schema: { tags: ['Fix Jobs'], summary: 'Update fix job status or details', security: [{ bearerAuth: [] }] },
  }, (req, rep) => controller.update(req as any, rep));

  // GET /fix-jobs/:id/history — full status change log
  fastify.get('/:id/history', {
    ...auth,
    schema: { tags: ['Fix Jobs'], summary: 'Get fix job status history', security: [{ bearerAuth: [] }] },
  }, (req, rep) => controller.getHistory(req as any, rep));
}