import { eq, and, ilike, desc, lt, inArray, sql } from 'drizzle-orm';
import { db } from '../../db';
import {
  invoices, invoiceLineItems, type Invoice, type InvoiceLineItem, type Payment,
} from '../../db/schema';
import { parsePagination, buildPaginationMeta, addDays } from '@motacare/shared-utils';
import { NotFoundError, ForbiddenError, ConflictError } from '../../errors';
import { nextDocumentNumber } from '../../lib/numbering';
import { computeTotals } from '../../lib/totals';
import { upsertCatalogItemFromLineItem } from '../catalog/catalog.service';
import type { CreateInvoiceInput, UpdateInvoiceInput, InvoiceQueryInput, VoidInvoiceInput } from './invoices.schema';
import type { LineItemInput } from '../quotes/quotes.schema';

export interface InvoiceWithLineItems extends Invoice {
  lineItems: InvoiceLineItem[];
  payments?: Payment[];
}

export interface InvoiceScope {
  workshopId?: string;
  ownerId?: string;
}

async function recomputeOverdue(where: ReturnType<typeof and>) {
  await db.update(invoices)
    .set({ status: 'OVERDUE', updatedAt: new Date() })
    .where(and(where, inArray(invoices.status, ['SENT', 'PARTIALLY_PAID']), lt(invoices.dueDate, new Date())));
}

export class InvoicesService {

  // ----------------------------------------------------------
  // LIST / GET
  // ----------------------------------------------------------

  async listInvoices(scope: InvoiceScope, query: InvoiceQueryInput) {
    const { offset, limit, page } = parsePagination(query);

    const conditions = [];
    if (scope.workshopId) conditions.push(eq(invoices.workshopId, scope.workshopId));
    if (scope.ownerId) conditions.push(eq(invoices.ownerId, scope.ownerId));
    const scopeWhere = and(...conditions);

    await recomputeOverdue(scopeWhere);

    if (query.status) conditions.push(eq(invoices.status, query.status));
    if (query.search) conditions.push(ilike(invoices.customerName, `%${query.search}%`));
    const where = and(...conditions);

    const [rows, [{ total }]] = await Promise.all([
      db.query.invoices.findMany({ where, orderBy: [desc(invoices.createdAt)], limit, offset }),
      db.select({ total: sql<number>`count(*)::int` }).from(invoices).where(where),
    ]);

    return { data: rows, pagination: buildPaginationMeta(total, page, limit) };
  }

  async getInvoice(id: string, scope: InvoiceScope): Promise<InvoiceWithLineItems> {
    await recomputeOverdue(eq(invoices.id, id));

    const invoice = await db.query.invoices.findFirst({
      where: eq(invoices.id, id),
      with: { lineItems: true, payments: { orderBy: (p, { desc }) => [desc(p.paidAt)] } },
    });
    if (!invoice) throw new NotFoundError('Invoice not found');
    if (scope.workshopId && invoice.workshopId !== scope.workshopId) {
      throw new ForbiddenError('You do not have access to this invoice');
    }
    if (scope.ownerId && invoice.ownerId !== scope.ownerId) {
      throw new ForbiddenError('You do not have access to this invoice');
    }
    return invoice as InvoiceWithLineItems;
  }

  // ----------------------------------------------------------
  // CREATE (standalone — not from a quote)
  // ----------------------------------------------------------

  async createInvoice(workshopId: string, createdBy: string, input: CreateInvoiceInput): Promise<InvoiceWithLineItems> {
    const { subtotal, taxAmount, total } = computeTotals(input.lineItems, input.taxRate, input.discountAmount);
    const dueDate = input.dueDate ?? addDays(new Date(), 14);

    return db.transaction(async (tx) => {
      const invoiceNumber = await nextDocumentNumber(tx, workshopId, 'INVOICE');

      const [invoice] = await tx.insert(invoices).values({
        workshopId,
        createdBy,
        invoiceNumber,
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
        amountDue: String(total),
        dueDate,
        notes: input.notes,
      }).returning();

      const lineItemRows = await insertInvoiceLineItems(tx, invoice.id, workshopId, input.lineItems);
      return { ...invoice, lineItems: lineItemRows };
    });
  }

  // ----------------------------------------------------------
  // UPDATE (DRAFT only)
  // ----------------------------------------------------------

  async updateInvoice(workshopId: string, id: string, input: UpdateInvoiceInput): Promise<InvoiceWithLineItems> {
    const existing = await this.getInvoice(id, { workshopId });
    if (existing.status !== 'DRAFT') {
      throw new ConflictError('Only DRAFT invoices can be edited');
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

      const [updated] = await tx.update(invoices).set({
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
        amountDue: String(total), // DRAFT invoices have no payments yet
        dueDate: input.dueDate ?? existing.dueDate,
        notes: input.notes ?? existing.notes,
        updatedAt: new Date(),
      }).where(eq(invoices.id, id)).returning();

      let lineItemRows = existing.lineItems;
      if (input.lineItems) {
        await tx.delete(invoiceLineItems).where(eq(invoiceLineItems.invoiceId, id));
        lineItemRows = await insertInvoiceLineItems(tx, id, workshopId, input.lineItems);
      }

      return { ...updated, lineItems: lineItemRows };
    });
  }

  // ----------------------------------------------------------
  // DELETE (DRAFT only)
  // ----------------------------------------------------------

  async deleteInvoice(workshopId: string, id: string): Promise<void> {
    const existing = await this.getInvoice(id, { workshopId });
    if (existing.status !== 'DRAFT') {
      throw new ConflictError('Only DRAFT invoices can be deleted');
    }
    await db.delete(invoices).where(eq(invoices.id, id));
  }

  // ----------------------------------------------------------
  // STATUS TRANSITIONS
  // ----------------------------------------------------------

  async sendInvoice(workshopId: string, id: string): Promise<Invoice> {
    const existing = await this.getInvoice(id, { workshopId });
    if (existing.status !== 'DRAFT') {
      throw new ConflictError('Only DRAFT invoices can be sent');
    }
    if (!existing.dueDate) {
      throw new ConflictError('A due date is required before sending an invoice');
    }
    const [updated] = await db.update(invoices)
      .set({ status: 'SENT', sentAt: new Date(), updatedAt: new Date() })
      .where(eq(invoices.id, id)).returning();
    return updated;
  }

  async voidInvoice(workshopId: string, id: string, input: VoidInvoiceInput): Promise<Invoice> {
    const existing = await this.getInvoice(id, { workshopId });
    if (existing.status === 'PAID' || existing.status === 'VOID') {
      throw new ConflictError('Only unpaid, non-voided invoices can be voided');
    }
    const [updated] = await db.update(invoices)
      .set({
        status: 'VOID',
        voidedAt: new Date(),
        voidReason: input.voidReason,
        updatedAt: new Date(),
      })
      .where(eq(invoices.id, id)).returning();
    return updated;
  }
}

// ============================================================
// SHARED LINE-ITEM INSERT
// ============================================================

export async function insertInvoiceLineItems(
  tx: any,
  invoiceId: string,
  workshopId: string,
  lineItems: LineItemInput[],
): Promise<InvoiceLineItem[]> {
  const rows: InvoiceLineItem[] = [];
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
    const [row] = await tx.insert(invoiceLineItems).values({
      invoiceId,
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
