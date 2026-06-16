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
}