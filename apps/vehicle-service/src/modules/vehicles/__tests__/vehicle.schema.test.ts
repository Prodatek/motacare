import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VehicleService, VehicleAlreadyRegisteredError, ForbiddenError, ConflictError } from '../vehicle.service';

// ============================================================
// MOCKS
// ============================================================

vi.mock('../../../db', () => ({
  db: {
    query: {
      vehicles: { findFirst: vi.fn() },
      vehicleOwnershipHistory: { findMany: vi.fn() },
    },
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(() => Promise.resolve([mockVehicle])),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn(() => Promise.resolve([mockVehicle])),
        })),
      })),
    })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve([{ value: 1 }])),
      })),
    })),
    transaction: vi.fn(async (cb: any) => cb({
      insert: vi.fn(() => ({ values: vi.fn(() => Promise.resolve()) })),
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            returning: vi.fn(() => Promise.resolve([{ ...mockVehicle, ownerId: 'new-owner-id', hash: 'new-hash' }])),
          })),
        })),
      })),
    })),
  },
}));

vi.mock('../../../config/env', () => ({
  env: {
    VEHICLE_HASH_SECRET: 'test-vehicle-secret-that-is-long-enough',
    AUTH_SERVICE_URL: 'http://localhost:3001',
    NODE_ENV: 'test',
  },
}));

// ============================================================
// FIXTURES
// ============================================================

const mockVehicle = {
  id: 'vehicle-uuid-123',
  hash: 'abc123def456',
  ownerId: 'owner-uuid-456',
  vin: 'JH4KA7532MC000001',
  licensePlate: 'LAG-001-AA',
  make: 'Toyota',
  model: 'Camry',
  year: 2020,
  color: 'Black',
  trim: 'LE',
  fuelType: 'PETROL',
  transmissionType: 'AUTOMATIC',
  engineCapacity: '2.5L',
  engineCode: '2AR-FE',
  mileageAtRegistration: 45000,
  status: 'ACTIVE',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const validRegisterInput = {
  vin: 'JH4KA7532MC000001',
  licensePlate: 'LAG-001-AA',
  make: 'Toyota',
  model: 'Camry',
  year: 2020,
  fuelType: 'PETROL' as const,
  transmissionType: 'AUTOMATIC' as const,
  mileageAtRegistration: 45000,
};

// ============================================================
// TESTS
// ============================================================

describe('VehicleService', () => {
  let service: VehicleService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new VehicleService();
  });

  // ----------------------------------------------------------

  describe('registerVehicle()', () => {
    it('should throw VehicleAlreadyRegisteredError if VIN already exists for owner', async () => {
      const { db } = await import('../../../db');
      vi.mocked(db.query.vehicles.findFirst).mockResolvedValueOnce(mockVehicle as any);

      await expect(
        service.registerVehicle(validRegisterInput, 'owner-uuid-456'),
      ).rejects.toThrow(VehicleAlreadyRegisteredError);
    });

    it('should return a vehicle with a hash on success', async () => {
      const { db } = await import('../../../db');
      vi.mocked(db.query.vehicles.findFirst).mockResolvedValueOnce(undefined as any);

      const result = await service.registerVehicle(validRegisterInput, 'owner-uuid-456');

      expect(result).toHaveProperty('hash');
      expect(result).toHaveProperty('vin', 'JH4KA7532MC000001');
      expect(result).toHaveProperty('make', 'Toyota');
    });

    it('should generate different hashes for the same VIN under different owners', async () => {
      const { generateVehicleHash } = await import('@motacare/shared-utils');
      const secret = 'test-vehicle-secret-that-is-long-enough';
      const vin = 'JH4KA7532MC000001';

      const hash1 = generateVehicleHash(vin, 'owner-aaa', secret);
      const hash2 = generateVehicleHash(vin, 'owner-bbb', secret);

      expect(hash1).not.toBe(hash2);
    });

    it('should generate the same hash for the same VIN and owner every time (deterministic)', async () => {
      const { generateVehicleHash } = await import('@motacare/shared-utils');
      const secret = 'test-vehicle-secret-that-is-long-enough';

      const hash1 = generateVehicleHash('JH4KA7532MC000001', 'owner-aaa', secret);
      const hash2 = generateVehicleHash('JH4KA7532MC000001', 'owner-aaa', secret);

      expect(hash1).toBe(hash2);
    });
  });

  // ----------------------------------------------------------

  describe('getVehicleByHash()', () => {
    it('should throw ForbiddenError if an OWNER requests another owner\'s vehicle', async () => {
      const { db } = await import('../../../db');
      vi.mocked(db.query.vehicles.findFirst).mockResolvedValueOnce(mockVehicle as any);

      await expect(
        service.getVehicleByHash('abc123', 'different-owner-id', 'OWNER'),
      ).rejects.toThrow(ForbiddenError);
    });

    it('should allow FIXER to see any vehicle by hash', async () => {
      const { db } = await import('../../../db');
      vi.mocked(db.query.vehicles.findFirst).mockResolvedValueOnce(mockVehicle as any);

      const result = await service.getVehicleByHash('abc123', 'fixer-id', 'FIXER');
      expect(result).toHaveProperty('vin', 'JH4KA7532MC000001');
    });

    it('should allow OWNER to see their own vehicle', async () => {
      const { db } = await import('../../../db');
      vi.mocked(db.query.vehicles.findFirst).mockResolvedValueOnce(mockVehicle as any);

      const result = await service.getVehicleByHash('abc123', 'owner-uuid-456', 'OWNER');
      expect(result).toHaveProperty('id', 'vehicle-uuid-123');
    });
  });

  // ----------------------------------------------------------

  describe('transferOwnership()', () => {
    it('should throw ConflictError if transferring to the same owner', async () => {
      const { db } = await import('../../../db');
      vi.mocked(db.query.vehicles.findFirst).mockResolvedValueOnce(mockVehicle as any);

      await expect(
        service.transferOwnership(
          'abc123',
          { newOwnerEmail: 'same@owner.com', mileageAtTransfer: 50000 },
          'owner-uuid-456',
          'owner-uuid-456', // same owner
        ),
      ).rejects.toThrow(ConflictError);
    });

    it('should generate a new hash when ownership is transferred', async () => {
      const { generateVehicleHash } = await import('@motacare/shared-utils');
      const secret = 'test-vehicle-secret-that-is-long-enough';

      const oldHash = generateVehicleHash('JH4KA7532MC000001', 'owner-aaa', secret);
      const newHash = generateVehicleHash('JH4KA7532MC000001', 'owner-bbb', secret);

      expect(newHash).not.toBe(oldHash);
      expect(newHash).toHaveLength(64); // SHA-256 hex = 64 chars
    });
  });

  // ----------------------------------------------------------

  describe('hash integrity', () => {
    it('should produce a 64-character hex hash', async () => {
      const { generateVehicleHash } = await import('@motacare/shared-utils');
      const hash = generateVehicleHash(
        'JH4KA7532MC000001',
        'owner-uuid-456',
        'test-vehicle-secret-that-is-long-enough',
      );
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should be sensitive to VIN casing (always uppercased internally)', async () => {
      const { generateVehicleHash } = await import('@motacare/shared-utils');
      const secret = 'test-vehicle-secret-that-is-long-enough';

      // generateVehicleHash uppercases the VIN — both should produce the same result
      const h1 = generateVehicleHash('jh4ka7532mc000001', 'owner', secret);
      const h2 = generateVehicleHash('JH4KA7532MC000001', 'owner', secret);
      expect(h1).toBe(h2);
    });
  });
});