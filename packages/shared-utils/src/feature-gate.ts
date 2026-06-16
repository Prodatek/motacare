export interface FeatureLimitCheck {
  allowed: boolean;
  limit: number;
  currentCount: number;
  tier: 'FREE' | 'PRO' | 'WORKSHOP';
  unlimited: boolean;
}
 
export async function checkFeatureLimit(
  subscriptionServiceUrl: string,
  userId: string,
  resource: 'vehicles' | 'inspections' | 'fixers',
  currentCount: number,
): Promise<FeatureLimitCheck> {
 
  const url = `${subscriptionServiceUrl}/internal/check-limit`;
 
  try {
    const payload = { userId, resource, currentCount };
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[feature-gate] POST ${url} payload: ${JSON.stringify(payload)}`);
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(2000),
    });
 
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error(
        `[feature-gate] ❌ check-limit returned ${res.status} from ${url} — FAILING OPEN. Body: ${body}`,
      );
      return { allowed: true, limit: -1, currentCount, tier: 'FREE', unlimited: true };
    }
 
    const body = (await res.json()) as { data: FeatureLimitCheck };
 
    // Dev-time visibility — confirms the gate actually ran and what it decided
    if (process.env.NODE_ENV !== 'production') {
      console.log(
        `[feature-gate] ${resource} check for user ${userId}: ` +
        `count=${currentCount} limit=${body.data.limit} tier=${body.data.tier} ` +
        `→ ${body.data.allowed ? 'ALLOWED' : 'BLOCKED'}`,
      );
    }
 
    return body.data;
  } catch (err: any) {
    // This branch fires if SUBSCRIPTION_SERVICE_URL is wrong, the service
    // is down, or the request times out. Logged as ERROR (not warn)
    // because it means limits are NOT being enforced at all.
    console.error(
      `[feature-gate] ❌ Could not reach ${url} — FAILING OPEN (no limits enforced). ` +
      `Check SUBSCRIPTION_SERVICE_URL env var and that subscription-service is running. ` +
      `Error: ${err.message}`,
    );
    return { allowed: true, limit: -1, currentCount, tier: 'FREE', unlimited: true };
    }
}