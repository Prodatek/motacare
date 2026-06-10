import type { FastifyInstance } from 'fastify';
import { VehicleController } from './vehicle.controller';
import { VehicleService } from './vehicle.service';

// ============================================================
// VEHICLE ROUTES
// Prefix: /vehicles (set in main.ts)
//
// Role matrix:
//   OWNER  — register, list own, view own, update own, deactivate, transfer
//   FIXER  — view any vehicle by hash (needed for inspections)
//   ADMIN  — full access
// ============================================================

export async function vehicleRoutes(fastify: FastifyInstance) {
  const vehicleService = new VehicleService();
  const vehicleController = new VehicleController(vehicleService);

  const authenticate = { onRequest: [fastify.authenticate] };
  const ownerOrAdmin = { onRequest: [fastify.requireRole('OWNER', 'ADMIN')] };

  // ----------------------------------------------------------
  // OWNER ROUTES
  // ----------------------------------------------------------

  // Register a new vehicle (owners only)
  fastify.post('/', { ...ownerOrAdmin, schema: { tags: ['Vehicles'], summary: 'Register a new vehicle', security: [{ bearerAuth: [] }] } as any },
    (req, rep) => vehicleController.register(req, rep),
  );

  // List vehicles (owners see own; fixers/admins search all)
  fastify.get('/', { ...authenticate, schema: { tags: ['Vehicles'], summary: 'List or search vehicles', security: [{ bearerAuth: [] }] } as any },
    (req, rep) => vehicleController.list(req, rep),
  );

  // Get a single vehicle by hash (owners see own, fixers/admins see any)
  fastify.get('/:hash', { ...authenticate, schema: { tags: ['Vehicles'], summary: 'Get vehicle by hash', security: [{ bearerAuth: [] }] } as any },
    (req, rep) => vehicleController.getOne(req as any, rep),
  );

  // Update mutable vehicle fields (owner only)
  fastify.patch('/:hash', { ...ownerOrAdmin, schema: { tags: ['Vehicles'], summary: 'Update vehicle details', security: [{ bearerAuth: [] }] } as any },
    (req, rep) => vehicleController.update(req as any, rep),
  );

  // Deactivate vehicle (owner only)
  fastify.delete('/:hash', { ...ownerOrAdmin, schema: { tags: ['Vehicles'], summary: 'Deactivate a vehicle', security: [{ bearerAuth: [] }] } as any },
    (req, rep) => vehicleController.deactivate(req as any, rep),
  );

  // Transfer ownership to another registered user
  fastify.post('/:hash/transfer', { ...ownerOrAdmin, schema: { tags: ['Vehicles'], summary: 'Transfer vehicle ownership', security: [{ bearerAuth: [] }] } as any },
    (req, rep) => vehicleController.transfer(req as any, rep),
  );

  // Get ownership history (owner + admin)
  fastify.get('/:hash/history', { ...authenticate, schema: { tags: ['Vehicles'], summary: 'Get vehicle ownership history', security: [{ bearerAuth: [] }] } as any },
    (req, rep) => vehicleController.getHistory(req as any, rep),
  );

  // ----------------------------------------------------------
  // INTERNAL ROUTE — called by inspection-service, not by clients
  // No auth here — only reachable within the Docker network
  // ----------------------------------------------------------

  fastify.get('/internal/lookup/:hash', {
    schema: { tags: ['Internal'], summary: 'Internal: look up vehicle by hash', hide: true },
  },
    (req, rep) => vehicleController.internalLookup(req as any, rep),
  );
}