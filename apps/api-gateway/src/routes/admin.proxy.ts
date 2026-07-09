import type { FastifyInstance } from 'fastify';
import { env } from '../config/env';
import { proxyRequest } from './auth.proxy';

// ============================================================
// ADMIN PROXY
// All routes gated at ADMIN role.
// The admin-service also double-checks on every route.
// ============================================================

function buildQs(query: unknown): string {
  const qs = new URLSearchParams(query as any).toString();
  return qs ? `?${qs}` : '';
}

export async function registerAdminProxy(fastify: FastifyInstance) {
  const up        = env.ADMIN_SERVICE_URL;
  const adminOnly = { onRequest: [(fastify as any).requireRole('ADMIN')] };
  const tag       = { schema: { tags: ['Admin'], security: [{ bearerAuth: [] }] } };

  // ── Platform metrics ────────────────────────────────────────
  fastify.get('/admin/platform/metrics',
    { ...adminOnly, ...tag },
    (req, rep) => proxyRequest(req, rep, `${up}/admin/platform/metrics`, 'GET'),
  );

  // ── Users ───────────────────────────────────────────────────
  fastify.get('/admin/users',
    { ...adminOnly, ...tag },
    (req, rep) => proxyRequest(req, rep, `${up}/admin/users${buildQs(req.query)}`, 'GET'),
  );
  fastify.get('/admin/users/:id',
    { ...adminOnly, ...tag },
    (req: any, rep) => proxyRequest(req, rep, `${up}/admin/users/${req.params.id}`, 'GET'),
  );
  fastify.post('/admin/users/:id/suspend',
    { ...adminOnly, ...tag },
    (req: any, rep) => proxyRequest(req, rep, `${up}/admin/users/${req.params.id}/suspend`, 'POST'),
  );
  fastify.post('/admin/users/:id/reactivate',
    { ...adminOnly, ...tag },
    (req: any, rep) => proxyRequest(req, rep, `${up}/admin/users/${req.params.id}/reactivate`, 'POST'),
  );
  fastify.post('/admin/users/:id/role',
    { ...adminOnly, ...tag },
    (req: any, rep) => proxyRequest(req, rep, `${up}/admin/users/${req.params.id}/role`, 'POST'),
  );

  // ── Workshops ────────────────────────────────────────────────
  fastify.post('/admin/workshops/:id/featured',
    { ...adminOnly, ...tag },
    (req: any, rep) => proxyRequest(req, rep, `${up}/admin/workshops/${req.params.id}/featured`, 'POST'),
  );
  fastify.post('/admin/workshops/:id/suspend',
    { ...adminOnly, ...tag },
    (req: any, rep) => proxyRequest(req, rep, `${up}/admin/workshops/${req.params.id}/suspend`, 'POST'),
  );
  fastify.post('/admin/workshops/:id/activate',
    { ...adminOnly, ...tag },
    (req: any, rep) => proxyRequest(req, rep, `${up}/admin/workshops/${req.params.id}/activate`, 'POST'),
  );

  // ── Billing ──────────────────────────────────────────────────
  fastify.get('/admin/billing/subscriptions',
    { ...adminOnly, ...tag },
    (req, rep) => proxyRequest(req, rep, `${up}/admin/billing/subscriptions${buildQs(req.query)}`, 'GET'),
  );
}