import { eq, and, desc, count, ilike, or, sql } from 'drizzle-orm';
import { db } from '../../db';
import { workshops, workshopMembers, type Workshop, type WorkshopMember } from '../../db/schema';
import { env } from '../../config/env';
import { parsePagination, buildPaginationMeta } from '@motacare/shared-utils';
import type {
  CreateWorkshopInput, UpdateWorkshopInput,
  JoinRequestInput, MemberActionInput,
  WorkshopQueryInput, StatsQueryInput,
} from './workshops.schema';
import type { PaginatedResponse } from '@motacare/shared-types';

// ============================================================
// CUSTOM ERRORS
// ============================================================

export class NotFoundError     extends Error { constructor(m: string) { super(m); this.name = 'NotFoundError'; } }
export class ForbiddenError    extends Error { constructor(m = 'Access denied') { super(m); this.name = 'ForbiddenError'; } }
export class ConflictError     extends Error { constructor(m: string) { super(m); this.name = 'ConflictError'; } }
export class BadRequestError   extends Error { constructor(m: string) { super(m); this.name = 'BadRequestError'; } }

// ============================================================
// HELPERS
// ============================================================

function toSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

async function uniqueSlug(base: string): Promise<string> {
  let slug = toSlug(base);
  let suffix = 0;
  while (true) {
    const candidate = suffix === 0 ? slug : `${slug}-${suffix}`;
    const existing = await db.query.workshops.findFirst({ where: eq(workshops.slug, candidate) });
    if (!existing) return candidate;
    suffix++;
  }
}

// Cross-service: promote/demote a fixer's role in auth-service
async function updateUserRole(userId: string, role: 'FIXER' | 'WORKSHOP_ADMIN', workshopId: string | null) {
  try {
    await fetch(`${env.AUTH_SERVICE_URL}/auth/internal/update-user-role`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, role, workshopId }),
    });
  } catch (err) {
    console.warn('[workshop] Failed to update user role in auth-service:', err);
  }
}

// Cross-service: get fixer profile from auth-service
async function getFixerProfile(fixerId: string) {
  try {
    const res = await fetch(`${env.AUTH_SERVICE_URL}/auth/internal/user-by-id`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: fixerId }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { data: any };
    return data.data;
  } catch { return null; }
}

// ============================================================
// WORKSHOP SERVICE
// ============================================================

export class WorkshopService {

  // ----------------------------------------------------------
  // CREATE WORKSHOP
  // The calling fixer becomes the WORKSHOP_ADMIN.
  // ----------------------------------------------------------
  async createWorkshop(input: CreateWorkshopInput, adminId: string): Promise<Workshop> {
    // A fixer can only admin one active workshop
    const existing = await db.query.workshops.findFirst({
      where: eq(workshops.adminId, adminId),
    });
    if (existing) throw new ConflictError('You already manage a workshop. A fixer can only administer one workshop.');

    const slug = await uniqueSlug(input.name);

    const [workshop] = await db.transaction(async (tx) => {
      const [newWorkshop] = await tx
        .insert(workshops)
        .values({
          name:        input.name,
          slug,
          description: input.description,
          address:     input.address,
          city:        input.city,
          state:       input.state,
          phone:       input.phone,
          email:       input.email,
          specialties: input.specialties ?? [],
          adminId,
          status:      'PENDING_APPROVAL',
        })
        .returning();

      // Auto-add the admin as an approved member
      await tx.insert(workshopMembers).values({
        workshopId: newWorkshop.id,
        fixerId:    adminId,
        status:     'APPROVED',
        joinedAt:   new Date(),
        approvedBy: adminId,
      });

      return [newWorkshop];
    });

    // Promote to WORKSHOP_ADMIN in auth-service (fire-and-forget)
    await updateUserRole(adminId, 'WORKSHOP_ADMIN', workshop.id);

    return workshop;
  }

