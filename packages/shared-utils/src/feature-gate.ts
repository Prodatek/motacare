// ============================================================
// FEATURE GATE CLIENT
// Add this file to packages/shared-utils/src/feature-gate.ts
// and re-export it from packages/shared-utils/src/index.ts:
//
//   export * from './feature-gate';
//
// Used by vehicle-service and inspection-service to check
// plan limits before creating a resource. Fails OPEN —
// if subscription-service is unreachable, the action is
// allowed rather than blocking the whole app on a dependency.
// ============================================================

export interface FeatureLimitCheck {
  allowed: boolean;
  limit: number;
  currentCount: number;
  tier: 'FREE' | 'PRO' | 'WORKSHOP';
  unlimited: boolean;
}

export interface FeatureLimitExceededInfo {
  limit: number;
  tier: string;
  resource: 'vehicles' | 'inspections' | 'fixers';
}

/**
 * Calls subscription-service to check whether the user is within
 * their plan's limit for a given resource.
 *
 * @param subscriptionServiceUrl Base URL of subscription-service
 * @param userId The user (owner or fixer) being checked
 * @param resource Which limit to check
 * @param currentCount The caller's current count of this resource
 *
 * @returns The limit check result. On any network/service error,
 *          returns `{ allowed: true, ... }` — fail open so a
 *          subscription-service outage never blocks core features.
 */
export async function checkFeatureLimit(
  subscriptionServiceUrl: string,
  userId: string,
  resource: 'vehicles' | 'inspections' | 'fixers',
  currentCount: number,
): Promise<FeatureLimitCheck> {
  try {
    const res = await fetch(`${subscriptionServiceUrl}/internal/check-limit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, resource, currentCount }),
      // Don't let a slow subscription-service stall the request
      signal: AbortSignal.timeout(2000),
    });

    if (!res.ok) {
      console.warn(`[feature-gate] check-limit returned ${res.status} — failing open`);
      return { allowed: true, limit: -1, currentCount, tier: 'FREE', unlimited: true };
    }

    const body = (await res.json()) as { data: FeatureLimitCheck };
    return body.data;
  } catch (err) {
    // Network error, timeout, service down — fail open
    console.warn('[feature-gate] check-limit unreachable — failing open:', err);
    return { allowed: true, limit: -1, currentCount, tier: 'FREE', unlimited: true };
  }
}