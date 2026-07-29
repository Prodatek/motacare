import type { FastifyInstance } from 'fastify';
import { QuotesService } from './quotes.service';
import { QuotesController } from './quotes.controller';

// ============================================================
// QUOTE ROUTES — prefix /quotes
//
// Role matrix:
//   FIXER / WORKSHOP_ADMIN / ADMIN → full manage (create/edit/
//     delete/send/convert), scoped to their own workshop
//   OWNER                          → read + accept/reject +
//     pdf on quotes addressed to them (enforced in the service)
// ============================================================

export async function quotesRoutes(fastify: FastifyInstance) {
  const service = new QuotesService();
  const ctrl    = new QuotesController(service);

  const staff = { onRequest: [(fastify as any).requireRole('FIXER', 'WORKSHOP_ADMIN', 'ADMIN')] };
  const anyRole = { onRequest: [(fastify as any).requireRole('OWNER', 'FIXER', 'WORKSHOP_ADMIN', 'ADMIN')] };

  fastify.get('/',    anyRole, (req, rep) => ctrl.listQuotes(req, rep));
  fastify.get('/:id', anyRole, (req: any, rep) => ctrl.getQuote(req, rep));

  fastify.post('/',        staff, (req, rep) => ctrl.createQuote(req, rep));
  fastify.patch('/:id',    staff, (req: any, rep) => ctrl.updateQuote(req, rep));
  fastify.delete('/:id',   staff, (req: any, rep) => ctrl.deleteQuote(req, rep));

  fastify.post('/:id/send', staff, (req: any, rep) => ctrl.sendQuote(req, rep));

  fastify.post('/:id/accept', anyRole, (req: any, rep) => ctrl.acceptQuote(req, rep));
  fastify.post('/:id/reject', anyRole, (req: any, rep) => ctrl.rejectQuote(req, rep));

  fastify.post('/:id/convert-to-invoice', staff, (req: any, rep) => ctrl.convertToInvoice(req, rep));
}
