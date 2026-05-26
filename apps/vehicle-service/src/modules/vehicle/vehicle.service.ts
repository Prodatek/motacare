import { eq, and, desc, count } from 'drizzle-orm';
import { db } from '../../db';
import { vehicles, vehicleOwnershipHistory, type Vehicle, type NewVehicle } from '../../db/schema';
import { env } from '../../config/env';
import { generateVehicleHash, parsePagination, buildPaginationMeta } from '@motacare/shared-utils';
import type {
  RegisterVehicleInput,
  UpdateVehicleInput,
  TransferOwnershipInput,
  VehicleQueryInput,
} from './vehicle.schema';
import type { PaginatedResponse } from '@motacare/shared-types';

// ============================================================
// CUSTOM ERRORS
// ============================================================

export class VehicleNotFoundError extends Error {
  constructor(identifier: string) {
    super(`Vehicle not found: ${identifier}`);
    this.name = 'VehicleNotFoundError';
  }
}

export class VehicleAlreadyRegisteredError extends Error {
  constructor(vin: string) {
    super(`VIN ${vin} is already registered to this owner`);
    this.name = 'VehicleAlreadyRegisteredError';
  }
}

export class ForbiddenError extends Error {
  constructor(message = 'You do not have permission to perform this action') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}

// ============================================================
// VEHICLE SERVICE
// ============================================================

export class VehicleService {

  // ----------------------------------------------------------
  // REGISTER A VEHICLE
  // ----------------------------------------------------------

  async registerVehicle(input: RegisterVehicleInput, ownerId: string): Promise<Vehicle> {
    // 1. Check this VIN isn't already registered to this owner
    const existingVehicle = await db.query.vehicles.findFirst({
      where: and(
        eq(vehicles.vin, input.vin),
        eq(vehicles.ownerId, ownerId),
      ),
    });

    if (existingVehicle) {
      throw new VehicleAlreadyRegisteredError(input.vin);
    }

    // 2. Generate the vehicle hash
    // This is the stable identifier used across ALL services.
    // HMAC-SHA256(VIN:ownerId) — deterministic, unforgeable without the secret.
    const hash = generateVehicleHash(input.vin, ownerId, env.VEHICLE_HASH_SECRET);

    // 3. Register the vehicle
    const [newVehicle] = await db
      .insert(vehicles)
      .values({
        hash,
        ownerId,
        vin: input.vin,
        licensePlate: input.licensePlate,
        make: input.make,
        model: input.model,
        year: input.year,
        color: input.color,
        trim: input.trim,
        fuelType: input.fuelType,
        transmissionType: input.transmissionType,
        engineCapacity: input.engineCapacity,
        engineCode: input.engineCode,
        mileageAtRegistration: input.mileageAtRegistration,
      } as NewVehicle)
      .returning();

    return newVehicle;
  }

  // ----------------------------------------------------------
  // GET ALL VEHICLES FOR AN OWNER (paginated)
  // ----------------------------------------------------------

  async getOwnerVehicles(
    ownerId: string,
    query: VehicleQueryInput,
  ): Promise<PaginatedResponse<Vehicle>> {
    const { offset, limit, page } = parsePagination(query);

    const conditions = [eq(vehicles.ownerId, ownerId)];
    if (query.status) {
      conditions.push(eq(vehicles.status, query.status));
    }

    const [rows, [{ value: total }]] = await Promise.all([
      db.query.vehicles.findMany({
        where: and(...conditions),
        orderBy: [desc(vehicles.createdAt)],
        limit,
        offset,
      }),
      db
        .select({ value: count() })
        .from(vehicles)
        .where(and(...conditions)),
    ]);

    return {
      data: rows,
      pagination: buildPaginationMeta(Number(total), page, limit),
    };
  }

  // ----------------------------------------------------------
  // GET A SINGLE VEHICLE BY HASH
  // The hash is the public-facing identifier — never expose the UUID
  // ----------------------------------------------------------

  async getVehicleByHash(hash: string, requesterId: string, requesterRole: string): Promise<Vehicle> {
    const vehicle = await db.query.vehicles.findFirst({
      where: eq(vehicles.hash, hash),
    });

    if (!vehicle) {
      throw new VehicleNotFoundError(hash);
    }

    // Owners can only see their own vehicles
    // Fixers and admins can see any vehicle
    if (requesterRole === 'OWNER' && vehicle.ownerId !== requesterId) {
      throw new ForbiddenError();
    }

    return vehicle;
  }

  // ----------------------------------------------------------
  // UPDATE A VEHICLE (mutable fields only)
  // ----------------------------------------------------------

