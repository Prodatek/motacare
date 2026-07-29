import type { FastifyRequest, FastifyReply } from 'fastify';
import { PaymentsService, type PaymentScope } from './payments.service';
import { recordPaymentSchema } from './payments.schema';
import { resolveEffectiveWorkshopId, ForbiddenError } from '../workshop-context/workshop-context.service';
import { NotFoundError, ConflictError, BadRequestError } from '../../errors';

export class PaymentsController {
  constructor(private readonly service: PaymentsService) {}

  private async resolveScope(
    user: { sub: string; role: string },
    explicitWorkshopId?: string,
  ): Promise<PaymentScope> {
    if (user.role === 'OWNER') return { ownerId: user.sub };
    return { workshopId: await resolveEffectiveWorkshopId(user, explicitWorkshopId) };
  }

  // GET /invoices/:invoiceId/payments
  async listPayments(req: FastifyRequest<{ Params: { invoiceId: string } }>, rep: FastifyReply) {
    try {
      const user = req.user as { sub: string; role: string };
      const scope = await this.resolveScope(user, (req.query as any)?.workshopId);
      const list = await this.service.listPayments(req.params.invoiceId, scope);
      return rep.status(200).send({ statusCode: 200, data: list });
    } catch (e) { return this.handleError(e, rep); }
  }

  // POST /invoices/:invoiceId/payments
  async recordPayment(req: FastifyRequest<{ Params: { invoiceId: string } }>, rep: FastifyReply) {
    const parsed = recordPaymentSchema.safeParse(req.body ?? {});
    if (!parsed.success) return this.validErr(rep, parsed.error);
    try {
      const user = req.user as { sub: string; role: string };
      const workshopId = await resolveEffectiveWorkshopId(user, parsed.data.workshopId);
      const result = await this.service.recordPayment(req.params.invoiceId, workshopId, user.sub, parsed.data);
      return rep.status(201).send({ statusCode: 201, message: 'Payment recorded', data: result });
    } catch (e) { return this.handleError(e, rep); }
  }

  // DELETE /payments/:id
  async deletePayment(req: FastifyRequest<{ Params: { id: string } }>, rep: FastifyReply) {
    try {
      const user = req.user as { sub: string; role: string };
      const workshopId = await resolveEffectiveWorkshopId(user, (req.query as any)?.workshopId);
      await this.service.deletePayment(req.params.id, workshopId);
      return rep.status(200).send({ statusCode: 200, message: 'Payment removed' });
    } catch (e) { return this.handleError(e, rep); }
  }

  private validErr(rep: FastifyReply, error: any) {
    return rep.status(400).send({
      statusCode: 400, error: 'Validation Error', message: 'Invalid request data',
      details: error.flatten().fieldErrors,
    });
  }

  private handleError(error: unknown, rep: FastifyReply) {
    if (error instanceof NotFoundError)   return rep.status(404).send({ statusCode: 404, error: 'Not Found',   message: error.message });
    if (error instanceof ForbiddenError)  return rep.status(403).send({ statusCode: 403, error: 'Forbidden',   message: error.message });
    if (error instanceof ConflictError)   return rep.status(409).send({ statusCode: 409, error: 'Conflict',    message: error.message });
    if (error instanceof BadRequestError) return rep.status(400).send({ statusCode: 400, error: 'Bad Request', message: error.message });
    console.error('[invoicing:payments] Unhandled error:', error);
    return rep.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'An unexpected error occurred' });
  }
}
