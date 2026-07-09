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

  // typed as `any` because Fastify's RouteShorthandOptions.schema expects
  // a `FastifySchema` shape; these OpenAPI-only fields (tags/security)
  // are accepted at runtime but not part of the FastifySchema type.
  const tag: any = { schema: { tags: ['Fix Jobs'], security: [{ bearerAuth: [] }] } };

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


// ============================================================
// WORKSHOP PATCH
// ============================================================

  fastify.post('/internal/stats', async (request, reply) => {
    const { fixerIds, from, to } = request.body as {
      fixerIds: string[];
      from: string;
      to: string;
    };

    if (!fixerIds?.length) {
      return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'fixerIds required' });
    }

    const { inArray, gte, lte, and, count, sum, avg, sql } = await import('drizzle-orm');
    const { db } = await import('../../db');
    const { fixJobs } = await import('../../db/schema');

    const fromDate = new Date(from);
    const toDate   = new Date(to);

    // Per-fixer aggregates
    const rows = await db
      .select({
        fixerId:       fixJobs.fixerId,
        total:         count(fixJobs.id),
        completed:     sql<number>`SUM(CASE WHEN ${fixJobs.status} = 'COMPLETED' THEN 1 ELSE 0 END)`,
        delivered:     sql<number>`SUM(CASE WHEN ${fixJobs.status} = 'DELIVERED' THEN 1 ELSE 0 END)`,
        revenue:       sql<number>`COALESCE(SUM(CASE WHEN ${fixJobs.status} = 'DELIVERED' THEN CAST(${fixJobs.finalCost} AS NUMERIC) ELSE 0 END), 0)`,
        avgDurationMs: sql<number>`AVG(EXTRACT(EPOCH FROM (${fixJobs.actualCompletionAt} - ${fixJobs.createdAt})) * 1000) FILTER (WHERE ${fixJobs.actualCompletionAt} IS NOT NULL)`,
      })
      .from(fixJobs)
      .where(and(
        inArray(fixJobs.fixerId, fixerIds),
        gte(fixJobs.createdAt, fromDate),
        lte(fixJobs.createdAt, toDate),
      ))
      .groupBy(fixJobs.fixerId);

    const overall = rows.reduce(
      (acc, r) => ({
        total:     acc.total     + Number(r.total),
        completed: acc.completed + Number(r.completed),
        delivered: acc.delivered + Number(r.delivered),
        totalRevenue: acc.totalRevenue + Number(r.revenue),
      }),
      { total: 0, completed: 0, delivered: 0, totalRevenue: 0 },
    );

    const byFixer = Object.fromEntries(
      rows.map((r) => [r.fixerId, {
        total:              Number(r.total),
        completed:          Number(r.completed),
        delivered:          Number(r.delivered),
        revenue:            Number(r.revenue),
        avgDurationHours:   r.avgDurationMs ? Number(r.avgDurationMs) / 1000 / 3600 : null,
      }]),
    );

    // Weekly trend — jobs and revenue grouped by ISO week
    const trend = await db.execute(sql`
      SELECT
        date_trunc('week', created_at)::date AS week,
        COUNT(*)::int AS fix_jobs,
        COALESCE(SUM(CASE WHEN status = 'DELIVERED' THEN CAST(final_cost AS NUMERIC) ELSE 0 END), 0)::numeric AS revenue
      FROM fix_jobs
      WHERE fixer_id = ANY(${fixerIds}::uuid[])
        AND created_at >= ${fromDate}
        AND created_at <= ${toDate}
      GROUP BY date_trunc('week', created_at)
      ORDER BY week ASC
    `);

    return reply.status(200).send({
      statusCode: 200,
      data: {
        ...overall,
        byFixer,
        trend: trend.rows.map((r: any) => ({
          week:     r.week,
          fixJobs:  Number(r.fix_jobs),
          revenue:  Number(r.revenue),
        })),
      },
    });
  });


  // ============================================================
