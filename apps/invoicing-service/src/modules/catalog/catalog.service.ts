import { eq, and, ilike, desc, asc, sql } from 'drizzle-orm';
import { db } from '../../db';
import { catalogItems, type CatalogItem, type CatalogItemKind } from '../../db/schema';
import { parsePagination, buildPaginationMeta } from '@motacare/shared-utils';
import type { CatalogQueryInput, CreateCatalogItemInput, UpdateCatalogItemInput } from './catalog.schema';
import { NotFoundError } from '../../errors';

export { NotFoundError };

// ============================================================
// NORMALIZATION
// Collapses whitespace/casing so "Brake  Pad" and "brake pad"
// resolve to the same catalog entry.
// ============================================================

export function normalizeDescription(description: string): string {
  return description.trim().toLowerCase().replace(/\s+/g, ' ');
}

// ============================================================
// AUTO-SAVE UPSERT
// Called by quotes.service.ts / invoices.service.ts for every
// line item on save. See the plan's "auto-save-line-item
// mechanism" — implicit, no per-line opt-in checkbox.
// ============================================================

export interface LineItemForUpsert {
  catalogItemId?: string | null;
  description: string;
  kind?: CatalogItemKind | null;
  unit: string;
  unitPrice: number;
}

export async function upsertCatalogItemFromLineItem(
  // Accepts either the module-level `db` or an in-flight `tx` from
  // db.transaction() so this stays atomic with the quote/invoice
  // insert it's called from — a rollback must not leave catalog
  // usage counts bumped for a document that never actually saved.
  dbClient: any,
  workshopId: string,
  item: LineItemForUpsert,
): Promise<string | null> {
  // Picked from autocomplete — just bump usage/refresh price, don't re-derive from text.
  if (item.catalogItemId) {
    const [updated] = await dbClient
      .update(catalogItems)
      .set({
        defaultUnitPrice: String(item.unitPrice),
        defaultUnit: item.unit,
        usageCount: sql`${catalogItems.usageCount} + 1`,
        lastUsedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(catalogItems.id, item.catalogItemId), eq(catalogItems.workshopId, workshopId)))
      .returning({ id: catalogItems.id });
    if (updated) return updated.id;
    // Fall through: the id didn't belong to this workshop (or was deleted) — upsert by text instead.
  }

  const normalized = normalizeDescription(item.description);
  const [row] = await dbClient
    .insert(catalogItems)
    .values({
      workshopId,
      description: item.description.trim(),
      normalizedDescription: normalized,
      kind: item.kind ?? 'MISC',
      defaultUnit: item.unit,
      defaultUnitPrice: String(item.unitPrice),
      usageCount: 1,
      lastUsedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [catalogItems.workshopId, catalogItems.normalizedDescription],
      set: {
        description: item.description.trim(),
        defaultUnitPrice: String(item.unitPrice),
        defaultUnit: item.unit,
        usageCount: sql`${catalogItems.usageCount} + 1`,
        lastUsedAt: new Date(),
        updatedAt: new Date(),
      },
    })
    .returning({ id: catalogItems.id });

  return row?.id ?? null;
}

// ============================================================
// CATALOG SERVICE — CRUD
// ============================================================

export class CatalogService {
  async listItems(workshopId: string, query: CatalogQueryInput) {
    const { offset, limit, page } = parsePagination(query);

    const conditions = [eq(catalogItems.workshopId, workshopId)];
    if (!query.includeInactive) conditions.push(eq(catalogItems.isActive, true));
    if (query.kind) conditions.push(eq(catalogItems.kind, query.kind));
    if (query.category) conditions.push(eq(catalogItems.category, query.category));
    if (query.search) conditions.push(ilike(catalogItems.description, `%${query.search}%`));

    const orderBy =
      query.sort === 'alpha'  ? [asc(catalogItems.description)] :
      query.sort === 'recent' ? [desc(catalogItems.lastUsedAt)] :
      [desc(catalogItems.usageCount)];

    const where = and(...conditions);

    const [rows, [{ total }]] = await Promise.all([
      db.query.catalogItems.findMany({ where, orderBy, limit, offset }),
      db.select({ total: sql<number>`count(*)::int` }).from(catalogItems).where(where),
    ]);

    return { data: rows, pagination: buildPaginationMeta(total, page, limit) };
  }

  async getItem(workshopId: string, id: string): Promise<CatalogItem> {
    const item = await db.query.catalogItems.findFirst({
      where: and(eq(catalogItems.id, id), eq(catalogItems.workshopId, workshopId)),
    });
    if (!item) throw new NotFoundError('Catalog item not found');
    return item;
  }

  async createItem(workshopId: string, input: CreateCatalogItemInput): Promise<CatalogItem> {
    const [item] = await db
      .insert(catalogItems)
      .values({
        workshopId,
        description: input.description.trim(),
        normalizedDescription: normalizeDescription(input.description),
        kind: input.kind,
        category: input.category,
        defaultUnit: input.defaultUnit,
        defaultUnitPrice: String(input.defaultUnitPrice),
        currency: input.currency,
      })
      .onConflictDoUpdate({
        target: [catalogItems.workshopId, catalogItems.normalizedDescription],
        set: {
          isActive: true,
          defaultUnitPrice: String(input.defaultUnitPrice),
          updatedAt: new Date(),
        },
      })
      .returning();
    return item;
  }

  async updateItem(workshopId: string, id: string, input: UpdateCatalogItemInput): Promise<CatalogItem> {
    await this.getItem(workshopId, id);
    const patch: Record<string, unknown> = { ...input, updatedAt: new Date() };
    if (input.description) patch.normalizedDescription = normalizeDescription(input.description);
    if (input.defaultUnitPrice !== undefined) patch.defaultUnitPrice = String(input.defaultUnitPrice);

    const [updated] = await db
      .update(catalogItems)
      .set(patch)
      .where(and(eq(catalogItems.id, id), eq(catalogItems.workshopId, workshopId)))
      .returning();
    return updated;
  }

  // Soft delete only — never hard-delete (line items keep a
  // traceability FK with onDelete: set null, but we don't want
  // to lose the catalog history either).
  async deleteItem(workshopId: string, id: string): Promise<void> {
    await this.getItem(workshopId, id);
    await db
      .update(catalogItems)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(eq(catalogItems.id, id), eq(catalogItems.workshopId, workshopId)));
  }
}
