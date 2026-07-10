import type { FastifyRequest, FastifyReply } from 'fastify';
import { CrmService, NotFoundError, ForbiddenError } from './customers.service';
import {
  createNoteSchema, updateNoteSchema, customerQuerySchema,
} from './customers.schema';

// ============================================================
// CRM CONTROLLER
// ============================================================

export class CrmController {
  constructor(private readonly service: CrmService) {}

  // GET /crm/customers
  async listCustomers(req: FastifyRequest, rep: FastifyReply) {
    const parsed = customerQuerySchema.safeParse(req.query);
    if (!parsed.success) return this.validErr(rep, parsed.error);
    try {
      const { sub: fixerId } = req.user as { sub: string };
      const result = await this.service.listCustomers(fixerId, parsed.data);
      return rep.status(200).send({ statusCode: 200, data: result });
    } catch (e) { return this.handleError(e, rep); }
  }

  // GET /crm/customers/recent
  async getRecentCustomers(req: FastifyRequest, rep: FastifyReply) {
    try {
      const { sub: fixerId } = req.user as { sub: string };
      const { limit = '5' } = req.query as { limit?: string };
      const result = await this.service.getRecentCustomers(fixerId, Math.min(20, Number(limit)));
      return rep.status(200).send({ statusCode: 200, data: result });
    } catch (e) { return this.handleError(e, rep); }
  }

  // GET /crm/customers/:ownerId
  async getCustomer(req: FastifyRequest<{ Params: { ownerId: string } }>, rep: FastifyReply) {
    try {
      const { sub: fixerId } = req.user as { sub: string };
      const result = await this.service.getCustomerProfile(fixerId, req.params.ownerId);
      return rep.status(200).send({ statusCode: 200, data: result });
    } catch (e) { return this.handleError(e, rep); }
  }

  // POST /crm/customers/:ownerId/notes
  async createNote(req: FastifyRequest<{ Params: { ownerId: string } }>, rep: FastifyReply) {
    const parsed = createNoteSchema.safeParse(req.body);
    if (!parsed.success) return this.validErr(rep, parsed.error);
    try {
      const { sub: fixerId } = req.user as { sub: string };
      const note = await this.service.createNote(fixerId, req.params.ownerId, parsed.data);
      return rep.status(201).send({ statusCode: 201, message: 'Note saved', data: note });
    } catch (e) { return this.handleError(e, rep); }
  }

  // PATCH /crm/notes/:noteId
  async updateNote(req: FastifyRequest<{ Params: { noteId: string } }>, rep: FastifyReply) {
    const parsed = updateNoteSchema.safeParse(req.body);
    if (!parsed.success) return this.validErr(rep, parsed.error);
    try {
      const { sub: fixerId } = req.user as { sub: string };
      const note = await this.service.updateNote(req.params.noteId, fixerId, parsed.data);
      return rep.status(200).send({ statusCode: 200, message: 'Note updated', data: note });
    } catch (e) { return this.handleError(e, rep); }
  }

  // DELETE /crm/notes/:noteId
  async deleteNote(req: FastifyRequest<{ Params: { noteId: string } }>, rep: FastifyReply) {
    try {
      const { sub: fixerId } = req.user as { sub: string };
      await this.service.deleteNote(req.params.noteId, fixerId);
      return rep.status(200).send({ statusCode: 200, message: 'Note deleted' });
    } catch (e) { return this.handleError(e, rep); }
  }

  // ── Helpers ────────────────────────────────────────────────

  private validErr(rep: FastifyReply, error: any) {
    return rep.status(400).send({
      statusCode: 400,
      error:      'Validation Error',
      message:    'Invalid request data',
      details:    error.flatten().fieldErrors,
    });
  }

  private handleError(error: unknown, rep: FastifyReply) {
    if (error instanceof NotFoundError) {
      return rep.status(404).send({ statusCode: 404, error: 'Not Found', message: (error as Error).message });
    }
    if (error instanceof ForbiddenError) {
      return rep.status(403).send({ statusCode: 403, error: 'Forbidden', message: (error as Error).message });
    }
    console.error('[crm] Unhandled error:', error);
    return rep.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'An unexpected error occurred' });
  }
}