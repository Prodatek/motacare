import type { FastifyInstance } from 'fastify';
import { env } from '../config/env';
import { proxyRequest } from './auth.proxy';

// ============================================================
// CRM PROXY
// Fixer + Workshop Admin + Admin roles can access CRM routes.
// ============================================================

function buildQs(query: unknown): string {
  const qs = new URLSearchParams(query as any).toString();
  return qs ? `?${qs}` : '';
}

export async function registerCrmProxy(fastify: FastifyInstance) {
  const up       = env.CRM_SERVICE_URL;
  const fixerAuth = {
    onRequest: [(fastify as any).requireRole('FIXER', 'WORKSHOP_ADMIN', 'ADMIN')],
  };
  const tag = { schema: { tags: ['CRM'], security: [{ bearerAuth: [] }] } };

  // ── Customers ────────────────────────────────────────────────
  fastify.get('/crm/customers',
    { ...fixerAuth, ...tag },
    (req, rep) => proxyRequest(req, rep, `${up}/crm/customers${buildQs(req.query)}`, 'GET'),
  );
  fastify.get('/crm/customers/recent',
    { ...fixerAuth, ...tag },
    (req, rep) => proxyRequest(req, rep, `${up}/crm/customers/recent${buildQs(req.query)}`, 'GET'),
  );
  fastify.get('/crm/customers/:id',
    { ...fixerAuth, ...tag },
    (req: any, rep) => proxyRequest(req, rep, `${up}/crm/customers/${req.params.id}`, 'GET'),
  );

  // ── Notes ────────────────────────────────────────────────────
  fastify.post('/crm/customers/:id/notes',
    { ...fixerAuth, ...tag },
    (req: any, rep) => proxyRequest(req, rep, `${up}/crm/customers/${req.params.id}/notes`, 'POST'),
  );
  fastify.patch('/crm/notes/:noteId',
    { ...fixerAuth, ...tag },
    (req: any, rep) => proxyRequest(req, rep, `${up}/crm/notes/${req.params.noteId}`, 'PATCH'),
  );
  fastify.delete('/crm/notes/:noteId',
    { ...fixerAuth, ...tag },
    (req: any, rep) => proxyRequest(req, rep, `${up}/crm/notes/${req.params.noteId}`, 'DELETE'),
  );
}