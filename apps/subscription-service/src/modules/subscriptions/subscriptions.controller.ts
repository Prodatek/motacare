import type { FastifyRequest, FastifyReply } from 'fastify';
import {
  SubscriptionService, NotFoundError, ConflictError, BadRequestError,
} from './subscriptions.service';
import {
  createCheckoutSchema, createPortalSessionSchema, cancelSubscriptionSchema,
} from './subscriptions.schema';

type AuthUser = { sub: string; role: string };

export class SubscriptionController {
  constructor(private readonly service: SubscriptionService) {}

  // GET /subscriptions/me
  async getMySubscription(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { sub: userId } = request.user as AuthUser;
      const sub = await this.service.getSubscription(userId);
      return reply.status(200).send({ statusCode: 200, data: sub });
    } catch (e) { return this.handleError(e, reply); }
  }

  // GET /subscriptions/plans
  // Returns the plan comparison table — no auth required
  async getPlans(_request: FastifyRequest, reply: FastifyReply) {
    return reply.status(200).send({
      statusCode: 200,
      data: {
        FREE: {
          name: 'Free',
          price: { monthly: 0, yearly: 0 },
          features: {
            vehiclesAllowed:     1,
            inspectionsPerMonth: 3,
            fixersAllowed:       1,
            canExportReports:    false,
            canAccessObd:        false,
            canAccessAiSummary:  false,
          },
          description: 'Perfect for individual car owners wanting to track one vehicle.',
        },
        PRO: {
          name: 'Pro',
          price: { monthly: 5000, yearly: 50000 },  // NGN
          features: {
            vehiclesAllowed:     5,
            inspectionsPerMonth: 30,
            fixersAllowed:       1,
            canExportReports:    true,
            canAccessObd:        true,
            canAccessAiSummary:  true,
          },
          description: 'For car owners with multiple vehicles and full inspection history.',
        },
        WORKSHOP: {
          name: 'Workshop',
          price: { monthly: 15000, yearly: 150000 }, // NGN
          features: {
            vehiclesAllowed:     -1,
            inspectionsPerMonth: -1,
            fixersAllowed:       -1,
            canExportReports:    true,
            canAccessObd:        true,
            canAccessAiSummary:  true,
          },
          description: 'Unlimited vehicles, fixers, and inspections for professional workshops.',
        },
      },
    });
  }

  // POST /subscriptions/checkout
  async createCheckout(request: FastifyRequest, reply: FastifyReply) {
    const parsed = createCheckoutSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        statusCode: 400, error: 'Validation Error',
        details: parsed.error.flatten().fieldErrors,
      });
    }
    try {
      const { sub: userId } = request.user as AuthUser;
      // Resolve email from auth-service
      const userEmail = await this.resolveUserEmail(userId);
      const result = await this.service.createCheckoutSession(userId, userEmail, parsed.data);
      return reply.status(200).send({ statusCode: 200, data: result });
    } catch (e) { return this.handleError(e, reply); }
  }

  // POST /subscriptions/portal
  async createPortal(request: FastifyRequest, reply: FastifyReply) {
    const parsed = createPortalSessionSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ statusCode: 400, error: 'Validation Error', details: parsed.error.flatten().fieldErrors });
    }
    try {
      const { sub: userId } = request.user as AuthUser;
      const result = await this.service.createPortalSession(userId, parsed.data.returnUrl);
      return reply.status(200).send({ statusCode: 200, data: result });
    } catch (e) { return this.handleError(e, reply); }
  }

  // POST /subscriptions/cancel
  async cancel(request: FastifyRequest, reply: FastifyReply) {
    const parsed = cancelSubscriptionSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ statusCode: 400, error: 'Validation Error', details: parsed.error.flatten().fieldErrors });
    }
    try {
      const { sub: userId } = request.user as AuthUser;
      const sub = await this.service.cancelSubscription(userId, parsed.data);
      return reply.status(200).send({ statusCode: 200, message: 'Subscription cancelled', data: sub });
    } catch (e) { return this.handleError(e, reply); }
  }

  // ----------------------------------------------------------
  // HELPERS
  // ----------------------------------------------------------

  private async resolveUserEmail(userId: string): Promise<string> {
    const { env } = await import('../../config/env');
    const res = await fetch(`${env.AUTH_SERVICE_URL}/auth/internal/user-by-id`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    if (!res.ok) throw new Error('Failed to resolve user email');
    const data = (await res.json()) as { data: { email: string } };
    return data.data.email;
  }

  private handleError(error: unknown, reply: FastifyReply) {
    if (error instanceof NotFoundError)
      return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: error.message });
    if (error instanceof ConflictError)
      return reply.status(409).send({ statusCode: 409, error: 'Conflict', message: error.message });
    if (error instanceof BadRequestError)
      return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: error.message });
    console.error('Unhandled error:', error);
    return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'An unexpected error occurred' });
  }
}