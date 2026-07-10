import { z } from 'zod';

// ── Note types ────────────────────────────────────────────────

export const NOTE_TYPES = ['GENERAL', 'PREFERENCE', 'WARNING', 'FOLLOWUP'] as const;

// ── Create note ───────────────────────────────────────────────

export const createNoteSchema = z.object({
  type:         z.enum(NOTE_TYPES).default('GENERAL'),
  content:      z.string().min(1, 'Note content cannot be empty').max(2000),
  vehicleHash:  z.string().length(64).optional(),
  inspectionId: z.string().uuid().optional(),
  fixJobId:     z.string().uuid().optional(),
});

// ── Update note ───────────────────────────────────────────────

export const updateNoteSchema = z.object({
  type:    z.enum(NOTE_TYPES).optional(),
  content: z.string().min(1).max(2000).optional(),
});

// ── Customer list query ───────────────────────────────────────

export const customerQuerySchema = z.object({
  page:   z.coerce.number().int().min(1).default(1),
  limit:  z.coerce.number().int().min(1).max(100).default(30),
  search: z.string().max(100).optional(),
  sort:   z.enum(['lastVisitAt:desc', 'totalSpend:desc', 'totalFixJobs:desc']).default('lastVisitAt:desc'),
});

// ── Inferred types ─────────────────────────────────────────────

export type CreateNoteInput   = z.infer<typeof createNoteSchema>;
export type UpdateNoteInput   = z.infer<typeof updateNoteSchema>;
export type CustomerQueryInput = z.infer<typeof customerQuerySchema>;