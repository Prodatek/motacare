import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { subscriptions } from '../db/schema';

// ============================================================
// FEATURE GATE — INTERNAL ENDPOINT
//
// Other services (vehicle-service, inspection-service) call
// this BEFORE creating a vehicle / inspection / fixer to check
// whether the user's plan allows it.
//
// This is NOT a Fastify decorator/hook — it's a plain internal
// route registered in main.ts because the check needs to query
// CURRENT USAGE from the calling service's own database
// (e.g. "how many vehicles does this owner already have?"),
// which subscription-service cannot see directly.
//
// Pattern: calling service sends { userId, currentCount },
// this service returns { allowed, limit, tier }.
// ============================================================

interface CheckLimitBody {
  userId: string;
  resource: 'vehicles' | 'inspections' | 'fixers';
  currentCount: number;
}

export async function checkFeatureLimit(
  request: FastifyRequest<{ Body: CheckLimitBody }>,
  reply: FastifyReply,
) {
  const { userId, resource, currentCount } = request.body;

  if (!userId || !resource || currentCount === undefined) {
    return reply.status(400).send({
      statusCode: 400,
      error: 'Bad Request',
      message: 'userId, resource, and currentCount are required',
    });
  }

  // Get or default to FREE limits
  const sub = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.userId, userId),
  });

  const tier = sub?.tier ?? 'FREE';
  const status = sub?.status ?? 'ACTIVE';

  // If subscription is past due or expired, fall back to FREE limits
  const effectiveTier = (status === 'PAST_DUE' || status === 'EXPIRED') ? 'FREE' : tier;

  const limitField =
    resource === 'vehicles'    ? 'vehiclesAllowed' :
    resource === 'inspections' ? 'inspectionsPerMonth' :
    'fixersAllowed';

  const limit = sub
    ? sub[limitField as keyof typeof sub] as number
    : (resource === 'vehicles' ? 1 : resource === 'inspections' ? 3 : 1);

  // -1 means unlimited (WORKSHOP tier)
  const allowed = limit === -1 || currentCount < limit;

  return reply.status(200).send({
    statusCode: 200,
    data: {
      allowed,
      limit,
      currentCount,
      tier: effectiveTier,
      unlimited: limit === -1,
    },
  });
}