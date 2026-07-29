import type { FastifyInstance } from 'fastify';
import { CatalogService } from './catalog.service';
import { CatalogController } from './catalog.controller';

// ============================================================
// CATALOG ROUTES — prefix /catalog
// Role matrix: FIXER / WORKSHOP_ADMIN / ADMIN → all routes
// ============================================================

export async function catalogRoutes(fastify: FastifyInstance) {
  const service = new CatalogService();
  const ctrl    = new CatalogController(service);
  const auth    = { onRequest: [(fastify as any).requireRole('FIXER', 'WORKSHOP_ADMIN', 'ADMIN')] };

  fastify.get('/items',        auth, (req, rep) => ctrl.listItems(req, rep));
  fastify.get('/items/:id',    auth, (req: any, rep) => ctrl.getItem(req, rep));
  fastify.post('/items',       auth, (req, rep) => ctrl.createItem(req, rep));
  fastify.patch('/items/:id',  auth, (req: any, rep) => ctrl.updateItem(req, rep));
  fastify.delete('/items/:id', auth, (req: any, rep) => ctrl.deleteItem(req, rep));
}
