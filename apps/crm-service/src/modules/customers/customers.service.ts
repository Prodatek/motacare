import { eq, and, desc, count, sql } from 'drizzle-orm';
import { db } from '../../db';
import { customerNotes, type CustomerNote, type NoteType } from '../../db/schema';
import { env } from '../../config/env';
import { parsePagination, buildPaginationMeta } from '@motacare/shared-utils';

// ============================================================
// CUSTOM ERRORS
// ============================================================

export class NotFoundError  extends Error { constructor(m: string) { super(m); this.name = 'NotFoundError'; } }
export class ForbiddenError extends Error { constructor(m: string) { super(m); this.name = 'ForbiddenError'; } }

// ============================================================
// CROSS-SERVICE HELPERS
// ============================================================

async function fetchJson(url: string): Promise<any> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;
    return ((await res.json()) as any).data;
  } catch { return null; }
}

async function postJson(url: string, body: object): Promise<any> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    return ((await res.json()) as any).data;
  } catch { return null; }
}

// ============================================================
// CUSTOMER PROFILE
// Aggregated view of an owner from the fixer's perspective.
// ============================================================

export interface CustomerProfile {
  ownerId: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string | null;

  // Counts across all this fixer's work for this owner
  totalInspections: number;
  totalFixJobs: number;
  totalSpend: number;       // sum of finalCost on delivered jobs
  lastVisitAt: string | null;
  firstVisitAt: string | null;

  // Vehicles this fixer has worked on for this owner
  vehicles: Array<{
    hash: string;
    make: string;
    model: string;
    year: number;
    licensePlate: string;
  }>;

  // Fixer's private notes about this customer
  notes: CustomerNote[];
}

// ============================================================
// CRM SERVICE
// ============================================================

export class CrmService {

  // ----------------------------------------------------------
  // LIST CUSTOMERS (unique owners this fixer has worked with)
  // ----------------------------------------------------------
  async listCustomers(
    fixerId: string,
    query: { page?: number; limit?: number; search?: string },
  ) {
    const { offset, limit, page } = parsePagination(query);

    // Get all unique ownerIds from fix-jobs for this fixer
    const qs = new URLSearchParams({
      fixerId, limit: '200',
      ...(query.search ? { search: query.search } : {}),
    });

    const fixJobsData = await fetchJson(
      `${env.FIX_JOBS_SERVICE_URL}/fix-jobs/internal/customers?${qs}`,
    );

    if (!fixJobsData) {
      return { data: [], pagination: buildPaginationMeta(0, page, limit) };
    }

    const customers: Array<{
      ownerId: string;
      ownerName: string;
      totalFixJobs: number;
      totalSpend: number;
      lastVisitAt: string | null;
    }> = fixJobsData.customers ?? [];

    // Paginate in-memory (customers list is typically small)
    const total = customers.length;
    const paged = customers.slice(offset, offset + limit);

    return {
      data: paged,
      pagination: buildPaginationMeta(total, page, limit),
    };
  }

  // ----------------------------------------------------------
  // GET CUSTOMER PROFILE (full visit history + notes)
  // ----------------------------------------------------------
  async getCustomerProfile(fixerId: string, ownerId: string): Promise<CustomerProfile> {

    // Fetch in parallel: owner profile, fix jobs, inspections, notes
    const [ownerProfile, fixJobsData, inspectionData, notesData] = await Promise.allSettled([
      postJson(`${env.AUTH_SERVICE_URL}/auth/internal/user-by-id`, { userId: ownerId }),
      postJson(`${env.FIX_JOBS_SERVICE_URL}/fix-jobs/internal/customer-history`, { fixerId, ownerId }),
      postJson(`${env.INSPECTION_SERVICE_URL}/inspections/internal/customer-history`, { fixerId, ownerId }),
      db.query.customerNotes.findMany({
        where: and(eq(customerNotes.fixerId, fixerId), eq(customerNotes.ownerId, ownerId)),
        orderBy: [desc(customerNotes.updatedAt)],
      }),
    ]);

    const owner     = ownerProfile.status    === 'fulfilled' ? ownerProfile.value    : null;
    const fixJobs   = fixJobsData.status     === 'fulfilled' ? fixJobsData.value     : null;
    const insp      = inspectionData.status  === 'fulfilled' ? inspectionData.value  : null;
    const notes     = notesData.status       === 'fulfilled' ? notesData.value       : [];

    return {
      ownerId,
      ownerName:         owner ? `${owner.firstName} ${owner.lastName}` : 'Unknown',
      ownerEmail:        owner?.email ?? '',
      ownerPhone:        owner?.phone ?? null,
      totalInspections:  insp?.total ?? 0,
      totalFixJobs:      fixJobs?.total ?? 0,
      totalSpend:        fixJobs?.totalRevenue ?? 0,
      lastVisitAt:       fixJobs?.lastVisitAt ?? null,
      firstVisitAt:      fixJobs?.firstVisitAt ?? null,
      vehicles:          fixJobs?.vehicles ?? [],
      notes:             notes,
    };
  }

  // ----------------------------------------------------------
  // CREATE NOTE
  // ----------------------------------------------------------
  async createNote(
    fixerId: string,
    ownerId: string,
    input: { type: NoteType; content: string; vehicleHash?: string; inspectionId?: string; fixJobId?: string },
  ): Promise<CustomerNote> {
    const [note] = await db
      .insert(customerNotes)
      .values({ fixerId, ownerId, ...input })
      .returning();
    return note;
  }

  // ----------------------------------------------------------
  // UPDATE NOTE
  // ----------------------------------------------------------
  async updateNote(
    noteId: string,
    fixerId: string,
    input: { type?: NoteType; content?: string },
  ): Promise<CustomerNote> {
    const note = await db.query.customerNotes.findFirst({
      where: eq(customerNotes.id, noteId),
    });
    if (!note) throw new NotFoundError('Note not found');
    if (note.fixerId !== fixerId) throw new ForbiddenError('You can only edit your own notes');

    const [updated] = await db
      .update(customerNotes)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(customerNotes.id, noteId))
      .returning();
    return updated;
  }

  // ----------------------------------------------------------
  // DELETE NOTE
  // ----------------------------------------------------------
  async deleteNote(noteId: string, fixerId: string): Promise<void> {
    const note = await db.query.customerNotes.findFirst({
      where: eq(customerNotes.id, noteId),
    });
    if (!note) throw new NotFoundError('Note not found');
    if (note.fixerId !== fixerId) throw new ForbiddenError('You can only delete your own notes');
    await db.delete(customerNotes).where(eq(customerNotes.id, noteId));
  }

  // ----------------------------------------------------------
  // GET RECENT CUSTOMERS (dashboard widget)
  // ----------------------------------------------------------
  async getRecentCustomers(fixerId: string, limit = 5) {
    const data = await fetchJson(
      `${env.FIX_JOBS_SERVICE_URL}/fix-jobs/internal/customers?fixerId=${fixerId}&limit=${limit}&sort=lastVisitAt:desc`,
    );
    return data?.customers ?? [];
  }
}