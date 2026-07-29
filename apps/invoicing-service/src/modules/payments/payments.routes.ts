import type { FastifyInstance } from 'fastify';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';

// ============================================================
// PAYMENT ROUTES
// Registered with NO prefix (see main.ts) since payments hang
// off two different resource paths: /invoices/:invoiceId/payments
// and /payments/:id.
//
// Role matrix:
//   FIXER / WORKSHOP_ADMIN / ADMIN → record/list/delete
//   OWNER                          → list only, on their own invoices
// ============================================================

export async function paymentsRoutes(fastify: FastifyInstance) {
  const service = new PaymentsService();
  const ctrl    = new PaymentsController(service);

  const staff   = { onRequest: [(fastify as any).requireRole('FIXER', 'WORKSHOP_ADMIN', 'ADMIN')] };
  const anyRole = { onRequest: [(fastify as any).requireRole('OWNER', 'FIXER', 'WORKSHOP_ADMIN', 'ADMIN')] };

  fastify.get('/invoices/:invoiceId/payments',  anyRole, (req: any, rep) => ctrl.listPayments(req, rep));
  fastify.post('/invoices/:invoiceId/payments', staff,   (req: any, rep) => ctrl.recordPayment(req, rep));
  fastify.delete('/payments/:id',               staff,   (req: any, rep) => ctrl.deletePayment(req, rep));
}
