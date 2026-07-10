import { env } from '../../config/env';

// ============================================================
// BILLING ADMIN SERVICE
// Proxies billing queries to subscription-service internal
// routes. Admin-service has no direct DB access to
// motacare_subscriptions.
// ============================================================

async function subscriptionInternal(path: string): Promise<any> {
  const res = await fetch(`${env.SUBSCRIPTION_SERVICE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    signal:  AbortSignal.timeout(5000),
  });

  const data = await res.json().catch(() => ({})) as any;

  if (!res.ok) {
    throw new Error(data.message ?? `Subscription service returned ${res.status}`);
  }

  return data;
}

export class BillingAdminService {

  async listSubscriptions(params: {
    page?:  number;
    limit?: number;
    tier?:  string;
  }): Promise<{ data: any[]; pagination: any }> {
    const qs = new URLSearchParams();
    if (params.page)  qs.set('page',  String(params.page));
    if (params.limit) qs.set('limit', String(params.limit));
    if (params.tier)  qs.set('tier',  params.tier);

    const body = await subscriptionInternal(
      `/subscriptions/internal/subscriptions?${qs}`,
    );

    return {
      data:       body.data        ?? [],
      pagination: body.pagination  ?? { total: 0, page: 1, limit: 25, totalPages: 0 },
    };
  }

  async getBillingStats(): Promise<any> {
    const body = await subscriptionInternal('/subscriptions/internal/stats');
    return body.data ?? {};
  }

  async getSubscriptionByUser(userId: string): Promise<any> {
    const body = await subscriptionInternal(
      `/subscriptions/internal/subscription-by-user?userId=${userId}`,
    );
    return body.data ?? null;
  }
}