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

export class NotFoundError   extends Error { constructor(m: string)           { super(m); this.name = 'NotFoundError'; } }
export class ForbiddenError  extends Error { constructor(m = 'Access denied') { super(m); this.name = 'ForbiddenError'; } }
export class ConflictError   extends Error { constructor(m: string)           { super(m); this.name = 'ConflictError'; } }
export class BadRequestError extends Error { constructor(m: string)           { super(m); this.name = 'BadRequestError'; } }

// ============================================================
// CONSTANTS
// ============================================================

// A fixer must wait this long after leaving a workshop before
// they can join another. Prevents rapid workshop switching.
const COOLDOWN_MS = 12 * 60 * 60 * 1000; // 12 hours

// ============================================================
// HELPERS
// ============================================================

interface AuthUserProfile {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
}

interface WorkshopStatsPayload {
  data?: {
    total?: number;
    completed?: number;
    delivered?: number;
    totalRevenue?: number;
    byFixer?: Record<string, {
      total?: number;
      completed?: number;
      revenue?: number;
      avgDurationHours?: number | null;
    }>;
    trend?: unknown[];
  } | null;
}

function toSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

async function uniqueSlug(base: string): Promise<string> {
  let suffix = 0;
  const slug = toSlug(base);
  while (true) {
    const candidate = suffix === 0 ? slug : `${slug}-${suffix}`;
    const existing = await db.query.workshops.findFirst({ where: eq(workshops.slug, candidate) });
    if (!existing) return candidate;
    suffix++;
  }
}

// Case-insensitive name uniqueness check
async function isNameTaken(name: string, excludeId?: string): Promise<boolean> {
  const where = excludeId
    ? and(ilike(workshops.name, name.trim()), sql`${workshops.id} != ${excludeId}`)
    : ilike(workshops.name, name.trim());
  const row = await db.query.workshops.findFirst({ where });
  return !!row;
}

async function updateUserRole(userId: string, role: 'FIXER' | 'WORKSHOP_ADMIN', workshopId: string | null) {
  try {
    await fetch(`${env.AUTH_SERVICE_URL}/auth/internal/update-user-role`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, role, workshopId }),
    });
  } catch (err) {
    console.warn('[workshop] Failed to update user role:', err);
  }
}

async function getFixerProfile(fixerId: string): Promise<AuthUserProfile | null> {
  try {
    const res = await fetch(`${env.AUTH_SERVICE_URL}/auth/internal/user-by-id`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: fixerId }),
    });
    if (!res.ok) return null;
    const payload = (await res.json()) as { data?: AuthUserProfile | null };
    return payload.data ?? null;
  } catch { return null; }
}

// ============================================================
// SERVICE
// ============================================================

export class WorkshopService {

  // ----------------------------------------------------------
  // CREATE
  // ----------------------------------------------------------
  async createWorkshop(input: CreateWorkshopInput, adminId: string): Promise<Workshop> {

    // One admin = one workshop
    const alreadyAdmin = await db.query.workshops.findFirst({ where: eq(workshops.adminId, adminId) });
    if (alreadyAdmin) {
      throw new ConflictError('You already manage a workshop. A fixer can only administer one workshop.');
    }

    // ── Workshop name must be globally unique (case-insensitive) ──
    if (await isNameTaken(input.name)) {
      throw new ConflictError(
        `A workshop named "${input.name}" already exists. Please choose a different name.`,
      );
    }

    const slug = await uniqueSlug(input.name);

    const [workshop] = await db.transaction(async (tx) => {
      const [w] = await tx
        .insert(workshops)
        .values({
          name:        input.name.trim(),
          slug,
          description: input.description,
          address:     input.address,
          city:        input.city,
          state:       input.state,
          phone:       input.phone,
          email:       input.email,
          specialties: input.specialties ?? [],
          adminId,
          // Workshops are ACTIVE immediately — visible to all users at once
          status:            'ACTIVE',
          currentFixerCount: 1,
        })
        .returning();

      // Auto-approve the admin as a member
      await tx.insert(workshopMembers).values({
        workshopId: w.id, fixerId: adminId,
        status: 'APPROVED', joinedAt: new Date(), approvedBy: adminId,
      });
      return [w];
    });

    // Promote to WORKSHOP_ADMIN in auth-service (fire-and-forget)
    await updateUserRole(adminId, 'WORKSHOP_ADMIN', workshop.id);
    return workshop;
  }

