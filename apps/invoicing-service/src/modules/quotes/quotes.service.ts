import { eq, and, ilike, desc, sql } from 'drizzle-orm';
import { db } from '../../db';
import {
  quotes, quoteLineItems, invoices, invoiceLineItems,
  type Quote, type QuoteLineItem,
} from '../../db/schema';
import { parsePagination, buildPaginationMeta, addDays } from '@motacare/shared-utils';
import { NotFoundError, ForbiddenError, ConflictError } from '../../errors';
import { nextDocumentNumber } from '../../lib/numbering';
import { computeTotals } from '../../lib/totals';
import { upsertCatalogItemFromLineItem } from '../catalog/catalog.service';
import type {
  CreateQuoteInput, UpdateQuoteInput, QuoteQueryInput, LineItemInput,
  RejectQuoteInput, ConvertQuoteInput,
} from './quotes.schema';

export interface QuoteWithLineItems extends Quote {
  lineItems: QuoteLineItem[];
}

// Staff are scoped to their workshop; OWNER isn't scoped to any one
// workshop and is instead scoped to documents addressed to them.
export interface QuoteScope {
  workshopId?: string;
  ownerId?: string;
}

// ============================================================
// QUOTES SERVICE
// ============================================================

export class QuotesService {

  // ----------------------------------------------------------
  // LIST / GET
  // ----------------------------------------------------------

  async listQuotes(scope: QuoteScope, query: QuoteQueryInput) {
    const { offset, limit, page } = parsePagination(query);

    const conditions = [];
    if (scope.workshopId) conditions.push(eq(quotes.workshopId, scope.workshopId));
    if (scope.ownerId) conditions.push(eq(quotes.ownerId, scope.ownerId));
    if (query.status) conditions.push(eq(quotes.status, query.status));
    if (query.search) conditions.push(ilike(quotes.customerName, `%${query.search}%`));
    const where = and(...conditions);

    const [rows, [{ total }]] = await Promise.all([
      db.query.quotes.findMany({ where, orderBy: [desc(quotes.createdAt)], limit, offset }),
      db.select({ total: sql<number>`count(*)::int` }).from(quotes).where(where),
    ]);

    return { data: rows, pagination: buildPaginationMeta(total, page, limit) };
  }

  async getQuote(id: string, scope: QuoteScope): Promise<QuoteWithLineItems> {
    const quote = await db.query.quotes.findFirst({
      where: eq(quotes.id, id),
      with: { lineItems: true },
    });
    if (!quote) throw new NotFoundError('Quote not found');
    if (scope.workshopId && quote.workshopId !== scope.workshopId) {
      throw new ForbiddenError('You do not have access to this quote');
    }
    if (scope.ownerId && quote.ownerId !== scope.ownerId) {
      throw new ForbiddenError('You do not have access to this quote');
    }
    return quote as QuoteWithLineItems;
  }

  // ----------------------------------------------------------
  // CREATE
  // ----------------------------------------------------------

  async createQuote(workshopId: string, createdBy: string, input: CreateQuoteInput): Promise<QuoteWithLineItems> {
    const { subtotal, taxAmount, total } = computeTotals(input.lineItems, input.taxRate, input.discountAmount);

    return db.transaction(async (tx) => {
      const quoteNumber = await nextDocumentNumber(tx, workshopId, 'QUOTE');

      const [quote] = await tx.insert(quotes).values({
        workshopId,
        createdBy,
        quoteNumber,
        customerName: input.customerName,
        customerContact: input.customerContact,
        customerAddress: input.customerAddress,
        ownerId: input.ownerId,
        vehicleHash: input.vehicleHash,
        vehicleDescription: input.vehicleDescription,
        inspectionId: input.inspectionId,
        fixJobId: input.fixJobId,
        currency: input.currency,
        taxRate: String(input.taxRate),
        taxAmount: String(taxAmount),
        discountAmount: String(input.discountAmount),
        subtotal: String(subtotal),
        total: String(total),
        notes: input.notes,
        validUntil: input.validUntil,
      }).returning();

      const lineItemRows = await insertQuoteLineItems(tx, quote.id, workshopId, input.lineItems);
      return { ...quote, lineItems: lineItemRows };
    });
  }