  async updateVehicle(
    hash: string,
    input: UpdateVehicleInput,
    requesterId: string,
  ): Promise<Vehicle> {
    const vehicle = await db.query.vehicles.findFirst({
      where: eq(vehicles.hash, hash),
    });

    if (!vehicle) throw new VehicleNotFoundError(hash);
    if (vehicle.ownerId !== requesterId) throw new ForbiddenError();

    const [updated] = await db
      .update(vehicles)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(vehicles.hash, hash))
      .returning();

    return updated;
  }

  // ----------------------------------------------------------
  // DEACTIVATE A VEHICLE
  // ----------------------------------------------------------

  async deactivateVehicle(hash: string, requesterId: string): Promise<Vehicle> {
    const vehicle = await db.query.vehicles.findFirst({
      where: eq(vehicles.hash, hash),
    });

    if (!vehicle) throw new VehicleNotFoundError(hash);
    if (vehicle.ownerId !== requesterId) throw new ForbiddenError();
    if (vehicle.status === 'INACTIVE') {
      throw new ConflictError('Vehicle is already inactive');
    }

    const [updated] = await db
      .update(vehicles)
      .set({ status: 'INACTIVE', updatedAt: new Date() })
      .where(eq(vehicles.hash, hash))
      .returning();

    return updated;
  }

  // ----------------------------------------------------------
  // TRANSFER OWNERSHIP
  // Generates a new hash for the new owner.
  // Old hash is preserved in ownership history for audit trail.
  // ----------------------------------------------------------

  async transferOwnership(
    hash: string,
    input: TransferOwnershipInput,
    currentOwnerId: string,
    newOwnerId: string,
  ): Promise<Vehicle> {
    const vehicle = await db.query.vehicles.findFirst({
      where: and(eq(vehicles.hash, hash), eq(vehicles.ownerId, currentOwnerId)),
    });

    if (!vehicle) throw new VehicleNotFoundError(hash);
    if (vehicle.ownerId !== currentOwnerId) throw new ForbiddenError();
    if (currentOwnerId === newOwnerId) {
      throw new ConflictError('Cannot transfer vehicle to the same owner');
    }

    // Check new owner doesn't already have this VIN registered
    const newOwnerAlreadyHasVehicle = await db.query.vehicles.findFirst({
      where: and(eq(vehicles.vin, vehicle.vin), eq(vehicles.ownerId, newOwnerId)),
    });

    if (newOwnerAlreadyHasVehicle) {
      throw new ConflictError('This VIN is already registered to the new owner');
    }

    // Generate new hash for the new owner
    const newHash = generateVehicleHash(vehicle.vin, newOwnerId, env.VEHICLE_HASH_SECRET);

    // Run both operations in a transaction
    const [updatedVehicle] = await db.transaction(async (tx) => {
      // Record ownership history
      await tx.insert(vehicleOwnershipHistory).values({
        vehicleId: vehicle.id,
        previousOwnerId: currentOwnerId,
        newOwnerId,
        previousHash: hash,
        newHash,
        mileageAtTransfer: input.mileageAtTransfer,
        notes: input.notes,
      });

      // Update vehicle with new owner and hash
      return tx
        .update(vehicles)
        .set({
          ownerId: newOwnerId,
          hash: newHash,
          status: 'ACTIVE',
          updatedAt: new Date(),
        })
        .where(eq(vehicles.id, vehicle.id))
        .returning();
    });

    return updatedVehicle;
  }

  // ----------------------------------------------------------
  // LOOKUP BY VIN — used internally by other services
  // Returns minimal data needed to verify a vehicle exists
  // ----------------------------------------------------------

  async lookupByHash(hash: string): Promise<{
    id: string;
    hash: string;
    ownerId: string;
    make: string;
    model: string;
    year: number;
    fuelType: string;
    transmissionType: string;
    engineCapacity: string | null;
  } | null> {
    const vehicle = await db.query.vehicles.findFirst({
      where: eq(vehicles.hash, hash),
      columns: {
        id: true,
        hash: true,
        ownerId: true,
        make: true,
        model: true,
        year: true,
        fuelType: true,
        transmissionType: true,
        engineCapacity: true,
      },
    });

    return vehicle ?? null;
  }

  // ----------------------------------------------------------
  // GET OWNERSHIP HISTORY (admin + current owner)
  // ----------------------------------------------------------

  async getOwnershipHistory(hash: string, requesterId: string, requesterRole: string) {
    const vehicle = await db.query.vehicles.findFirst({
      where: eq(vehicles.hash, hash),
    });

    if (!vehicle) throw new VehicleNotFoundError(hash);

    if (requesterRole === 'OWNER' && vehicle.ownerId !== requesterId) {
      throw new ForbiddenError();
    }

    return db.query.vehicleOwnershipHistory.findMany({
      where: eq(vehicleOwnershipHistory.vehicleId, vehicle.id),
      orderBy: [desc(vehicleOwnershipHistory.transferredAt)],
    });
  }
}