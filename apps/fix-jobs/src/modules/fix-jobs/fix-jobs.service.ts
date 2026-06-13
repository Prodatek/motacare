import { eq, and, desc, count } from 'drizzle-orm';
import { db } from '../../db';
import {
  fixJobs, fixJobStatusHistory,
  type FixJob, type FixJobStatus, type PartEntry,
} from '../../db/schema';
import { parsePagination, buildPaginationMeta } from '@motacare/shared-utils';
import type {
  CreateFixJobInput, UpdateFixJobInput,
  AddPartInput, RemovePartInput,
  CancelFixJobInput, FixJobQueryInput,
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
// ============================================================

const VALID_TRANSITIONS: Record<FixJobStatus, FixJobStatus[]> = {
  PENDING:        ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS:    ['AWAITING_PARTS', 'COMPLETED', 'CANCELLED'],
  AWAITING_PARTS: ['IN_PROGRESS', 'CANCELLED'],
  COMPLETED:      ['DELIVERED'],
  DELIVERED:      [],
  CANCELLED:      [],
};

const TERMINAL_STATES: FixJobStatus[] = ['DELIVERED', 'CANCELLED'];

// ============================================================
// ALERT SERVICE INTEGRATION
// Fire-and-forget — alert failures never block fix job operations.
// ============================================================

const ALERT_SERVICE_URL = process.env.ALERT_SERVICE_URL ?? 'http://localhost:3005';

async function scheduleAlerts(job: FixJob): Promise<void> {
  if (!job.estimatedCompletionAt) return;

  try {
    await fetch(`${ALERT_SERVICE_URL}/alerts/schedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fixJobId:              job.id,
        estimatedCompletionAt: job.estimatedCompletionAt.toISOString(),
        vehicleHash:           job.vehicleHash,
        fixerId:               job.fixerId,
        ownerId:               job.ownerId,
        description:           job.description,
      }),
    });
  } catch (err) {
    // Log but never throw — alert failure must not fail the API call
    console.warn(`[fix-jobs] Failed to schedule alerts for job ${job.id}:`, err);
  }
}

async function cancelAlerts(fixJobId: string): Promise<void> {
  try {
    await fetch(`${ALERT_SERVICE_URL}/alerts/${fixJobId}`, { method: 'DELETE' });
  } catch (err) {
    console.warn(`[fix-jobs] Failed to cancel alerts for job ${fixJobId}:`, err);
  }
}

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
          inspectionId:          input.inspectionId,
          vehicleHash:           input.vehicleHash,
          fixerId,
          ownerId:               input.ownerId,
          description:           input.description,
          estimatedCompletionAt: input.estimatedCompletionAt,
          estimatedCost:         input.estimatedCost?.toString(),
          currency:              input.currency,
          partsUsed:             [],
        })
        .returning();

      await tx.insert(fixJobStatusHistory).values({
        fixJobId:   newJob.id,
        fromStatus: null,
        toStatus:   'PENDING',
        changedBy:  fixerId,
        notes:      'Fix job created',
      });

      return [newJob];
    });

    // Schedule alerts if an estimated completion time was provided
    await scheduleAlerts(job);

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
  // LIST
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

    if (query.status)      conditions.push(eq(fixJobs.status, query.status));
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
  // Reschedules alerts if estimatedCompletionAt changes.
  // Cancels alerts if job moves to a terminal state.
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
          ...(input.status !== undefined           && { status: input.status }),
          ...(input.estimatedCompletionAt !== undefined && { estimatedCompletionAt: input.estimatedCompletionAt }),
          ...(input.finalCost !== undefined        && { finalCost: input.finalCost?.toString() }),
          ...(input.repairNotes !== undefined      && { repairNotes: input.repairNotes }),
          ...completionTimestamp,
          updatedAt: new Date(),
        })
        .where(eq(fixJobs.id, jobId))
        .returning();

      if (input.status && input.status !== job.status) {
        await tx.insert(fixJobStatusHistory).values({
          fixJobId:   jobId,
          fromStatus: job.status as FixJobStatus,
          toStatus:   input.status as FixJobStatus,
          changedBy:  fixerId,
          notes:      input.notes ?? null,
        });
      }

      return [updatedJob];
    });

    // Alert side-effects — fire and forget
    const movedToTerminal = TERMINAL_STATES.includes(updated.status as FixJobStatus);
    const completionTimeChanged =
      input.estimatedCompletionAt !== undefined &&
      input.estimatedCompletionAt?.toString() !== job.estimatedCompletionAt?.toString();

    if (movedToTerminal) {
      // Job done or cancelled — remove any pending alerts
      await cancelAlerts(jobId);
    } else if (completionTimeChanged) {
      // Due date changed — reschedule at new time
      await scheduleAlerts(updated);
    }

    return updated;
  }

  // ----------------------------------------------------------
  // CANCEL
  // ----------------------------------------------------------

  async cancelFixJob(
    jobId: string,
    input: CancelFixJobInput,
    requesterId: string,
    requesterRole: string,
  ): Promise<FixJob> {

    const job = await db.query.fixJobs.findFirst({ where: eq(fixJobs.id, jobId) });
    if (!job) throw new NotFoundError('Fix job not found');

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
        fixJobId:   jobId,
        fromStatus: job.status as FixJobStatus,
        toStatus:   'CANCELLED',
        changedBy:  requesterId,
        notes:      `Cancelled: ${input.reason}`,
      });

      return [updatedJob];
    });

    // Cancel pending alerts — job is done
    await cancelAlerts(jobId);

    return updated;
  }

  // ----------------------------------------------------------
  // ADD PART
  // ----------------------------------------------------------

  async addPart(jobId: string, input: AddPartInput, fixerId: string): Promise<FixJob> {
    const job = await db.query.fixJobs.findFirst({ where: eq(fixJobs.id, jobId) });
    if (!job) throw new NotFoundError('Fix job not found');
    if (job.fixerId !== fixerId) throw new ForbiddenError();
    if (TERMINAL_STATES.includes(job.status as FixJobStatus)) {
      throw new ConflictError('Cannot add parts to a completed or cancelled job');
    }

    const current: PartEntry[] = (job.partsUsed as PartEntry[]) ?? [];
    const updated = [...current, { name: input.name, quantity: input.quantity, unitCost: input.unitCost }];
    const partsTotal = updated.reduce((sum, p) => sum + p.quantity * p.unitCost, 0);

    const [result] = await db
      .update(fixJobs)
      .set({
        partsUsed: updated,
        ...(!job.estimatedCost || Number(job.estimatedCost) === 0
          ? { estimatedCost: partsTotal.toString() }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(fixJobs.id, jobId))
      .returning();

    return result;
  }

  // ----------------------------------------------------------
  // REMOVE PART
  // ----------------------------------------------------------

  async removePart(jobId: string, input: RemovePartInput, fixerId: string): Promise<FixJob> {
    const job = await db.query.fixJobs.findFirst({ where: eq(fixJobs.id, jobId) });
    if (!job) throw new NotFoundError('Fix job not found');
    if (job.fixerId !== fixerId) throw new ForbiddenError();
    if (TERMINAL_STATES.includes(job.status as FixJobStatus)) {
      throw new ConflictError('Cannot remove parts from a completed or cancelled job');
    }

    const current: PartEntry[] = (job.partsUsed as PartEntry[]) ?? [];
    if (input.partIndex < 0 || input.partIndex >= current.length) {
      throw new BadRequestError(`Part index ${input.partIndex} is out of range`);
    }

    const [result] = await db
      .update(fixJobs)
      .set({ partsUsed: current.filter((_, i) => i !== input.partIndex), updatedAt: new Date() })
      .where(eq(fixJobs.id, jobId))
      .returning();

    return result;
  }

  // ----------------------------------------------------------
  // GET STATUS HISTORY
  // ----------------------------------------------------------

  async getStatusHistory(jobId: string, requesterId: string, requesterRole: string) {
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

export type { PartEntry };