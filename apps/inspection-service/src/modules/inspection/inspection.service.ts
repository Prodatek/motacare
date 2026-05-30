import { eq, and, desc, count } from 'drizzle-orm';
import { db } from '../../db';
import {
  inspections,
  inspectionItems,
  fixJobs,
  type Inspection,
  type InspectionItem,
  type FixJob,
} from '../../db/schema';
import { env } from '../../config/env';
import { parsePagination, buildPaginationMeta } from '@motacare/shared-utils';
import {
  buildInitialInspectionItems,
  computeChecklistStats,
  STATIC_CHECKLIST,
} from './checklist';
import type {
  CreateInspectionInput,
  UpdateItemInput,
  BatchUpdateItemsInput,
  CompleteInspectionInput,
  CreateFixJobInput,
  UpdateFixJobInput,
  InspectionQueryInput,
  FixJobQueryInput,
} from './inspection.schema';
import type { PaginatedResponse } from '@motacare/shared-types';

// Lazy-load AI client so service starts even without ANTHROPIC_API_KEY
async function getAiClient() {
  try {
    return await import('@motacare/ai-client');
  } catch {
    return null;
  }
}

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
// VEHICLE VERIFICATION
// Calls vehicle-service internal lookup to confirm the hash
// exists before we allow an inspection to be created.
// ============================================================

async function verifyVehicleHash(hash: string): Promise<{
  id: string;
  ownerId: string;
  make: string;
  model: string;
  year: number;
  fuelType: string;
  transmissionType: string;
  engineCapacity?: string | null;
}> {
  const response = await fetch(
    `${env.VEHICLE_SERVICE_URL}/vehicles/internal/lookup/${hash}`,
  );

  if (!response.ok) {
    throw new NotFoundError(
      'Vehicle not found. Register the vehicle before creating an inspection.',
    );
  }

  const body = (await response.json()) as {
    data: {
      id: string;
      ownerId: string;
      make: string;
      model: string;
      year: number;
      fuelType: string;
      transmissionType: string;
      engineCapacity?: string | null;
    }
  };
  return body.data;
}

// ============================================================
// INSPECTION SERVICE
// ============================================================

export class InspectionService {

  // ----------------------------------------------------------
  // GET CHECKLIST TEMPLATE
  // Returns the full static checklist — used to render the
  // form before an inspection session is created
  // ----------------------------------------------------------

  getChecklist() {
    return STATIC_CHECKLIST;
  }

  // ----------------------------------------------------------
  // CREATE INSPECTION SESSION
  // ----------------------------------------------------------

  async createInspection(
    input: CreateInspectionInput,
    fixerId: string,
  ): Promise<Inspection & { items: InspectionItem[]; aiSummaryHint?: string; fallbackUsed?: boolean }> {

    // 1. Verify vehicle exists via vehicle-service
    const vehicle = await verifyVehicleHash(input.vehicleHash);

    // 2. Check no active inspection already exists for this vehicle
    const existingActive = await db.query.inspections.findFirst({
      where: and(
        eq(inspections.vehicleHash, input.vehicleHash),
        eq(inspections.status, 'IN_PROGRESS'),
      ),
    });

    if (existingActive) {
      throw new ConflictError(
        'An in-progress inspection already exists for this vehicle. Complete it before starting a new one.',
      );
    }

    // 3. Attempt AI dynamic checklist generation
    let checklistItems = buildInitialInspectionItems('PLACEHOLDER'); // temp id
    let aiSummaryHint: string | undefined;
    let fallbackUsed = true;

    if (env.ANTHROPIC_API_KEY) {
      try {
        const ai = await getAiClient();
        if (ai) {
          const dynamicChecklist = await ai.generateDynamicChecklist({
            vehicleContext: {
              make: vehicle.make,
              model: vehicle.model,
              year: vehicle.year,
              fuelType: vehicle.fuelType,
              transmissionType: vehicle.transmissionType,
              engineCapacity: vehicle.engineCapacity,
              mileageAtInspection: input.mileageAtInspection,
            },
            reportedSymptoms: input.reportedSymptoms,
            priorityAreas: input.priorityAreas,
          });

          aiSummaryHint = dynamicChecklist.aiSummaryHint;
          fallbackUsed = dynamicChecklist.fallbackUsed;

          // Convert AI categories to DB item seeds
          checklistItems = dynamicChecklist.categories.flatMap((cat) =>
            cat.items.map((item) => ({
              inspectionId: 'PLACEHOLDER',
              category: cat.id,
              checkId: item.id,
              checkName: item.name,
              status: 'NOT_CHECKED' as const,
              severity: null,
              notes: item.aiReason ? `AI note: ${item.aiReason}` : null,
              mediaUrls: [],
            })),
          );
        }
      } catch (err) {
        // AI failed — fall back to static (already set above)
        console.warn('[inspection] AI checklist failed, using static fallback:', err);
      }
    }

    // 4. Create inspection + seed all checklist items atomically
    const result = await db.transaction(async (tx) => {
      const [newInspection] = await tx
        .insert(inspections)
        .values({
          vehicleHash: input.vehicleHash,
          vehicleId: vehicle.id,
          fixerId,
          ownerId: vehicle.ownerId,
          status: 'IN_PROGRESS',
          mileageAtInspection: input.mileageAtInspection,
        })
        .returning();

      // Replace placeholder ID with real inspection ID
      const itemSeeds = checklistItems.map((item) => ({
        ...item,
        inspectionId: newInspection.id,
      }));

      const seededItems = await tx
        .insert(inspectionItems)
        .values(itemSeeds)
        .returning();

      return { ...newInspection, items: seededItems };
    });

    return { ...result, aiSummaryHint, fallbackUsed };
  }

