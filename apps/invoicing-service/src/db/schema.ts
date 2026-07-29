import {
  pgTable, uuid, text, timestamp, varchar, integer, decimal, boolean, pgEnum, index, unique,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ============================================================
// INVOICING SERVICE SCHEMA
//
// Owns: a per-workshop reusable line-item catalog, quotes,
// invoices (both with snapshotted line items), manual payment
// records against invoices, and per-workshop sequential
// document numbering. Financial reports are derived via
// aggregate queries over invoices + payments — no dedicated
// summary table.
//
// Cross-service refs (workshopId, ownerId, vehicleHash,
// inspectionId, fixJobId, createdBy, recordedBy) are plain
// indexed columns with NO FK — different services, different
// databases. Real FKs are only used within this service's own
// tables (quote/invoice <-> line items <-> payments, and the
// quote<->invoice conversion link).
// ============================================================

// ── ENUMS ─────────────────────────────────────────────────────

export const catalogItemKindEnum = pgEnum('catalog_item_kind', ['PART', 'LABOR', 'MISC']);
export const docTypeEnum = pgEnum('doc_type', ['QUOTE', 'INVOICE']);
export const quoteStatusEnum = pgEnum('quote_status', [
  'DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED',
]);
export const invoiceStatusEnum = pgEnum('invoice_status', [
  'DRAFT', 'SENT', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'VOID',
]);
export const paymentMethodEnum = pgEnum('payment_method', [
  'CASH', 'BANK_TRANSFER', 'MOBILE_MONEY', 'CARD', 'CHEQUE', 'OTHER',
]);

// ── DOCUMENT COUNTERS ─────────────────────────────────────────
// Per-workshop, per-doc-type sequential counter for gap-free
// numbering (e.g. Q-2026-000123 / INV-2026-000456). Incremented
// transactionally inside the create-quote/create-invoice flow.

export const documentCounters = pgTable(
  'document_counters',
  {
    id:         uuid('id').primaryKey().defaultRandom(),
    workshopId: uuid('workshop_id').notNull(),
    docType:    docTypeEnum('doc_type').notNull(),
    lastNumber: integer('last_number').notNull().default(0),
    updatedAt:  timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    workshopDocTypeUnique: unique('document_counters_workshop_doc_type_unique').on(table.workshopId, table.docType),
  }),
);

// ── CATALOG ITEMS ─────────────────────────────────────────────
// The reusable per-workshop line-item library. New descriptions
// typed into a quote/invoice are auto-upserted here (see
// quotes/invoices .service.ts) so staff stop re-typing the same
// parts/work descriptions.

export const catalogItems = pgTable(
  'catalog_items',
  {
    id:                     uuid('id').primaryKey().defaultRandom(),
    workshopId:             uuid('workshop_id').notNull(),

    description:            varchar('description', { length: 300 }).notNull(),
    normalizedDescription:  varchar('normalized_description', { length: 300 }).notNull(),
    kind:                   catalogItemKindEnum('kind').notNull().default('MISC'),
    category:               varchar('category', { length: 100 }),

    defaultUnit:            varchar('default_unit', { length: 20 }).notNull().default('pcs'),
    defaultUnitPrice:       decimal('default_unit_price', { precision: 12, scale: 2 }).notNull().default('0'),
    currency:               varchar('currency', { length: 3 }).notNull().default('NGN'),

    usageCount:             integer('usage_count').notNull().default(0),
    lastUsedAt:             timestamp('last_used_at'),

    isActive:               boolean('is_active').notNull().default(true),

    createdAt:              timestamp('created_at').notNull().defaultNow(),
    updatedAt:              timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    workshopIdx:          index('catalog_items_workshop_idx').on(table.workshopId),
    workshopNormDescUniq: unique('catalog_items_workshop_norm_desc_unique').on(table.workshopId, table.normalizedDescription),
    workshopUsageIdx:     index('catalog_items_workshop_usage_idx').on(table.workshopId, table.usageCount),
    workshopRecentIdx:    index('catalog_items_workshop_recent_idx').on(table.workshopId, table.lastUsedAt),
  }),
);

// ── QUOTES ────────────────────────────────────────────────────

