import type { FastifyRequest, FastifyReply } from 'fastify';
import { renderQuotePdf, renderInvoicePdf } from './pdf.service';
import { resolveEffectiveWorkshopId, ForbiddenError } from '../workshop-context/workshop-context.service';
import { NotFoundError } from '../../errors';

export class PdfController {

  private async resolveScope(user: { sub: string; role: string }, explicitWorkshopId?: string) {
    if (user.role === 'OWNER') return { ownerId: user.sub };
    return { workshopId: await resolveEffectiveWorkshopId(user, explicitWorkshopId) };
  }

  // GET /quotes/:id/pdf
  async getQuotePdf(req: FastifyRequest<{ Params: { id: string } }>, rep: FastifyReply) {
    try {
      const user = req.user as { sub: string; role: string };
      const query = req.query as { workshopId?: string; download?: string };
      const scope = await this.resolveScope(user, query.workshopId);
      const { stream, filename } = await renderQuotePdf(req.params.id, scope);
      const disposition = query.download === '1' ? 'attachment' : 'inline';
      rep.header('Content-Type', 'application/pdf');
      rep.header('Content-Disposition', `${disposition}; filename="${filename}"`);
      return rep.send(stream);
    } catch (e) { return this.handleError(e, rep); }
  }

  // GET /invoices/:id/pdf
  async getInvoicePdf(req: FastifyRequest<{ Params: { id: string } }>, rep: FastifyReply) {
    try {
      const user = req.user as { sub: string; role: string };
      const query = req.query as { workshopId?: string; download?: string };
      const scope = await this.resolveScope(user, query.workshopId);
      const { stream, filename } = await renderInvoicePdf(req.params.id, scope);
      const disposition = query.download === '1' ? 'attachment' : 'inline';
      rep.header('Content-Type', 'application/pdf');
      rep.header('Content-Disposition', `${disposition}; filename="${filename}"`);
      return rep.send(stream);
    } catch (e) { return this.handleError(e, rep); }
  }

  private handleError(error: unknown, rep: FastifyReply) {
    if (error instanceof NotFoundError)  return rep.status(404).send({ statusCode: 404, error: 'Not Found',  message: error.message });
    if (error instanceof ForbiddenError) return rep.status(403).send({ statusCode: 403, error: 'Forbidden', message: error.message });
    console.error('[invoicing:pdf] Unhandled error:', error);
    return rep.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'An unexpected error occurred' });
  }
}
