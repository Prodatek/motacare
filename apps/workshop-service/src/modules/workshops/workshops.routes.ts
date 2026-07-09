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

  fastify.get('/workshops/internal/stats', { schema: { hide: true } }, async (_request, reply) => {
    const { count, sql } = await import('drizzle-orm');
    const { db } = await import('../../db');
    const { workshops } = await import('../../db/schema');
 
    const [row] = await db.select({
      total:           count(workshops.id),
      active:          sql<number>`COUNT(*) FILTER (WHERE status = 'ACTIVE')`,
      pendingApproval: sql<number>`COUNT(*) FILTER (WHERE status = 'PENDING_APPROVAL')`,
      totalViews:      sql<number>`COALESCE(SUM(view_count), 0)`,
    }).from(workshops);
 
    return reply.status(200).send({
      statusCode: 200,
      data: {
        total:           Number(row?.total ?? 0),
        active:          Number(row?.active ?? 0),
        pendingApproval: Number(row?.pendingApproval ?? 0),
        totalViews:      Number(row?.totalViews ?? 0),
      },
    });
  });
 
  // Internal featured/status management endpoints (called by admin-service)
  fastify.post('/workshops/internal/:id/featured', { schema: { hide: true } }, async (request: any, reply) => {
    const { featured } = request.body as { featured: boolean };
    const { eq } = await import('drizzle-orm');
    const { db } = await import('../../db');
    const { workshops } = await import('../../db/schema');
    await db.update(workshops).set({ featured, updatedAt: new Date() }).where(eq(workshops.id, request.params.id));
    return reply.status(200).send({ statusCode: 200, message: 'Featured status updated' });
  });
 
  fastify.post('/workshops/internal/:id/status', { schema: { hide: true } }, async (request: any, reply) => {
    const { status } = request.body as { status: 'ACTIVE' | 'SUSPENDED' };
    const { eq } = await import('drizzle-orm');
    const { db } = await import('../../db');
    const { workshops } = await import('../../db/schema');
    await db.update(workshops).set({ status, updatedAt: new Date() }).where(eq(workshops.id, request.params.id));
    return reply.status(200).send({ statusCode: 200, message: `Workshop ${status.toLowerCase()}` });
  });
}