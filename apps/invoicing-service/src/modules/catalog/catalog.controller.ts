import type { FastifyRequest, FastifyReply } from 'fastify';
import { CatalogService, NotFoundError } from './catalog.service';
import { catalogQuerySchema, createCatalogItemSchema, updateCatalogItemSchema } from './catalog.schema';
import { resolveEffectiveWorkshopId, ForbiddenError } from '../workshop-context/workshop-context.service';

export class CatalogController {
  constructor(private readonly service: CatalogService) {}

  // GET /catalog/items
  async listItems(req: FastifyRequest, rep: FastifyReply) {
    const parsed = catalogQuerySchema.safeParse(req.query);
    if (!parsed.success) return this.validErr(rep, parsed.error);
    try {
      const { sub, role } = req.user as { sub: string; role: string };
      const workshopId = await resolveEffectiveWorkshopId({ sub, role }, (req.query as any).workshopId);
      const result = await this.service.listItems(workshopId, parsed.data);
      return rep.status(200).send({ statusCode: 200, data: result.data, pagination: result.pagination });
    } catch (e) { return this.handleError(e, rep); }
  }

  // GET /catalog/items/:id
  async getItem(req: FastifyRequest<{ Params: { id: string } }>, rep: FastifyReply) {
    try {
      const { sub, role } = req.user as { sub: string; role: string };
      const workshopId = await resolveEffectiveWorkshopId({ sub, role }, (req.query as any).workshopId);
      const item = await this.service.getItem(workshopId, req.params.id);
      return rep.status(200).send({ statusCode: 200, data: item });
    } catch (e) { return this.handleError(e, rep); }
  }

  // POST /catalog/items
  async createItem(req: FastifyRequest, rep: FastifyReply) {
    const parsed = createCatalogItemSchema.safeParse(req.body);
    if (!parsed.success) return this.validErr(rep, parsed.error);
    try {
      const { sub, role } = req.user as { sub: string; role: string };
      const workshopId = await resolveEffectiveWorkshopId({ sub, role }, (req.body as any)?.workshopId);
      const item = await this.service.createItem(workshopId, parsed.data);
      return rep.status(201).send({ statusCode: 201, message: 'Catalog item saved', data: item });
    } catch (e) { return this.handleError(e, rep); }
  }

  // PATCH /catalog/items/:id
  async updateItem(req: FastifyRequest<{ Params: { id: string } }>, rep: FastifyReply) {
    const parsed = updateCatalogItemSchema.safeParse(req.body);
    if (!parsed.success) return this.validErr(rep, parsed.error);
    try {
      const { sub, role } = req.user as { sub: string; role: string };
      const workshopId = await resolveEffectiveWorkshopId({ sub, role }, (req.body as any)?.workshopId);
      const item = await this.service.updateItem(workshopId, req.params.id, parsed.data);
      return rep.status(200).send({ statusCode: 200, message: 'Catalog item updated', data: item });
    } catch (e) { return this.handleError(e, rep); }
  }

  // DELETE /catalog/items/:id
  async deleteItem(req: FastifyRequest<{ Params: { id: string } }>, rep: FastifyReply) {
    try {
      const { sub, role } = req.user as { sub: string; role: string };
      const workshopId = await resolveEffectiveWorkshopId({ sub, role }, (req.query as any).workshopId);
      await this.service.deleteItem(workshopId, req.params.id);
      return rep.status(200).send({ statusCode: 200, message: 'Catalog item deactivated' });
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
    console.error('[invoicing:catalog] Unhandled error:', error);
    return rep.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'An unexpected error occurred' });
  }
}
