import type { FastifyRequest, FastifyReply } from 'fastify';
import {
  InspectionService,
  NotFoundError,
  ForbiddenError,
  ConflictError,
  BadRequestError,
} from './inspection.service';
import {
  createInspectionSchema,
  updateItemSchema,
  batchUpdateItemsSchema,
  completeInspectionSchema,
  createFixJobSchema,
  updateFixJobSchema,
  inspectionQuerySchema,
  fixJobQuerySchema,
} from './inspection.schema';

type AuthUser = { sub: string; role: string };

export class InspectionController {
  constructor(private readonly service: InspectionService) {}

  // GET /inspections/checklist
  async getChecklist(_req: FastifyRequest, reply: FastifyReply) {
    return reply.status(200).send({
      statusCode: 200,
      data: this.service.getChecklist(),
    });
  }

  // POST /inspections
  async create(request: FastifyRequest, reply: FastifyReply) {
    const parsed = createInspectionSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        statusCode: 400, error: 'Validation Error',
        details: parsed.error.flatten().fieldErrors,
      });
    }
    try {
      const { sub: fixerId } = request.user as AuthUser;
      const result = await this.service.createInspection(parsed.data, fixerId);
      return reply.status(201).send({ statusCode: 201, message: 'Inspection session created', data: result });
    } catch (e) { return this.handleError(e, reply); }
  }

  // GET /inspections
  async list(request: FastifyRequest, reply: FastifyReply) {
    const parsed = inspectionQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ statusCode: 400, error: 'Validation Error', details: parsed.error.flatten().fieldErrors });
    }
    try {
      const { sub, role } = request.user as AuthUser;
      const result = await this.service.listInspections(sub, role, parsed.data);
      return reply.status(200).send({ statusCode: 200, ...result });
    } catch (e) { return this.handleError(e, reply); }
  }

  // GET /inspections/:id
  async getOne(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    try {
      const { sub, role } = request.user as AuthUser;
      const result = await this.service.getInspection(request.params.id, sub, role);
      return reply.status(200).send({ statusCode: 200, data: result });
    } catch (e) { return this.handleError(e, reply); }
  }

  // PATCH /inspections/:id/items
  async updateItem(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const parsed = updateItemSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ statusCode: 400, error: 'Validation Error', details: parsed.error.flatten().fieldErrors });
    }
    try {
      const { sub: fixerId } = request.user as AuthUser;
      const result = await this.service.updateItem(request.params.id, parsed.data, fixerId);
      return reply.status(200).send({ statusCode: 200, message: 'Item updated', data: result });
    } catch (e) { return this.handleError(e, reply); }
  }

  // PATCH /inspections/:id/items/batch
  async batchUpdateItems(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const parsed = batchUpdateItemsSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ statusCode: 400, error: 'Validation Error', details: parsed.error.flatten().fieldErrors });
    }
    try {
      const { sub: fixerId } = request.user as AuthUser;
      const results = await this.service.batchUpdateItems(request.params.id, parsed.data, fixerId);
      return reply.status(200).send({ statusCode: 200, message: `${results.length} items updated`, data: results });
    } catch (e) { return this.handleError(e, reply); }
  }

  // POST /inspections/:id/complete
  async complete(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const parsed = completeInspectionSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ statusCode: 400, error: 'Validation Error', details: parsed.error.flatten().fieldErrors });
    }
    try {
      const { sub: fixerId } = request.user as AuthUser;
      const result = await this.service.completeInspection(request.params.id, parsed.data, fixerId);
      return reply.status(200).send({ statusCode: 200, message: 'Inspection completed', data: result });
    } catch (e) { return this.handleError(e, reply); }
  }

  // POST /inspections/:id/fix-jobs
  async createFixJob(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const parsed = createFixJobSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ statusCode: 400, error: 'Validation Error', details: parsed.error.flatten().fieldErrors });
    }
    try {
      const { sub: fixerId } = request.user as AuthUser;
      const result = await this.service.createFixJob(request.params.id, parsed.data, fixerId);
      return reply.status(201).send({ statusCode: 201, message: 'Fix job created', data: result });
    } catch (e) { return this.handleError(e, reply); }
  }

  // GET /fix-jobs
  async listFixJobs(request: FastifyRequest, reply: FastifyReply) {
    const parsed = fixJobQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ statusCode: 400, error: 'Validation Error', details: parsed.error.flatten().fieldErrors });
    }
    try {
      const { sub, role } = request.user as AuthUser;
      const result = await this.service.listFixJobs(sub, role, parsed.data);
      return reply.status(200).send({ statusCode: 200, ...result });
    } catch (e) { return this.handleError(e, reply); }
  }

  // GET /fix-jobs/:id
  async getFixJob(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    try {
      const { sub, role } = request.user as AuthUser;
      const result = await this.service.getFixJob(request.params.id, sub, role);
      return reply.status(200).send({ statusCode: 200, data: result });
    } catch (e) { return this.handleError(e, reply); }
  }

  // PATCH /fix-jobs/:id
  async updateFixJob(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const parsed = updateFixJobSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ statusCode: 400, error: 'Validation Error', details: parsed.error.flatten().fieldErrors });
    }
    try {
      const { sub: fixerId } = request.user as AuthUser;
      const result = await this.service.updateFixJob(request.params.id, parsed.data, fixerId);
      return reply.status(200).send({ statusCode: 200, message: 'Fix job updated', data: result });
    } catch (e) { return this.handleError(e, reply); }
  }

  private handleError(error: unknown, reply: FastifyReply) {
    if (error instanceof NotFoundError)
      return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: error.message });
    if (error instanceof ForbiddenError)
      return reply.status(403).send({ statusCode: 403, error: 'Forbidden', message: error.message });
    if (error instanceof ConflictError)
      return reply.status(409).send({ statusCode: 409, error: 'Conflict', message: error.message });
    if (error instanceof BadRequestError)
      return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: error.message });

    console.error('Unhandled error in inspection controller:', error);
    return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'An unexpected error occurred' });
  }
}