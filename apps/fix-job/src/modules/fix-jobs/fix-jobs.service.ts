import { eq, and, desc, count } from 'drizzle-orm';
import { db } from '../../db';
import {
  fixJobs, fixJobStatusHistory,
  type FixJob, type FixJobStatus,
} from '../../db/schema';
import { parsePagination, buildPaginationMeta } from '@motacare/shared-utils';
import type {
  CreateFixJobInput, UpdateFixJobInput, FixJobQueryInput,
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
// VALID STATUS TRANSITIONS
// Prevents illegal moves like DELIVERED → IN_PROGRESS.
// ============================================================

const VALID_TRANSITIONS: Record<FixJobStatus, FixJobStatus[]> = {
  PENDING:        ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS:    ['AWAITING_PARTS', 'COMPLETED', 'CANCELLED'],
  AWAITING_PARTS: ['IN_PROGRESS', 'CANCELLED'],
  COMPLETED:      ['DELIVERED'],
  DELIVERED:      [],
  CANCELLED:      [],
};

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
        })
        .returning();

      // Seed initial status history entry
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
  // GET SINGLE
  // ----------------------------------------------------------

  async getFixJob(
    jobId: string,
    requesterId: string,
    requesterRole: string,
  ): Promise<FixJob & { statusHistory: any[] }> {
    const job = await db.query.fixJobs.findFirst({
      where: eq(fixJobs.id, jobId),
      with: { statusHistory: { orderBy: [desc(fixJobStatusHistory.changedAt)] } },
    });

    if (!job) throw new NotFoundError('Fix job not found');

    if (requesterRole === 'OWNER' && job.ownerId !== requesterId) throw new ForbiddenError();
    if (requesterRole === 'FIXER' && job.fixerId !== requesterId) throw new ForbiddenError();

    return job as FixJob & { statusHistory: any[] };
  }

  // ----------------------------------------------------------
  // LIST (paginated, role-scoped)
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

    return {
      data: rows,
      pagination: buildPaginationMeta(Number(total), page, limit),
    };
  }

  // ----------------------------------------------------------
  // UPDATE STATUS
  // Validates transition, records history, sets timestamps.
  // ----------------------------------------------------------

  async updateFixJob(
    jobId: string,
    input: UpdateFixJobInput,
    fixerId: string,
  ): Promise<FixJob> {
    const job = await db.query.fixJobs.findFirst({
      where: eq(fixJobs.id, jobId),
    });

    if (!job) throw new NotFoundError('Fix job not found');
    if (job.fixerId !== fixerId) throw new ForbiddenError('Only the assigned fixer can update this job');

    // Validate status transition
    if (input.status && input.status !== job.status) {
      const allowed = VALID_TRANSITIONS[job.status as FixJobStatus] ?? [];
      if (!allowed.includes(input.status as FixJobStatus)) {
        throw new BadRequestError(
          `Cannot move from ${job.status} to ${input.status}. ` +
          `Valid transitions: ${allowed.join(', ') || 'none'}`,
        );
      }
    }

    // Set actual completion timestamp when job is marked COMPLETED
    const completionFields =
      input.status === 'COMPLETED' && job.status !== 'COMPLETED'
        ? { actualCompletionAt: new Date() }
        : {};

    const [updated] = await db.transaction(async (tx) => {
      const [updatedJob] = await tx
        .update(fixJobs)
        .set({
          ...(input.status && { status: input.status }),
          ...(input.estimatedCompletionAt !== undefined && { estimatedCompletionAt: input.estimatedCompletionAt }),
          ...(input.finalCost !== undefined && { finalCost: input.finalCost?.toString() }),
          ...(input.repairNotes !== undefined && { repairNotes: input.repairNotes }),
          ...completionFields,
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
  // GET STATUS HISTORY (owner + fixer)
  // ----------------------------------------------------------

  async getStatusHistory(
    jobId: string,
    requesterId: string,
    requesterRole: string,
  ) {
    const job = await db.query.fixJobs.findFirst({
      where: eq(fixJobs.id, jobId),
    });

    if (!job) throw new NotFoundError('Fix job not found');
    if (requesterRole === 'OWNER' && job.ownerId !== requesterId) throw new ForbiddenError();
    if (requesterRole === 'FIXER' && job.fixerId !== requesterId) throw new ForbiddenError();

    return db.query.fixJobStatusHistory.findMany({
      where: eq(fixJobStatusHistory.fixJobId, jobId),
      orderBy: [desc(fixJobStatusHistory.changedAt)],
    });
  }

  // ----------------------------------------------------------
  // INTERNAL: get jobs needing alert checks (used by Phase 2 alert system)
  // ----------------------------------------------------------

  async getJobsNeedingAlerts(): Promise<FixJob[]> {
    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    return db.query.fixJobs.findMany({
      where: and(
        eq(fixJobs.status, 'IN_PROGRESS'),
        // Only jobs with an estimated completion time
      ),
    });
  }
}