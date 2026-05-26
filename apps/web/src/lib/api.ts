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
// API CLIENT
// All requests go through the Next.js rewrite (/api → gateway).
// This keeps the browser origin consistent and avoids CORS issues.
//
// Every method returns typed data or throws an ApiClientError
// with the statusCode so components can handle specific cases.
// ============================================================

const BASE_URL = '/api';

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

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  // Read access token from memory (set by auth module)
  const token = getAccessToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string> ?? {}),
  };

  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  // Handle 401 — refresh once, except when calling /auth/refresh itself.
  if (response.status === 401) {
    if (path === '/auth/refresh') {
      clearTokens();
      window.location.href = '/login';
      throw new ApiClientError(401, 'Unauthorized', 'Session expired');
    }

    const refreshed = await tryRefreshToken();
    if (refreshed) {
      // Retry original request with new token
      return request<T>(path, options);
    }

    // Refresh failed — boot to login
    clearTokens();
    window.location.href = '/login';
    throw new ApiClientError(401, 'Unauthorized', 'Session expired');
  }

  const data = await response.json() as ApiResponse<T> & ApiError;

  if (!response.ok) {
    throw new ApiClientError(
      data.statusCode ?? response.status,
      data.error ?? 'Error',
      data.message ?? 'An unexpected error occurred',
      data.details,
    );
  }

  return (data.data ?? data) as T;
}

// ============================================================
// TOKEN MANAGEMENT (in-memory for XSS safety)
// Access token: memory only
// Refresh token: httpOnly cookie (set by the server ideally,
// or localStorage as a fallback for this phase)
// ============================================================

let _accessToken: string | null = null;

export function setAccessToken(token: string) {
  _accessToken = token;
}

export function getAccessToken(): string | null {
  return _accessToken;
}

export function clearTokens() {
  _accessToken = null;
  localStorage.removeItem('mc_refresh');
  if (typeof document !== 'undefined') {
    document.cookie = 'mc_session=; path=/; max-age=0; SameSite=Lax';
  }
}

export function saveRefreshToken(token: string) {
  localStorage.setItem('mc_refresh', token);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem('mc_refresh');
}

async function tryRefreshToken(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  try {
    const response = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) return false;

    const data = await response.json() as { data: TokenPair };
    setAccessToken(data.data.accessToken);
    saveRefreshToken(data.data.refreshToken);
    return true;
  } catch {
    return false;
  }
}

// ============================================================
// AUTH ENDPOINTS
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
    request<AuthResult>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  login: (email: string, password: string) =>
    request<AuthResult>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  refresh: () => {
    const refreshToken = getRefreshToken();
    return request<TokenPair>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });
  },

  logout: (refreshToken: string) =>
    request<void>('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    }),

  me: () => request<BaseUser>('/auth/me'),
};

// ============================================================
// VEHICLE ENDPOINTS
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
    request<Vehicle>('/vehicles', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  list: (params?: { page?: number; limit?: number; status?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    return request<PaginatedResponse<Vehicle>>(`/vehicles${query ? `?${query}` : ''}`);
  },

  get: (hash: string) => request<Vehicle>(`/vehicles/${hash}`),

  update: (hash: string, payload: Partial<RegisterVehiclePayload>) =>
    request<Vehicle>(`/vehicles/${hash}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  deactivate: (hash: string) =>
    request<Vehicle>(`/vehicles/${hash}`, { method: 'DELETE' }),
};

// ============================================================
// INSPECTION ENDPOINTS
// ============================================================

export const inspectionApi = {
  getChecklist: () => request<any[]>('/inspections/checklist'),

  create: (vehicleHash: string, mileageAtInspection: number) =>
    request<Inspection>('/inspections', {
      method: 'POST',
      body: JSON.stringify({ vehicleHash, mileageAtInspection }),
    }),

  list: (params?: { page?: number; status?: string; vehicleHash?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    return request<PaginatedResponse<Inspection>>(`/inspections${query ? `?${query}` : ''}`);
  },

  get: (id: string) => request<Inspection & { items: any[]; stats: any }>(`/inspections/${id}`),

  updateItem: (inspectionId: string, payload: {
    checkId: string;
    status: 'PASS' | 'FAIL' | 'WARNING' | 'NOT_CHECKED';
    severity?: string | null;
    notes?: string | null;
  }) =>
    request<any>(`/inspections/${inspectionId}/items`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  complete: (inspectionId: string, summary: string) =>
    request<Inspection>(`/inspections/${inspectionId}/complete`, {
      method: 'POST',
      body: JSON.stringify({ summary }),
    }),

  createFixJob: (inspectionId: string, payload: {
    description: string;
    estimatedCompletionAt?: string;
    estimatedCost?: number;
  }) =>
    request<FixJob>(`/inspections/${inspectionId}/fix-jobs`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};

// ============================================================
// FIX JOB ENDPOINTS
// ============================================================

export const fixJobApi = {
  list: (params?: { page?: number; status?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    return request<PaginatedResponse<FixJob>>(`/fix-jobs${query ? `?${query}` : ''}`);
  },

  get: (id: string) => request<FixJob>(`/fix-jobs/${id}`),

  update: (id: string, payload: {
    status?: string;
    estimatedCompletionAt?: string | null;
    finalCost?: number;
    repairNotes?: string;
  }) =>
    request<FixJob>(`/fix-jobs/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
};