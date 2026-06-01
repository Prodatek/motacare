import type { FastifyRequest, FastifyReply } from 'fastify';
import {
  FixJobService, NotFoundError, ForbiddenError, ConflictError, BadRequestError,
} from './fix-jobs.service';
import {
  createFixJobSchema, updateFixJobSchema, addPartSchema,
  removePartSchema, cancelFixJobSchema, fixJobQuerySchema,
} from './fix-jobs.schema';

type AuthUser = { sub: string; role: string };

export class FixJobController {
  constructor(private readonly service: FixJobService) {}

  // POST /fix-jobs
  async create(request: FastifyRequest, reply: FastifyReply) {
    const parsed = createFixJobSchema.safeParse(request.body);
    if (!parsed.success) return this.validationError(reply, parsed.error);
    try {
      const { sub: fixerId } = request.user as AuthUser;
      const job = await this.service.createFixJob(parsed.data, fixerId);
      return reply.status(201).send({ statusCode: 201, message: 'Fix job created', data: job });
    } catch (e) { return this.handleError(e, reply); }
  }

  // GET /fix-jobs
  async list(request: FastifyRequest, reply: FastifyReply) {
    const parsed = fixJobQuerySchema.safeParse(request.query);
    if (!parsed.success) return this.validationError(reply, parsed.error);
    try {
      const { sub, role } = request.user as AuthUser;
      const result = await this.service.listFixJobs(sub, role, parsed.data);
      return reply.status(200).send({ statusCode: 200, ...result });
    } catch (e) { return this.handleError(e, reply); }
  }

  // GET /fix-jobs/:id
  async getOne(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    try {
      const { sub, role } = request.user as AuthUser;
      const job = await this.service.getFixJob(request.params.id, sub, role);
      return reply.status(200).send({ statusCode: 200, data: job });
    } catch (e) { return this.handleError(e, reply); }
  }

  // PATCH /fix-jobs/:id
  async update(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const parsed = updateFixJobSchema.safeParse(request.body);
    if (!parsed.success) return this.validationError(reply, parsed.error);
    try {
      const { sub: fixerId } = request.user as AuthUser;
      const job = await this.service.updateFixJob(request.params.id, parsed.data, fixerId);
      return reply.status(200).send({ statusCode: 200, message: 'Fix job updated', data: job });
    } catch (e) { return this.handleError(e, reply); }
  }

  // POST /fix-jobs/:id/cancel
  async cancel(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const parsed = cancelFixJobSchema.safeParse(request.body);
    if (!parsed.success) return this.validationError(reply, parsed.error);
    try {
      const { sub, role } = request.user as AuthUser;
      const job = await this.service.cancelFixJob(request.params.id, parsed.data, sub, role);
      return reply.status(200).send({ statusCode: 200, message: 'Fix job cancelled', data: job });
    } catch (e) { return this.handleError(e, reply); }
  }

  // POST /fix-jobs/:id/parts
  async addPart(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const parsed = addPartSchema.safeParse(request.body);
    if (!parsed.success) return this.validationError(reply, parsed.error);
    try {
      const { sub: fixerId } = request.user as AuthUser;
      const job = await this.service.addPart(request.params.id, parsed.data, fixerId);
      return reply.status(200).send({ statusCode: 200, message: 'Part added', data: job });
    } catch (e) { return this.handleError(e, reply); }
  }

  // DELETE /fix-jobs/:id/parts/:index
  async removePart(
    request: FastifyRequest<{ Params: { id: string; index: string } }>,
    reply: FastifyReply,
  ) {
    const parsed = removePartSchema.safeParse({ partIndex: Number(request.params.index) });
    if (!parsed.success) return this.validationError(reply, parsed.error);
    try {
      const { sub: fixerId } = request.user as AuthUser;
      const job = await this.service.removePart(request.params.id, parsed.data, fixerId);
      return reply.status(200).send({ statusCode: 200, message: 'Part removed', data: job });
    } catch (e) { return this.handleError(e, reply); }
  }

  // GET /fix-jobs/:id/history
  async getHistory(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    try {
      const { sub, role } = request.user as AuthUser;
      const history = await this.service.getStatusHistory(request.params.id, sub, role);
      return reply.status(200).send({ statusCode: 200, data: history });
    } catch (e) { return this.handleError(e, reply); }
  }

  // ----------------------------------------------------------
  // HELPERS
  // ----------------------------------------------------------

  private validationError(reply: FastifyReply, error: any) {
    return reply.status(400).send({
      statusCode: 400,
      error: 'Validation Error',
      message: 'Invalid request data',
      details: error.flatten().fieldErrors,
    });
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

    console.error('Unhandled error:', error);
    return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'An unexpected error occurred' });
  }
}