  // ----------------------------------------------------------
  // GET WORKSHOP
  // ----------------------------------------------------------
  async getWorkshop(workshopId: string): Promise<Workshop & { members: WorkshopMember[] }> {
    const workshop = await db.query.workshops.findFirst({
      where: eq(workshops.id, workshopId),
      with: {
        members: {
          where: eq(workshopMembers.status, 'APPROVED'),
          orderBy: [desc(workshopMembers.joinedAt)],
        },
      },
    });
    if (!workshop) throw new NotFoundError('Workshop not found');
    return workshop as Workshop & { members: WorkshopMember[] };
  }

  // ----------------------------------------------------------
  // GET WORKSHOP BY SLUG (public — for landing page)
  // ----------------------------------------------------------
  async getWorkshopBySlug(slug: string): Promise<Workshop> {
    const workshop = await db.query.workshops.findFirst({
      where: and(eq(workshops.slug, slug), eq(workshops.status, 'ACTIVE')),
    });
    if (!workshop) throw new NotFoundError('Workshop not found');
    return workshop;
  }

  // ----------------------------------------------------------
  // LIST WORKSHOPS (public — with filters)
  // ----------------------------------------------------------
  async listWorkshops(query: WorkshopQueryInput): Promise<PaginatedResponse<Workshop>> {
    const { offset, limit, page } = parsePagination(query);

    const conditions = [eq(workshops.status, 'ACTIVE')];

    if (query.city)     conditions.push(ilike(workshops.city, `%${query.city}%`));
    if (query.featured) conditions.push(eq(workshops.featured, true));
    if (query.search) {
      conditions.push(or(
        ilike(workshops.name, `%${query.search}%`),
        ilike(workshops.city, `%${query.search}%`),
      ) as any);
    }

    const where = and(...conditions);

    const [rows, [{ value: total }]] = await Promise.all([
      db.query.workshops.findMany({
        where,
        orderBy: [desc(workshops.featured), desc(workshops.totalFixJobs)],
        limit,
        offset,
      }),
      db.select({ value: count() }).from(workshops).where(where),
    ]);

    return { data: rows, pagination: buildPaginationMeta(Number(total), page, limit) };
  }

  // ----------------------------------------------------------
  // UPDATE WORKSHOP (admin only)
  // ----------------------------------------------------------
  async updateWorkshop(workshopId: string, input: UpdateWorkshopInput, adminId: string): Promise<Workshop> {
    const workshop = await db.query.workshops.findFirst({ where: eq(workshops.id, workshopId) });
    if (!workshop) throw new NotFoundError('Workshop not found');
    if (workshop.adminId !== adminId) throw new ForbiddenError('Only the workshop admin can update this workshop');

    const [updated] = await db
      .update(workshops)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(workshops.id, workshopId))
      .returning();

