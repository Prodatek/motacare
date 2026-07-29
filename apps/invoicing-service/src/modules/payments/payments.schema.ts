import { z } from 'zod';

export const PAYMENT_METHODS = ['CASH', 'BANK_TRANSFER', 'MOBILE_MONEY', 'CARD', 'CHEQUE', 'OTHER'] as const;

export const recordPaymentSchema = z.object({
  workshopId: z.string().uuid().optional(), // ADMIN only
  amount:     z.number().positive(),
  method:     z.enum(PAYMENT_METHODS),
  paidAt:     z.coerce.date().default(() => new Date()),
  reference:  z.string().max(100).optional(),
  note:       z.string().max(2000).optional(),
});

export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;
