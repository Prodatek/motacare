import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import Stripe from 'stripe';
import { SubscriptionService } from '../modules/subscriptions/subscriptions.service';
import { env } from '../config/env';

const stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: '2024-04-10' });
const service = new SubscriptionService();

// ============================================================
// STRIPE WEBHOOK HANDLER
//
// IMPORTANT: Fastify must receive the raw body (Buffer) for
// Stripe signature verification to work. The route must be
// registered BEFORE any JSON body parser is added, and must
// use addContentTypeParser to capture the raw bytes.
//
// The webhook endpoint is NOT authenticated with JWT —
// it is authenticated via Stripe signature.
// ============================================================

export async function registerStripeWebhook(fastify: FastifyInstance) {

  // Tell Fastify to give us the raw Buffer for the Stripe webhook route
  // but continue to parse JSON normally for all other routes. The
  // previous implementation replaced Fastify's JSON parser globally,
  // causing other endpoints (e.g. /internal/check-limit) to receive a
  // Buffer instead of a parsed object and fail validation.
  fastify.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer' },
    function (req, body, done) {
      // `req.raw.url` contains the original request path
      const url = (req.raw && (req.raw as any).url) || (req as any).url || '';

      // If this is the Stripe webhook route, return the raw Buffer so
      // Stripe signature verification can use the exact bytes.
      if (url && url.startsWith('/webhooks/stripe')) {
        return done(null, body);
      }

      // For all other routes, attempt to parse the buffer as JSON so
      // normal endpoints continue to receive JS objects.
      try {
        const parsed = JSON.parse((body as Buffer).toString('utf8'));
        return done(null, parsed);
      } catch (err) {
        return done(err as Error);
      }
    },
  );

  fastify.post('/webhooks/stripe', async (request: FastifyRequest, reply: FastifyReply) => {
    const signature = request.headers['stripe-signature'];

    if (!signature) {
      return reply.status(400).send({ error: 'Missing stripe-signature header' });
    }

    let event: Stripe.Event;

    try {
      // Verify the event came from Stripe — not a spoofed request
      event = stripe.webhooks.constructEvent(
        request.body as Buffer,
        signature,
        env.STRIPE_WEBHOOK_SECRET,
      );
    } catch (err: any) {
      console.error('[stripe-webhook] Signature verification failed:', err.message);
      return reply.status(400).send({ error: `Webhook verification failed: ${err.message}` });
    }

    console.log(`[stripe-webhook] Received event: ${event.type} (${event.id})`);

    try {
      await service.applyWebhookEvent(event);
      // Return 200 immediately — Stripe retries if it doesn't get 2xx
      return reply.status(200).send({ received: true });
    } catch (err: any) {
      console.error(`[stripe-webhook] Failed to process ${event.type}:`, err.message);
      // Return 500 so Stripe retries the event
      return reply.status(500).send({ error: 'Event processing failed' });
    }
  });
}