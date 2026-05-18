import crypto from 'crypto';

// ==============================================
// MOTACARE — Shared Utilities
// ==============================================

// ============================================================
// VEHICLE HASH
// Generates a deterministic, unique hash per vehicle+owner pair.
// HMAC-SHA256 ensures the hash can't be reverse-engineered.
// Used as the stable identifier for all vehicle operations.
// ============================================================

export function generateVehicleHash(vin: string, ownerId: string, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(`${vin.toUpperCase()}:${ownerId}`)
    .digest('hex');
}

// ============================================================
// PAGINATION
// ============================================================

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginationResult {
  offset: number;
  limit: number;
  page: number;
}

export function parsePagination(params: PaginationParams): PaginationResult {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(100, Math.max(1, params.limit ?? 20));
  const offset = (page - 1) * limit;
  return { offset, limit, page };
}

export function buildPaginationMeta(total: number, page: number, limit: number) {
  return {
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

// ============================================================
// LOGGER
// Structured logger — consistent across all services.
// In production, outputs JSON for log aggregation (Loki/ELK).
// ============================================================

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogEntry {
  level: LogLevel;
  service: string;
  message: string;
  timestamp: string;
  [key: string]: unknown;
}

export function createLogger(service: string) {
  const log = (level: LogLevel, message: string, meta?: Record<string, unknown>) => {
    const entry: LogEntry = {
      level,
      service,
      message,
      timestamp: new Date().toISOString(),
      ...meta,
    };

    const output = JSON.stringify(entry);

    if (level === 'error') {
      console.error(output);
    } else if (level === 'warn') {
      console.warn(output);
    } else {
      console.log(output);
    }
  };

  return {
    info: (message: string, meta?: Record<string, unknown>) => log('info', message, meta),
    warn: (message: string, meta?: Record<string, unknown>) => log('warn', message, meta),
    error: (message: string, meta?: Record<string, unknown>) => log('error', message, meta),
    debug: (message: string, meta?: Record<string, unknown>) => {
      if (process.env.NODE_ENV === 'development') {
        log('debug', message, meta);
      }
    },
  };
}

// ============================================================
// STRING HELPERS
// ============================================================

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  const masked = local.slice(0, 2) + '***';
  return `${masked}@${domain}`;
}

// ============================================================
// DATE HELPERS
// ============================================================

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

export function isExpired(date: Date): boolean {
  return new Date() > date;
}