  // ----------------------------------------------------------
  // UPDATE (DRAFT only)
  // ----------------------------------------------------------

  async updateQuote(workshopId: string, id: string, input: UpdateQuoteInput): Promise<QuoteWithLineItems> {
    const existing = await this.getQuote(id, { workshopId });
    if (existing.status !== 'DRAFT') {
      throw new ConflictError('Only DRAFT quotes can be edited');
    }

    return db.transaction(async (tx) => {
      const lineItems = input.lineItems ?? existing.lineItems.map((li) => ({
        catalogItemId: li.catalogItemId ?? undefined,
        description: li.description,
        kind: li.kind ?? undefined,
        quantity: Number(li.quantity),
        unit: li.unit,
        unitPrice: Number(li.unitPrice),
      }));

      const taxRate = input.taxRate ?? Number(existing.taxRate);
      const discountAmount = input.discountAmount ?? Number(existing.discountAmount);
      const { subtotal, taxAmount, total } = computeTotals(lineItems, taxRate, discountAmount);

      const [updated] = await tx.update(quotes).set({
        customerName: input.customerName ?? existing.customerName,
        customerContact: input.customerContact ?? existing.customerContact,
        customerAddress: input.customerAddress ?? existing.customerAddress,
        ownerId: input.ownerId ?? existing.ownerId,
        vehicleHash: input.vehicleHash ?? existing.vehicleHash,
        vehicleDescription: input.vehicleDescription ?? existing.vehicleDescription,
        inspectionId: input.inspectionId ?? existing.inspectionId,
        fixJobId: input.fixJobId ?? existing.fixJobId,
        currency: input.currency ?? existing.currency,
        taxRate: String(taxRate),
        taxAmount: String(taxAmount),
        discountAmount: String(discountAmount),
        subtotal: String(subtotal),
        total: String(total),
        notes: input.notes ?? existing.notes,
        validUntil: input.validUntil ?? existing.validUntil,
        updatedAt: new Date(),
      }).where(eq(quotes.id, id)).returning();

      let lineItemRows = existing.lineItems;
      if (input.lineItems) {
        await tx.delete(quoteLineItems).where(eq(quoteLineItems.quoteId, id));
        lineItemRows = await insertQuoteLineItems(tx, id, workshopId, input.lineItems);
      }

      return { ...updated, lineItems: lineItemRows };
    });
  }

  // ----------------------------------------------------------
  // DELETE (DRAFT only)
  // ----------------------------------------------------------

  async deleteQuote(workshopId: string, id: string): Promise<void> {
    const existing = await this.getQuote(id, { workshopId });
    if (existing.status !== 'DRAFT') {
      throw new ConflictError('Only DRAFT quotes can be deleted');
    }
    await db.delete(quotes).where(eq(quotes.id, id));
  }

  // ----------------------------------------------------------
  // STATUS TRANSITIONS
  // ----------------------------------------------------------

  async sendQuote(workshopId: string, id: string): Promise<Quote> {
    const existing = await this.getQuote(id, { workshopId });
    if (existing.status !== 'DRAFT') {
      throw new ConflictError('Only DRAFT quotes can be sent');
    }
    const [updated] = await db.update(quotes)
      .set({ status: 'SENT', sentAt: new Date(), updatedAt: new Date() })
      .where(eq(quotes.id, id)).returning();
    return updated;
  }

  async acceptQuote(id: string, scope: QuoteScope): Promise<Quote> {
    const existing = await this.getQuote(id, scope);
    if (existing.status !== 'SENT') {
      throw new ConflictError('Only SENT quotes can be accepted');
    }
    const [updated] = await db.update(quotes)
      .set({ status: 'ACCEPTED', respondedAt: new Date(), updatedAt: new Date() })
      .where(eq(quotes.id, id)).returning();
    return updated;
  }

