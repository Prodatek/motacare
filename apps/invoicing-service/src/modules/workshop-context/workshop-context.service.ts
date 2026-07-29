import { env } from '../../config/env';
import { ForbiddenError } from '../../errors';

// ============================================================
// WORKSHOP CONTEXT
//
// The JWT only carries { sub, role } — no workshopId claim — so
// every module that needs to scope reads/writes to "the caller's
// workshop" resolves it here, once, via workshop-service's
// existing internal endpoint. ADMIN callers aren't scoped to a
// single workshop, so they must pass workshopId explicitly
// (query/body param) instead of going through this resolver.
// ============================================================

export { ForbiddenError };

interface FixerWorkshop {
  workshopId: string;
  workshopName: string;
  role: string;
}

export async function resolveWorkshopId(fixerId: string): Promise<string> {
  try {
    const res = await fetch(`${env.WORKSHOP_SERVICE_URL}/workshops/internal/fixer/${fixerId}`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) {
      throw new ForbiddenError('You are not associated with a workshop');
    }
    const body = (await res.json()) as { data: FixerWorkshop | null };
    if (!body.data?.workshopId) {
      throw new ForbiddenError('You are not associated with a workshop');
    }
    return body.data.workshopId;
  } catch (err) {
    if (err instanceof ForbiddenError) throw err;
    throw new ForbiddenError('Could not resolve your workshop — try again shortly');
  }
}

// Resolves the effective workshopId for a request: ADMIN callers
// pass one explicitly, everyone else is resolved from their fixerId.
export async function resolveEffectiveWorkshopId(
  user: { sub: string; role: string },
  explicitWorkshopId?: string,
): Promise<string> {
  if (user.role === 'ADMIN') {
    if (!explicitWorkshopId) throw new ForbiddenError('workshopId is required for ADMIN requests');
    return explicitWorkshopId;
  }
  return resolveWorkshopId(user.sub);
}
