import type {
  ApiResponse,
  ApiError,
  BaseUser,
  TokenPair,
  Vehicle,
  Inspection,
  FixJob,
  PaginatedResponse,
  CatalogItem,
  CatalogItemKind,
  Quote,
  QuoteStatus,
  Invoice,
  InvoiceStatus,
  Payment,
  PaymentMethod,
  FinancialSummary,
  FinancialTrendPoint,
  TopCustomer,
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

  // Handle 401 — try to refresh token once, then redirect to login
  if (response.status === 401) {
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

  // ── Parse body ──────────────────────────────────────────────
  // Always attempt JSON first. Fall back to text so a plain-text
  // or HTML error body (e.g. a crashed upstream service) still
  // produces a meaningful error message instead of a SyntaxError.
  let data: ApiResponse<T> & ApiError & { pagination?: unknown };
  const contentType = response.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch {
      // Server said Content-Type: application/json but body isn't valid JSON.
      // Treat as a service error with the raw status code.
      throw new ApiClientError(
        response.status,
        'Parse Error',
        `The server returned an invalid response (HTTP ${response.status}). ` +
        'This usually means the upstream service crashed or is starting up.',
      );
    }
  } else {
    // Non-JSON response — read text for the error message
    const text = await response.text().catch(() => '');
    if (!response.ok) {
      throw new ApiClientError(
        response.status,
        `HTTP ${response.status}`,
        text.slice(0, 200) ||
          `The server returned HTTP ${response.status} with no body. ` +
          'Check that all services are running.',
      );
    }
    // A non-JSON 2xx is unusual — return empty object and let the caller handle it
    return {} as T;
  }

  if (!response.ok) {
    throw new ApiClientError(
      data.statusCode ?? response.status,
      data.error ?? 'Error',
      data.message ?? `HTTP ${response.status} — check that all services are running and the database is migrated.`,
      data.details,
    );
  }

  // Paginated list response — return full { data, pagination } object
  if ('pagination' in data && data.pagination !== undefined) {
    return data as unknown as T;
  }

  // Standard response — unwrap .data
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

  logout: (refreshToken: string) =>
    request<void>('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    }),

  refresh: (refreshToken: string) =>
    request<TokenPair>('/auth/refresh', {
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

  list: (params?: { page?: number; limit?: number; status?: string; search?: string }) => {
    const query = new URLSearchParams(
      Object.fromEntries(Object.entries(params ?? {}).filter(([, v]) => v !== undefined)) as any
    ).toString();
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

  list: (params?: { page?: number; limit?: number; status?: string; vehicleHash?: string }) => {
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

  complete: (inspectionId: string, outcome: 'COMPLETED' | 'NEEDS_FOLLOWUP' | 'DRAFT', summary?: string) =>
    request<Inspection>(`/inspections/${inspectionId}/complete`, {
      method: 'POST',
      body: JSON.stringify({ outcome, summary }),
    }),

  createFixJob: (
    inspectionIdOrPayload: string | {
      inspectionId?: string;
      vehicleHash?: string;
      ownerId?: string;
      description: string;
      estimatedCompletionAt?: string;
      estimatedCost?: number;
      currency?: string;
    },
    payload?: {
      inspectionId?: string;
      vehicleHash?: string;
      ownerId?: string;
      description: string;
      estimatedCompletionAt?: string;
      estimatedCost?: number;
      currency?: string;
    },
  ) => {
    const normalizedPayload = typeof inspectionIdOrPayload === 'string'
      ? { ...(payload ?? {}), inspectionId: inspectionIdOrPayload }
      : inspectionIdOrPayload;

    return request<FixJob>('/fix-jobs', {
      method: 'POST',
      body: JSON.stringify(normalizedPayload),
    });
  },
};

// ============================================================
// FIX JOB ENDPOINTS
// ============================================================

export const fixJobApi = {
  list: (params?: { page?: number; limit?: number; status?: string; statuses?: string[]; vehicleHash?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    return request<PaginatedResponse<FixJob>>(`/fix-jobs${query ? `?${query}` : ''}`);
  },

  get: (id: string) => request<FixJob>(`/fix-jobs/${id}`),

  createFixJob: (
    inspectionIdOrPayload: string | {
      inspectionId?: string;
      vehicleHash?: string;
      ownerId?: string;
      description: string;
      estimatedCompletionAt?: string;
      estimatedCost?: number;
      currency?: string;
    },
    payload?: {
      inspectionId?: string;
      vehicleHash?: string;
      ownerId?: string;
      description: string;
      estimatedCompletionAt?: string;
      estimatedCost?: number;
      currency?: string;
    },
  ) => {
    const normalizedPayload = typeof inspectionIdOrPayload === 'string'
      ? { ...(payload ?? {}), inspectionId: inspectionIdOrPayload }
      : inspectionIdOrPayload;

    return request<FixJob>('/fix-jobs', {
      method: 'POST',
      body: JSON.stringify(normalizedPayload),
    });
  },

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

// ============================================================
// SUBSCRIPTION API
// ============================================================

export type SubscriptionTier = 'FREE' | 'PRO' | 'WORKSHOP';
export type BillingInterval = 'MONTHLY' | 'YEARLY';
export type SubscriptionStatus = 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'EXPIRED' | 'TRIALING';

export interface PlanDetails {
  name: string;
  description: string;
  price: { monthly: number; yearly: number };
  features: {
    vehiclesAllowed: number;
    inspectionsPerMonth: number;
    fixersAllowed: number;
    canExportReports: boolean;
    canAccessObd: boolean;
    canAccessAiSummary: boolean;
  };
}

export type PlansResponse = Record<SubscriptionTier, PlanDetails>;

export interface Subscription {
  id: string;
  userId: string;
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  billingInterval: BillingInterval | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  trialEndsAt: string | null;
  vehiclesAllowed: number;
  inspectionsPerMonth: number;
  fixersAllowed: number;
  createdAt: string;
  updatedAt: string;
}

export interface UsageSnapshot {
  vehicles: number;
  inspectionsThisMonth: number;
  fixers: number;
  updatedAt: string;
}

export const subscriptionApi = {
  getPlans: () => request<PlansResponse>('/subscriptions/plans'),

  getMySubscription: () => request<Subscription>('/subscriptions/me'),

  getUsage: () => request<UsageSnapshot>('/subscriptions/usage'),

  createCheckout: (tier: 'PRO' | 'WORKSHOP', billingInterval: BillingInterval) =>
    request<{ url: string }>('/subscriptions/checkout', {
      method: 'POST',
      body: JSON.stringify({ tier, billingInterval }),
    }),

  createPortalSession: (returnUrl?: string) =>
    request<{ url: string }>('/subscriptions/portal', {
      method: 'POST',
      body: JSON.stringify({ returnUrl }),
    }),

  cancel: (immediately = false) =>
    request<Subscription>('/subscriptions/cancel', {
      method: 'POST',
      body: JSON.stringify({ immediately }),
    }),
};

// ============================================================
// WORKSHOP API
// ============================================================

export interface Workshop {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  address: string;
  city: string;
  state: string;
  phone: string | null;
  email: string | null;
  logoUrl: string | null;
  coverImageUrl: string | null;
  specialties: string[];
  status: 'PENDING_APPROVAL' | 'ACTIVE' | 'SUSPENDED';
  adminId: string;
  maxFixers: number;
  currentFixerCount: number;
  featured: boolean;
  totalInspections: number;
  totalFixJobs: number;
  createdAt: string;
  updatedAt: string;
}

export interface WorkshopMember {
  id: string;
  workshopId: string;
  fixerId: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'LEFT';
  joinRequestNote: string | null;
  rejectionReason: string | null;
  joinedAt: string | null;
  leftAt: string | null;
  createdAt: string;
}

export interface WorkshopStats {
  workshopId: string;
  period: { from: string; to: string };
  viewCount: number;
  totalInspections: number;
  completedInspections: number;
  totalFixJobs: number;
  completedFixJobs: number;
  deliveredFixJobs: number;
  totalRevenue: number;
  currency: string;
  byFixer: Array<{
    fixerId: string;
    fixerName: string;
    inspections: number;
    fixJobs: number;
    completedFixJobs: number;
    revenue: number;
    avgFixJobDurationHours: number | null;
  }>;
  trend: Array<{ week: string; fixJobs: number; revenue: number }>;
}

export const workshopApi = {
  list: (params?: { page?: number; limit?: number; city?: string; search?: string; featured?: boolean }) => {
    const query = new URLSearchParams(
      Object.fromEntries(Object.entries(params ?? {}).filter(([, v]) => v !== undefined)) as any,
    ).toString();
    return request<PaginatedResponse<Workshop>>(`/workshops${query ? `?${query}` : ''}`);
  },

  featured: () => request<PaginatedResponse<Workshop>>('/workshops/featured'),

  get: (id: string) =>
    request<Workshop & { members: WorkshopMember[] }>(`/workshops/${id}`),

  getBySlug: (slug: string) =>
    request<Workshop>(`/workshops/slug/${slug}`),

  create: (payload: {
    name: string; description?: string; address: string;
    city: string; state: string; phone?: string; email?: string;
    specialties?: string[];
  }) =>
    request<Workshop>('/workshops', { method: 'POST', body: JSON.stringify(payload) }),

  update: (id: string, payload: Partial<{
    name: string; description: string; address: string;
    city: string; state: string; phone: string; email: string; specialties: string[];
  }>) =>
    request<Workshop>(`/workshops/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),

  join: (workshopId: string, note?: string) =>
    request<WorkshopMember>('/workshops/join', {
      method: 'POST',
      body: JSON.stringify({ workshopId, note }),
    }),

  leave: (id: string) =>
    request<void>(`/workshops/${id}/leave`, { method: 'POST' }),

  getPending: (id: string) =>
    request<WorkshopMember[]>(`/workshops/${id}/members/pending`),

  handleMember: (workshopId: string, memberId: string, action: 'APPROVE' | 'REJECT', rejectionReason?: string) =>
    request<WorkshopMember>(`/workshops/${workshopId}/members/${memberId}`, {
      method: 'POST',
      body: JSON.stringify({ action, rejectionReason }),
    }),

  getStats: (id: string, from?: string, to?: string) => {
    const q = new URLSearchParams(
      Object.fromEntries(Object.entries({ from, to }).filter(([, v]) => v !== undefined) as any),
    ).toString();
    return request<WorkshopStats>(`/workshops/${id}/stats${q ? `?${q}` : ''}`);
  },
};

// ── TYPES - phase4 ────────────────────────────────────────────────────
 
export interface PlatformMetrics {
  users: {
    total: number; owners: number; fixers: number;
    workshopAdmins: number; newThisMonth: number;
  };
  vehicles:      { total: number; active: number };
  inspections:   { total: number; thisMonth: number; completed: number; inProgress: number };
  fixJobs:       { total: number; thisMonth: number; delivered: number; totalRevenue: number };
  workshops:     { total: number; active: number; pendingApproval: number; totalViews: number };
  subscriptions: { free: number; pro: number; workshop: number; totalMonthlyRevenue: number };
  updatedAt: string;
}
 
export interface AdminUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
  subscriptionTier: string;
  workshopId: string | null;
  createdAt: string;
  lastLoginAt: string | null;
}
 
export interface AdminSubscription {
  id: string;
  userId: string;
  tier: string;
  status: string;
  vehiclesAllowed: number;
  inspectionsPerMonth: number;
  currentPeriodEnd: string | null;
  createdAt: string;
}
 
// ── ADMIN API ─────────────────────────────────────────────────
 
export const adminApi = {
  // Platform
  getMetrics: () =>
    request<PlatformMetrics>('/admin/platform/metrics'),
 
  // Users
  listUsers: (params?: { page?: number; limit?: number; role?: string; search?: string; isActive?: boolean }) => {
    const q = new URLSearchParams(
      Object.fromEntries(Object.entries(params ?? {}).filter(([, v]) => v !== undefined)) as any,
    ).toString();
    return request<PaginatedResponse<AdminUser>>(`/admin/users${q ? `?${q}` : ''}`);
  },
 
  getUser: (id: string) =>
    request<{ user: AdminUser; subscription: AdminSubscription | null }>(`/admin/users/${id}`),
 
  suspendUser: (id: string) =>
    request<void>(`/admin/users/${id}/suspend`, { method: 'POST' }),
 
  reactivateUser: (id: string) =>
    request<void>(`/admin/users/${id}/reactivate`, { method: 'POST' }),
 
  setUserRole: (id: string, role: string) =>
    request<void>(`/admin/users/${id}/role`, { method: 'POST', body: JSON.stringify({ role }) }),
 
  // Workshops
  setFeatured: (id: string, featured: boolean) =>
    request<void>(`/admin/workshops/${id}/featured`, { method: 'POST', body: JSON.stringify({ featured }) }),
 
  suspendWorkshop: (id: string) =>
    request<void>(`/admin/workshops/${id}/suspend`, { method: 'POST' }),
 
  activateWorkshop: (id: string) =>
    request<void>(`/admin/workshops/${id}/activate`, { method: 'POST' }),
 
  // Billing
  listSubscriptions: (params?: { page?: number; limit?: number; tier?: string }) => {
    const q = new URLSearchParams(
      Object.fromEntries(Object.entries(params ?? {}).filter(([, v]) => v !== undefined)) as any,
    ).toString();
    return request<PaginatedResponse<AdminSubscription>>(`/admin/billing/subscriptions${q ? `?${q}` : ''}`);
  },
};
 
// ── CRM API ───────────────────────────────────────────────────
 
export interface CrmCustomer {
  ownerId: string;
  ownerName: string;
  totalFixJobs: number;
  totalSpend: number;
  lastVisitAt: string | null;
  firstVisitAt: string | null;
}
 
export interface CrmNote {
  id: string;
  type: 'GENERAL' | 'PREFERENCE' | 'WARNING' | 'FOLLOWUP';
  content: string;
  vehicleHash?: string | null;
  inspectionId?: string | null;
  fixJobId?: string | null;
  createdAt: string;
  updatedAt: string;
}
 
export interface CrmCustomerProfile {
  ownerId: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string | null;
  totalInspections: number;
  totalFixJobs: number;
  totalSpend: number;
  lastVisitAt: string | null;
  firstVisitAt: string | null;
  vehicles: Array<{ hash: string; make: string; model: string; year: number; licensePlate: string }>;
  notes: CrmNote[];
  jobs: any[];
}
 
export const crmApi = {
  listCustomers: (params?: { page?: number; limit?: number; search?: string }) => {
    const q = new URLSearchParams(
      Object.fromEntries(Object.entries(params ?? {}).filter(([, v]) => v !== undefined)) as any,
    ).toString();
    return request<{ customers: CrmCustomer[]; total: number }>(`/crm/customers${q ? `?${q}` : ''}`);
  },
 
  getCustomer: (ownerId: string) =>
    request<CrmCustomerProfile>(`/crm/customers/${ownerId}`),
 
  createNote: (ownerId: string, payload: { type: CrmNote['type']; content: string; vehicleHash?: string; inspectionId?: string; fixJobId?: string }) =>
    request<CrmNote>(`/crm/customers/${ownerId}/notes`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
 
  updateNote: (noteId: string, payload: { type?: CrmNote['type']; content?: string }) =>
    request<CrmNote>(`/crm/notes/${noteId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
 
  deleteNote: (noteId: string) =>
    request<void>(`/crm/notes/${noteId}`, { method: 'DELETE' }),
 
  getRecentCustomers: (limit = 5) =>
    request<CrmCustomer[]>(`/crm/customers/recent?limit=${limit}`),
};

// ============================================================
// INVOICING API
// Quotes, invoices, the reusable line-item catalog, manual
// payment records, and financial reports.
// ============================================================

function toQs(params?: Record<string, unknown>): string {
  if (!params) return '';
  const q = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== '')) as any,
  ).toString();
  return q ? `?${q}` : '';
}

export interface LineItemInput {
  catalogItemId?: string;
  description: string;
  kind?: CatalogItemKind;
  quantity: number;
  unit: string;
  unitPrice: number;
}

export interface QuoteInput {
  customerName: string;
  customerContact: string;
  customerAddress?: string;
  ownerId?: string;
  vehicleHash?: string;
  vehicleDescription?: string;
  currency?: string;
  taxRate?: number;
  discountAmount?: number;
  notes?: string;
  validUntil?: string;
  lineItems: LineItemInput[];
}

export interface InvoiceInput {
  customerName: string;
  customerContact: string;
  customerAddress?: string;
  ownerId?: string;
  vehicleHash?: string;
  vehicleDescription?: string;
  currency?: string;
  taxRate?: number;
  discountAmount?: number;
  notes?: string;
  dueDate?: string;
  lineItems: LineItemInput[];
}

// PDF endpoints return a binary body — request<T>() always calls
// .json()/.text(), so this bypasses it and does its own fetch +
// blob handling, downloading the file via an object URL.
async function downloadPdf(path: string, filename: string): Promise<void> {
  const token = getAccessToken();
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new ApiClientError(
      response.status,
      data?.error ?? 'Error',
      data?.message ?? `Failed to download ${filename}`,
    );
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export const invoicingApi = {
  // ── Catalog ──────────────────────────────────────────────────
  listCatalogItems: (params?: { page?: number; limit?: number; search?: string; kind?: CatalogItemKind; sort?: 'usage' | 'recent' | 'alpha' }) =>
    request<PaginatedResponse<CatalogItem>>(`/invoicing/catalog/items${toQs(params)}`),

  getCatalogItem: (id: string) =>
    request<CatalogItem>(`/invoicing/catalog/items/${id}`),

  createCatalogItem: (payload: { description: string; kind?: CatalogItemKind; category?: string; defaultUnit?: string; defaultUnitPrice?: number }) =>
    request<CatalogItem>('/invoicing/catalog/items', { method: 'POST', body: JSON.stringify(payload) }),

  updateCatalogItem: (id: string, payload: Partial<{ description: string; kind: CatalogItemKind; category: string | null; defaultUnit: string; defaultUnitPrice: number; isActive: boolean }>) =>
    request<CatalogItem>(`/invoicing/catalog/items/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),

  deleteCatalogItem: (id: string) =>
    request<void>(`/invoicing/catalog/items/${id}`, { method: 'DELETE' }),

  // ── Quotes ───────────────────────────────────────────────────
  listQuotes: (params?: { page?: number; limit?: number; search?: string; status?: QuoteStatus }) =>
    request<PaginatedResponse<Quote>>(`/invoicing/quotes${toQs(params)}`),

  getQuote: (id: string) =>
    request<Quote>(`/invoicing/quotes/${id}`),

  createQuote: (payload: QuoteInput) =>
    request<Quote>('/invoicing/quotes', { method: 'POST', body: JSON.stringify(payload) }),

  updateQuote: (id: string, payload: Partial<QuoteInput>) =>
    request<Quote>(`/invoicing/quotes/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),

  deleteQuote: (id: string) =>
    request<void>(`/invoicing/quotes/${id}`, { method: 'DELETE' }),

  sendQuote: (id: string) =>
    request<Quote>(`/invoicing/quotes/${id}/send`, { method: 'POST' }),

  acceptQuote: (id: string) =>
    request<Quote>(`/invoicing/quotes/${id}/accept`, { method: 'POST' }),

  rejectQuote: (id: string, rejectionReason?: string) =>
    request<Quote>(`/invoicing/quotes/${id}/reject`, { method: 'POST', body: JSON.stringify({ rejectionReason }) }),

  convertQuoteToInvoice: (id: string, payload?: { dueDate?: string; notes?: string }) =>
    request<Invoice>(`/invoicing/quotes/${id}/convert-to-invoice`, { method: 'POST', body: JSON.stringify(payload ?? {}) }),

  downloadQuotePdf: (id: string, quoteNumber: string) =>
    downloadPdf(`/invoicing/quotes/${id}/pdf?download=1`, `Quote-${quoteNumber}.pdf`),

  // ── Invoices ─────────────────────────────────────────────────
  listInvoices: (params?: { page?: number; limit?: number; search?: string; status?: InvoiceStatus }) =>
    request<PaginatedResponse<Invoice>>(`/invoicing/invoices${toQs(params)}`),

  getInvoice: (id: string) =>
    request<Invoice>(`/invoicing/invoices/${id}`),

  createInvoice: (payload: InvoiceInput) =>
    request<Invoice>('/invoicing/invoices', { method: 'POST', body: JSON.stringify(payload) }),

  updateInvoice: (id: string, payload: Partial<InvoiceInput>) =>
    request<Invoice>(`/invoicing/invoices/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),

  deleteInvoice: (id: string) =>
    request<void>(`/invoicing/invoices/${id}`, { method: 'DELETE' }),

  sendInvoice: (id: string) =>
    request<Invoice>(`/invoicing/invoices/${id}/send`, { method: 'POST' }),

  voidInvoice: (id: string, voidReason?: string) =>
    request<Invoice>(`/invoicing/invoices/${id}/void`, { method: 'POST', body: JSON.stringify({ voidReason }) }),

  downloadInvoicePdf: (id: string, invoiceNumber: string) =>
    downloadPdf(`/invoicing/invoices/${id}/pdf?download=1`, `Invoice-${invoiceNumber}.pdf`),

  // ── Payments ─────────────────────────────────────────────────
  listPayments: (invoiceId: string) =>
    request<Payment[]>(`/invoicing/invoices/${invoiceId}/payments`),

  recordPayment: (invoiceId: string, payload: { amount: number; method: PaymentMethod; paidAt?: string; reference?: string; note?: string }) =>
    request<{ payment: Payment; invoice: Invoice }>(`/invoicing/invoices/${invoiceId}/payments`, { method: 'POST', body: JSON.stringify(payload) }),

  deletePayment: (id: string) =>
    request<void>(`/invoicing/payments/${id}`, { method: 'DELETE' }),

  // ── Reports ──────────────────────────────────────────────────
  getFinancialSummary: (params?: { from?: string; to?: string }) =>
    request<FinancialSummary>(`/invoicing/reports/summary${toQs(params)}`),

  getFinancialTrend: (params?: { from?: string; to?: string }) =>
    request<FinancialTrendPoint[]>(`/invoicing/reports/trend${toQs(params)}`),

  getTopCustomers: (params?: { from?: string; to?: string; limit?: number }) =>
    request<TopCustomer[]>(`/invoicing/reports/top-customers${toQs(params)}`),
};