  async rejectQuote(id: string, input: RejectQuoteInput, scope: QuoteScope): Promise<Quote> {
    const existing = await this.getQuote(id, scope);
    if (existing.status !== 'SENT') {
      throw new ConflictError('Only SENT quotes can be rejected');
    }
    const [updated] = await db.update(quotes)
      .set({
        status: 'REJECTED',
        respondedAt: new Date(),
        rejectionReason: input.rejectionReason,
        updatedAt: new Date(),
      })
      .where(eq(quotes.id, id)).returning();
    return updated;
  }

  // ----------------------------------------------------------
  // CONVERT TO INVOICE (ACCEPTED only)
  // ----------------------------------------------------------

  async convertToInvoice(
    workshopId: string,
    id: string,
    createdBy: string,
    input: ConvertQuoteInput,
  ) {
    const quote = await this.getQuote(id, { workshopId });
    if (quote.status !== 'ACCEPTED') {
      throw new ConflictError('Only ACCEPTED quotes can be converted to an invoice');
    }
    if (quote.convertedInvoiceId) {
      throw new ConflictError('This quote has already been converted to an invoice');
    }

    return db.transaction(async (tx) => {
      const invoiceNumber = await nextDocumentNumber(tx, workshopId, 'INVOICE');
      const dueDate = input.dueDate ?? addDays(new Date(), 14);

      const [invoice] = await tx.insert(invoices).values({
        workshopId,
        createdBy,
        invoiceNumber,
        sourceQuoteId: quote.id,
        customerName: quote.customerName,
        customerContact: quote.customerContact,
        customerAddress: quote.customerAddress,
        ownerId: quote.ownerId,
        vehicleHash: quote.vehicleHash,
        vehicleDescription: quote.vehicleDescription,
        inspectionId: quote.inspectionId,
        fixJobId: quote.fixJobId,
        currency: quote.currency,
        subtotal: quote.subtotal,
        taxRate: quote.taxRate,
        taxAmount: quote.taxAmount,
        discountAmount: quote.discountAmount,
        total: quote.total,
        amountDue: quote.total,
        dueDate,
        notes: input.notes ?? quote.notes,
      }).returning();

      // Copy line items verbatim — invoice line items are their own
      // snapshot, independent of the quote's from this point on.
      const lineItemValues = quote.lineItems.map((li) => ({
        invoiceId: invoice.id,
        catalogItemId: li.catalogItemId,
        description: li.description,
        kind: li.kind,
        quantity: li.quantity,
        unit: li.unit,
        unitPrice: li.unitPrice,
        lineTotal: li.lineTotal,
        sortOrder: li.sortOrder,
      }));
      const invoiceLineItemRows = lineItemValues.length
        ? await tx.insert(invoiceLineItems).values(lineItemValues).returning()
        : [];

      await tx.update(quotes)
        .set({ convertedInvoiceId: invoice.id, convertedAt: new Date(), updatedAt: new Date() })
        .where(eq(quotes.id, id));

      return { ...invoice, lineItems: invoiceLineItemRows };
    });
  }
}

// ============================================================
// SHARED LINE-ITEM INSERT (also imported by invoices.service.ts
// convert flow indirectly via quote copy above — this helper is
// specific to fresh quote creation/edits)
// ============================================================

async function insertQuoteLineItems(
  tx: any,
  quoteId: string,
  workshopId: string,
  lineItems: LineItemInput[],
): Promise<QuoteLineItem[]> {
  const rows: QuoteLineItem[] = [];
  let sortOrder = 0;
  for (const li of lineItems) {
    const catalogItemId = await upsertCatalogItemFromLineItem(tx, workshopId, {
      catalogItemId: li.catalogItemId,
      description: li.description,
      kind: li.kind,
      unit: li.unit,
      unitPrice: li.unitPrice,
    });
    const lineTotal = li.quantity * li.unitPrice;
    const [row] = await tx.insert(quoteLineItems).values({
      quoteId,
      catalogItemId,
      description: li.description.trim(),
      kind: li.kind,
      quantity: String(li.quantity),
      unit: li.unit,
      unitPrice: String(li.unitPrice),
      lineTotal: String(lineTotal),
      sortOrder: sortOrder++,
    }).returning();
    rows.push(row);
  }
  return rows;
}
