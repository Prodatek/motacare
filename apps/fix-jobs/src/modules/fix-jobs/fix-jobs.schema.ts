import { z } from 'zod';

// ============================================================
// CREATE FIX JOB
// Called by inspection-service (or fixer directly) after a
// completed inspection reveals issues needing repair.
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
// UPDATE FIX JOB
// Fixer updates status, cost, notes as work progresses.
// ============================================================

export const updateFixJobSchema = z.object({
  status: z.enum([
    'PENDING', 'IN_PROGRESS', 'AWAITING_PARTS',
    'COMPLETED', 'DELIVERED', 'CANCELLED',
  ]).optional(),
  estimatedCompletionAt: z.coerce.date().nullable().optional(),
  finalCost: z.number().min(0).optional(),
  repairNotes: z.string().max(2000).nullable().optional(),
  notes: z.string().max(500).optional(), // status change note for history
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

export type CreateFixJobInput = z.infer<typeof createFixJobSchema>;
export type UpdateFixJobInput = z.infer<typeof updateFixJobSchema>;
export type FixJobQueryInput = z.infer<typeof fixJobQuerySchema>;