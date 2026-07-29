import { z } from 'zod';
import { lineItemInputSchema } from '../quotes/quotes.schema';

export const createInvoiceSchema = z.object({
  workshopId:         z.string().uuid().optional(), // ADMIN only
  customerName:       z.string().min(1).max(200),
  customerContact:    z.string().min(1).max(200),
  customerAddress:    z.string().max(2000).optional(),
  ownerId:            z.string().uuid().optional(),
  vehicleHash:        z.string().length(64).optional(),
  vehicleDescription: z.string().max(300).optional(),
  inspectionId:       z.string().uuid().optional(),
  fixJobId:           z.string().uuid().optional(),
  currency:           z.string().length(3).default('NGN'),
  taxRate:            z.number().min(0).max(100).default(0),
  discountAmount:     z.number().min(0).default(0),
  notes:              z.string().max(2000).optional(),
  dueDate:            z.coerce.date().optional(),
  lineItems:          z.array(lineItemInputSchema).min(1, 'At least one line item is required'),
});

export const updateInvoiceSchema = createInvoiceSchema.partial().extend({
  lineItems: z.array(lineItemInputSchema).min(1).optional(),
});

export const invoiceQuerySchema = z.object({
  workshopId: z.string().uuid().optional(), // ADMIN only
  page:       z.coerce.number().int().min(1).default(1),
  limit:      z.coerce.number().int().min(1).max(100).default(30),
  search:     z.string().max(100).optional(),
  status:     z.enum(['DRAFT', 'SENT', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'VOID']).optional(),
});

export const voidInvoiceSchema = z.object({
  voidReason: z.string().max(2000).optional(),
});

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>;
export type InvoiceQueryInput  = z.infer<typeof invoiceQuerySchema>;
export type VoidInvoiceInput   = z.infer<typeof voidInvoiceSchema>;