  // ----------------------------------------------------------
  // GET BY ID
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
    this.incrementViewCount(workshopId).catch(() => {});
    return workshop as Workshop & { members: WorkshopMember[] };
  }

  //-----------------------------------------------
  //INCREMENT VIEW COUNT
  //------------------------------------------------------
  async incrementViewCount(workshopId: string): Promise<void> {
    try {
      await db
        .update(workshops)
        .set({ viewCount: sql`${workshops.viewCount} + 1` })
        .where(eq(workshops.id, workshopId));
    } catch (err) {
      // Non-fatal — log and move on
      console.warn('[workshop] Failed to increment view count:', err);
    }
  }

  // ----------------------------------------------------------
  // GET BY SLUG (public)
  // ----------------------------------------------------------
  async getWorkshopBySlug(slug: string): Promise<Workshop> {
    const workshop = await db.query.workshops.findFirst({
      where: and(eq(workshops.slug, slug), eq(workshops.status, 'ACTIVE')),
    });
    if (!workshop) throw new NotFoundError('Workshop not found');
    return workshop;
  }

  // ----------------------------------------------------------
  // LIST (public — all ACTIVE workshops visible to all users)
  // ----------------------------------------------------------
  async listWorkshops(query: WorkshopQueryInput): Promise<PaginatedResponse<Workshop>> {
    const { offset, limit, page } = parsePagination(query);

    // All ACTIVE workshops are always visible — no auth gate
    const conditions: Array<ReturnType<typeof eq> | ReturnType<typeof ilike> | ReturnType<typeof or>> = [
      eq(workshops.status, 'ACTIVE'),
    ];

    if (query.city)     conditions.push(ilike(workshops.city, `%${query.city}%`));
    if (query.featured) conditions.push(eq(workshops.featured, true));
    if (query.search) {
      conditions.push(or(
        ilike(workshops.name,    `%${query.search}%`),
        ilike(workshops.city,    `%${query.search}%`),
        ilike(workshops.address, `%${query.search}%`),
      ));
    }

    const where = and(...conditions);

    const [rows, [{ value: total }]] = await Promise.all([
      db.query.workshops.findMany({
        where,
        // Featured workshops float to the top, then sort by activity
        orderBy: [desc(workshops.featured), desc(workshops.totalFixJobs), desc(workshops.createdAt)],
        limit, offset,
      }),
      db.select({ value: count() }).from(workshops).where(where),
    ]);

    return { data: rows, pagination: buildPaginationMeta(Number(total), page, limit) };
  }



    // GET FEATURED WORKSHOPS (public — landing page)
  // Returns hardcoded seeds + dynamically fetched real workshops
  // ----------------------------------------------------------
  async getFeaturedWorkshops(): Promise<Array<Partial<Workshop> & { isSeeded?: boolean }>> {
 
    // ── 3 hardcoded seed companies ───────────────────────────
    // These are always shown, represent the kind of workshops
    // on the platform, and never disappear even if DB is empty.
    const seeds = [
      {
        id:                 'seed-1',
        name:               'Ade Motors & Auto Works',
        slug:               'ade-motors',
        description:        'Lagos Island\'s most trusted workshop for Japanese and Korean vehicles. 10+ years keeping cars on the road.',
        address:            '14 Bode Thomas Street',
        city:               'Lagos',
        state:              'Lagos State',
        phone:              '+234 801 234 5678',
        email:              'info@ademotors.ng',
        specialties:        ['Engine', 'Brakes', 'Diagnostics', 'AC & Cooling'],
        status:             'ACTIVE' as const,
        adminId:            'seed',
        maxFixers:          5,
        currentFixerCount:  4,
        featured:           true,
        totalInspections:   312,
        totalFixJobs:       289,
        logoUrl:            null,
        coverImageUrl:      null,
        createdAt:          new Date('2023-01-15').toISOString(),
        updatedAt:          new Date().toISOString(),
        isSeeded:           true,
      },
      {
        id:                 'seed-2',
        name:               'Prodatek Auto Care',
        slug:               'prodatek-auto-care',
        description:        'Full-service workshop specialising in European vehicles and advanced electrical diagnostics across Abuja.',
        address:            '7 Gimbiya Street, Garki 2',
        city:               'Abuja',
        state:              'FCT',
        phone:              '+234 802 345 6789',
        email:              'hello@prodatekauto.ng',
        specialties:        ['Electrical', 'Transmission', 'Diagnostics', 'Suspension'],
        status:             'ACTIVE' as const,
        adminId:            'seed',
        maxFixers:          5,
        currentFixerCount:  3,
        featured:           true,
        totalInspections:   198,
        totalFixJobs:       175,
        logoUrl:            null,
        coverImageUrl:      null,
        createdAt:          new Date('2023-03-10').toISOString(),
        updatedAt:          new Date().toISOString(),
        isSeeded:           true,
      },
      {
        id:                 'seed-3',
        name:               'SpeedFix Workshop',
        slug:               'speedfix-workshop',
        description:        'Port Harcourt\'s go-to workshop for tyres, brakes, and fast-turnaround oil changes. Open 7 days a week.',
        address:            '23 Aggrey Road, Diobu',
        city:               'Port Harcourt',
        state:              'Rivers State',
        phone:              '+234 803 456 7890',
        email:              'speedfix@email.com',
        specialties:        ['Tyres', 'Brakes', 'Fluids', 'Body & Paint'],
        status:             'ACTIVE' as const,
        adminId:            'seed',
        maxFixers:          5,
        currentFixerCount:  5,
        featured:           true,
        totalInspections:   445,
        totalFixJobs:       391,
        logoUrl:            null,
        coverImageUrl:      null,
        createdAt:          new Date('2022-11-20').toISOString(),
        updatedAt:          new Date().toISOString(),
        isSeeded:           true,
      },
    ];
 
    // ── Up to 2 dynamically fetched real workshops ────────────
    // Fetch the 2 most recently created ACTIVE real workshops.
    // We intentionally do NOT filter by featured=true so that
    // any registered workshop surfaces here automatically.
    // Once there are enough featured workshops in the DB, a
    // platform admin can switch this to filter by featured=true.
    let realWorkshops: Workshop[] = [];
    try {
      realWorkshops = await db.query.workshops.findMany({
        where: eq(workshops.status, 'ACTIVE'),
        orderBy: [desc(workshops.createdAt)],
        limit: 2,
      });
    } catch (err) {
      // DB unavailable — return seeds only, never crash the landing page
      console.warn('[workshop] Could not fetch real workshops for featured list:', err);
    }
 
    // Merge: seeds first (always 3), then real workshops (0–2)
    // Deduplicate on name in case a real workshop matches a seed name
    const seedNames = new Set(seeds.map((s) => s.name.toLowerCase()));
    const uniqueReal = realWorkshops.filter(
      (w) => !seedNames.has(w.name.toLowerCase()),
    );
 
    return [...seeds, ...uniqueReal.map((w) => ({ ...w, isSeeded: false }))];
  }
  
  // ----------------------------------------------------------
  // UPDATE (admin only)
  // ----------------------------------------------------------
  async updateWorkshop(workshopId: string, input: UpdateWorkshopInput, adminId: string): Promise<Workshop> {
    const workshop = await db.query.workshops.findFirst({ where: eq(workshops.id, workshopId) });
    if (!workshop) throw new NotFoundError('Workshop not found');
    if (workshop.adminId !== adminId) throw new ForbiddenError('Only the workshop creator can update this workshop');

    // Unique name check on rename
    if (input.name && input.name.toLowerCase().trim() !== workshop.name.toLowerCase().trim()) {
      if (await isNameTaken(input.name, workshopId)) {
        throw new ConflictError(`A workshop named "${input.name}" already exists.`);
      }
    }

    const [updated] = await db
      .update(workshops)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(workshops.id, workshopId))
      .returning();
    return updated;
  }

  // ----------------------------------------------------------
  // FIXER: SUBMIT JOIN REQUEST
  // Rules enforced:
  //   1. Fixer must not already be APPROVED at any workshop
  //   2. Must wait 12 hours after leaving any workshop
  //   3. Target workshop must be ACTIVE and have capacity
  //   4. Cannot have a PENDING request at the same workshop
  // ----------------------------------------------------------
  async submitJoinRequest(input: JoinRequestInput, fixerId: string): Promise<WorkshopMember> {
    const workshop = await db.query.workshops.findFirst({
      where: and(eq(workshops.id, input.workshopId), eq(workshops.status, 'ACTIVE')),
    });
    if (!workshop) throw new NotFoundError('Workshop not found or not accepting members');

    if (workshop.currentFixerCount >= workshop.maxFixers) {
      throw new ConflictError(
        `This workshop is at full capacity (${workshop.maxFixers} fixers). Try another workshop.`,
      );
    }

    // ── Cannot be in two workshops ──────────────────────────
    const currentApproved = await db.query.workshopMembers.findFirst({
      where: and(eq(workshopMembers.fixerId, fixerId), eq(workshopMembers.status, 'APPROVED')),
    });
    if (currentApproved) {
      throw new ConflictError(
        'You are already a member of a workshop. Leave your current workshop before applying elsewhere.',
      );
    }

    // ── 12-hour cooldown after leaving any workshop ──────────
    const lastLeft = await db.query.workshopMembers.findFirst({
      where: and(eq(workshopMembers.fixerId, fixerId), eq(workshopMembers.status, 'LEFT')),
      orderBy: [desc(workshopMembers.leftAt)],
    });

    if (lastLeft?.leftAt) {
      const msSince = Date.now() - new Date(lastLeft.leftAt).getTime();
      if (msSince < COOLDOWN_MS) {
        const hoursLeft = Math.ceil((COOLDOWN_MS - msSince) / 1000 / 3600);
        throw new ConflictError(
          `You must wait ${hoursLeft} more hour${hoursLeft === 1 ? '' : 's'} before joining a new workshop. ` +
          `This cooldown prevents rapid workshop switching.`,
        );
      }
    }

    // ── Existing request at this specific workshop ───────────
    const existing = await db.query.workshopMembers.findFirst({
      where: and(
        eq(workshopMembers.fixerId, fixerId),
        eq(workshopMembers.workshopId, input.workshopId),
      ),
    });

    if (existing?.status === 'PENDING') {
      throw new ConflictError('You already have a pending join request for this workshop');
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
      .values({ workshopId: input.workshopId, fixerId, status: 'PENDING', joinRequestNote: input.note })
      .returning();
    return member;
  }

  // ----------------------------------------------------------
  // ADMIN: APPROVE OR REJECT JOIN REQUEST
  // Only the workshop creator (adminId) can take this action.
  // ----------------------------------------------------------
  async handleMemberAction(
    workshopId: string,
    memberId: string,
    input: MemberActionInput,
    requesterId: string,
  ): Promise<WorkshopMember> {
    const workshop = await db.query.workshops.findFirst({ where: eq(workshops.id, workshopId) });
    if (!workshop) throw new NotFoundError('Workshop not found');

    // ── Only the creator can approve/reject ─────────────────
    if (workshop.adminId !== requesterId) {
      throw new ForbiddenError('Only the workshop creator can approve or reject join requests');
    }

    const member = await db.query.workshopMembers.findFirst({
      where: and(eq(workshopMembers.id, memberId), eq(workshopMembers.workshopId, workshopId)),
    });
    if (!member) throw new NotFoundError('Join request not found');
    if (member.status !== 'PENDING') throw new ConflictError('This request has already been processed');

    if (input.action === 'APPROVE') {
      if (workshop.currentFixerCount >= workshop.maxFixers) {
        throw new ConflictError('Workshop is now at full capacity');
      }

      // Race-condition guard — fixer may have joined elsewhere while pending
      const alreadyMember = await db.query.workshopMembers.findFirst({
        where: and(eq(workshopMembers.fixerId, member.fixerId), eq(workshopMembers.status, 'APPROVED')),
      });
      if (alreadyMember) {
        throw new ConflictError('This fixer has already joined another workshop');
      }

      const [approved] = await db.transaction(async (tx) => {
        const [updated] = await tx
          .update(workshopMembers)
          .set({ status: 'APPROVED', joinedAt: new Date(), approvedBy: requesterId, updatedAt: new Date() })
          .where(eq(workshopMembers.id, memberId))
          .returning();

        await tx.update(workshops)
          .set({ currentFixerCount: workshop.currentFixerCount + 1, updatedAt: new Date() })
          .where(eq(workshops.id, workshopId));

        return [updated];
      });

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
    if (!member) throw new NotFoundError('You are not an active member of this workshop');

    const workshop = await db.query.workshops.findFirst({ where: eq(workshops.id, workshopId) });
    if (!workshop) throw new NotFoundError('Workshop not found');

    if (workshop.adminId === fixerId) {
      throw new BadRequestError(
        'You created this workshop and cannot leave it. Contact support to transfer ownership.',
      );
    }

    await db.transaction(async (tx) => {
      await tx.update(workshopMembers)
        .set({ status: 'LEFT', leftAt: new Date(), updatedAt: new Date() })
        .where(eq(workshopMembers.id, member.id));

      await tx.update(workshops)
        .set({ currentFixerCount: Math.max(0, workshop.currentFixerCount - 1), updatedAt: new Date() })
        .where(eq(workshops.id, workshopId));
    });

    await updateUserRole(fixerId, 'FIXER', null);
  }

  // ----------------------------------------------------------
  // GET PENDING REQUESTS (creator only)
  // ----------------------------------------------------------
  async getPendingRequests(workshopId: string, adminId: string): Promise<WorkshopMember[]> {
    const workshop = await db.query.workshops.findFirst({ where: eq(workshops.id, workshopId) });
    if (!workshop) throw new NotFoundError('Workshop not found');
    if (workshop.adminId !== adminId) throw new ForbiddenError('Only the workshop creator can view join requests');

    return db.query.workshopMembers.findMany({
      where: and(eq(workshopMembers.workshopId, workshopId), eq(workshopMembers.status, 'PENDING')),
      orderBy: [desc(workshopMembers.createdAt)],
    });
  }

  // ----------------------------------------------------------
  // STATS (admin only)
  // ----------------------------------------------------------
  async getWorkshopStats(workshopId: string, adminId: string, query: StatsQueryInput) {
    const workshop = await db.query.workshops.findFirst({ where: eq(workshops.id, workshopId) });
    if (!workshop) throw new NotFoundError('Workshop not found');
    if (workshop.adminId !== adminId) throw new ForbiddenError();

    const members = await db.query.workshopMembers.findMany({
      where: and(eq(workshopMembers.workshopId, workshopId), eq(workshopMembers.status, 'APPROVED')),
    });
    const fixerIds = members.map((m) => m.fixerId);
    const from = query.from ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const to   = query.to   ?? new Date();

    const [inspectionStats, fixJobStats] = await Promise.allSettled([
      fetch(`${env.INSPECTION_SERVICE_URL}/inspections/internal/stats`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fixerIds, from: from.toISOString(), to: to.toISOString() }),
      }).then((r) => r.json()),
      fetch(`${env.FIX_JOBS_SERVICE_URL}/fix-jobs/internal/stats`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fixerIds, from: from.toISOString(), to: to.toISOString() }),
      }).then((r) => r.json()),
    ]);

    const inspData = inspectionStats.status === 'fulfilled'
      ? (inspectionStats.value as WorkshopStatsPayload).data
      : null;
    const fixData = fixJobStats.status === 'fulfilled'
      ? (fixJobStats.value as WorkshopStatsPayload).data
      : null;

    const fixerProfiles = await Promise.all(fixerIds.map(getFixerProfile));
    const fixerMap = Object.fromEntries(
      fixerProfiles
        .filter((f): f is AuthUserProfile => f !== null)
        .map((f) => [f.id, `${f.firstName} ${f.lastName}`]),
    );

    return {
      workshopId, period: { from: from.toISOString(), to: to.toISOString() },
      viewCount: workshop.viewCount,
      totalInspections: inspData?.total ?? 0, completedInspections: inspData?.completed ?? 0,
      totalFixJobs: fixData?.total ?? 0, completedFixJobs: fixData?.completed ?? 0,
      deliveredFixJobs: fixData?.delivered ?? 0, totalRevenue: fixData?.totalRevenue ?? 0,
      currency: 'NGN',
      byFixer: fixerIds.map((fixerId) => ({
        fixerId, fixerName: fixerMap[fixerId] ?? 'Unknown',
        inspections: inspData?.byFixer?.[fixerId]?.total ?? 0,
        fixJobs: fixData?.byFixer?.[fixerId]?.total ?? 0,
        completedFixJobs: fixData?.byFixer?.[fixerId]?.completed ?? 0,
        revenue: fixData?.byFixer?.[fixerId]?.revenue ?? 0,
        avgFixJobDurationHours: fixData?.byFixer?.[fixerId]?.avgDurationHours ?? null,
      })),
      trend: fixData?.trend ?? [],
    };
  }

  // ----------------------------------------------------------
  // INTERNAL: get workshop for a fixer
  // ----------------------------------------------------------
  async getFixerWorkshop(fixerId: string): Promise<{ workshopId: string; workshopName: string } | null> {
    const member = await db.query.workshopMembers.findFirst({
      where: and(eq(workshopMembers.fixerId, fixerId), eq(workshopMembers.status, 'APPROVED')),
      with: { workshop: true },
    });
    if (!member) return null;
    return { workshopId: member.workshopId, workshopName: member.workshop?.name ?? '' };
  }
}