export async function registerCrmProxy(fastify: FastifyInstance) {
  const up      = env.CRM_SERVICE_URL;
  const fixerAuth = { onRequest: [fastify.requireRole('FIXER', 'WORKSHOP_ADMIN', 'ADMIN')] };
  const tag       = { schema: { tags: ['CRM'], security: [{ bearerAuth: [] }] } };
 
  fastify.get('/crm/customers',                        { ...fixerAuth, ...tag }, (req, rep) => proxyRequest(req, rep, `${up}/crm/customers${buildQs(req.query)}`, 'GET'));
  fastify.get('/crm/customers/:id',                    { ...fixerAuth, ...tag }, (req: any, rep) => proxyRequest(req, rep, `${up}/crm/customers/${req.params.id}`, 'GET'));
  fastify.post('/crm/customers/:id/notes',             { ...fixerAuth, ...tag }, (req: any, rep) => proxyRequest(req, rep, `${up}/crm/customers/${req.params.id}/notes`, 'POST'));
  fastify.patch('/crm/notes/:noteId',                  { ...fixerAuth, ...tag }, (req: any, rep) => proxyRequest(req, rep, `${up}/crm/notes/${req.params.noteId}`, 'PATCH'));
  fastify.delete('/crm/notes/:noteId',                 { ...fixerAuth, ...tag }, (req: any, rep) => proxyRequest(req, rep, `${up}/crm/notes/${req.params.noteId}`, 'DELETE'));
  fastify.get('/crm/customers/recent',                 { ...fixerAuth, ...tag }, (req, rep) => proxyRequest(req, rep, `${up}/crm/customers/recent`, 'GET'));
}