//INTERNAL ROUTES (no JWT, internal Docker network only)
//
// These internal endpoints are called by crm-service and
// admin-service. No JWT — internal Docker network only.
// ============================================================

  // ── GET UNIQUE CUSTOMERS FOR A FIXER ──────────────────────
  // Returns aggregated customer list: unique ownerIds with
  // total fix jobs, spend, and last visit date.
  fastify.get('/fix-jobs/internal/customers', async (request, reply) => {
    const { fixerId, limit = '20', sort = 'lastVisitAt:desc' } = request.query as any;
    if (!fixerId) return reply.status(400).send({ statusCode: 400, message: 'fixerId required' });

    const { eq, desc, sql, sum, count, max, min } = await import('drizzle-orm');
    const { db } = await import('../../db');
    const { fixJobs } = await import('../../db/schema');

    const rows = await db
      .select({
        ownerId:      fixJobs.ownerId,
        totalFixJobs: count(fixJobs.id),
        totalRevenue: sql<number>`COALESCE(SUM(CASE WHEN ${fixJobs.status} = 'DELIVERED' THEN CAST(${fixJobs.finalCost} AS NUMERIC) ELSE 0 END), 0)`,
        lastVisitAt:  sql<string>`MAX(${fixJobs.updatedAt})`,
        firstVisitAt: sql<string>`MIN(${fixJobs.createdAt})`,
        vehicleHashes: sql<string[]>`ARRAY_AGG(DISTINCT ${fixJobs.vehicleHash})`,
      })
      .from(fixJobs)
      .where(eq(fixJobs.fixerId, fixerId))
      .groupBy(fixJobs.ownerId)
      .orderBy(sql`MAX(${fixJobs.updatedAt}) DESC`)
      .limit(Number(limit));

    return reply.status(200).send({
      statusCode: 200,
      data: { customers: rows.map((r) => ({
        ownerId:      r.ownerId,
        totalFixJobs: Number(r.totalFixJobs),
        totalSpend:   Number(r.totalRevenue),
        lastVisitAt:  r.lastVisitAt,
        firstVisitAt: r.firstVisitAt,
        vehicleHashes: r.vehicleHashes,
      })) },
    });
  });

  // ── GET FULL CUSTOMER HISTORY FOR A FIXER ─────────────────
  // Used by crm-service to populate a customer's profile page.
  fastify.post('/fix-jobs/internal/customer-history', async (request, reply) => {
    const { fixerId, ownerId } = request.body as { fixerId: string; ownerId: string };
    if (!fixerId || !ownerId) return reply.status(400).send({ statusCode: 400, message: 'fixerId and ownerId required' });

    const { eq, and, desc, sql, count } = await import('drizzle-orm');
    const { db } = await import('../../db');
    const { fixJobs } = await import('../../db/schema');

    const [stats, jobs] = await Promise.all([
      db.select({
        total:        count(fixJobs.id),
        totalRevenue: sql<number>`COALESCE(SUM(CASE WHEN ${fixJobs.status} = 'DELIVERED' THEN CAST(${fixJobs.finalCost} AS NUMERIC) ELSE 0 END), 0)`,
        lastVisitAt:  sql<string>`MAX(${fixJobs.updatedAt})`,
        firstVisitAt: sql<string>`MIN(${fixJobs.createdAt})`,
        vehicleHashes: sql<string[]>`ARRAY_AGG(DISTINCT ${fixJobs.vehicleHash})`,
      })
      .from(fixJobs)
      .where(and(eq(fixJobs.fixerId, fixerId), eq(fixJobs.ownerId, ownerId))),

      db.select()
        .from(fixJobs)
        .where(and(eq(fixJobs.fixerId, fixerId), eq(fixJobs.ownerId, ownerId)))
        .orderBy(desc(fixJobs.createdAt))
        .limit(50),
    ]);

    const [agg] = stats;

    return reply.status(200).send({
      statusCode: 200,
      data: {
        total:         Number(agg?.total ?? 0),
        totalRevenue:  Number(agg?.totalRevenue ?? 0),
        lastVisitAt:   agg?.lastVisitAt ?? null,
        firstVisitAt:  agg?.firstVisitAt ?? null,
        vehicleHashes: agg?.vehicleHashes ?? [],
        jobs,
      },
    });
  });

  // ── PLATFORM STATS (admin-service) ────────────────────────
  fastify.get('/fix-jobs/internal/stats', async (request, reply) => {
    const { from } = request.query as { from?: string };

    const { sql, gte, count } = await import('drizzle-orm');
    const { db } = await import('../../db');
    const { fixJobs } = await import('../../db/schema');

    const conditions: any[] = [];
    if (from) conditions.push(gte(fixJobs.createdAt, new Date(from)));
    const where = conditions.length > 0 ? conditions[0] : undefined;

    const [allTime] = await db.select({ value: count() }).from(fixJobs);
    const [periodStats] = await db.select({
      total:        count(fixJobs.id),
      completed:    sql<number>`SUM(CASE WHEN ${fixJobs.status} = 'COMPLETED' THEN 1 ELSE 0 END)`,
      delivered:    sql<number>`SUM(CASE WHEN ${fixJobs.status} = 'DELIVERED' THEN 1 ELSE 0 END)`,
      totalRevenue: sql<number>`COALESCE(SUM(CASE WHEN ${fixJobs.status} = 'DELIVERED' THEN CAST(${fixJobs.finalCost} AS NUMERIC) ELSE 0 END), 0)`,
    }).from(fixJobs).where(where);

    return reply.status(200).send({
      statusCode: 200,
      data: {
        allTime:     Number(allTime?.value ?? 0),
        total:       Number(periodStats?.total ?? 0),
        completed:   Number(periodStats?.completed ?? 0),
        delivered:   Number(periodStats?.delivered ?? 0),
        totalRevenue: Number(periodStats?.totalRevenue ?? 0),
      },
    });
  });

}