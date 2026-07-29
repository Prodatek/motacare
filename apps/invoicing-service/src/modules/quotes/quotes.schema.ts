import { z } from 'zod';
import { CATALOG_ITEM_KINDS } from '../catalog/catalog.schema';

export const lineItemInputSchema = z.object({
  catalogItemId: z.string().uuid().optional(),
  description:   z.string().min(1).max(300),
  kind:          z.enum(CATALOG_ITEM_KINDS).optional(),
  quantity:      z.number().positive().default(1),
  unit:          z.string().max(20).default('pcs'),
  unitPrice:     z.number().min(0),
});

export const createQuoteSchema = z.object({
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
  validUntil:         z.coerce.date().optional(),
  lineItems:          z.array(lineItemInputSchema).min(1, 'At least one line item is required'),
});

export const updateQuoteSchema = createQuoteSchema.partial().extend({
  lineItems: z.array(lineItemInputSchema).min(1).optional(),
});

export const quoteQuerySchema = z.object({
  workshopId: z.string().uuid().optional(), // ADMIN only
  page:       z.coerce.number().int().min(1).default(1),
  limit:      z.coerce.number().int().min(1).max(100).default(30),
  search:     z.string().max(100).optional(),
  status:     z.enum(['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED']).optional(),
});

export const rejectQuoteSchema = z.object({
  rejectionReason: z.string().max(2000).optional(),
});

export const convertQuoteSchema = z.object({
  dueDate: z.coerce.date().optional(),
  notes:   z.string().max(2000).optional(),
});

export type LineItemInput      = z.infer<typeof lineItemInputSchema>;
export type CreateQuoteInput   = z.infer<typeof createQuoteSchema>;
export type UpdateQuoteInput   = z.infer<typeof updateQuoteSchema>;
export type QuoteQueryInput    = z.infer<typeof quoteQuerySchema>;
export type RejectQuoteInput   = z.infer<typeof rejectQuoteSchema>;
export type ConvertQuoteInput  = z.infer<typeof convertQuoteSchema>;
