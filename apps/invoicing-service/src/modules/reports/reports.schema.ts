import { z } from 'zod';

export const reportRangeSchema = z.object({
  workshopId: z.string().uuid().optional(), // ADMIN only
  from:       z.coerce.date().optional(),
  to:         z.coerce.date().optional(),
});

export const topCustomersQuerySchema = reportRangeSchema.extend({
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export type ReportRangeInput      = z.infer<typeof reportRangeSchema>;
export type TopCustomersQueryInput = z.infer<typeof topCustomersQuerySchema>;