    return updated;
  }

  // ----------------------------------------------------------
  // FIXER: SUBMIT JOIN REQUEST
  // ----------------------------------------------------------
  async submitJoinRequest(input: JoinRequestInput, fixerId: string): Promise<WorkshopMember> {
    const workshop = await db.query.workshops.findFirst({
      where: and(eq(workshops.id, input.workshopId), eq(workshops.status, 'ACTIVE')),
    });
    if (!workshop) throw new NotFoundError('Workshop not found or not accepting members');

    if (workshop.currentFixerCount >= workshop.maxFixers) {
      throw new ConflictError(`This workshop is at capacity (${workshop.maxFixers} fixers). Try another workshop.`);
    }

    // Check they're not already a member or pending
    const existing = await db.query.workshopMembers.findFirst({
      where: and(
        eq(workshopMembers.fixerId, fixerId),
        eq(workshopMembers.workshopId, input.workshopId),
      ),
    });

    if (existing?.status === 'APPROVED') throw new ConflictError('You are already a member of this workshop');
    if (existing?.status === 'PENDING') throw new ConflictError('You already have a pending join request for this workshop');

    // Check fixer isn't already approved at ANOTHER workshop
    const currentMembership = await db.query.workshopMembers.findFirst({
      where: and(eq(workshopMembers.fixerId, fixerId), eq(workshopMembers.status, 'APPROVED')),
    });
    if (currentMembership) {
      throw new ConflictError('You are already a member of another workshop. Leave it before applying elsewhere.');
    }

    if (existing) {
      // Re-applying after rejection
      const [updated] = await db
        .update(workshopMembers)
        .set({ status: 'PENDING', joinRequestNote: input.note, rejectionReason: null, updatedAt: new Date() })
        .where(eq(workshopMembers.id, existing.id))
        .returning();
      return updated;
    }

    const [member] = await db
      .insert(workshopMembers)
      .values({
        workshopId:      input.workshopId,
        fixerId,
        status:          'PENDING',
        joinRequestNote: input.note,
      })
      .returning();

    return member;
  }

  // ----------------------------------------------------------
  // ADMIN: APPROVE OR REJECT A JOIN REQUEST
  // ----------------------------------------------------------
  async handleMemberAction(
    workshopId: string,
    memberId: string,
    input: MemberActionInput,
    adminId: string,
  ): Promise<WorkshopMember> {
    const workshop = await db.query.workshops.findFirst({ where: eq(workshops.id, workshopId) });
    if (!workshop) throw new NotFoundError('Workshop not found');
    if (workshop.adminId !== adminId) throw new ForbiddenError();

    const member = await db.query.workshopMembers.findFirst({
      where: and(eq(workshopMembers.id, memberId), eq(workshopMembers.workshopId, workshopId)),
    });
    if (!member) throw new NotFoundError('Join request not found');
    if (member.status !== 'PENDING') throw new ConflictError('This request has already been processed');

    if (input.action === 'APPROVE') {
      if (workshop.currentFixerCount >= workshop.maxFixers) {
        throw new ConflictError('Workshop is now at capacity');
      }
      const [approved] = await db.transaction(async (tx) => {
        const [updated] = await tx
          .update(workshopMembers)
          .set({ status: 'APPROVED', joinedAt: new Date(), approvedBy: adminId, updatedAt: new Date() })
          .where(eq(workshopMembers.id, memberId))
          .returning();

        await tx
          .update(workshops)
          .set({ currentFixerCount: workshop.currentFixerCount + 1, updatedAt: new Date() })
          .where(eq(workshops.id, workshopId));

        return [updated];
      });

      // Update fixer's workshopId in auth-service
      await updateUserRole(member.fixerId, 'FIXER', workshopId);
      return approved;

    } else {
      const [rejected] = await db
        .update(workshopMembers)
        .set({ status: 'REJECTED', rejectionReason: input.rejectionReason, updatedAt: new Date() })
        .where(eq(workshopMembers.id, memberId))
        .returning();
      return rejected;
    }
  }

  // ----------------------------------------------------------
  // FIXER: LEAVE WORKSHOP
  // ----------------------------------------------------------
  async leaveWorkshop(workshopId: string, fixerId: string): Promise<void> {
    const member = await db.query.workshopMembers.findFirst({
      where: and(
        eq(workshopMembers.fixerId, fixerId),
        eq(workshopMembers.workshopId, workshopId),
        eq(workshopMembers.status, 'APPROVED'),
      ),
    });
    if (!member) throw new NotFoundError('You are not a member of this workshop');

    const workshop = await db.query.workshops.findFirst({ where: eq(workshops.id, workshopId) });
    if (!workshop) throw new NotFoundError('Workshop not found');
    if (workshop.adminId === fixerId) throw new BadRequestError('Workshop admins cannot leave — transfer admin rights first');

    await db.transaction(async (tx) => {
      await tx
        .update(workshopMembers)
        .set({ status: 'LEFT', leftAt: new Date(), updatedAt: new Date() })
        .where(eq(workshopMembers.id, member.id));

      await tx
        .update(workshops)
        .set({ currentFixerCount: Math.max(0, workshop.currentFixerCount - 1), updatedAt: new Date() })
        .where(eq(workshops.id, workshopId));
    });

    await updateUserRole(fixerId, 'FIXER', null);
  }

  // ----------------------------------------------------------
  // GET PENDING JOIN REQUESTS (admin only)
  // ----------------------------------------------------------
  async getPendingRequests(workshopId: string, adminId: string): Promise<WorkshopMember[]> {
    const workshop = await db.query.workshops.findFirst({ where: eq(workshops.id, workshopId) });
    if (!workshop) throw new NotFoundError('Workshop not found');
    if (workshop.adminId !== adminId) throw new ForbiddenError();

    return db.query.workshopMembers.findMany({
      where: and(
        eq(workshopMembers.workshopId, workshopId),
        eq(workshopMembers.status, 'PENDING'),
      ),
      orderBy: [desc(workshopMembers.createdAt)],
    });
  }

  // ----------------------------------------------------------
  // GET WORKSHOP STATS (admin only)
  // Calls inspection-service and fix-jobs-service for aggregates
  // ----------------------------------------------------------
  async getWorkshopStats(workshopId: string, adminId: string, query: StatsQueryInput) {
    const workshop = await db.query.workshops.findFirst({ where: eq(workshops.id, workshopId) });
    if (!workshop) throw new NotFoundError('Workshop not found');
    if (workshop.adminId !== adminId) throw new ForbiddenError();

    // Get approved fixer IDs for this workshop
    const members = await db.query.workshopMembers.findMany({
      where: and(eq(workshopMembers.workshopId, workshopId), eq(workshopMembers.status, 'APPROVED')),
    });
    const fixerIds = members.map((m) => m.fixerId);

    const from = query.from ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const to   = query.to   ?? new Date();

    // Fetch stats from each service in parallel
    const [inspectionStats, fixJobStats] = await Promise.allSettled([
      fetch(`${env.INSPECTION_SERVICE_URL}/inspections/internal/stats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fixerIds, from: from.toISOString(), to: to.toISOString() }),
      }).then((r) => r.json()),
      fetch(`${env.FIX_JOBS_SERVICE_URL}/fix-jobs/internal/stats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fixerIds, from: from.toISOString(), to: to.toISOString() }),
      }).then((r) => r.json()),
    ]);

    const inspData = inspectionStats.status === 'fulfilled' ? (inspectionStats.value as any).data : null;
    const fixData  = fixJobStats.status === 'fulfilled'     ? (fixJobStats.value as any).data  : null;

    // Resolve fixer names from auth-service
    const fixerProfiles = await Promise.all(fixerIds.map(getFixerProfile));
    const fixerMap = Object.fromEntries(
      fixerProfiles
        .filter(Boolean)
        .map((f: any) => [f.id, `${f.firstName} ${f.lastName}`]),
    );

    return {
      workshopId,
      period: { from: from.toISOString(), to: to.toISOString() },
      totalInspections:    inspData?.total ?? 0,
      completedInspections: inspData?.completed ?? 0,
      totalFixJobs:        fixData?.total ?? 0,
      completedFixJobs:    fixData?.completed ?? 0,
      deliveredFixJobs:    fixData?.delivered ?? 0,
      totalRevenue:        fixData?.totalRevenue ?? 0,
      currency:            'NGN',
      byFixer: fixerIds.map((fixerId) => ({
        fixerId,
        fixerName:            fixerMap[fixerId] ?? 'Unknown',
        inspections:          inspData?.byFixer?.[fixerId]?.total ?? 0,
        fixJobs:              fixData?.byFixer?.[fixerId]?.total ?? 0,
        completedFixJobs:     fixData?.byFixer?.[fixerId]?.completed ?? 0,
        revenue:              fixData?.byFixer?.[fixerId]?.revenue ?? 0,
        avgFixJobDurationHours: fixData?.byFixer?.[fixerId]?.avgDurationHours ?? null,
      })),
      trend: fixData?.trend ?? [],
    };
  }

  // ----------------------------------------------------------
  // INTERNAL: get workshopId for a fixer (called by other services)
  // ----------------------------------------------------------
  async getFixerWorkshop(fixerId: string): Promise<{ workshopId: string; workshopName: string } | null> {
    const member = await db.query.workshopMembers.findFirst({
      where: and(eq(workshopMembers.fixerId, fixerId), eq(workshopMembers.status, 'APPROVED')),
      with: { workshop: true },
    });
    if (!member) return null;
    return { workshopId: member.workshopId, workshopName: (member as any).workshop?.name ?? '' };
  }
}