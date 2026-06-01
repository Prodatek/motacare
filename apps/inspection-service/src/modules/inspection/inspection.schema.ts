import { z } from 'zod';
import { ALL_CHECK_IDS } from './checklist';

// ============================================================
// CREATE INSPECTION SESSION
// ============================================================

export const createInspectionSchema = z.object({
  vehicleHash: z.string().length(64, 'Invalid vehicle hash'),
  mileageAtInspection: z.number().int().min(0, 'Mileage cannot be negative'),
  reportedSymptoms: z.array(z.string().max(200)).max(10).optional(),
  priorityAreas: z.array(
    z.enum(['engine', 'brakes', 'tyres', 'electrical', 'fluids', 'transmission', 'body', 'exhaust']),
  ).optional(),
});

// ============================================================
// UPDATE A SINGLE INSPECTION ITEM
//
// BUG FIX: the original validator used ALL_CHECK_IDS.includes(id)
// which blocked AI-generated check IDs (prefixed "ai_").
// We now accept any non-empty string so both static and AI-
// generated check IDs pass through cleanly.
// ============================================================

export const updateItemSchema = z.object({
  checkId: z.string().min(1, 'checkId is required'),
  status: z.enum(['PASS', 'FAIL', 'WARNING', 'NOT_CHECKED']),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  mediaUrls: z.array(z.string().url()).max(10).optional(),
});

// ============================================================
// BATCH UPDATE
// ============================================================

export const batchUpdateItemsSchema = z.object({
  items: z.array(updateItemSchema).min(1).max(50),
});

// ============================================================
// COMPLETE INSPECTION
//
// BUG FIX: previous version had summary: z.string().min(10)
// and no outcome field. The controller was receiving
// { outcome, summary } from the frontend but the schema only
// knew about summary — causing a 400 on every completion attempt.
//
// The fixer now explicitly selects an outcome:
//   COMPLETED     — all done, vehicle is ready
//   NEEDS_FOLLOWUP — issues found, repairs required
//   DRAFT         — save progress and continue later
//
// Summary is required for COMPLETED and NEEDS_FOLLOWUP,
// optional for DRAFT. The service enforces this at runtime.
// ============================================================

export const completeInspectionSchema = z.object({
  outcome: z.enum(['COMPLETED', 'NEEDS_FOLLOWUP', 'DRAFT'], {
    required_error: 'outcome is required (COMPLETED, NEEDS_FOLLOWUP, or DRAFT)',
    invalid_type_error: 'outcome must be COMPLETED, NEEDS_FOLLOWUP, or DRAFT',
  }),
  summary: z.string().max(2000).optional().nullable(),
});

// ============================================================
// CREATE FIX JOB (nested under inspection — legacy route)
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
    'PENDING', 'IN_PROGRESS', 'AWAITING_PARTS',
    'COMPLETED', 'DELIVERED', 'CANCELLED',
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