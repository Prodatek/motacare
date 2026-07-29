import type { FastifyRequest, FastifyReply } from 'fastify';
import { ReportsService } from './reports.service';
import { reportRangeSchema, topCustomersQuerySchema } from './reports.schema';
import { resolveEffectiveWorkshopId, ForbiddenError } from '../workshop-context/workshop-context.service';

export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  // GET /reports/summary
  async getSummary(req: FastifyRequest, rep: FastifyReply) {
    const parsed = reportRangeSchema.safeParse(req.query);
    if (!parsed.success) return this.validErr(rep, parsed.error);
    try {
      const user = req.user as { sub: string; role: string };
      const workshopId = await resolveEffectiveWorkshopId(user, parsed.data.workshopId);
      const summary = await this.service.getSummary(workshopId, parsed.data);
      return rep.status(200).send({ statusCode: 200, data: summary });
    } catch (e) { return this.handleError(e, rep); }
  }

  // GET /reports/trend
  async getTrend(req: FastifyRequest, rep: FastifyReply) {
    const parsed = reportRangeSchema.safeParse(req.query);
    if (!parsed.success) return this.validErr(rep, parsed.error);
    try {
      const user = req.user as { sub: string; role: string };
      const workshopId = await resolveEffectiveWorkshopId(user, parsed.data.workshopId);
      const trend = await this.service.getTrend(workshopId, parsed.data);
      return rep.status(200).send({ statusCode: 200, data: trend });
    } catch (e) { return this.handleError(e, rep); }
  }

  // GET /reports/top-customers
  async getTopCustomers(req: FastifyRequest, rep: FastifyReply) {
    const parsed = topCustomersQuerySchema.safeParse(req.query);
    if (!parsed.success) return this.validErr(rep, parsed.error);
    try {
      const user = req.user as { sub: string; role: string };
      const workshopId = await resolveEffectiveWorkshopId(user, parsed.data.workshopId);
      const top = await this.service.getTopCustomers(workshopId, parsed.data);
      return rep.status(200).send({ statusCode: 200, data: top });
    } catch (e) { return this.handleError(e, rep); }
  }

  private validErr(rep: FastifyReply, error: any) {
    return rep.status(400).send({
      statusCode: 400, error: 'Validation Error', message: 'Invalid request data',
      details: error.flatten().fieldErrors,
    });
  }

  private handleError(error: unknown, rep: FastifyReply) {
    if (error instanceof ForbiddenError) return rep.status(403).send({ statusCode: 403, error: 'Forbidden', message: error.message });
    console.error('[invoicing:reports] Unhandled error:', error);
    return rep.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'An unexpected error occurred' });
  }
}
