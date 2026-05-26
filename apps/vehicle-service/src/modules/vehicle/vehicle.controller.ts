import type { FastifyRequest, FastifyReply } from 'fastify';
import {
  VehicleService,
  VehicleNotFoundError,
  VehicleAlreadyRegisteredError,
  ForbiddenError,
  ConflictError,
} from './vehicle.service';
import {
  registerVehicleSchema,
  updateVehicleSchema,
  transferOwnershipSchema,
  vehicleQuerySchema,
} from './vehicle.schema';

// ============================================================
// VEHICLE CONTROLLER
// ============================================================

export class VehicleController {
  constructor(private readonly vehicleService: VehicleService) {}

  // POST /vehicles
  async register(request: FastifyRequest, reply: FastifyReply) {
    const parsed = registerVehicleSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Validation Error',
        message: 'Invalid request body',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    try {
      const { sub: ownerId } = request.user as { sub: string };
      const vehicle = await this.vehicleService.registerVehicle(parsed.data, ownerId);
      return reply.status(201).send({
        statusCode: 201,
        message: 'Vehicle registered successfully',
        data: vehicle,
      });
    } catch (error) {
      return this.handleError(error, reply);
    }
  }

  // GET /vehicles
  async list(request: FastifyRequest, reply: FastifyReply) {
    const parsed = vehicleQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Validation Error',
        message: 'Invalid query parameters',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    try {
      const { sub: ownerId } = request.user as { sub: string };
      const result = await this.vehicleService.getOwnerVehicles(ownerId, parsed.data);
      return reply.status(200).send({ statusCode: 200, ...result });
    } catch (error) {
      return this.handleError(error, reply);
    }
  }

  // GET /vehicles/:hash
  async getOne(request: FastifyRequest<{ Params: { hash: string } }>, reply: FastifyReply) {
    try {
      const { sub: requesterId, role } = request.user as { sub: string; role: string };
      const vehicle = await this.vehicleService.getVehicleByHash(
        request.params.hash,
        requesterId,
        role,
      );
      return reply.status(200).send({ statusCode: 200, data: vehicle });
    } catch (error) {
      return this.handleError(error, reply);
    }
  }

  // PATCH /vehicles/:hash
  async update(request: FastifyRequest<{ Params: { hash: string } }>, reply: FastifyReply) {
    const parsed = updateVehicleSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Validation Error',
        message: 'Invalid request body',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    try {
      const { sub: requesterId } = request.user as { sub: string };
      const vehicle = await this.vehicleService.updateVehicle(
        request.params.hash,
        parsed.data,
        requesterId,
      );
      return reply.status(200).send({
        statusCode: 200,
        message: 'Vehicle updated successfully',
        data: vehicle,
      });
    } catch (error) {
      return this.handleError(error, reply);
    }
  }

  // DELETE /vehicles/:hash
  async deactivate(request: FastifyRequest<{ Params: { hash: string } }>, reply: FastifyReply) {
    try {
      const { sub: requesterId } = request.user as { sub: string };
      const vehicle = await this.vehicleService.deactivateVehicle(
        request.params.hash,
        requesterId,
      );
      return reply.status(200).send({
        statusCode: 200,
        message: 'Vehicle deactivated',
        data: vehicle,
      });
    } catch (error) {
      return this.handleError(error, reply);
    }
  }

  // POST /vehicles/:hash/transfer
  async transfer(request: FastifyRequest<{ Params: { hash: string } }>, reply: FastifyReply) {
    const parsed = transferOwnershipSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Validation Error',
        message: 'Invalid request body',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    try {
      const { sub: currentOwnerId } = request.user as { sub: string };

      // Resolve the new owner's ID by calling auth-service
      const newOwnerId = await this.resolveOwnerIdByEmail(parsed.data.newOwnerEmail);

      const vehicle = await this.vehicleService.transferOwnership(
        request.params.hash,
        parsed.data,
        currentOwnerId,
        newOwnerId,
      );

      return reply.status(200).send({
        statusCode: 200,
        message: 'Vehicle ownership transferred successfully',
        data: vehicle,
      });
    } catch (error) {
      return this.handleError(error, reply);
    }
  }

  // GET /vehicles/:hash/history
  async getHistory(request: FastifyRequest<{ Params: { hash: string } }>, reply: FastifyReply) {
    try {
      const { sub: requesterId, role } = request.user as { sub: string; role: string };
      const history = await this.vehicleService.getOwnershipHistory(
        request.params.hash,
        requesterId,
        role,
      );
      return reply.status(200).send({ statusCode: 200, data: history });
    } catch (error) {
      return this.handleError(error, reply);
    }
  }

  // GET /vehicles/lookup/:hash — internal endpoint for other services
  async internalLookup(request: FastifyRequest<{ Params: { hash: string } }>, reply: FastifyReply) {
    try {
      const vehicle = await this.vehicleService.lookupByHash(request.params.hash);
      if (!vehicle) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Vehicle not found' });
      }
      return reply.status(200).send({ statusCode: 200, data: vehicle });
    } catch (error) {
      return this.handleError(error, reply);
    }
  }

  // ----------------------------------------------------------
  // RESOLVE OWNER ID FROM EMAIL
  // Makes an internal HTTP call to auth-service to look up
  // a user by email during ownership transfer
  // ----------------------------------------------------------

  private async resolveOwnerIdByEmail(email: string): Promise<string> {
    const { env } = await import('../../config/env');
    const response = await fetch(`${env.AUTH_SERVICE_URL}/auth/internal/user-by-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    if (!response.ok) {
      throw new ForbiddenError(`No registered user found with email: ${email}`);
    }

    const data = (await response.json()) as { data: { id: string } };
    return data.data.id;
  }

  // ----------------------------------------------------------
  // ERROR HANDLER
  // ----------------------------------------------------------

  private handleError(error: unknown, reply: FastifyReply) {
    if (error instanceof VehicleNotFoundError) {
      return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: error.message });
    }
    if (error instanceof VehicleAlreadyRegisteredError) {
      return reply.status(409).send({ statusCode: 409, error: 'Conflict', message: error.message });
    }
    if (error instanceof ForbiddenError) {
      return reply.status(403).send({ statusCode: 403, error: 'Forbidden', message: error.message });
    }
    if (error instanceof ConflictError) {
      return reply.status(409).send({ statusCode: 409, error: 'Conflict', message: error.message });
    }

    console.error('Unhandled error in vehicle controller:', error);
    return reply.status(500).send({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'An unexpected error occurred',
    });
  }
}