import type {
  ApiResponse,
  ApiError,
  BaseUser,
  TokenPair,
  Vehicle,
  Inspection,
  FixJob,
  PaginatedResponse,
} from '@motacare/shared-types';

// ============================================================
// TYPES
// ============================================================

export interface FixJobStatusEntry {
  id: string;
  fixJobId: string;
  fromStatus: string | null;
  toStatus: string;
  changedBy: string;
  notes: string | null;
  changedAt: string;
}

export type FixJobWithHistory = FixJob & { statusHistory: FixJobStatusEntry[] };

export type PartEntry = { name: string; quantity: number; unitCost: number };

// ============================================================
// API CLIENT ERROR
// ============================================================

export class ApiClientError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly error: string,
    message: string,
    public readonly details?: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

// ============================================================
// CORE FETCH WRAPPER
// ============================================================

const BASE_URL = '/api';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getAccessToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string> ?? {}),
  };

  const response = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (response.status === 401) {
    const refreshed = await tryRefreshToken();
    if (refreshed) return request<T>(path, options);
    clearTokens();
    window.location.href = '/login';
    throw new ApiClientError(401, 'Unauthorized', 'Session expired');
  }

  const data = await response.json() as ApiResponse<T> & ApiError & { pagination?: unknown };

  if (!response.ok) {
    throw new ApiClientError(
      data.statusCode ?? response.status,
      data.error ?? 'Error',
      data.message ?? 'An unexpected error occurred',
      data.details,
    );
  }

  // Paginated responses — return full object with data + pagination
  if ('pagination' in data && data.pagination !== undefined) {
    return data as unknown as T;
  }

  return (data.data ?? data) as T;
}

// ============================================================
// TOKEN MANAGEMENT
// ============================================================

let _accessToken: string | null = null;

export const setAccessToken = (t: string) => { _accessToken = t; };
export const getAccessToken = (): string | null => _accessToken;
export const clearTokens = () => { _accessToken = null; localStorage.removeItem('mc_refresh'); };
export const saveRefreshToken = (t: string) => localStorage.setItem('mc_refresh', t);
export const getRefreshToken = (): string | null => localStorage.getItem('mc_refresh');

async function tryRefreshToken(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return false;
    const data = await res.json() as { data: TokenPair };
    setAccessToken(data.data.accessToken);
    saveRefreshToken(data.data.refreshToken);
    return true;
  } catch { return false; }
}

// ============================================================
// AUTH API
// ============================================================

export interface RegisterPayload {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role: 'OWNER' | 'FIXER';
  workshopName?: string;
  workshopAddress?: string;
}

export interface AuthResult {
  user: BaseUser;
  tokens: TokenPair;
}

export const authApi = {
  register: (payload: RegisterPayload) =>
    request<AuthResult>('/auth/register', { method: 'POST', body: JSON.stringify(payload) }),

  login: (email: string, password: string) =>
    request<AuthResult>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),

  logout: (refreshToken: string) =>
    request<void>('/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken }) }),

  me: () => request<BaseUser>('/auth/me'),
};

// ============================================================
// VEHICLE API
// ============================================================

export interface RegisterVehiclePayload {
  vin: string;
  licensePlate: string;
  make: string;
  model: string;
  year: number;
  color?: string;
  trim?: string;
  fuelType: 'PETROL' | 'DIESEL' | 'ELECTRIC' | 'HYBRID' | 'CNG' | 'LPG';
  transmissionType: 'MANUAL' | 'AUTOMATIC' | 'CVT';
  engineCapacity?: string;
  mileageAtRegistration: number;
}

export const vehicleApi = {
  register: (payload: RegisterVehiclePayload) =>
    request<Vehicle>('/vehicles', { method: 'POST', body: JSON.stringify(payload) }),

  list: (params?: { page?: number; limit?: number; status?: string; search?: string }) => {
    const query = new URLSearchParams(
      Object.fromEntries(Object.entries(params ?? {}).filter(([, v]) => v !== undefined)) as any,
    ).toString();
    return request<PaginatedResponse<Vehicle>>(`/vehicles${query ? `?${query}` : ''}`);
  },

  get: (hash: string) => request<Vehicle>(`/vehicles/${hash}`),

  update: (hash: string, payload: Partial<RegisterVehiclePayload>) =>
    request<Vehicle>(`/vehicles/${hash}`, { method: 'PATCH', body: JSON.stringify(payload) }),

  deactivate: (hash: string) => request<Vehicle>(`/vehicles/${hash}`, { method: 'DELETE' }),
};

