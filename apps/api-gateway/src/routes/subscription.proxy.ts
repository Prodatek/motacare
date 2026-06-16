import type { FastifyInstance } from 'fastify';
import { env } from '../config/env';
import { proxyRequest } from './auth.proxy';

// ============================================================
// SUBSCRIPTION PROXY — routes /subscriptions/* to subscription-service
// Note: /webhooks/stripe is NOT proxied — Stripe calls that
// service directly (it needs raw body + own domain/port).
// ============================================================

export async function registerSubscriptionProxy(fastify: FastifyInstance) {
  const up = env.SUBSCRIPTION_SERVICE_URL;
  const tag = { schema: { tags: ['Subscriptions'], security: [{ bearerAuth: [] }] } };

  // Public — plan comparison table
  fastify.get('/subscriptions/plans', {
    schema: { tags: ['Subscriptions'], summary: 'Get subscription plans and pricing' },
  }, (req, rep) => proxyRequest(req, rep, `${up}/subscriptions/plans`, 'GET'));

  // Authenticated
  fastify.get('/subscriptions/me', { onRequest: [fastify.authenticate], ...tag },
    (req, rep) => proxyRequest(req, rep, `${up}/subscriptions/me`, 'GET'));

  fastify.post('/subscriptions/checkout', { onRequest: [fastify.authenticate], ...tag },
    (req, rep) => proxyRequest(req, rep, `${up}/subscriptions/checkout`, 'POST'));

  fastify.post('/subscriptions/portal', { onRequest: [fastify.authenticate], ...tag },
    (req, rep) => proxyRequest(req, rep, `${up}/subscriptions/portal`, 'POST'));

  fastify.post('/subscriptions/cancel', { onRequest: [fastify.authenticate], ...tag },
    (req, rep) => proxyRequest(req, rep, `${up}/subscriptions/cancel`, 'POST'));
}