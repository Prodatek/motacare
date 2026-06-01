import { z } from 'zod';

// ============================================================
// CREATE FIX JOB
// ============================================================

export const createFixJobSchema = z.object({
  inspectionId: z.string().uuid('Invalid inspection ID'),
  vehicleHash: z.string().length(64, 'Invalid vehicle hash'),
  ownerId: z.string().uuid('Invalid owner ID'),
  description: z.string().min(10, 'Description must be at least 10 characters').max(2000),
  estimatedCompletionAt: z.coerce.date().optional(),
  estimatedCost: z.number().min(0).optional(),
  currency: z.string().length(3).default('NGN'),
});

// ============================================================
// UPDATE FIX JOB — general fields (status, notes, cost, timing)
// ============================================================

export const updateFixJobSchema = z.object({
  status: z.enum([
    'PENDING', 'IN_PROGRESS', 'AWAITING_PARTS',
    'COMPLETED', 'DELIVERED', 'CANCELLED',
  ]).optional(),
  estimatedCompletionAt: z.coerce.date().nullable().optional(),
  finalCost: z.number().min(0).optional(),
  repairNotes: z.string().max(2000).nullable().optional(),
  notes: z.string().max(500).optional(),        // note logged in status history
});

// ============================================================
// ADD PART — adds one part to the partsUsed JSON array
// ============================================================

export const addPartSchema = z.object({
  name: z.string().min(1, 'Part name is required').max(200),
  quantity: z.number().int().min(1, 'Quantity must be at least 1'),
  unitCost: z.number().min(0, 'Unit cost must be 0 or greater'),
});

// ============================================================
// REMOVE PART — removes by index in the partsUsed array
// ============================================================

export const removePartSchema = z.object({
  partIndex: z.number().int().min(0, 'Invalid part index'),
});

// ============================================================
// CANCEL JOB — requires a reason
// ============================================================

export const cancelFixJobSchema = z.object({
  reason: z.string().min(5, 'Please provide a cancellation reason').max(500),
});

// ============================================================
// QUERY PARAMS
// ============================================================

export const fixJobQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  status: z.enum([
    'PENDING', 'IN_PROGRESS', 'AWAITING_PARTS',
    'COMPLETED', 'DELIVERED', 'CANCELLED',
  ]).optional(),
  vehicleHash: z.string().length(64).optional(),
});

// ============================================================
// INFERRED TYPES
// ============================================================

export type CreateFixJobInput   = z.infer<typeof createFixJobSchema>;
export type UpdateFixJobInput   = z.infer<typeof updateFixJobSchema>;
export type AddPartInput        = z.infer<typeof addPartSchema>;
export type RemovePartInput     = z.infer<typeof removePartSchema>;
export type CancelFixJobInput   = z.infer<typeof cancelFixJobSchema>;
export type FixJobQueryInput    = z.infer<typeof fixJobQuerySchema>;