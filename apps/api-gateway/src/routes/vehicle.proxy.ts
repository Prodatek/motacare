import type { FastifyInstance } from 'fastify';
import { env } from '../config/env';
import { WRITE_RATE_LIMIT, READ_RATE_LIMIT, buildRateLimitErrorResponse } from '../middleware/rate-limit';
import { proxyRequest } from './auth.proxy';

// ============================================================
// VEHICLE PROXY
// Routes all /vehicles/* requests to vehicle-service.
//
// Role matrix enforced at gateway level:
//   POST   /vehicles         → OWNER only (register)
//   GET    /vehicles         → OWNER only (list own)
//   GET    /vehicles/:hash   → any authenticated user
//   PATCH  /vehicles/:hash   → OWNER only
//   DELETE /vehicles/:hash   → OWNER only
//   POST   /vehicles/:hash/transfer → OWNER only
//   GET    /vehicles/:hash/history  → authenticated
// ============================================================

export async function registerVehicleProxy(fastify: FastifyInstance) {
  const vehicleBodySchema = {
    type: 'object',
    required: [
      'vin',
      'licensePlate',
      'make',
      'model',
      'year',
      'fuelType',
      'transmissionType',
      'mileageAtRegistration',
    ],
    properties: {
      vin: { type: 'string', minLength: 17, maxLength: 17, pattern: '^[A-HJ-NPR-Z0-9]{17}$' },
      licensePlate: { type: 'string', minLength: 2, maxLength: 20 },
      make: { type: 'string', minLength: 1, maxLength: 100 },
      model: { type: 'string', minLength: 1, maxLength: 100 },
      year: { type: 'integer', minimum: 1900, maximum: new Date().getFullYear() + 1 },
      color: { type: 'string', maxLength: 50 },
      trim: { type: 'string', maxLength: 100 },
      fuelType: { type: 'string', enum: ['PETROL', 'DIESEL', 'ELECTRIC', 'HYBRID', 'CNG', 'LPG'] },
      transmissionType: { type: 'string', enum: ['MANUAL', 'AUTOMATIC', 'CVT'] },
      engineCapacity: { type: 'string', maxLength: 20 },
      mileageAtRegistration: { type: 'integer', minimum: 0 },
    },
  } as const;

  const transferBodySchema = {
    type: 'object',
    required: ['newOwnerEmail', 'mileageAtTransfer'],
    properties: {
      newOwnerEmail: { type: 'string', format: 'email' },
      mileageAtTransfer: { type: 'integer', minimum: 0 },
      notes: { type: 'string', maxLength: 500 },
    },
  } as const;

  // POST /vehicles — register a new vehicle (OWNER only)
  fastify.post('/vehicles', {
    onRequest: [fastify.requireRole('OWNER', 'ADMIN')],
    schema: { tags: ['Vehicles'], summary: 'Register a new vehicle', security: [{ bearerAuth: [] }] },
  }, async (request, reply) => {
    return proxyRequest(request, reply, `${env.VEHICLE_SERVICE_URL}/vehicles`, 'POST');
  });

  // GET /vehicles — list own (OWNER) or search all (FIXER/ADMIN)
  fastify.get('/vehicles', {
    onRequest: [fastify.authenticate],
    schema: { tags: ['Vehicles'], summary: 'List or search vehicles', security: [{ bearerAuth: [] }] },
  }, async (request, reply) => {
    const query = new URLSearchParams(request.query as any).toString();
    return proxyRequest(request, reply, `${env.VEHICLE_SERVICE_URL}/vehicles${query ? `?${query}` : ''}`, 'GET');
  });

  // GET /vehicles/:hash — get single vehicle
  fastify.get('/vehicles/:hash', {
    onRequest: [fastify.authenticate],
    schema: { tags: ['Vehicles'], summary: 'Get vehicle by hash', security: [{ bearerAuth: [] }] },
  }, async (request, reply) => {
    const { hash } = request.params as { hash: string };
    return proxyRequest(request, reply, `${env.VEHICLE_SERVICE_URL}/vehicles/${hash}`, 'GET');
  });

  // PATCH /vehicles/:hash — update vehicle
  fastify.patch('/vehicles/:hash', {
    onRequest: [fastify.requireRole('OWNER', 'ADMIN')],
    schema: { tags: ['Vehicles'], summary: 'Update vehicle details', security: [{ bearerAuth: [] }] },
  }, async (request, reply) => {
    const { hash } = request.params as { hash: string };
    return proxyRequest(request, reply, `${env.VEHICLE_SERVICE_URL}/vehicles/${hash}`, 'PATCH');
  });

  // DELETE /vehicles/:hash — deactivate vehicle
  fastify.delete('/vehicles/:hash', {
    onRequest: [fastify.requireRole('OWNER', 'ADMIN')],
    schema: { tags: ['Vehicles'], summary: 'Deactivate a vehicle', security: [{ bearerAuth: [] }] },
  }, async (request, reply) => {
    const { hash } = request.params as { hash: string };
    return proxyRequest(request, reply, `${env.VEHICLE_SERVICE_URL}/vehicles/${hash}`, 'DELETE');
  });

  // POST /vehicles/:hash/transfer — ownership transfer
  fastify.post('/vehicles/:hash/transfer', {
    onRequest: [fastify.requireRole('OWNER', 'ADMIN')],
    schema: { tags: ['Vehicles'], summary: 'Transfer vehicle ownership', security: [{ bearerAuth: [] }] },
  }, async (request, reply) => {
    const { hash } = request.params as { hash: string };
    return proxyRequest(request, reply, `${env.VEHICLE_SERVICE_URL}/vehicles/${hash}/transfer`, 'POST');
  });

  // GET /vehicles/:hash/history — ownership history
  fastify.get('/vehicles/:hash/history', {
    onRequest: [fastify.authenticate],
    schema: { tags: ['Vehicles'], summary: 'Get vehicle ownership history', security: [{ bearerAuth: [] }] },
  }, async (request, reply) => {
    const { hash } = request.params as { hash: string };
    return proxyRequest(request, reply, `${env.VEHICLE_SERVICE_URL}/vehicles/${hash}/history`, 'GET');
  });
}