import type { FastifyInstance } from 'fastify';
import { InvoicesService } from './invoices.service';
import { InvoicesController } from './invoices.controller';

// ============================================================
// INVOICE ROUTES — prefix /invoices
//
// Role matrix:
//   FIXER / WORKSHOP_ADMIN / ADMIN → full manage, scoped to
//     their own workshop
//   OWNER                          → read + pdf on invoices
//     addressed to them (enforced in the service)
// ============================================================

export async function invoicesRoutes(fastify: FastifyInstance) {
  const service = new InvoicesService();
  const ctrl    = new InvoicesController(service);

  const staff = { onRequest: [(fastify as any).requireRole('FIXER', 'WORKSHOP_ADMIN', 'ADMIN')] };
  const anyRole = { onRequest: [(fastify as any).requireRole('OWNER', 'FIXER', 'WORKSHOP_ADMIN', 'ADMIN')] };

  fastify.get('/',    anyRole, (req, rep) => ctrl.listInvoices(req, rep));
  fastify.get('/:id', anyRole, (req: any, rep) => ctrl.getInvoice(req, rep));

  fastify.post('/',      staff, (req, rep) => ctrl.createInvoice(req, rep));
  fastify.patch('/:id',  staff, (req: any, rep) => ctrl.updateInvoice(req, rep));
  fastify.delete('/:id', staff, (req: any, rep) => ctrl.deleteInvoice(req, rep));

  fastify.post('/:id/send', staff, (req: any, rep) => ctrl.sendInvoice(req, rep));
  fastify.post('/:id/void', staff, (req: any, rep) => ctrl.voidInvoice(req, rep));
}
