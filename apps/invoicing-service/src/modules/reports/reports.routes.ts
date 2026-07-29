import type { FastifyInstance } from 'fastify';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';

// ============================================================
// REPORT ROUTES — prefix /reports
// Role matrix: FIXER / WORKSHOP_ADMIN / ADMIN only — financial
// records are a staff-facing concern, not exposed to OWNER.
// ============================================================

export async function reportsRoutes(fastify: FastifyInstance) {
  const service = new ReportsService();
  const ctrl    = new ReportsController(service);
  const staff   = { onRequest: [(fastify as any).requireRole('FIXER', 'WORKSHOP_ADMIN', 'ADMIN')] };

  fastify.get('/summary',       staff, (req, rep) => ctrl.getSummary(req, rep));
  fastify.get('/trend',         staff, (req, rep) => ctrl.getTrend(req, rep));
  fastify.get('/top-customers', staff, (req, rep) => ctrl.getTopCustomers(req, rep));
}