// ============================================================
// INSPECTION API
// ============================================================

export const inspectionApi = {
  getChecklist: () => request<any[]>('/inspections/checklist'),

  create: (vehicleHash: string, mileageAtInspection: number, reportedSymptoms?: string[], priorityAreas?: string[]) =>
    request<Inspection>('/inspections', {
      method: 'POST',
      body: JSON.stringify({
        vehicleHash,
        mileageAtInspection,
        ...(reportedSymptoms?.length ? { reportedSymptoms } : {}),
        ...(priorityAreas?.length ? { priorityAreas } : {}),
      }),
    }),

  list: (params?: { page?: number; status?: string; vehicleHash?: string; limit?: number }) => {
    const query = new URLSearchParams(
      Object.fromEntries(Object.entries(params ?? {}).filter(([, v]) => v !== undefined)) as any,
    ).toString();
    return request<PaginatedResponse<Inspection>>(`/inspections${query ? `?${query}` : ''}`);
  },

  get: (id: string) =>
    request<Inspection & { items: any[]; stats: any }>(`/inspections/${id}`),

  updateItem: (inspectionId: string, payload: {
    checkId: string;
    status: 'PASS' | 'FAIL' | 'WARNING' | 'NOT_CHECKED';
    severity?: string | null;
    notes?: string | null;
  }) =>
    request<any>(`/inspections/${inspectionId}/items`, { method: 'PATCH', body: JSON.stringify(payload) }),

  complete: (inspectionId: string, outcome: 'COMPLETED' | 'NEEDS_FOLLOWUP' | 'DRAFT', summary?: string) =>
    request<Inspection>(`/inspections/${inspectionId}/complete`, {
      method: 'POST',
      body: JSON.stringify({ outcome, summary: summary ?? null }),
    }),

  createFixJob: (payload: {
    inspectionId: string;
    vehicleHash: string;
    ownerId: string;
    description: string;
    estimatedCompletionAt?: string;
    estimatedCost?: number;
    currency?: string;
  }) =>
    request<FixJob>('/fix-jobs', { method: 'POST', body: JSON.stringify(payload) }),
};

// ============================================================
// FIX JOB API — full CRUD + parts + cancel
// ============================================================

export const fixJobApi = {

  list: (params?: { page?: number; limit?: number; status?: string; vehicleHash?: string }) => {
    const query = new URLSearchParams(
      Object.fromEntries(Object.entries(params ?? {}).filter(([, v]) => v !== undefined)) as any,
    ).toString();
    return request<PaginatedResponse<FixJob>>(`/fix-jobs${query ? `?${query}` : ''}`);
  },

  get: (id: string) =>
    request<FixJobWithHistory>(`/fix-jobs/${id}`),

  update: (id: string, payload: {
    status?: string;
    estimatedCompletionAt?: string | null;
    finalCost?: number;
    repairNotes?: string | null;
    notes?: string;
  }) =>
    request<FixJob>(`/fix-jobs/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),

  cancel: (id: string, reason: string) =>
    request<FixJob>(`/fix-jobs/${id}/cancel`, { method: 'POST', body: JSON.stringify({ reason }) }),

  addPart: (id: string, part: PartEntry) =>
    request<FixJob>(`/fix-jobs/${id}/parts`, { method: 'POST', body: JSON.stringify(part) }),

  removePart: (id: string, partIndex: number) =>
    request<FixJob>(`/fix-jobs/${id}/parts/${partIndex}`, { method: 'DELETE' }),

  history: (id: string) =>
    request<FixJobStatusEntry[]>(`/fix-jobs/${id}/history`),

  // Alias used from inspection modal
  createFixJob: (payload: Parameters<typeof inspectionApi.createFixJob>[0]) =>
    inspectionApi.createFixJob(payload),
};