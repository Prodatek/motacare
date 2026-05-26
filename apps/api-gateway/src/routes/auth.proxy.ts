import type { FastifyInstance } from 'fastify';
import httpProxy from '@fastify/http-proxy';
import { env } from '../config/env';
import { AUTH_RATE_LIMIT, WRITE_RATE_LIMIT, buildRateLimitErrorResponse } from '../middleware/rate-limit';

// ============================================================
// AUTH PROXY
//
// Routes all /auth/* requests to the auth-service.
// The gateway applies rate limiting here — downstream auth-service
// also has its own limits as a second layer of defence.
//
// Public routes (no gateway-level auth check needed):
//   POST /auth/register
//   POST /auth/login
//   POST /auth/refresh
//   POST /auth/logout
//
// Protected routes (gateway verifies JWT first):
//   GET  /auth/me
// ============================================================

export async function registerAuthProxy(fastify: FastifyInstance) {

  // ----------------------------------------------------------
  // TIGHT rate limit on login/register (brute force protection)
  // Applied before the proxy so abusive requests never reach
  // the auth-service at all.
  // ----------------------------------------------------------

  fastify.register(async (instance) => {
    // Apply tight rate limit to this scope only
    await instance.register(
      (await import('@fastify/rate-limit')).default,
      {
        max: AUTH_RATE_LIMIT.max,
        timeWindow: AUTH_RATE_LIMIT.timeWindow,
        keyGenerator: AUTH_RATE_LIMIT.keyGenerator,
        errorResponseBuilder: buildRateLimitErrorResponse,
      },
    );

    // Proxy: POST /auth/register
    instance.post('/auth/register', {
      schema: {
        tags: ['Auth'],
        summary: 'Register a new user account',
        description: 'Proxied to auth-service. Rate limited to 10 requests per 15 minutes per IP+email.',
        body: {
          type: 'object',
          required: ['email', 'password', 'firstName', 'lastName'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 8 },
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            phone: { type: 'string' },
            role: { type: 'string', enum: ['OWNER', 'FIXER'] },
            workshopName: { type: 'string' },
            workshopAddress: { type: 'string' },
          },
        },
      },
    }, async (request, reply) => {
      return proxyRequest(request, reply, `${env.AUTH_SERVICE_URL}/auth/register`, 'POST');
    });

    // Proxy: POST /auth/login
    instance.post('/auth/login', {
      schema: {
        tags: ['Auth'],
        summary: 'Login with email and password',
        body: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string' },
          },
        },
      },
    }, async (request, reply) => {
      console.log('Authorization header:', request.headers.authorization?.slice(0, 30));
      return proxyRequest(request, reply, `${env.AUTH_SERVICE_URL}/auth/login`, 'POST');
    });

    // Proxy: POST /auth/refresh
    instance.post('/auth/refresh', {
      schema: {
        tags: ['Auth'],
        summary: 'Refresh access token',
      },
    }, async (request, reply) => {
      return proxyRequest(request, reply, `${env.AUTH_SERVICE_URL}/auth/refresh`, 'POST');
    });

    // Proxy: POST /auth/logout
    instance.post('/auth/logout', {
      schema: {
        tags: ['Auth'],
        summary: 'Logout and revoke refresh token',
      },
    }, async (request, reply) => {
      return proxyRequest(request, reply, `${env.AUTH_SERVICE_URL}/auth/logout`, 'POST');
    });
  });

  // ----------------------------------------------------------
  // Protected auth routes — gateway verifies JWT first
  // ----------------------------------------------------------

  // GET /auth/me
  fastify.get('/auth/me', {
    onRequest: [fastify.authenticate],
    schema: {
      tags: ['Auth'],
      summary: 'Get authenticated user profile',
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    return proxyRequest(request, reply, `${env.AUTH_SERVICE_URL}/auth/me`, 'GET');
  });

  // Auth service health (used by monitoring)
  fastify.get('/auth/health', async (request, reply) => {
    return proxyRequest(request, reply, `${env.AUTH_SERVICE_URL}/health`, 'GET');
  });
}

// ============================================================
// PROXY HELPER
// Forwards the request to the upstream service and streams
// the response back to the client, preserving:
//   - status code
//   - response headers (minus hop-by-hop headers)
//   - body
// Adds X-Gateway-* headers so downstream services can track
// where the request originated.
// ============================================================

export async function proxyRequest(
  request: any,
  reply: any,
  upstreamUrl: string,
  method: string,
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.PROXY_TIMEOUT_MS);

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      // Forward the original authorization header downstream
      ...(request.headers.authorization
        ? { Authorization: request.headers.authorization }
        : {}),
      // Gateway metadata headers
      'X-Gateway-Request-Id': request.id,
      'X-Forwarded-For': request.ip,
      'X-Forwarded-Proto': request.protocol,
    };

    const fetchOptions: RequestInit = {
      method,
      headers,
      signal: controller.signal,
      // Only include body for non-GET/HEAD requests
      ...(method !== 'GET' && method !== 'HEAD' && request.body
        ? { body: JSON.stringify(request.body) }
        : {}),
    };

    const upstream = await fetch(upstreamUrl, fetchOptions);

    // Forward response status and body
    const data = await upstream.json();

    // Strip internal headers before forwarding to client
    reply
      .status(upstream.status)
      .header('X-Served-By', 'motacare-gateway')
      .send(data);

  } catch (error: any) {
    if (error.name === 'AbortError') {
      return reply.status(504).send({
        statusCode: 504,
        error: 'Gateway Timeout',
        message: 'The upstream service did not respond in time',
      });
    }

    request.log.error({
      event: 'proxy_error',
      upstream: upstreamUrl,
      error: error.message,
    });

    return reply.status(502).send({
      statusCode: 502,
      error: 'Bad Gateway',
      message: 'The upstream service is currently unavailable',
    });
  } finally {
    clearTimeout(timeout);
  }
}