import type { FastifyRequest, FastifyReply } from 'fastify';
import {
  WorkshopService, NotFoundError, ForbiddenError, ConflictError, BadRequestError,
} from './workshops.service';
import {
  createWorkshopSchema, updateWorkshopSchema, joinRequestSchema,
  memberActionSchema, workshopQuerySchema, statsQuerySchema,
} from './workshops.schema';

type AuthUser = { sub: string; role: string };

export class WorkshopController {
  constructor(private readonly service: WorkshopService) {}

  // POST /workshops
  async create(req: FastifyRequest, rep: FastifyReply) {
    const parsed = createWorkshopSchema.safeParse(req.body);
    if (!parsed.success) return this.validErr(rep, parsed.error);
    try {
      const { sub } = req.user as AuthUser;
      const workshop = await this.service.createWorkshop(parsed.data, sub);
      return rep.status(201).send({ statusCode: 201, message: 'Workshop created — pending approval', data: workshop });
    } catch (e) { return this.handleError(e, rep); }
  }

  // GET /workshops — public list
  async list(req: FastifyRequest, rep: FastifyReply) {
    const parsed = workshopQuerySchema.safeParse(req.query);
    if (!parsed.success) return this.validErr(rep, parsed.error);
    try {
      const result = await this.service.listWorkshops(parsed.data);
      return rep.status(200).send({ statusCode: 200, ...result });
    } catch (e) { return this.handleError(e, rep); }
  }

  // GET /workshops/featured — public, used on landing page
  async listFeatured(req: FastifyRequest, rep: FastifyReply) {
    try {
      const result = await this.service.listWorkshops({ page: 1, limit: 6, featured: true });
      return rep.status(200).send({ statusCode: 200, ...result });
    } catch (e) { return this.handleError(e, rep); }
  }

  // GET /workshops/:id
  async getOne(req: FastifyRequest<{ Params: { id: string } }>, rep: FastifyReply) {
    try {
      const workshop = await this.service.getWorkshop(req.params.id);
      return rep.status(200).send({ statusCode: 200, data: workshop });
    } catch (e) { return this.handleError(e, rep); }
  }

  // GET /workshops/slug/:slug — public
  async getBySlug(req: FastifyRequest<{ Params: { slug: string } }>, rep: FastifyReply) {
    try {
      const workshop = await this.service.getWorkshopBySlug(req.params.slug);
      return rep.status(200).send({ statusCode: 200, data: workshop });
    } catch (e) { return this.handleError(e, rep); }
  }

  // PATCH /workshops/:id
  async update(req: FastifyRequest<{ Params: { id: string } }>, rep: FastifyReply) {
    const parsed = updateWorkshopSchema.safeParse(req.body);
    if (!parsed.success) return this.validErr(rep, parsed.error);
    try {
      const { sub } = req.user as AuthUser;
      const workshop = await this.service.updateWorkshop(req.params.id, parsed.data, sub);
      return rep.status(200).send({ statusCode: 200, message: 'Workshop updated', data: workshop });
    } catch (e) { return this.handleError(e, rep); }
  }

  // POST /workshops/join
  async join(req: FastifyRequest, rep: FastifyReply) {
    const parsed = joinRequestSchema.safeParse(req.body);
    if (!parsed.success) return this.validErr(rep, parsed.error);
    try {
      const { sub } = req.user as AuthUser;
      const member = await this.service.submitJoinRequest(parsed.data, sub);
      return rep.status(201).send({ statusCode: 201, message: 'Join request submitted — awaiting admin approval', data: member });
    } catch (e) { return this.handleError(e, rep); }
  }

  // POST /workshops/:id/members/:memberId — admin approves/rejects
  async handleMember(req: FastifyRequest<{ Params: { id: string; memberId: string } }>, rep: FastifyReply) {
    const parsed = memberActionSchema.safeParse(req.body);
    if (!parsed.success) return this.validErr(rep, parsed.error);
    try {
      const { sub } = req.user as AuthUser;
      const result = await this.service.handleMemberAction(req.params.id, req.params.memberId, parsed.data, sub);
      return rep.status(200).send({ statusCode: 200, message: `Member ${parsed.data.action.toLowerCase()}d`, data: result });
    } catch (e) { return this.handleError(e, rep); }
  }

  // GET /workshops/:id/members/pending — admin only
  async getPending(req: FastifyRequest<{ Params: { id: string } }>, rep: FastifyReply) {
    try {
      const { sub } = req.user as AuthUser;
      const requests = await this.service.getPendingRequests(req.params.id, sub);
      return rep.status(200).send({ statusCode: 200, data: requests });
    } catch (e) { return this.handleError(e, rep); }
  }

  // POST /workshops/:id/leave — fixer leaves
  async leave(req: FastifyRequest<{ Params: { id: string } }>, rep: FastifyReply) {
    try {
      const { sub } = req.user as AuthUser;
      await this.service.leaveWorkshop(req.params.id, sub);
      return rep.status(200).send({ statusCode: 200, message: 'You have left the workshop' });
    } catch (e) { return this.handleError(e, rep); }
  }

  // GET /workshops/:id/stats — admin only
  async getStats(req: FastifyRequest<{ Params: { id: string } }>, rep: FastifyReply) {
    const parsed = statsQuerySchema.safeParse(req.query);
    if (!parsed.success) return this.validErr(rep, parsed.error);
    try {
      const { sub } = req.user as AuthUser;
      const stats = await this.service.getWorkshopStats(req.params.id, sub, parsed.data);
      return rep.status(200).send({ statusCode: 200, data: stats });
    } catch (e) { return this.handleError(e, rep); }
  }

  // GET /workshops/internal/fixer/:fixerId — internal route for other services
  async getFixerWorkshop(req: FastifyRequest<{ Params: { fixerId: string } }>, rep: FastifyReply) {
    try {
      const result = await this.service.getFixerWorkshop(req.params.fixerId);
      return rep.status(200).send({ statusCode: 200, data: result });
    } catch (e) { return this.handleError(e, rep); }
  }

  private validErr(rep: FastifyReply, error: any) {
    return rep.status(400).send({ statusCode: 400, error: 'Validation Error', message: 'Invalid request', details: error.flatten().fieldErrors });
  }

  private handleError(error: unknown, rep: FastifyReply) {
    if (error instanceof NotFoundError)   return rep.status(404).send({ statusCode: 404, error: 'Not Found',   message: error.message });
    if (error instanceof ForbiddenError)  return rep.status(403).send({ statusCode: 403, error: 'Forbidden',   message: error.message });
    if (error instanceof ConflictError)   return rep.status(409).send({ statusCode: 409, error: 'Conflict',    message: error.message });
    if (error instanceof BadRequestError) return rep.status(400).send({ statusCode: 400, error: 'Bad Request', message: error.message });
    console.error('Unhandled error:', error);
    return rep.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'An unexpected error occurred' });
  }
}