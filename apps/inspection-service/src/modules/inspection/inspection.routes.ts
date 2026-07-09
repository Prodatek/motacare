import { fastify, type FastifyInstance } from 'fastify';
import { InspectionController } from './inspection.controller';
import { InspectionService } from './inspection.service';

// ============================================================
// INSPECTION ROUTES
//
// Role matrix:
//   FIXER  — create inspection, update items, complete, create fix job, update fix job
//   OWNER  — read their own inspections and fix jobs
//   ADMIN  — full read/write
// ============================================================

export async function inspectionRoutes(fastify: FastifyInstance) {
  const service = new InspectionService();
  const controller = new InspectionController(service);

  const auth = { onRequest: [fastify.authenticate] };
  const fixerOrAdmin = { onRequest: [fastify.requireRole('FIXER', 'ADMIN')] };

  // ----------------------------------------------------------
  // CHECKLIST (public-ish — requires login but any role)
  // ----------------------------------------------------------

  fastify.get('/checklist', { ...auth,
    schema: { tags: ['Inspections'], summary: 'Get the full static inspection checklist', security: [{ bearerAuth: [] }] } as any,
  }, (req, rep) => controller.getChecklist(req, rep));

  // ----------------------------------------------------------
  // INSPECTION SESSIONS
  // ----------------------------------------------------------

  fastify.post('/', { ...fixerOrAdmin,
    schema: { tags: ['Inspections'], summary: 'Start a new inspection session for a vehicle', security: [{ bearerAuth: [] }] } as any,
  }, (req, rep) => controller.create(req, rep));

  fastify.get('/', { ...auth,
    schema: { tags: ['Inspections'], summary: 'List inspections (own only for OWNER/FIXER; all for ADMIN)', security: [{ bearerAuth: [] }] } as any,
  }, (req, rep) => controller.list(req, rep));

  fastify.get('/:id', { ...auth,
    schema: { tags: ['Inspections'], summary: 'Get a single inspection with all checklist items and stats', security: [{ bearerAuth: [] }] } as any,
  }, (req, rep) => controller.getOne(req as any, rep));

  // ----------------------------------------------------------
  // CHECKLIST ITEM UPDATES (fixer only)
  // ----------------------------------------------------------

  fastify.patch('/:id/items', { ...fixerOrAdmin,
    schema: { tags: ['Inspections'], summary: 'Update a single checklist item result', security: [{ bearerAuth: [] }] } as any,
  }, (req, rep) => controller.updateItem(req as any, rep));

  fastify.patch('/:id/items/batch', { ...fixerOrAdmin,
    schema: { tags: ['Inspections'], summary: 'Batch update multiple checklist items at once', security: [{ bearerAuth: [] }] } as any,
  }, (req, rep) => controller.batchUpdateItems(req as any, rep));

  // ----------------------------------------------------------
  // COMPLETE INSPECTION
  // ----------------------------------------------------------

  fastify.post('/:id/complete', { ...fixerOrAdmin,
    schema: { tags: ['Inspections'], summary: 'Mark an inspection as complete and generate summary', security: [{ bearerAuth: [] }] } as any,
  }, (req, rep) => controller.complete(req as any, rep));

  // ----------------------------------------------------------
  // FIX JOBS (created from an inspection)
  // ----------------------------------------------------------

  fastify.post('/:id/fix-jobs', { ...fixerOrAdmin,
    schema: { tags: ['Fix Jobs'], summary: 'Create a fix job from a completed inspection', security: [{ bearerAuth: [] }] } as any,
  }, (req, rep) => controller.createFixJob(req as any, rep));
}

// ============================================================
// FIX JOB ROUTES (standalone, not nested under inspection)
// ============================================================

export async function fixJobRoutes(fastify: FastifyInstance) {
  const service = new InspectionService();
  const controller = new InspectionController(service);

  const auth = { onRequest: [fastify.authenticate] };
  const fixerOrAdmin = { onRequest: [fastify.requireRole('FIXER', 'ADMIN')] };

  fastify.get('/', { ...auth,
    schema: { tags: ['Fix Jobs'], summary: 'List fix jobs for the authenticated user', security: [{ bearerAuth: [] }] } as any,
  }, (req, rep) => controller.listFixJobs(req, rep));

  fastify.get('/:id', { ...auth,
    schema: { tags: ['Fix Jobs'], summary: 'Get a single fix job', security: [{ bearerAuth: [] }] } as any,
  }, (req, rep) => controller.getFixJob(req as any, rep));

  fastify.patch('/:id', { ...fixerOrAdmin,
    schema: { tags: ['Fix Jobs'], summary: 'Update fix job status, cost, or repair notes', security: [{ bearerAuth: [] }] } as any,
  }, (req, rep) => controller.updateFixJob(req as any, rep));


// This internal endpoint is called by workshop-service to
// aggregate inspection counts per fixer over a date range.
// No JWT — internal network only.
// ============================================================
 
  fastify.post('/internal/stats', async (request, reply) => {
    const { fixerIds, from, to } = request.body as {
      fixerIds: string[];
      from: string;
      to: string;
    };
 
    if (!fixerIds?.length) {
      return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'fixerIds is required' });
    }
 
    const { inArray, gte, lte, and, eq, count, sql } = await import('drizzle-orm');
    const { db } = await import('../../db');
    const { inspections } = await import('../../db/schema');
 
    const fromDate = new Date(from);
    const toDate   = new Date(to);
 
    // Total and completed counts per fixer
    const rows = await db
      .select({
        fixerId:   inspections.fixerId,
        total:     count(inspections.id),
        completed: sql<number>`SUM(CASE WHEN ${inspections.status} IN ('COMPLETED','NEEDS_FOLLOWUP') THEN 1 ELSE 0 END)`,
      })
      .from(inspections)
      .where(and(
        inArray(inspections.fixerId, fixerIds),
        gte(inspections.createdAt, fromDate),
        lte(inspections.createdAt, toDate),
      ))
      .groupBy(inspections.fixerId);
 
    const overall = rows.reduce(
      (acc, r) => ({ total: acc.total + Number(r.total), completed: acc.completed + Number(r.completed) }),
      { total: 0, completed: 0 },
    );
 
    const byFixer = Object.fromEntries(
      rows.map((r) => [r.fixerId, { total: Number(r.total), completed: Number(r.completed) }]),
    );
 
    return reply.status(200).send({ statusCode: 200, data: { ...overall, byFixer } });
  });

}