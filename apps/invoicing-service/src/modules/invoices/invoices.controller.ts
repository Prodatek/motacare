import type { FastifyRequest, FastifyReply } from 'fastify';
import { InvoicesService, type InvoiceScope } from './invoices.service';
import {
  createInvoiceSchema, updateInvoiceSchema, invoiceQuerySchema, voidInvoiceSchema,
} from './invoices.schema';
import { resolveEffectiveWorkshopId, ForbiddenError } from '../workshop-context/workshop-context.service';
import { NotFoundError, ConflictError } from '../../errors';

export class InvoicesController {
  constructor(private readonly service: InvoicesService) {}

  private async resolveScope(
    user: { sub: string; role: string },
    explicitWorkshopId?: string,
  ): Promise<InvoiceScope> {
    if (user.role === 'OWNER') return { ownerId: user.sub };
    return { workshopId: await resolveEffectiveWorkshopId(user, explicitWorkshopId) };
  }

  // GET /invoices
  async listInvoices(req: FastifyRequest, rep: FastifyReply) {
    const parsed = invoiceQuerySchema.safeParse(req.query);
    if (!parsed.success) return this.validErr(rep, parsed.error);
    try {
      const user = req.user as { sub: string; role: string };
      const scope = await this.resolveScope(user, parsed.data.workshopId);
      const result = await this.service.listInvoices(scope, parsed.data);
      return rep.status(200).send({ statusCode: 200, data: result.data, pagination: result.pagination });
    } catch (e) { return this.handleError(e, rep); }
  }

  // GET /invoices/:id
  async getInvoice(req: FastifyRequest<{ Params: { id: string } }>, rep: FastifyReply) {
    try {
      const user = req.user as { sub: string; role: string };
      const scope = await this.resolveScope(user, (req.query as any)?.workshopId);
      const invoice = await this.service.getInvoice(req.params.id, scope);
      return rep.status(200).send({ statusCode: 200, data: invoice });
    } catch (e) { return this.handleError(e, rep); }
  }

  // POST /invoices
  async createInvoice(req: FastifyRequest, rep: FastifyReply) {
    const parsed = createInvoiceSchema.safeParse(req.body);
    if (!parsed.success) return this.validErr(rep, parsed.error);
    try {
      const user = req.user as { sub: string; role: string };
      const workshopId = await resolveEffectiveWorkshopId(user, parsed.data.workshopId);
      const invoice = await this.service.createInvoice(workshopId, user.sub, parsed.data);
      return rep.status(201).send({ statusCode: 201, message: 'Invoice created', data: invoice });
    } catch (e) { return this.handleError(e, rep); }
  }

  // PATCH /invoices/:id
  async updateInvoice(req: FastifyRequest<{ Params: { id: string } }>, rep: FastifyReply) {
    const parsed = updateInvoiceSchema.safeParse(req.body);
    if (!parsed.success) return this.validErr(rep, parsed.error);
    try {
      const user = req.user as { sub: string; role: string };
      const workshopId = await resolveEffectiveWorkshopId(user, parsed.data.workshopId);
      const invoice = await this.service.updateInvoice(workshopId, req.params.id, parsed.data);
      return rep.status(200).send({ statusCode: 200, message: 'Invoice updated', data: invoice });
    } catch (e) { return this.handleError(e, rep); }
  }

  // DELETE /invoices/:id
  async deleteInvoice(req: FastifyRequest<{ Params: { id: string } }>, rep: FastifyReply) {
    try {
      const user = req.user as { sub: string; role: string };
      const workshopId = await resolveEffectiveWorkshopId(user, (req.query as any)?.workshopId);
      await this.service.deleteInvoice(workshopId, req.params.id);
      return rep.status(200).send({ statusCode: 200, message: 'Invoice deleted' });
    } catch (e) { return this.handleError(e, rep); }
  }

  // POST /invoices/:id/send
  async sendInvoice(req: FastifyRequest<{ Params: { id: string } }>, rep: FastifyReply) {
    try {
      const user = req.user as { sub: string; role: string };
      const workshopId = await resolveEffectiveWorkshopId(user, (req.body as any)?.workshopId);
      const invoice = await this.service.sendInvoice(workshopId, req.params.id);
      return rep.status(200).send({ statusCode: 200, message: 'Invoice sent', data: invoice });
    } catch (e) { return this.handleError(e, rep); }
  }

  // POST /invoices/:id/void
  async voidInvoice(req: FastifyRequest<{ Params: { id: string } }>, rep: FastifyReply) {
    const parsed = voidInvoiceSchema.safeParse(req.body ?? {});
    if (!parsed.success) return this.validErr(rep, parsed.error);
    try {
      const user = req.user as { sub: string; role: string };
      const workshopId = await resolveEffectiveWorkshopId(user, (req.body as any)?.workshopId);
      const invoice = await this.service.voidInvoice(workshopId, req.params.id, parsed.data);
      return rep.status(200).send({ statusCode: 200, message: 'Invoice voided', data: invoice });
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
    console.error('[invoicing:invoices] Unhandled error:', error);
    return rep.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'An unexpected error occurred' });
  }
}
