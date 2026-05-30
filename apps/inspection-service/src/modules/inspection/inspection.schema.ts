import { z } from 'zod';
import { ALL_CHECK_IDS } from './checklist';

// ============================================================
// CREATE INSPECTION SESSION
// ============================================================

export const createInspectionSchema = z.object({
  vehicleHash: z.string().length(64, 'Invalid vehicle hash'),
  mileageAtInspection: z.number().int().min(0, 'Mileage cannot be negative'),
  // Phase 2: owner-reported symptoms and fixer priority areas
  reportedSymptoms: z.array(z.string().max(200)).max(10).optional(),
  priorityAreas: z.array(
    z.enum(['engine', 'brakes', 'tyres', 'electrical', 'fluids', 'transmission', 'body', 'exhaust'])
  ).optional(),
});

// ============================================================
// UPDATE A SINGLE INSPECTION ITEM
// Fixers submit one item at a time as they work through the car
// ============================================================

export const updateItemSchema = z.object({
  checkId: z.string().refine(
    (id) => ALL_CHECK_IDS.includes(id),
    { message: 'Unknown check ID — must be a valid checklist item' },
  ),
  status: z.enum(['PASS', 'FAIL', 'WARNING', 'NOT_CHECKED']),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  mediaUrls: z.array(z.string().url()).max(10).optional(),
});

// ============================================================
// BATCH UPDATE — submit multiple items at once
// ============================================================

export const batchUpdateItemsSchema = z.object({
  items: z.array(updateItemSchema).min(1).max(50),
});

// ============================================================
// COMPLETE INSPECTION
// Fixer explicitly chooses the outcome — the system no longer
// auto-derives it from pass/fail counts.
// ============================================================

export const completeInspectionSchema = z.object({
  // Fixer's written summary — required for COMPLETED and NEEDS_FOLLOWUP, optional for DRAFT
  summary: z.string().max(2000).optional().nullable(),

  // Explicit outcome chosen by the fixer
  outcome: z.enum(['COMPLETED', 'NEEDS_FOLLOWUP', 'DRAFT'], {
    errorMap: () => ({ message: 'Outcome must be COMPLETED, NEEDS_FOLLOWUP, or DRAFT' }),
  }),
});

// ============================================================
// CREATE FIX JOB
// ============================================================

export const createFixJobSchema = z.object({
  description: z.string().min(10).max(2000),
  estimatedCompletionAt: z.coerce.date().optional(),
  estimatedCost: z.number().min(0).optional(),
  currency: z.string().length(3).default('NGN'),
});

// ============================================================
// UPDATE FIX JOB STATUS
// ============================================================

export const updateFixJobSchema = z.object({
  status: z.enum([
    'PENDING',
    'IN_PROGRESS',
    'AWAITING_PARTS',
    'COMPLETED',
    'DELIVERED',
    'CANCELLED',
  ]).optional(),
  estimatedCompletionAt: z.coerce.date().optional().nullable(),
  finalCost: z.number().min(0).optional(),
  repairNotes: z.string().max(2000).optional().nullable(),
  partsUsed: z.array(z.object({
    name: z.string().min(1),
    quantity: z.number().int().min(1),
    unitCost: z.number().min(0),
  })).optional(),
});

// ============================================================
// QUERY PARAMS
// ============================================================

export const inspectionQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  status: z.enum(['DRAFT', 'IN_PROGRESS', 'COMPLETED', 'NEEDS_FOLLOWUP']).optional(),
  vehicleHash: z.string().length(64).optional(),
});

export const fixJobQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  status: z.enum([
    'PENDING', 'IN_PROGRESS', 'AWAITING_PARTS',
    'COMPLETED', 'DELIVERED', 'CANCELLED',
  ]).optional(),
});

// ============================================================
// INFERRED TYPES
// ============================================================

export type CreateInspectionInput = z.infer<typeof createInspectionSchema>;
export type UpdateItemInput = z.infer<typeof updateItemSchema>;
export type BatchUpdateItemsInput = z.infer<typeof batchUpdateItemsSchema>;
export type CompleteInspectionInput = z.infer<typeof completeInspectionSchema>;
export type CreateFixJobInput = z.infer<typeof createFixJobSchema>;
export type UpdateFixJobInput = z.infer<typeof updateFixJobSchema>;
export type InspectionQueryInput = z.infer<typeof inspectionQuerySchema>;
export type FixJobQueryInput = z.infer<typeof fixJobQuerySchema>;