  // ----------------------------------------------------------
  // GET INSPECTION WITH ALL ITEMS
  // ----------------------------------------------------------

  async getInspection(
    inspectionId: string,
    requesterId: string,
    requesterRole: string,
  ): Promise<Inspection & { items: InspectionItem[]; stats: ReturnType<typeof computeChecklistStats> }> {

    const inspection = await db.query.inspections.findFirst({
      where: eq(inspections.id, inspectionId),
    });

    if (!inspection) throw new NotFoundError('Inspection not found');

    // Access control: owners see their own, fixers see jobs they own, admins see all
    if (requesterRole === 'OWNER' && inspection.ownerId !== requesterId) {
      throw new ForbiddenError();
    }
    if (requesterRole === 'FIXER' && inspection.fixerId !== requesterId) {
      throw new ForbiddenError();
    }

    const items = await db.query.inspectionItems.findMany({
      where: eq(inspectionItems.inspectionId, inspectionId),
      orderBy: [inspectionItems.category, inspectionItems.checkId],
    });

    const stats = computeChecklistStats(items);

    return { ...inspection, items, stats };
  }

  // ----------------------------------------------------------
  // LIST INSPECTIONS (for a fixer or owner, paginated)
  // ----------------------------------------------------------

  async listInspections(
    requesterId: string,
    requesterRole: string,
    query: InspectionQueryInput,
  ): Promise<PaginatedResponse<Inspection>> {
    const { offset, limit, page } = parsePagination(query);

    const conditions = requesterRole === 'OWNER'
      ? [eq(inspections.ownerId, requesterId)]
      : requesterRole === 'FIXER'
        ? [eq(inspections.fixerId, requesterId)]
        : []; // ADMIN sees all

    if (query.status) conditions.push(eq(inspections.status, query.status));
    if (query.vehicleHash) conditions.push(eq(inspections.vehicleHash, query.vehicleHash));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, [{ value: total }]] = await Promise.all([
      db.query.inspections.findMany({
        where: whereClause,
        orderBy: [desc(inspections.createdAt)],
        limit,
        offset,
      }),
      db.select({ value: count() }).from(inspections).where(whereClause),
    ]);

