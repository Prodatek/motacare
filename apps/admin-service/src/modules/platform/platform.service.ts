import { env } from '../../config/env';

// ============================================================
// PLATFORM METRICS SERVICE
// Aggregates metrics from all downstream services.
// Powers the Prodatek admin dashboard overview.
// ============================================================

export interface PlatformMetrics {
  users: {
    total: number;
    owners: number;
    fixers: number;
    workshopAdmins: number;
    newThisMonth: number;
  };
  vehicles: {
    total: number;
    active: number;
  };
  inspections: {
    total: number;
    thisMonth: number;
    completed: number;
    inProgress: number;
  };
  fixJobs: {
    total: number;
    thisMonth: number;
    delivered: number;
    totalRevenue: number;
  };
  workshops: {
    total: number;
    active: number;
    pendingApproval: number;
    totalViews: number;
  };
  subscriptions: {
    free: number;
    pro: number;
    workshop: number;
    totalMonthlyRevenue: number;
  };
  updatedAt: string;
}

async function fetchServiceStats(url: string, path: string): Promise<any> {
  try {
    const res = await fetch(`${url}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    return ((await res.json()) as any).data;
  } catch {
    return null;
  }
}

export class PlatformService {

  async getMetrics(): Promise<PlatformMetrics> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    // Fan out to all services in parallel
    const [users, vehicles, inspections, fixJobs, workshops, subscriptions] = await Promise.allSettled([
      fetchServiceStats(env.AUTH_SERVICE_URL,         `/auth/internal/stats`),
      fetchServiceStats(env.VEHICLE_SERVICE_URL,      `/vehicles/internal/stats`),
      fetchServiceStats(env.INSPECTION_SERVICE_URL,   `/inspections/internal/stats?from=${startOfMonth}`),
      fetchServiceStats(env.FIX_JOBS_SERVICE_URL,     `/fix-jobs/internal/stats?from=${startOfMonth}`),
      fetchServiceStats(env.WORKSHOP_SERVICE_URL,     `/workshops/internal/stats`),
      fetchServiceStats(env.SUBSCRIPTION_SERVICE_URL, `/subscriptions/internal/stats`),
    ]);

    const u = users.status === 'fulfilled'         ? users.value         : null;
    const v = vehicles.status === 'fulfilled'      ? vehicles.value      : null;
    const i = inspections.status === 'fulfilled'   ? inspections.value   : null;
    const f = fixJobs.status === 'fulfilled'       ? fixJobs.value       : null;
    const w = workshops.status === 'fulfilled'     ? workshops.value     : null;
    const s = subscriptions.status === 'fulfilled' ? subscriptions.value : null;

    return {
      users: {
        total:          u?.total ?? 0,
        owners:         u?.byRole?.OWNER ?? 0,
        fixers:         u?.byRole?.FIXER ?? 0,
        workshopAdmins: u?.byRole?.WORKSHOP_ADMIN ?? 0,
        newThisMonth:   u?.newThisMonth ?? 0,
      },
      vehicles: {
        total:  v?.total ?? 0,
        active: v?.active ?? 0,
      },
      inspections: {
        total:      i?.allTime ?? 0,
        thisMonth:  i?.total ?? 0,
        completed:  i?.completed ?? 0,
        inProgress: i?.inProgress ?? 0,
      },
      fixJobs: {
        total:         f?.allTime ?? 0,
        thisMonth:     f?.total ?? 0,
        delivered:     f?.delivered ?? 0,
        totalRevenue:  f?.totalRevenue ?? 0,
      },
      workshops: {
        total:           w?.total ?? 0,
        active:          w?.active ?? 0,
        pendingApproval: w?.pendingApproval ?? 0,
        totalViews:      w?.totalViews ?? 0,
      },
      subscriptions: {
        free:                 s?.byTier?.FREE ?? 0,
        pro:                  s?.byTier?.PRO ?? 0,
        workshop:             s?.byTier?.WORKSHOP ?? 0,
        totalMonthlyRevenue:  s?.monthlyRevenue ?? 0,
      },
      updatedAt: now.toISOString(),
    };
  }
}