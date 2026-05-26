import { z } from 'zod';

// ============================================================
// VIN VALIDATION
// ISO 3779 standard: 17 chars, no I, O, or Q
// ============================================================

const vinRegex = /^[A-HJ-NPR-Z0-9]{17}$/;

const vinField = z
  .string()
  .length(17, 'VIN must be exactly 17 characters')
  .regex(vinRegex, 'VIN contains invalid characters (I, O, Q are not allowed)')
  .transform((v) => v.toUpperCase());

const currentYear = new Date().getFullYear();

// ============================================================
// REGISTER VEHICLE
// ============================================================

export const registerVehicleSchema = z.object({
  vin: vinField,
  licensePlate: z
    .string()
    .min(2)
    .max(20)
    .transform((v) => v.toUpperCase().trim()),
  make: z.string().min(1).max(100),
  model: z.string().min(1).max(100),
  year: z
    .coerce.number()
    .int()
    .min(1900, 'Year must be 1900 or later')
    .max(currentYear + 1, `Year cannot exceed ${currentYear + 1}`),
  color: z.string().max(50).optional(),
  trim: z.string().max(100).optional(),
  fuelType: z.enum(['PETROL', 'DIESEL', 'ELECTRIC', 'HYBRID', 'CNG', 'LPG']),
  transmissionType: z.enum(['MANUAL', 'AUTOMATIC', 'CVT']),
  engineCapacity: z.string().max(20).optional(),
  engineCode: z.string().max(50).optional(),
  mileageAtRegistration: z.coerce.number().int().min(0).default(0),
});

// ============================================================
// UPDATE VEHICLE (partial — only mutable fields)
// VIN, make, model, year cannot change after registration
// ============================================================

export const updateVehicleSchema = z.object({
  licensePlate: z
    .string()
    .min(2)
    .max(20)
    .transform((v) => v.toUpperCase().trim())
    .optional(),
  color: z.string().max(50).optional(),
  trim: z.string().max(100).optional(),
  fuelType: z.enum(['PETROL', 'DIESEL', 'ELECTRIC', 'HYBRID', 'CNG', 'LPG']).optional(),
  transmissionType: z.enum(['MANUAL', 'AUTOMATIC', 'CVT']).optional(),
  engineCapacity: z.string().max(20).optional(),
  engineCode: z.string().max(50).optional(),
});

// ============================================================
// TRANSFER OWNERSHIP
// ============================================================

export const transferOwnershipSchema = z.object({
  newOwnerEmail: z.string().email('Invalid email address'),
  mileageAtTransfer: z.number().int().min(0),
  notes: z.string().max(500).optional(),
});

// ============================================================
// QUERY PARAMS
// ============================================================

export const vehicleQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  status: z.enum(['ACTIVE', 'INACTIVE', 'TRANSFERRED']).optional(),
});

// ============================================================
// INFERRED TYPES
// ============================================================

export type RegisterVehicleInput = z.infer<typeof registerVehicleSchema>;
export type UpdateVehicleInput = z.infer<typeof updateVehicleSchema>;
export type TransferOwnershipInput = z.infer<typeof transferOwnershipSchema>;
export type VehicleQueryInput = z.infer<typeof vehicleQuerySchema>;