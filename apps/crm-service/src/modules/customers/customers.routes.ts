import type { FastifyInstance } from 'fastify';
import { CrmService }    from './customers.service';
import { CrmController } from './customers.controller';

// ============================================================
// CRM ROUTES
// Prefix: /crm
//
// Role matrix:
//   FIXER / WORKSHOP_ADMIN / ADMIN → all routes
//   OWNER                          → no access (gateway blocks)
// ============================================================

export async function crmRoutes(fastify: FastifyInstance) {
  const service    = new CrmService();
  const ctrl       = new CrmController(service);
  const auth       = { onRequest: [fastify.authenticate] };
  const tag        = { schema: { tags: ['CRM'], security: [{ bearerAuth: [] }] } };

  // ── Customer list & recent ─────────────────────────────────
  fastify.get('/customers',        { ...auth, ...tag }, (req, rep) => ctrl.listCustomers(req, rep));
  fastify.get('/customers/recent', { ...auth, ...tag }, (req, rep) => ctrl.getRecentCustomers(req, rep));

  // ── Customer profile ───────────────────────────────────────
  // NOTE: /recent must be declared BEFORE /:ownerId so Fastify
  // doesn't match "recent" as a UUID parameter.
  fastify.get('/customers/:ownerId', { ...auth, ...tag }, (req: any, rep) => ctrl.getCustomer(req, rep));

  // ── Notes on a customer ────────────────────────────────────
  fastify.post('/customers/:ownerId/notes', { ...auth, ...tag }, (req: any, rep) => ctrl.createNote(req, rep));

  // ── Note management ────────────────────────────────────────
  fastify.patch('/notes/:noteId',  { ...auth, ...tag }, (req: any, rep) => ctrl.updateNote(req, rep));
  fastify.delete('/notes/:noteId', { ...auth, ...tag }, (req: any, rep) => ctrl.deleteNote(req, rep));
}