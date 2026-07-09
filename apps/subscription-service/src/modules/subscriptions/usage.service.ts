import { env } from '../../config/env';

// ============================================================
// USAGE AGGREGATION SERVICE
//
// Calls vehicle-service and inspection-service to get actual
// usage counts for the current user, so the subscription page
// can show accurate progress bars.
//
// This is separate from the limit enforcement (feature-gate)
// which runs on the calling service side. This is purely for
// display purposes in the subscription UI.
// ============================================================

export interface UsageSnapshot {
  vehicles: number;
  inspectionsThisMonth: number;
  fixers: number;
  updatedAt: string;
}

export async function getUserUsage(userId: string, role: string): Promise<UsageSnapshot> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [vehicleRes, inspectionRes] = await Promise.allSettled([
    fetch(`${env.VEHICLE_SERVICE_URL}/vehicles/internal/count`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ownerId: userId }),
    }).then((r) => r.json()),
    fetch(`${env.INSPECTION_SERVICE_URL}/inspections/internal/count`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ownerId: userId, from: startOfMonth }),
    }).then((r) => r.json()),
  ]);

  return {
    vehicles:             vehicleRes.status === 'fulfilled'    ? (vehicleRes.value as any).data?.count ?? 0 : 0,
    inspectionsThisMonth: inspectionRes.status === 'fulfilled' ? (inspectionRes.value as any).data?.count ?? 0 : 0,
    fixers:               0, // Populated from workshop-service in Phase 4 Stage 2
    updatedAt:            now.toISOString(),
  };
}