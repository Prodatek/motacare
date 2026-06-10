import { eq, and, desc, count } from 'drizzle-orm';
import { db } from '../../db';
import {
  fixJobs, fixJobStatusHistory,
  type FixJob, type FixJobStatus, type PartEntry,
} from '../../db/schema';
import { parsePagination, buildPaginationMeta } from '@motacare/shared-utils';
import type {
  CreateFixJobInput,
  UpdateFixJobInput,
  AddPartInput,
  RemovePartInput,
  CancelFixJobInput,
  FixJobQueryInput,
} from './fix-jobs.schema';
import type { PaginatedResponse } from '@motacare/shared-types';

// ============================================================
// CUSTOM ERRORS
// ============================================================

export class NotFoundError extends Error {
  constructor(msg: string) { super(msg); this.name = 'NotFoundError'; }
}
export class ForbiddenError extends Error {
  constructor(msg = 'Access denied') { super(msg); this.name = 'ForbiddenError'; }
}
export class ConflictError extends Error {
  constructor(msg: string) { super(msg); this.name = 'ConflictError'; }
}
export class BadRequestError extends Error {
  constructor(msg: string) { super(msg); this.name = 'BadRequestError'; }
}

// ============================================================
// STATUS TRANSITION MAP
// Enforces the fix job lifecycle — illegal jumps are rejected.
// ============================================================

const VALID_TRANSITIONS: Record<FixJobStatus, FixJobStatus[]> = {
  PENDING:        ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS:    ['AWAITING_PARTS', 'COMPLETED', 'CANCELLED'],
  AWAITING_PARTS: ['IN_PROGRESS', 'CANCELLED'],
  COMPLETED:      ['DELIVERED'],
  DELIVERED:      [],
  CANCELLED:      [],
};

// Terminal states — no further changes allowed
const TERMINAL_STATES: FixJobStatus[] = ['DELIVERED', 'CANCELLED'];

// ============================================================
// FIX JOB SERVICE
// ============================================================

export class FixJobService {

  // ----------------------------------------------------------
  // CREATE
  // ----------------------------------------------------------

  async createFixJob(input: CreateFixJobInput, fixerId: string): Promise<FixJob> {
    const [job] = await db.transaction(async (tx) => {
      const [newJob] = await tx
        .insert(fixJobs)
        .values({
          inspectionId: input.inspectionId,
          vehicleHash: input.vehicleHash,
          fixerId,
          ownerId: input.ownerId,
          description: input.description,
          estimatedCompletionAt: input.estimatedCompletionAt,
          estimatedCost: input.estimatedCost?.toString(),
          currency: input.currency,
          partsUsed: [],
        })
        .returning();

      await tx.insert(fixJobStatusHistory).values({
        fixJobId: newJob.id,
        fromStatus: null,
        toStatus: 'PENDING',
        changedBy: fixerId,
        notes: 'Fix job created',
      });

      return [newJob];
    });

    return job;
  }

  // ----------------------------------------------------------
  // GET SINGLE — includes status history
  // ----------------------------------------------------------

  async getFixJob(
    jobId: string,
    requesterId: string,
    requesterRole: string,
  ): Promise<FixJob & { statusHistory: fixJobStatusHistory[] } & { fixer?: any; vehicle?: any }> {

    const job = await db.query.fixJobs.findFirst({
      where: eq(fixJobs.id, jobId),
      with: { statusHistory: { orderBy: [desc(fixJobStatusHistory.changedAt)] } },
    });

    if (!job) throw new NotFoundError('Fix job not found');

    if (requesterRole === 'OWNER' && job.ownerId !== requesterId) throw new ForbiddenError();
    if (requesterRole === 'FIXER' && job.fixerId !== requesterId) throw new ForbiddenError();

    // Enrich with fixer name and vehicle details (best-effort, non-blocking)
    let fixerInfo: any = null;
    let vehicleInfo: any = null;
    try {
      const { env } = await import('../../config/env');
      const [fixerRes, vehicleRes] = await Promise.all([
        fetch(`${env.AUTH_SERVICE_URL}/auth/internal/user/${job.fixerId}`),
        fetch(`${env.VEHICLE_SERVICE_URL}/vehicles/internal/lookup/${job.vehicleHash}`),
      ]);

      if (fixerRes.ok) {
        const body = (await fixerRes.json()) as { data: any };
        fixerInfo = body.data;
      }
      if (vehicleRes.ok) {
        const body = (await vehicleRes.json()) as { data: any };
        vehicleInfo = body.data;
      }
    } catch (err) {
      // best-effort: don't fail the request if external lookups fail
      console.warn('[fix-jobs] enrichment lookup failed:', err);
    }

    return { ...(job as any), fixer: fixerInfo, vehicle: vehicleInfo } as FixJob & { statusHistory: fixJobStatusHistory[] } & { fixer?: any; vehicle?: any };
  }