export const quotes = pgTable(
  'quotes',
  {
    id:                 uuid('id').primaryKey().defaultRandom(),
    workshopId:         uuid('workshop_id').notNull(),
    createdBy:          uuid('created_by').notNull(),

    quoteNumber:        varchar('quote_number', { length: 30 }).notNull(),
    status:             quoteStatusEnum('status').notNull().default('DRAFT'),

    // Always required, denormalized — walk-in customers with no
    // app account are fully supported this way.
    customerName:       varchar('customer_name', { length: 200 }).notNull(),
    customerContact:    varchar('customer_contact', { length: 200 }).notNull(),
    customerAddress:    text('customer_address'),

    // Optional cross-service links
    ownerId:            uuid('owner_id'),
    vehicleHash:        varchar('vehicle_hash', { length: 64 }),
    vehicleDescription: varchar('vehicle_description', { length: 300 }),
    inspectionId:       uuid('inspection_id'),
    fixJobId:           uuid('fix_job_id'),

    currency:           varchar('currency', { length: 3 }).notNull().default('NGN'),
    subtotal:           decimal('subtotal', { precision: 12, scale: 2 }).notNull().default('0'),
    taxRate:            decimal('tax_rate', { precision: 5, scale: 2 }).notNull().default('0'),
    taxAmount:          decimal('tax_amount', { precision: 12, scale: 2 }).notNull().default('0'),
    discountAmount:     decimal('discount_amount', { precision: 12, scale: 2 }).notNull().default('0'),
    total:              decimal('total', { precision: 12, scale: 2 }).notNull().default('0'),

    notes:              text('notes'),
    validUntil:         timestamp('valid_until'),
    sentAt:             timestamp('sent_at'),
    respondedAt:        timestamp('responded_at'),
    rejectionReason:    text('rejection_reason'),

    convertedInvoiceId: uuid('converted_invoice_id'),
    convertedAt:        timestamp('converted_at'),

    createdAt:          timestamp('created_at').notNull().defaultNow(),
    updatedAt:          timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    workshopIdx:       index('quotes_workshop_idx').on(table.workshopId),
    workshopStatusIdx: index('quotes_workshop_status_idx').on(table.workshopId, table.status),
    ownerIdx:          index('quotes_owner_idx').on(table.ownerId),
    quoteNumberUniq:   unique('quotes_workshop_number_unique').on(table.workshopId, table.quoteNumber),
  }),
);

export const quoteLineItems = pgTable(
  'quote_line_items',
  {
    id:            uuid('id').primaryKey().defaultRandom(),
    quoteId:       uuid('quote_id').notNull().references(() => quotes.id, { onDelete: 'cascade' }),
    catalogItemId: uuid('catalog_item_id').references(() => catalogItems.id, { onDelete: 'set null' }),

    // Snapshot — immutable after save, never re-reads the catalog.
    description:   varchar('description', { length: 300 }).notNull(),
    kind:          catalogItemKindEnum('kind'),
    quantity:      decimal('quantity', { precision: 10, scale: 2 }).notNull().default('1'),
    unit:          varchar('unit', { length: 20 }).notNull().default('pcs'),
    unitPrice:     decimal('unit_price', { precision: 12, scale: 2 }).notNull(),
    lineTotal:     decimal('line_total', { precision: 12, scale: 2 }).notNull(),
    sortOrder:     integer('sort_order').notNull().default(0),

    createdAt:     timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    quoteIdx: index('quote_line_items_quote_idx').on(table.quoteId),
  }),
);

// ── INVOICES ──────────────────────────────────────────────────

export const invoices = pgTable(
  'invoices',
  {
    id:                 uuid('id').primaryKey().defaultRandom(),
    workshopId:         uuid('workshop_id').notNull(),
    createdBy:          uuid('created_by').notNull(),

    invoiceNumber:      varchar('invoice_number', { length: 30 }).notNull(),
    status:             invoiceStatusEnum('status').notNull().default('DRAFT'),
    sourceQuoteId:      uuid('source_quote_id').references(() => quotes.id, { onDelete: 'set null' }),

    customerName:       varchar('customer_name', { length: 200 }).notNull(),
    customerContact:    varchar('customer_contact', { length: 200 }).notNull(),
    customerAddress:    text('customer_address'),

    ownerId:            uuid('owner_id'),
    vehicleHash:        varchar('vehicle_hash', { length: 64 }),
    vehicleDescription: varchar('vehicle_description', { length: 300 }),
    inspectionId:       uuid('inspection_id'),
    fixJobId:           uuid('fix_job_id'),

    currency:           varchar('currency', { length: 3 }).notNull().default('NGN'),
    subtotal:           decimal('subtotal', { precision: 12, scale: 2 }).notNull().default('0'),
    taxRate:            decimal('tax_rate', { precision: 5, scale: 2 }).notNull().default('0'),
    taxAmount:          decimal('tax_amount', { precision: 12, scale: 2 }).notNull().default('0'),
    discountAmount:     decimal('discount_amount', { precision: 12, scale: 2 }).notNull().default('0'),
    total:              decimal('total', { precision: 12, scale: 2 }).notNull().default('0'),

    amountPaid:         decimal('amount_paid', { precision: 12, scale: 2 }).notNull().default('0'),
    amountDue:          decimal('amount_due', { precision: 12, scale: 2 }).notNull().default('0'),

    issueDate:          timestamp('issue_date').notNull().defaultNow(),
    dueDate:            timestamp('due_date'),
    sentAt:             timestamp('sent_at'),
    paidAt:             timestamp('paid_at'),
    voidedAt:           timestamp('voided_at'),
    voidReason:         text('void_reason'),

    notes:              text('notes'),

    createdAt:          timestamp('created_at').notNull().defaultNow(),
    updatedAt:          timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    workshopIdx:       index('invoices_workshop_idx').on(table.workshopId),
    workshopStatusIdx: index('invoices_workshop_status_idx').on(table.workshopId, table.status),
    ownerIdx:          index('invoices_owner_idx').on(table.ownerId),
    dueDateIdx:        index('invoices_due_date_idx').on(table.dueDate),
    invoiceNumberUniq: unique('invoices_workshop_number_unique').on(table.workshopId, table.invoiceNumber),
  }),
);

