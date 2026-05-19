import type { FastifyInstance } from 'fastify';

// ============================================================
// RATE LIMITING STRATEGY
//
// Different routes need different limits:
//
//   Auth endpoints (login/register) → tight limit
//   Prevents brute-force attacks on credentials
//
//   Write endpoints (POST/PATCH) → medium limit
//   Prevents spam and runaway clients
//
//   Read endpoints (GET) → generous limit
//   Normal browsing should never hit this
//
// All limits are per IP address.
// In production, add Redis store for distributed limiting
// (so limits work across multiple gateway instances).
// ============================================================

export interface RateLimitConfig {
  max: number;
  timeWindow: string;
  keyGenerator?: (request: any) => string;
}

// Auth routes — tightest limits (brute force protection)
export const AUTH_RATE_LIMIT: RateLimitConfig = {
  max: 10,
  timeWindow: '15 minutes',
  // Key on IP + email to prevent distributed attacks on one account
  keyGenerator: (request: any) => {
    const ip = request.ip;
    const email = (request.body as any)?.email ?? '';
    return `${ip}:${email}`;
  },
};

// Write operations
export const WRITE_RATE_LIMIT: RateLimitConfig = {
  max: 30,
  timeWindow: '1 minute',
};

// Read operations
export const READ_RATE_LIMIT: RateLimitConfig = {
  max: 120,
  timeWindow: '1 minute',
};

// Health check — generous, used by load balancers
export const HEALTH_RATE_LIMIT: RateLimitConfig = {
  max: 600,
  timeWindow: '1 minute',
};

export function buildRateLimitErrorResponse() {
  return {
    statusCode: 429,
    error: 'Too Many Requests',
    message: 'Rate limit exceeded. Please slow down and try again shortly.',
  };
}