  // ----------------------------------------------------------
  // LIST — paginated, role-scoped
  // ----------------------------------------------------------

  async listFixJobs(
    requesterId: string,
    requesterRole: string,
    query: FixJobQueryInput,
  ): Promise<PaginatedResponse<FixJob>> {

    const { offset, limit, page } = parsePagination(query);

    const conditions =
      requesterRole === 'OWNER' ? [eq(fixJobs.ownerId, requesterId)] :
      requesterRole === 'FIXER' ? [eq(fixJobs.fixerId, requesterId)] : [];

    if (query.status) conditions.push(eq(fixJobs.status, query.status));
    if (query.vehicleHash) conditions.push(eq(fixJobs.vehicleHash, query.vehicleHash));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, [{ value: total }]] = await Promise.all([
      db.query.fixJobs.findMany({
        where: whereClause,
        orderBy: [desc(fixJobs.createdAt)],
        limit,
        offset,
      }),
      db.select({ value: count() }).from(fixJobs).where(whereClause),
    ]);

    return { data: rows, pagination: buildPaginationMeta(Number(total), page, limit) };
  }

  // ----------------------------------------------------------
  // UPDATE — status, notes, cost, timing
  // ----------------------------------------------------------

  async updateFixJob(
    jobId: string,
    input: UpdateFixJobInput,
    fixerId: string,
  ): Promise<FixJob> {

    const job = await db.query.fixJobs.findFirst({ where: eq(fixJobs.id, jobId) });
    if (!job) throw new NotFoundError('Fix job not found');
    if (job.fixerId !== fixerId) throw new ForbiddenError('Only the assigned fixer can update this job');

    if (TERMINAL_STATES.includes(job.status as FixJobStatus)) {
      throw new ConflictError(`This fix job is ${job.status} and cannot be modified`);
    }

    // Validate status transition
    if (input.status && input.status !== job.status) {
      const allowed = VALID_TRANSITIONS[job.status as FixJobStatus] ?? [];
      if (!allowed.includes(input.status as FixJobStatus)) {
        throw new BadRequestError(
          `Cannot move from ${job.status} → ${input.status}. ` +
          `Valid next steps: ${allowed.join(', ') || 'none'}`,
        );
      }
    }

    const completionTimestamp =
      input.status === 'COMPLETED' && job.status !== 'COMPLETED'
        ? { actualCompletionAt: new Date() }
        : {};

    const [updated] = await db.transaction(async (tx) => {
      const [updatedJob] = await tx
        .update(fixJobs)
        .set({
          ...(input.status !== undefined && { status: input.status }),
          ...(input.estimatedCompletionAt !== undefined && { estimatedCompletionAt: input.estimatedCompletionAt }),
          ...(input.finalCost !== undefined && { finalCost: input.finalCost?.toString() }),
          ...(input.repairNotes !== undefined && { repairNotes: input.repairNotes }),
          ...completionTimestamp,
          updatedAt: new Date(),
        })
        .where(eq(fixJobs.id, jobId))
        .returning();

      // Record status change in history
      if (input.status && input.status !== job.status) {
        await tx.insert(fixJobStatusHistory).values({
          fixJobId: jobId,
          fromStatus: job.status as FixJobStatus,
          toStatus: input.status as FixJobStatus,
          changedBy: fixerId,
          notes: input.notes ?? null,
        });
      }

      return [updatedJob];
    });

    return updated;
  }

  // ----------------------------------------------------------
  // CANCEL — requires a reason, records in history
  // ----------------------------------------------------------

  async cancelFixJob(
    jobId: string,
    input: CancelFixJobInput,
    requesterId: string,
    requesterRole: string,
  ): Promise<FixJob> {

    const job = await db.query.fixJobs.findFirst({ where: eq(fixJobs.id, jobId) });
    if (!job) throw new NotFoundError('Fix job not found');

    // Both fixer and owner can cancel
    if (requesterRole === 'FIXER' && job.fixerId !== requesterId) throw new ForbiddenError();
    if (requesterRole === 'OWNER' && job.ownerId !== requesterId) throw new ForbiddenError();

    if (TERMINAL_STATES.includes(job.status as FixJobStatus)) {
      throw new ConflictError(`Cannot cancel a job that is already ${job.status}`);
    }

    const [updated] = await db.transaction(async (tx) => {
      const [updatedJob] = await tx
        .update(fixJobs)
        .set({ status: 'CANCELLED', cancelReason: input.reason, updatedAt: new Date() })
        .where(eq(fixJobs.id, jobId))
        .returning();

      await tx.insert(fixJobStatusHistory).values({
        fixJobId: jobId,
        fromStatus: job.status as FixJobStatus,
        toStatus: 'CANCELLED',
        changedBy: requesterId,
        notes: `Cancelled: ${input.reason}`,
      });

      return [updatedJob];
    });

    return updated;
  }

  // ----------------------------------------------------------
  // ADD PART — appends to the partsUsed JSON array
  // ----------------------------------------------------------

  async addPart(
    jobId: string,
    input: AddPartInput,
    fixerId: string,
  ): Promise<FixJob> {

    const job = await db.query.fixJobs.findFirst({ where: eq(fixJobs.id, jobId) });
    if (!job) throw new NotFoundError('Fix job not found');
    if (job.fixerId !== fixerId) throw new ForbiddenError('Only the assigned fixer can add parts');
    if (TERMINAL_STATES.includes(job.status as FixJobStatus)) {
      throw new ConflictError('Cannot add parts to a completed or cancelled job');
    }

    const currentParts: PartEntry[] = (job.partsUsed as PartEntry[]) ?? [];
    const newPart: PartEntry = {
      name: input.name,
      quantity: input.quantity,
      unitCost: input.unitCost,
    };

    const updatedParts = [...currentParts, newPart];

    // Recalculate estimated cost from parts if not set manually
    const partsTotal = updatedParts.reduce((sum, p) => sum + p.quantity * p.unitCost, 0);

    const [updated] = await db
      .update(fixJobs)
      .set({
        partsUsed: updatedParts,
        // Update estimated cost to reflect parts cost if it was 0/unset
        ...((!job.estimatedCost || Number(job.estimatedCost) === 0) && {
          estimatedCost: partsTotal.toString(),
        }),
        updatedAt: new Date(),
      })
      .where(eq(fixJobs.id, jobId))
      .returning();

    return updated;
  }

  // ----------------------------------------------------------
  // REMOVE PART — removes by index from partsUsed array
  // ----------------------------------------------------------

  async removePart(
    jobId: string,
    input: RemovePartInput,
    fixerId: string,
  ): Promise<FixJob> {

    const job = await db.query.fixJobs.findFirst({ where: eq(fixJobs.id, jobId) });
    if (!job) throw new NotFoundError('Fix job not found');
    if (job.fixerId !== fixerId) throw new ForbiddenError();
    if (TERMINAL_STATES.includes(job.status as FixJobStatus)) {
      throw new ConflictError('Cannot remove parts from a completed or cancelled job');
    }

    const currentParts: PartEntry[] = (job.partsUsed as PartEntry[]) ?? [];
    if (input.partIndex < 0 || input.partIndex >= currentParts.length) {
      throw new BadRequestError(`Part index ${input.partIndex} is out of range`);
    }

    const updatedParts = currentParts.filter((_, i) => i !== input.partIndex);

    const [updated] = await db
      .update(fixJobs)
      .set({ partsUsed: updatedParts, updatedAt: new Date() })
      .where(eq(fixJobs.id, jobId))
      .returning();

    return updated;
  }

  // ----------------------------------------------------------
  // GET STATUS HISTORY
  // ----------------------------------------------------------

  async getStatusHistory(
    jobId: string,
    requesterId: string,
    requesterRole: string,
  ): Promise<fixJobStatusHistory[]> {

    const job = await db.query.fixJobs.findFirst({ where: eq(fixJobs.id, jobId) });
    if (!job) throw new NotFoundError('Fix job not found');
    if (requesterRole === 'OWNER' && job.ownerId !== requesterId) throw new ForbiddenError();
    if (requesterRole === 'FIXER' && job.fixerId !== requesterId) throw new ForbiddenError();

    return db.query.fixJobStatusHistory.findMany({
      where: eq(fixJobStatusHistory.fixJobId, jobId),
      orderBy: [desc(fixJobStatusHistory.changedAt)],
    });
  }
}

// Re-export for controller
export type { fixJobStatusHistory };