export const invoiceLineItems = pgTable(
  'invoice_line_items',
  {
    id:            uuid('id').primaryKey().defaultRandom(),
    invoiceId:     uuid('invoice_id').notNull().references(() => invoices.id, { onDelete: 'cascade' }),
    catalogItemId: uuid('catalog_item_id').references(() => catalogItems.id, { onDelete: 'set null' }),

    description:   varchar('description', { length: 300 }).notNull(),
    kind:          catalogItemKindEnum('kind'),
    quantity:      decimal('quantity', { precision: 10, scale: 2 }).notNull().default('1'),
    unit:          varchar('unit', { length: 20 }).notNull().default('pcs'),
    unitPrice:     decimal('unit_price', { precision: 12, scale: 2 }).notNull(),
    lineTotal:     decimal('line_total', { precision: 12, scale: 2 }).notNull(),
    sortOrder:     integer('sort_order').notNull().default(0),

    createdAt:     timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    invoiceIdx: index('invoice_line_items_invoice_idx').on(table.invoiceId),
  }),
);

// ── PAYMENTS ──────────────────────────────────────────────────
// Manually recorded payments (cash/bank/mobile money/etc) against
// an invoice. Supports partial payments — multiple rows per invoice.

export const payments = pgTable(
  'payments',
  {
    id:          uuid('id').primaryKey().defaultRandom(),
    invoiceId:   uuid('invoice_id').notNull().references(() => invoices.id, { onDelete: 'cascade' }),
    workshopId:  uuid('workshop_id').notNull(), // denormalized, avoids a join for reporting

    amount:      decimal('amount', { precision: 12, scale: 2 }).notNull(),
    method:      paymentMethodEnum('method').notNull(),
    paidAt:      timestamp('paid_at').notNull(),
    reference:   varchar('reference', { length: 100 }),
    note:        text('note'),
    recordedBy:  uuid('recorded_by').notNull(),

    createdAt:   timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    invoiceIdx:        index('payments_invoice_idx').on(table.invoiceId),
    workshopIdx:       index('payments_workshop_idx').on(table.workshopId),
    workshopPaidAtIdx: index('payments_workshop_paid_at_idx').on(table.workshopId, table.paidAt),
  }),
);

// ── RELATIONS ─────────────────────────────────────────────────

export const quotesRelations = relations(quotes, ({ many }) => ({
  lineItems: many(quoteLineItems),
}));

export const quoteLineItemsRelations = relations(quoteLineItems, ({ one }) => ({
  quote: one(quotes, { fields: [quoteLineItems.quoteId], references: [quotes.id] }),
  catalogItem: one(catalogItems, { fields: [quoteLineItems.catalogItemId], references: [catalogItems.id] }),
}));

export const invoicesRelations = relations(invoices, ({ many, one }) => ({
  lineItems: many(invoiceLineItems),
  payments: many(payments),
  sourceQuote: one(quotes, { fields: [invoices.sourceQuoteId], references: [quotes.id] }),
}));

export const invoiceLineItemsRelations = relations(invoiceLineItems, ({ one }) => ({
  invoice: one(invoices, { fields: [invoiceLineItems.invoiceId], references: [invoices.id] }),
  catalogItem: one(catalogItems, { fields: [invoiceLineItems.catalogItemId], references: [catalogItems.id] }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  invoice: one(invoices, { fields: [payments.invoiceId], references: [invoices.id] }),
}));

// ── INFERRED TYPES ────────────────────────────────────────────

export type CatalogItem    = typeof catalogItems.$inferSelect;
export type NewCatalogItem = typeof catalogItems.$inferInsert;

export type Quote          = typeof quotes.$inferSelect;
export type NewQuote       = typeof quotes.$inferInsert;
export type QuoteLineItem  = typeof quoteLineItems.$inferSelect;

export type Invoice          = typeof invoices.$inferSelect;
export type NewInvoice       = typeof invoices.$inferInsert;
export type InvoiceLineItem  = typeof invoiceLineItems.$inferSelect;

export type Payment    = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;

export type CatalogItemKind = 'PART' | 'LABOR' | 'MISC';
export type QuoteStatus     = 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';
export type InvoiceStatus   = 'DRAFT' | 'SENT' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'VOID';
export type PaymentMethod   = 'CASH' | 'BANK_TRANSFER' | 'MOBILE_MONEY' | 'CARD' | 'CHEQUE' | 'OTHER';
