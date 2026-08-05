import { z } from 'zod';

const SPECIALTIES = [
  'Engine', 'Brakes', 'Tyres', 'Electrical', 'Fluids',
  'Transmission', 'Body & Paint', 'Exhaust', 'AC & Cooling',
  'Suspension', 'Diagnostics', 'Fabrication',
] as const;

// ============================================================
// CREATE WORKSHOP
// A FIXER calls this — they become the WORKSHOP_ADMIN.
// ============================================================
export const createWorkshopSchema = z.object({
  name:        z.string().min(3).max(200),
  description: z.string().max(1000).optional(),
  address:     z.string().min(5).max(500),
  city:        z.string().min(2).max(100),
  state:       z.string().min(2).max(100),
  phone:       z.string().max(20).optional(),
  email:       z.string().email().optional(),
  specialties: z.array(z.enum(SPECIALTIES)).min(1).max(6).optional(),
});

// ============================================================
// UPDATE WORKSHOP (admin only)
// ============================================================
export const updateWorkshopSchema = z.object({
  name:        z.string().min(3).max(200).optional(),
  description: z.string().max(1000).nullable().optional(),
  address:     z.string().min(5).max(500).optional(),
  city:        z.string().min(2).max(100).optional(),
  state:       z.string().min(2).max(100).optional(),
  phone:       z.string().max(20).nullable().optional(),
  email:       z.string().email().nullable().optional(),
  specialties: z.array(z.enum(SPECIALTIES)).min(1).max(6).optional(),
  logoUrl:     z.string().url().max(500).nullable().optional(),
});

// ============================================================
// JOIN REQUEST — fixer applies to join a workshop
// ============================================================
export const joinRequestSchema = z.object({
  workshopId: z.string().uuid('Invalid workshop ID'),
  note:       z.string().max(500).optional(),
});

// ============================================================
// APPROVE / REJECT a join request (admin only)
// ============================================================
export const memberActionSchema = z.object({
  action:          z.enum(['APPROVE', 'REJECT']),
  rejectionReason: z.string().max(500).optional(),
});

// ============================================================
// WORKSHOP QUERY
// ============================================================
export const workshopQuerySchema = z.object({
  page:       z.coerce.number().int().min(1).default(1),
  limit:      z.coerce.number().int().min(1).max(50).default(20),
  city:       z.string().optional(),
  specialty:  z.string().optional(),
  featured:   z.coerce.boolean().optional(),
  search:     z.string().max(100).optional(),
});

// ============================================================
// STATS QUERY
// ============================================================
export const statsQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to:   z.coerce.date().optional(),
});

export type CreateWorkshopInput = z.infer<typeof createWorkshopSchema>;
export type UpdateWorkshopInput = z.infer<typeof updateWorkshopSchema>;
export type JoinRequestInput    = z.infer<typeof joinRequestSchema>;
export type MemberActionInput   = z.infer<typeof memberActionSchema>;
export type WorkshopQueryInput  = z.infer<typeof workshopQuerySchema>;
export type StatsQueryInput     = z.infer<typeof statsQuerySchema>;