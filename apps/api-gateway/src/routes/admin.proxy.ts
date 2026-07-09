export async function registerAdminProxy(fastify: FastifyInstance) {
  const up = env.ADMIN_SERVICE_URL;
  const adminOnly = { onRequest: [fastify.requireRole('ADMIN')] };
  const tag = { schema: { tags: ['Admin'], security: [{ bearerAuth: [] }] } };
 
  fastify.get('/admin/platform/metrics',       { ...adminOnly, ...tag }, (req, rep) => proxyRequest(req, rep, `${up}/admin/platform/metrics`, 'GET'));
  fastify.get('/admin/users',                  { ...adminOnly, ...tag }, (req, rep) => proxyRequest(req, rep, `${up}/admin/users${buildQs(req.query)}`, 'GET'));
  fastify.get('/admin/users/:id',              { ...adminOnly, ...tag }, (req: any, rep) => proxyRequest(req, rep, `${up}/admin/users/${req.params.id}`, 'GET'));
  fastify.post('/admin/users/:id/suspend',     { ...adminOnly, ...tag }, (req: any, rep) => proxyRequest(req, rep, `${up}/admin/users/${req.params.id}/suspend`, 'POST'));
  fastify.post('/admin/users/:id/reactivate',  { ...adminOnly, ...tag }, (req: any, rep) => proxyRequest(req, rep, `${up}/admin/users/${req.params.id}/reactivate`, 'POST'));
  fastify.post('/admin/users/:id/role',        { ...adminOnly, ...tag }, (req: any, rep) => proxyRequest(req, rep, `${up}/admin/users/${req.params.id}/role`, 'POST'));
  fastify.post('/admin/workshops/:id/featured',{ ...adminOnly, ...tag }, (req: any, rep) => proxyRequest(req, rep, `${up}/admin/workshops/${req.params.id}/featured`, 'POST'));
  fastify.post('/admin/workshops/:id/suspend', { ...adminOnly, ...tag }, (req: any, rep) => proxyRequest(req, rep, `${up}/admin/workshops/${req.params.id}/suspend`, 'POST'));
  fastify.post('/admin/workshops/:id/activate',{ ...adminOnly, ...tag }, (req: any, rep) => proxyRequest(req, rep, `${up}/admin/workshops/${req.params.id}/activate`, 'POST'));
  fastify.get('/admin/billing/subscriptions',  { ...adminOnly, ...tag }, (req, rep) => proxyRequest(req, rep, `${up}/admin/billing/subscriptions${buildQs(req.query)}`, 'GET'));
}
 
function buildQs(query: any): string {
  const qs = new URLSearchParams(query as any).toString();
  return qs ? `?${qs}` : '';
}