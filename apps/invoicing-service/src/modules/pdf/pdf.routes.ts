import type { FastifyInstance } from 'fastify';
import { PdfController } from './pdf.controller';

// ============================================================
// PDF ROUTES
// Registered with NO prefix (see main.ts) — these hang off the
// quote/invoice resource paths, not a standalone /pdf namespace.
// ============================================================

export async function pdfRoutes(fastify: FastifyInstance) {
  const ctrl = new PdfController();
  const anyRole = { onRequest: [(fastify as any).requireRole('OWNER', 'FIXER', 'WORKSHOP_ADMIN', 'ADMIN')] };

  fastify.get('/quotes/:id/pdf',   anyRole, (req: any, rep) => ctrl.getQuotePdf(req, rep));
  fastify.get('/invoices/:id/pdf', anyRole, (req: any, rep) => ctrl.getInvoicePdf(req, rep));
}
