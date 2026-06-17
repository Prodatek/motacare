import type { FastifyInstance } from 'fastify';
import { WorkshopController } from './workshops.controller';
import { WorkshopService } from './workshops.service';

// ============================================================
// WORKSHOP ROUTES — prefix /workshops
//
// Role matrix:
//   PUBLIC        — list, featured, get by slug, get by id
//   FIXER         — create workshop, join request, leave
//   WORKSHOP_ADMIN — update, approve/reject members, stats
//   ADMIN (system) — all of the above + featured management
// ============================================================

export async function workshopRoutes(fastify: FastifyInstance) {
  const service = new WorkshopService();
  const ctrl    = new WorkshopController(service);

  const auth       = { onRequest: [fastify.authenticate] };
  const fixerOnly  = { onRequest: [fastify.requireRole('FIXER', 'WORKSHOP_ADMIN', 'ADMIN')] };
  const adminOnly  = { onRequest: [fastify.requireRole('WORKSHOP_ADMIN', 'ADMIN')] };
  const tag        = { schema: { tags: ['Workshops'], security: [{ bearerAuth: [] }] } };
  const pubTag     = { schema: { tags: ['Workshops'] } };

  // ── Public ──────────────────────────────────────────────
  fastify.get('/',               pubTag,  (req, rep) => ctrl.list(req, rep));
  fastify.get('/featured',       pubTag,  (req, rep) => ctrl.listFeatured(req, rep));
  fastify.get('/slug/:slug',     pubTag,  (req: any, rep) => ctrl.getBySlug(req, rep));
  fastify.get('/:id',            pubTag,  (req: any, rep) => ctrl.getOne(req, rep));

  // ── Fixer actions ────────────────────────────────────────
  fastify.post('/',       { ...fixerOnly, ...tag }, (req, rep) => ctrl.create(req, rep));
  fastify.post('/join',   { ...fixerOnly, ...tag }, (req, rep) => ctrl.join(req, rep));
  fastify.post('/:id/leave', { ...fixerOnly, ...tag }, (req: any, rep) => ctrl.leave(req, rep));

  // ── Workshop admin actions ───────────────────────────────
  fastify.patch('/:id',                          { ...adminOnly, ...tag }, (req: any, rep) => ctrl.update(req, rep));
  fastify.get('/:id/members/pending',            { ...adminOnly, ...tag }, (req: any, rep) => ctrl.getPending(req, rep));
  fastify.post('/:id/members/:memberId',         { ...adminOnly, ...tag }, (req: any, rep) => ctrl.handleMember(req, rep));
  fastify.get('/:id/stats',                      { ...adminOnly, ...tag }, (req: any, rep) => ctrl.getStats(req, rep));

  // ── Internal (no JWT — other services only) ──────────────
  fastify.get('/internal/fixer/:fixerId', (req: any, rep) => ctrl.getFixerWorkshop(req, rep));
}