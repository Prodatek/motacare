import type { FastifyInstance } from 'fastify';
import { env } from '../config/env';
import { proxyRequest } from './auth.proxy';

// ============================================================
// INVOICING PROXY
// Quotes, invoices, the reusable line-item catalog, manual
// payment records, and financial reports.
//
// FIXER / WORKSHOP_ADMIN / ADMIN → full manage, scoped server-side
// to their own workshop.
// OWNER → read + accept/reject + pdf on quotes/invoices addressed
// to them (ownerId match enforced inside invoicing-service).
// ============================================================

function buildQs(query: unknown): string {
  const qs = new URLSearchParams(query as any).toString();
  return qs ? `?${qs}` : '';
}

// proxyRequest (auth.proxy.ts) always does JSON.stringify/JSON
// parsing, which would corrupt a binary PDF response. PDF routes
// need their own helper that forwards the raw stream instead.
async function proxyBinaryStream(request: any, reply: any, upstreamUrl: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.PROXY_TIMEOUT_MS);

  try {
    const upstream = await fetch(upstreamUrl, {
      method: 'GET',
      headers: {
        ...(request.headers.authorization ? { Authorization: request.headers.authorization } : {}),
        'X-Gateway-Request-Id': request.id,
        'X-Forwarded-For': request.ip,
        'X-Forwarded-Proto': request.protocol,
      },
      signal: controller.signal,
    });

    if (!upstream.ok) {
      // Error responses from invoicing-service are JSON, not PDF — parse normally.
      const data = await upstream.json().catch(() => ({
        statusCode: upstream.status, error: 'Error', message: 'The upstream service returned an error',
      }));
      return reply.status(upstream.status).send(data);
    }

    reply
      .status(upstream.status)
      .header('Content-Type', upstream.headers.get('content-type') ?? 'application/pdf')
      .header('Content-Disposition', upstream.headers.get('content-disposition') ?? 'inline')
      .header('X-Served-By', 'motacare-gateway');

    return reply.send(upstream.body);
  } catch (error: any) {
    if (error.name === 'AbortError') {
      return reply.status(504).send({
        statusCode: 504, error: 'Gateway Timeout', message: 'The upstream service did not respond in time',
      });
    }
    request.log.error({ event: 'proxy_error', upstream: upstreamUrl, error: error.message });
    return reply.status(502).send({
      statusCode: 502, error: 'Bad Gateway', message: 'The upstream service is currently unavailable',
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function registerInvoicingProxy(fastify: FastifyInstance) {
  const up = env.INVOICING_SERVICE_URL;
  const staffAuth = { onRequest: [(fastify as any).requireRole('FIXER', 'WORKSHOP_ADMIN', 'ADMIN')] };
  const anyAuth   = { onRequest: [(fastify as any).requireRole('OWNER', 'FIXER', 'WORKSHOP_ADMIN', 'ADMIN')] };
  const tag       = { schema: { tags: ['Invoicing'], security: [{ bearerAuth: [] }] } };

  // ── Catalog ──────────────────────────────────────────────────
  fastify.get('/invoicing/catalog/items',
    { ...staffAuth, ...tag },
    (req, rep) => proxyRequest(req, rep, `${up}/invoicing/catalog/items${buildQs(req.query)}`, 'GET'),
  );
  fastify.get('/invoicing/catalog/items/:id',
    { ...staffAuth, ...tag },
    (req: any, rep) => proxyRequest(req, rep, `${up}/invoicing/catalog/items/${req.params.id}${buildQs(req.query)}`, 'GET'),
  );
  fastify.post('/invoicing/catalog/items',
    { ...staffAuth, ...tag },
    (req, rep) => proxyRequest(req, rep, `${up}/invoicing/catalog/items`, 'POST'),
  );
  fastify.patch('/invoicing/catalog/items/:id',
    { ...staffAuth, ...tag },
    (req: any, rep) => proxyRequest(req, rep, `${up}/invoicing/catalog/items/${req.params.id}`, 'PATCH'),
  );
  fastify.delete('/invoicing/catalog/items/:id',
    { ...staffAuth, ...tag },
    (req: any, rep) => proxyRequest(req, rep, `${up}/invoicing/catalog/items/${req.params.id}${buildQs(req.query)}`, 'DELETE'),
  );

  // ── Quotes ───────────────────────────────────────────────────
  fastify.get('/invoicing/quotes',
    { ...anyAuth, ...tag },
    (req, rep) => proxyRequest(req, rep, `${up}/invoicing/quotes${buildQs(req.query)}`, 'GET'),
  );
  fastify.get('/invoicing/quotes/:id',
    { ...anyAuth, ...tag },
    (req: any, rep) => proxyRequest(req, rep, `${up}/invoicing/quotes/${req.params.id}${buildQs(req.query)}`, 'GET'),
  );
  fastify.post('/invoicing/quotes',
    { ...staffAuth, ...tag },
    (req, rep) => proxyRequest(req, rep, `${up}/invoicing/quotes`, 'POST'),
  );
  fastify.patch('/invoicing/quotes/:id',
    { ...staffAuth, ...tag },
    (req: any, rep) => proxyRequest(req, rep, `${up}/invoicing/quotes/${req.params.id}`, 'PATCH'),
  );
  fastify.delete('/invoicing/quotes/:id',
    { ...staffAuth, ...tag },
    (req: any, rep) => proxyRequest(req, rep, `${up}/invoicing/quotes/${req.params.id}${buildQs(req.query)}`, 'DELETE'),
  );
  fastify.post('/invoicing/quotes/:id/send',
    { ...staffAuth, ...tag },
    (req: any, rep) => proxyRequest(req, rep, `${up}/invoicing/quotes/${req.params.id}/send`, 'POST'),
  );
  fastify.post('/invoicing/quotes/:id/accept',
    { ...anyAuth, ...tag },
    (req: any, rep) => proxyRequest(req, rep, `${up}/invoicing/quotes/${req.params.id}/accept`, 'POST'),
  );
  fastify.post('/invoicing/quotes/:id/reject',
    { ...anyAuth, ...tag },
    (req: any, rep) => proxyRequest(req, rep, `${up}/invoicing/quotes/${req.params.id}/reject`, 'POST'),
  );
  fastify.post('/invoicing/quotes/:id/convert-to-invoice',
    { ...staffAuth, ...tag },
    (req: any, rep) => proxyRequest(req, rep, `${up}/invoicing/quotes/${req.params.id}/convert-to-invoice`, 'POST'),
  );
  fastify.get('/invoicing/quotes/:id/pdf',
    { ...anyAuth, ...tag },
    (req: any, rep) => proxyBinaryStream(req, rep, `${up}/invoicing/quotes/${req.params.id}/pdf${buildQs(req.query)}`),
  );

  // ── Invoices ─────────────────────────────────────────────────
  fastify.get('/invoicing/invoices',
    { ...anyAuth, ...tag },
    (req, rep) => proxyRequest(req, rep, `${up}/invoicing/invoices${buildQs(req.query)}`, 'GET'),
  );
  fastify.get('/invoicing/invoices/:id',
    { ...anyAuth, ...tag },
    (req: any, rep) => proxyRequest(req, rep, `${up}/invoicing/invoices/${req.params.id}${buildQs(req.query)}`, 'GET'),
  );
  fastify.post('/invoicing/invoices',
    { ...staffAuth, ...tag },
    (req, rep) => proxyRequest(req, rep, `${up}/invoicing/invoices`, 'POST'),
  );
  fastify.patch('/invoicing/invoices/:id',
    { ...staffAuth, ...tag },
    (req: any, rep) => proxyRequest(req, rep, `${up}/invoicing/invoices/${req.params.id}`, 'PATCH'),
  );
  fastify.delete('/invoicing/invoices/:id',
    { ...staffAuth, ...tag },
    (req: any, rep) => proxyRequest(req, rep, `${up}/invoicing/invoices/${req.params.id}${buildQs(req.query)}`, 'DELETE'),
  );
  fastify.post('/invoicing/invoices/:id/send',
    { ...staffAuth, ...tag },
    (req: any, rep) => proxyRequest(req, rep, `${up}/invoicing/invoices/${req.params.id}/send`, 'POST'),
  );
  fastify.post('/invoicing/invoices/:id/void',
    { ...staffAuth, ...tag },
    (req: any, rep) => proxyRequest(req, rep, `${up}/invoicing/invoices/${req.params.id}/void`, 'POST'),
  );
  fastify.get('/invoicing/invoices/:id/pdf',
    { ...anyAuth, ...tag },
    (req: any, rep) => proxyBinaryStream(req, rep, `${up}/invoicing/invoices/${req.params.id}/pdf${buildQs(req.query)}`),
  );

  // ── Payments ─────────────────────────────────────────────────
  fastify.get('/invoicing/invoices/:invoiceId/payments',
    { ...anyAuth, ...tag },
    (req: any, rep) => proxyRequest(req, rep, `${up}/invoicing/invoices/${req.params.invoiceId}/payments${buildQs(req.query)}`, 'GET'),
  );
  fastify.post('/invoicing/invoices/:invoiceId/payments',
    { ...staffAuth, ...tag },
    (req: any, rep) => proxyRequest(req, rep, `${up}/invoicing/invoices/${req.params.invoiceId}/payments`, 'POST'),
  );
  fastify.delete('/invoicing/payments/:id',
    { ...staffAuth, ...tag },
    (req: any, rep) => proxyRequest(req, rep, `${up}/invoicing/payments/${req.params.id}${buildQs(req.query)}`, 'DELETE'),
  );

  // ── Reports ──────────────────────────────────────────────────
  fastify.get('/invoicing/reports/summary',
    { ...staffAuth, ...tag },
    (req, rep) => proxyRequest(req, rep, `${up}/invoicing/reports/summary${buildQs(req.query)}`, 'GET'),
  );
  fastify.get('/invoicing/reports/trend',
    { ...staffAuth, ...tag },
    (req, rep) => proxyRequest(req, rep, `${up}/invoicing/reports/trend${buildQs(req.query)}`, 'GET'),
  );
  fastify.get('/invoicing/reports/top-customers',
    { ...staffAuth, ...tag },
    (req, rep) => proxyRequest(req, rep, `${up}/invoicing/reports/top-customers${buildQs(req.query)}`, 'GET'),
  );
}
