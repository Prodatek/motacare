const Fastify = require('fastify');
const cors = require('fastify-cors');

const server = Fastify({ logger: true });
server.register(cors, { origin: true });

// In-memory mock data
let FIX_JOBS = [];
for (let i = 1; i <= 12; i++) {
  FIX_JOBS.push({
    id: `${i}`,
    description: `Mock fix job #${i}`,
    status: i % 3 === 0 ? 'IN_PROGRESS' : i % 3 === 1 ? 'PENDING' : 'AWAITING_PARTS',
    createdAt: new Date(Date.now() - i * 3600 * 1000).toISOString(),
    inspectionId: `${100 + i}`,
  });
}

server.get('/health', async (req, reply) => {
  return reply.code(200).send({ status: 'ok', service: 'fix-job-mock' });
});

// GET /fix-jobs?page&limit&status
server.get('/fix-jobs', async (req, reply) => {
  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || 20, 50);
  const status = req.query.status;

  let items = FIX_JOBS.slice();
  if (status) items = items.filter((j) => j.status === status);

  const start = (page - 1) * limit;
  const paged = items.slice(start, start + limit);

  return reply.code(200).send({ statusCode: 200, data: paged, pagination: { page, limit, total: items.length } });
});

server.get('/fix-jobs/:id', async (req, reply) => {
  const job = FIX_JOBS.find((j) => j.id === req.params.id);
  if (!job) return reply.code(404).send({ statusCode: 404, error: 'Not Found', message: 'Fix job not found' });
  return reply.code(200).send({ statusCode: 200, data: job });
});

const start = async () => {
  try {
    await server.listen({ port: 3010, host: '0.0.0.0' });
    console.log('Fix-job mock service listening on http://localhost:3010');
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
