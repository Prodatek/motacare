import type { FastifyInstance } from 'fastify';
import { SubscriptionController } from './subscriptions.controller';
import { SubscriptionService } from './subscriptions.service';

export async function subscriptionRoutes(fastify: FastifyInstance) {
  const service = new SubscriptionService();
  const controller = new SubscriptionController(service);

  const auth = { onRequest: [fastify.authenticate] };
  const tag: any = { schema: { tags: ['Subscriptions'], security: [{ bearerAuth: [] }] } };

  // Public — no auth needed to view plans
  fastify.get('/plans', {
    schema: { tags: ['Subscriptions'], summary: 'Get all subscription plan details and pricing' } as any,
  }, (req, rep) => controller.getPlans(req, rep));

  // Protected — authenticated users only
  fastify.get('/me',       { ...auth, ...tag }, (req, rep) => controller.getMySubscription(req, rep));
  fastify.post('/checkout',{ ...auth, ...tag }, (req, rep) => controller.createCheckout(req, rep));
  fastify.post('/portal',  { ...auth, ...tag }, (req, rep) => controller.createPortal(req, rep));
  fastify.post('/cancel',  { ...auth, ...tag }, (req, rep) => controller.cancel(req, rep));

  fastify.get('/subscriptions/internal/stats', { schema: { hide: true } }, async (_request, reply) => {
    const { count, sql } = await import('drizzle-orm');
    const { db } = await import('../../db');
    const { subscriptions, PLAN_LIMITS } = await import('../../db/schema');
 
    const [row] = await db.select({
      total:   count(subscriptions.id),
      byTier:  sql<string>`json_build_object(
        'FREE',     COUNT(*) FILTER (WHERE tier = 'FREE'),
        'PRO',      COUNT(*) FILTER (WHERE tier = 'PRO'),
        'WORKSHOP', COUNT(*) FILTER (WHERE tier = 'WORKSHOP')
      )`,
    }).from(subscriptions);
 
    // Approximate MRR from active paid subscriptions
    // PRO = ₦5,000/mo, WORKSHOP = ₦15,000/mo
    const tierData = typeof row?.byTier === 'string' ? JSON.parse(row.byTier) : (row?.byTier ?? {});
    const monthlyRevenue = (tierData.PRO ?? 0) * 5000 + (tierData.WORKSHOP ?? 0) * 15000;
 
    return reply.status(200).send({
      statusCode: 200,
      data: {
        total:          Number(row?.total ?? 0),
        byTier:         tierData,
        monthlyRevenue,
      },
    });
  });
 
  // List all subscriptions (admin-service billing page)
  fastify.get('/subscriptions/internal/subscriptions', { schema: { hide: true } }, async (request, reply) => {
    const { page = '1', limit = '25', tier } = request.query as any;
    const { eq, desc, count } = await import('drizzle-orm');
    const { db } = await import('../../db');
    const { subscriptions } = await import('../../db/schema');
 
    const pageNum  = Math.max(1, Number(page));
    const limitNum = Math.min(100, Number(limit));
    const offset   = (pageNum - 1) * limitNum;
    const where    = tier ? eq(subscriptions.tier as any, tier) : undefined;
 
    const [rows, [{ value: total }]] = await Promise.all([
      db.select().from(subscriptions).where(where).orderBy(desc(subscriptions.createdAt)).limit(limitNum).offset(offset),
      db.select({ value: count() }).from(subscriptions).where(where),
    ]);
 
    return reply.status(200).send({
      statusCode: 200,
      data: rows,
      pagination: {
        total:      Number(total),
        page:       pageNum,
        limit:      limitNum,
        totalPages: Math.ceil(Number(total) / limitNum),
      },
    });
  });
}