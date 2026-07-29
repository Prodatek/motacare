import type { FastifyRequest, FastifyReply } from 'fastify';
import { QuotesService, type QuoteScope } from './quotes.service';
import {
  createQuoteSchema, updateQuoteSchema, quoteQuerySchema,
  rejectQuoteSchema, convertQuoteSchema,
} from './quotes.schema';
import { resolveEffectiveWorkshopId, ForbiddenError } from '../workshop-context/workshop-context.service';
import { NotFoundError, ConflictError } from '../../errors';

export class QuotesController {
  constructor(private readonly service: QuotesService) {}

  // OWNER isn't tied to a single workshop — scope by ownerId instead.
  // Staff (FIXER/WORKSHOP_ADMIN/ADMIN) are scoped to their workshop.
  private async resolveScope(
    user: { sub: string; role: string },
    explicitWorkshopId?: string,
  ): Promise<QuoteScope> {
    if (user.role === 'OWNER') return { ownerId: user.sub };
    return { workshopId: await resolveEffectiveWorkshopId(user, explicitWorkshopId) };
  }

  // GET /quotes
  async listQuotes(req: FastifyRequest, rep: FastifyReply) {
    const parsed = quoteQuerySchema.safeParse(req.query);
    if (!parsed.success) return this.validErr(rep, parsed.error);
    try {
      const user = req.user as { sub: string; role: string };
      const scope = await this.resolveScope(user, parsed.data.workshopId);
      const result = await this.service.listQuotes(scope, parsed.data);
      return rep.status(200).send({ statusCode: 200, data: result.data, pagination: result.pagination });
    } catch (e) { return this.handleError(e, rep); }
  }

  // GET /quotes/:id
  async getQuote(req: FastifyRequest<{ Params: { id: string } }>, rep: FastifyReply) {
    try {
      const user = req.user as { sub: string; role: string };
      const scope = await this.resolveScope(user, (req.query as any)?.workshopId);
      const quote = await this.service.getQuote(req.params.id, scope);
      return rep.status(200).send({ statusCode: 200, data: quote });
    } catch (e) { return this.handleError(e, rep); }
  }

  // POST /quotes
  async createQuote(req: FastifyRequest, rep: FastifyReply) {
    const parsed = createQuoteSchema.safeParse(req.body);
    if (!parsed.success) return this.validErr(rep, parsed.error);
    try {
      const user = req.user as { sub: string; role: string };
      const workshopId = await resolveEffectiveWorkshopId(user, parsed.data.workshopId);
      const quote = await this.service.createQuote(workshopId, user.sub, parsed.data);
      return rep.status(201).send({ statusCode: 201, message: 'Quote created', data: quote });
    } catch (e) { return this.handleError(e, rep); }
  }

  // PATCH /quotes/:id
  async updateQuote(req: FastifyRequest<{ Params: { id: string } }>, rep: FastifyReply) {
    const parsed = updateQuoteSchema.safeParse(req.body);
    if (!parsed.success) return this.validErr(rep, parsed.error);
    try {
      const user = req.user as { sub: string; role: string };
      const workshopId = await resolveEffectiveWorkshopId(user, parsed.data.workshopId);
      const quote = await this.service.updateQuote(workshopId, req.params.id, parsed.data);
      return rep.status(200).send({ statusCode: 200, message: 'Quote updated', data: quote });
    } catch (e) { return this.handleError(e, rep); }
  }

  // DELETE /quotes/:id
  async deleteQuote(req: FastifyRequest<{ Params: { id: string } }>, rep: FastifyReply) {
    try {
      const user = req.user as { sub: string; role: string };
      const workshopId = await resolveEffectiveWorkshopId(user, (req.query as any)?.workshopId);
      await this.service.deleteQuote(workshopId, req.params.id);
      return rep.status(200).send({ statusCode: 200, message: 'Quote deleted' });
    } catch (e) { return this.handleError(e, rep); }
  }

  // POST /quotes/:id/send
  async sendQuote(req: FastifyRequest<{ Params: { id: string } }>, rep: FastifyReply) {
    try {
      const user = req.user as { sub: string; role: string };
      const workshopId = await resolveEffectiveWorkshopId(user, (req.body as any)?.workshopId);
      const quote = await this.service.sendQuote(workshopId, req.params.id);
      return rep.status(200).send({ statusCode: 200, message: 'Quote sent', data: quote });
    } catch (e) { return this.handleError(e, rep); }
  }

  // POST /quotes/:id/accept
  async acceptQuote(req: FastifyRequest<{ Params: { id: string } }>, rep: FastifyReply) {
    try {
      const user = req.user as { sub: string; role: string };
      const scope = await this.resolveScope(user, (req.body as any)?.workshopId);
      const quote = await this.service.acceptQuote(req.params.id, scope);
      return rep.status(200).send({ statusCode: 200, message: 'Quote accepted', data: quote });
    } catch (e) { return this.handleError(e, rep); }
  }

  // POST /quotes/:id/reject
  async rejectQuote(req: FastifyRequest<{ Params: { id: string } }>, rep: FastifyReply) {
    const parsed = rejectQuoteSchema.safeParse(req.body ?? {});
    if (!parsed.success) return this.validErr(rep, parsed.error);
    try {
      const user = req.user as { sub: string; role: string };
      const scope = await this.resolveScope(user, (req.body as any)?.workshopId);
      const quote = await this.service.rejectQuote(req.params.id, parsed.data, scope);
      return rep.status(200).send({ statusCode: 200, message: 'Quote rejected', data: quote });
    } catch (e) { return this.handleError(e, rep); }
  }

  // POST /quotes/:id/convert-to-invoice
  async convertToInvoice(req: FastifyRequest<{ Params: { id: string } }>, rep: FastifyReply) {
    const parsed = convertQuoteSchema.safeParse(req.body ?? {});
    if (!parsed.success) return this.validErr(rep, parsed.error);
    try {
      const user = req.user as { sub: string; role: string };
      const workshopId = await resolveEffectiveWorkshopId(user, (req.body as any)?.workshopId);
      const invoice = await this.service.convertToInvoice(workshopId, req.params.id, user.sub, parsed.data);
      return rep.status(201).send({ statusCode: 201, message: 'Quote converted to invoice', data: invoice });
    } catch (e) { return this.handleError(e, rep); }
  }

  private validErr(rep: FastifyReply, error: any) {
    return rep.status(400).send({
      statusCode: 400, error: 'Validation Error', message: 'Invalid request data',
      details: error.flatten().fieldErrors,
    });
  }

  private handleError(error: unknown, rep: FastifyReply) {
    if (error instanceof NotFoundError)  return rep.status(404).send({ statusCode: 404, error: 'Not Found',  message: error.message });
    if (error instanceof ForbiddenError) return rep.status(403).send({ statusCode: 403, error: 'Forbidden', message: error.message });
    if (error instanceof ConflictError)  return rep.status(409).send({ statusCode: 409, error: 'Conflict',   message: error.message });
    console.error('[invoicing:quotes] Unhandled error:', error);
    return rep.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'An unexpected error occurred' });
  }
}
