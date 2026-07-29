import { z } from 'zod';

export const CATALOG_ITEM_KINDS = ['PART', 'LABOR', 'MISC'] as const;

export const catalogQuerySchema = z.object({
  page:     z.coerce.number().int().min(1).default(1),
  limit:    z.coerce.number().int().min(1).max(100).default(30),
  search:   z.string().max(100).optional(),
  kind:     z.enum(CATALOG_ITEM_KINDS).optional(),
  category: z.string().max(100).optional(),
  sort:     z.enum(['usage', 'recent', 'alpha']).default('usage'),
  includeInactive: z.coerce.boolean().default(false),
});

export const createCatalogItemSchema = z.object({
  description:      z.string().min(1).max(300),
  kind:             z.enum(CATALOG_ITEM_KINDS).default('MISC'),
  category:         z.string().max(100).optional(),
  defaultUnit:      z.string().max(20).default('pcs'),
  defaultUnitPrice: z.number().min(0).default(0),
  currency:         z.string().length(3).default('NGN'),
});

export const updateCatalogItemSchema = z.object({
  description:      z.string().min(1).max(300).optional(),
  kind:             z.enum(CATALOG_ITEM_KINDS).optional(),
  category:         z.string().max(100).nullable().optional(),
  defaultUnit:      z.string().max(20).optional(),
  defaultUnitPrice: z.number().min(0).optional(),
  currency:         z.string().length(3).optional(),
  isActive:         z.boolean().optional(),
});

export type CatalogQueryInput        = z.infer<typeof catalogQuerySchema>;
export type CreateCatalogItemInput   = z.infer<typeof createCatalogItemSchema>;
export type UpdateCatalogItemInput   = z.infer<typeof updateCatalogItemSchema>;
