import { env } from '../../config/env';

// ============================================================
// USER MANAGEMENT SERVICE
// Admin-only operations on users across the platform.
// All user data lives in auth-service — this service proxies
// admin-level requests through internal routes.
// ============================================================

export class BadRequestError extends Error { constructor(m: string) { super(m); this.name = 'BadRequestError'; } }
export class NotFoundError   extends Error { constructor(m: string) { super(m); this.name = 'NotFoundError'; } }
export class ForbiddenError  extends Error { constructor(m: string) { super(m); this.name = 'ForbiddenError'; } }

async function authInternal(path: string, method: string, body?: object) {
  const res = await fetch(`${env.AUTH_SERVICE_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(5000),
  });
  const data = (await res.json()) as any;
  if (!res.ok) throw new Error(data.message ?? 'Auth service error');
  return data.data;
}

export class UserManagementService {

  // ----------------------------------------------------------
  // LIST ALL USERS (paginated, filterable)
  // ----------------------------------------------------------
  async listUsers(params: {
    page?: number;
    limit?: number;
    role?: string;
    search?: string;
    isActive?: boolean;
  }) {
    const query = new URLSearchParams();
    if (params.page)     query.set('page',     String(params.page));
    if (params.limit)    query.set('limit',    String(params.limit));
    if (params.role)     query.set('role',     params.role);
    if (params.search)   query.set('search',   params.search);
    if (params.isActive !== undefined) query.set('isActive', String(params.isActive));

    return authInternal(`/auth/internal/users?${query}`, 'GET');
  }

  // ----------------------------------------------------------
  // GET SINGLE USER + THEIR SUBSCRIPTION + WORKSHOP
  // ----------------------------------------------------------
  async getUserDetail(userId: string) {
    const [user, subscription] = await Promise.allSettled([
      authInternal(`/auth/internal/user-by-id`, 'POST', { userId }),
      fetch(`${env.SUBSCRIPTION_SERVICE_URL}/internal/subscription-by-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      }).then((r) => r.json()).then((d: any) => d.data),
    ]);

    return {
      user:         user.status === 'fulfilled'         ? user.value         : null,
      subscription: subscription.status === 'fulfilled' ? subscription.value : null,
    };
  }

  // ----------------------------------------------------------
  // SUSPEND / REACTIVATE USER
  // ----------------------------------------------------------
  async setUserActive(userId: string, isActive: boolean, adminId: string) {
    if (userId === adminId) throw new ForbiddenError('You cannot suspend your own account');
    return authInternal('/auth/internal/set-user-active', 'POST', { userId, isActive });
  }

  // ----------------------------------------------------------
  // CHANGE USER ROLE
  // ----------------------------------------------------------
  async setUserRole(userId: string, role: string, adminId: string) {
    if (userId === adminId) throw new ForbiddenError('You cannot change your own role');
    const validRoles = ['OWNER', 'FIXER', 'WORKSHOP_ADMIN', 'ADMIN'];
    if (!validRoles.includes(role)) throw new BadRequestError(`Invalid role: ${role}`);
    return authInternal('/auth/internal/update-user-role', 'POST', { userId, role, workshopId: null });
  }

  // ----------------------------------------------------------
  // GET RECENT USERS (for admin dashboard widget)
  // ----------------------------------------------------------
  async getRecentUsers(limit = 10) {
    return authInternal(`/auth/internal/users?limit=${limit}&sort=createdAt:desc`, 'GET');
  }
}