    return {
      data: rows,
      pagination: buildPaginationMeta(Number(total), page, limit),
    };
  }

  // ----------------------------------------------------------
  // UPDATE A SINGLE CHECKLIST ITEM
  // ----------------------------------------------------------

  async updateItem(
    inspectionId: string,
    input: UpdateItemInput,
    fixerId: string,
  ): Promise<InspectionItem> {

    const inspection = await db.query.inspections.findFirst({
      where: eq(inspections.id, inspectionId),
    });

    if (!inspection) throw new NotFoundError('Inspection not found');
    if (inspection.fixerId !== fixerId) throw new ForbiddenError('Only the assigned fixer can update inspection items');
    if (inspection.status === 'COMPLETED') throw new ConflictError('Cannot update items on a completed inspection');

    const item = await db.query.inspectionItems.findFirst({
      where: and(
        eq(inspectionItems.inspectionId, inspectionId),
        eq(inspectionItems.checkId, input.checkId),
      ),
    });

    if (!item) throw new NotFoundError(`Check item '${input.checkId}' not found in this inspection`);

    const [updated] = await db
      .update(inspectionItems)
      .set({
        status: input.status,
        severity: input.severity ?? null,
        notes: input.notes ?? null,
        mediaUrls: input.mediaUrls ?? item.mediaUrls,
        updatedAt: new Date(),
      })
      .where(eq(inspectionItems.id, item.id))
      .returning();

    // Also bump inspection updatedAt
    await db
      .update(inspections)
      .set({ updatedAt: new Date() })
      .where(eq(inspections.id, inspectionId));

    return updated;
  }

  // ----------------------------------------------------------
  // BATCH UPDATE ITEMS — submit many at once
  // ----------------------------------------------------------

  async batchUpdateItems(
    inspectionId: string,
    input: BatchUpdateItemsInput,
    fixerId: string,
  ): Promise<InspectionItem[]> {
    const results: InspectionItem[] = [];

    // Process sequentially to respect DB constraints
    // Could be parallelised but serial is safer for FK checks
    for (const itemUpdate of input.items) {
      const updated = await this.updateItem(inspectionId, itemUpdate, fixerId);
      results.push(updated);
    }

    return results;
  }

  // ----------------------------------------------------------
  // COMPLETE INSPECTION
  // Validates all items are checked, then marks as complete
  // ----------------------------------------------------------

  async completeInspection(
    inspectionId: string,
    input: CompleteInspectionInput,
    fixerId: string,
  ): Promise<Inspection & { stats: ReturnType<typeof computeChecklistStats> }> {

    const inspection = await db.query.inspections.findFirst({
      where: eq(inspections.id, inspectionId),
    });

    if (!inspection) throw new NotFoundError('Inspection not found');
    if (inspection.fixerId !== fixerId) throw new ForbiddenError();

    // Only block if already in a terminal state
    if (inspection.status === 'COMPLETED' || inspection.status === 'NEEDS_FOLLOWUP') {
      throw new ConflictError(
        `Inspection is already marked as ${inspection.status}. ` +
        `Only DRAFT or IN_PROGRESS inspections can be updated.`,
      );
    }

    // Require a summary for COMPLETED and NEEDS_FOLLOWUP outcomes
    if (
      (input.outcome === 'COMPLETED' || input.outcome === 'NEEDS_FOLLOWUP') &&
      (!input.summary || input.summary.trim().length < 5)
    ) {
      throw new BadRequestError(
        'A summary is required when marking an inspection as COMPLETED or NEEDS_FOLLOWUP.',
      );
    }

    const items = await db.query.inspectionItems.findMany({
      where: eq(inspectionItems.inspectionId, inspectionId),
    });

    // Generate AI summary for completed/needs-followup outcomes — best effort, non-blocking
    let aiSummary: string | null = inspection.aiSummary ?? null;
    if (
      env.ANTHROPIC_API_KEY &&
      input.outcome !== 'DRAFT' &&
      input.summary
    ) {
      try {
        const ai = await getAiClient();
        if (ai) {
          const vehicleRes = await fetch(
            `${env.VEHICLE_SERVICE_URL}/vehicles/internal/lookup/${inspection.vehicleHash}`,
          );
          const vehicleData = vehicleRes.ok
            ? ((await vehicleRes.json()) as any).data
            : null;

          if (vehicleData) {
            const summaryResult = await ai.generateInspectionSummary({
              vehicle: {
                make: vehicleData.make,
                model: vehicleData.model,
                year: vehicleData.year,
                mileageAtInspection: inspection.mileageAtInspection,
                fuelType: vehicleData.fuelType,
              },
              fixer: { firstName: 'Technician' },
              items: items.map((i) => ({
                category: i.category,
                checkName: i.checkName,
                status: i.status as any,
                severity: i.severity,
                notes: i.notes,
              })),
              fixerSummary: input.summary,
              inspectionDate: new Date().toISOString(),
            });
            aiSummary = JSON.stringify(summaryResult);
          }
        }
      } catch (err) {
        console.warn('[inspection] AI summary generation failed:', err);
      }
    }

    const isTerminal = input.outcome !== 'DRAFT';

    const [completed] = await db
      .update(inspections)
      .set({
        status: input.outcome,
        summary: input.summary ?? inspection.summary,
        aiSummary,
        completedAt: isTerminal ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(inspections.id, inspectionId))
      .returning();

    const stats = computeChecklistStats(items);
    return { ...completed, stats };
  }

  // ----------------------------------------------------------
  // CREATE FIX JOB FROM INSPECTION
  // ----------------------------------------------------------

  async createFixJob(
    inspectionId: string,
    input: CreateFixJobInput,
    fixerId: string,
  ): Promise<FixJob> {

    const inspection = await db.query.inspections.findFirst({
      where: eq(inspections.id, inspectionId),
    });

    if (!inspection) throw new NotFoundError('Inspection not found');
    if (inspection.fixerId !== fixerId) throw new ForbiddenError();

    if (inspection.status === 'DRAFT' || inspection.status === 'IN_PROGRESS') {
      throw new BadRequestError(
        'Mark the inspection as COMPLETED or NEEDS_FOLLOWUP before creating a fix job.',
      );
    }

    const [job] = await db
      .insert(fixJobs)
      .values({
        inspectionId,
        vehicleHash: inspection.vehicleHash,
        fixerId: inspection.fixerId,
        ownerId: inspection.ownerId,
        description: input.description,
        estimatedCompletionAt: input.estimatedCompletionAt,
        estimatedCost: input.estimatedCost?.toString(),
        currency: input.currency,
      })
      .returning();

    return job;
  }

  // ----------------------------------------------------------
  // UPDATE FIX JOB STATUS
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
    if (job.fixerId !== fixerId) throw new ForbiddenError();
    if (job.status === 'CANCELLED') throw new ConflictError('Cannot update a cancelled job');
    if (job.status === 'DELIVERED') throw new ConflictError('Cannot update a delivered job');

    const setActualCompletion =
      input.status === 'COMPLETED' && job.status !== 'COMPLETED'
        ? { actualCompletionAt: new Date() }
        : {};

    const [updated] = await db
      .update(fixJobs)
      .set({
        ...input,
        ...setActualCompletion,
        finalCost: input.finalCost?.toString(),
        updatedAt: new Date(),
      })
      .where(eq(fixJobs.id, jobId))
      .returning();

    return updated;
  }

  // ----------------------------------------------------------
  // GET FIX JOB
  // ----------------------------------------------------------

  async getFixJob(
    jobId: string,
    requesterId: string,
    requesterRole: string,
  ): Promise<FixJob> {

    const job = await db.query.fixJobs.findFirst({
      where: eq(fixJobs.id, jobId),
    });

    if (!job) throw new NotFoundError('Fix job not found');

    if (requesterRole === 'OWNER' && job.ownerId !== requesterId) throw new ForbiddenError();
    if (requesterRole === 'FIXER' && job.fixerId !== requesterId) throw new ForbiddenError();

    return job;
  }

  // ----------------------------------------------------------
  // LIST FIX JOBS
  // ----------------------------------------------------------

  async listFixJobs(
    requesterId: string,
    requesterRole: string,
    query: FixJobQueryInput,
  ): Promise<PaginatedResponse<FixJob>> {
    const { offset, limit, page } = parsePagination(query);

    const conditions = requesterRole === 'OWNER'
      ? [eq(fixJobs.ownerId, requesterId)]
      : requesterRole === 'FIXER'
        ? [eq(fixJobs.fixerId, requesterId)]
        : [];

    if (query.status) conditions.push(eq(fixJobs.status, query.status));

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
}