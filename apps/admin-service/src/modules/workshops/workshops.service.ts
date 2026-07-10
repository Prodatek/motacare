import { env } from '../../config/env';

// ============================================================
// WORKSHOP ADMIN SERVICE
// Proxies admin actions to workshop-service internal routes.
// Admin-service has no direct DB access to motacare_workshops.
// ============================================================

async function workshopInternal(path: string, method: string, body?: object): Promise<any> {
  const res = await fetch(`${env.WORKSHOP_SERVICE_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body:    body ? JSON.stringify(body) : undefined,
    signal:  AbortSignal.timeout(5000),
  });

  const data = await res.json().catch(() => ({})) as any;

  if (!res.ok) {
    throw new Error(data.message ?? `Workshop service returned ${res.status}`);
  }

  return data.data ?? data;
}

export class WorkshopAdminService {

  async setFeatured(workshopId: string, featured: boolean): Promise<void> {
    await workshopInternal(
      `/workshops/internal/${workshopId}/featured`,
      'POST',
      { featured },
    );
  }

  async setStatus(workshopId: string, status: 'ACTIVE' | 'SUSPENDED'): Promise<void> {
    await workshopInternal(
      `/workshops/internal/${workshopId}/status`,
      'POST',
      { status },
    );
  }

  async getWorkshopStats(): Promise<any> {
    return workshopInternal('/workshops/internal/stats', 'GET');
  }
}