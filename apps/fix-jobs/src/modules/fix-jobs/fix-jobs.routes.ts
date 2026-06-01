import type { FastifyInstance } from 'fastify';
import { FixJobController } from './fix-jobs.controller';
import { FixJobService } from './fix-jobs.service';

// ============================================================
// FIX JOB ROUTES
// Prefix: /fix-jobs (set in main.ts)
//
// Role matrix:
//   FIXER  — create, update, add/remove parts, cancel
//   OWNER  — read own jobs, cancel own job
//   ADMIN  — full access
// ============================================================

export async function fixJobRoutes(fastify: FastifyInstance) {
  const service = new FixJobService();
  const controller = new FixJobController(service);

  const auth        = { onRequest: [fastify.authenticate] };
  const fixerAdmin  = { onRequest: [fastify.requireRole('FIXER', 'ADMIN')] };
  const allRoles    = { onRequest: [fastify.authenticate] }; // owner + fixer + admin

  const tag = { schema: { tags: ['Fix Jobs'], security: [{ bearerAuth: [] }] } };

  // Core CRUD
  fastify.post('/',    { ...fixerAdmin, ...tag }, (req, rep) => controller.create(req, rep));
  fastify.get('/',    { ...allRoles, ...tag },    (req, rep) => controller.list(req, rep));
  fastify.get('/:id', { ...allRoles, ...tag },    (req: any, rep) => controller.getOne(req, rep));
  fastify.patch('/:id', { ...fixerAdmin, ...tag },(req: any, rep) => controller.update(req, rep));

  // Cancel — both owner and fixer can cancel
  fastify.post('/:id/cancel', { ...allRoles, ...tag }, (req: any, rep) => controller.cancel(req, rep));

  // Parts management (fixer only)
  fastify.post('/:id/parts',         { ...fixerAdmin, ...tag }, (req: any, rep) => controller.addPart(req, rep));
  fastify.delete('/:id/parts/:index', { ...fixerAdmin, ...tag }, (req: any, rep) => controller.removePart(req, rep));

  // Status history audit log
  fastify.get('/:id/history', { ...allRoles, ...tag }, (req: any, rep) => controller.getHistory(req, rep));
}