// ==============================================
// MOTACARE — Shared Types
// Used across all services and the frontend
// ==============================================

// ============================================================
// USER TYPES
// ============================================================

export type UserRole = 'OWNER' | 'FIXER' | 'WORKSHOP_ADMIN' | 'ADMIN';
export type SubscriptionTier = 'FREE' | 'PRO' | 'WORKSHOP';

export interface BaseUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  role: UserRole;
  subscriptionTier: SubscriptionTier;
  isActive: boolean;
  isEmailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date | null;
}

export interface FixerUser extends BaseUser {
  role: 'FIXER' | 'WORKSHOP_ADMIN';
  workshopId?: string | null;         // UUID of the workshop they belong to
  workshopName?: string | null;       // denormalised for convenience
}

export interface OwnerUser extends BaseUser {
  role: 'OWNER';
}

export type AnyUser = OwnerUser | FixerUser;

// ============================================================
// AUTH TYPES
// ============================================================

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

export interface JwtPayload {
  sub: string;      // user ID
  role: UserRole;
  iat: number;
  exp: number;
}

// ============================================================
// VEHICLE TYPES
// ============================================================

export type FuelType = 'PETROL' | 'DIESEL' | 'ELECTRIC' | 'HYBRID' | 'CNG' | 'LPG';
export type TransmissionType = 'MANUAL' | 'AUTOMATIC' | 'CVT';

export interface Vehicle {
  id: string;
  hash: string;             // Unique identifier: HMAC(VIN + ownerId)
  ownerId: string;
  vin: string;              // Vehicle Identification Number
  make: string;             // e.g. Toyota
  model: string;            // e.g. Camry
  year: number;
  color?: string | null;
  fuelType: FuelType;
  transmissionType: TransmissionType;
  engineCapacity?: string | null;  // e.g. "2.0L"
  licensePlate: string;
  mileageAtRegistration: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================
// INSPECTION TYPES
// ============================================================

export type InspectionStatus =
  | 'DRAFT'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'NEEDS_FOLLOWUP';

export type FixJobStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'AWAITING_PARTS'
  | 'COMPLETED'
  | 'DELIVERED'
  | 'CANCELLED';

export type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface InspectionItem {
  id: string;
  category: string;         // e.g. "Engine", "Brakes", "Tyres"
  checkName: string;        // e.g. "Engine oil level"
  status: 'PASS' | 'FAIL' | 'WARNING' | 'NOT_CHECKED';
  severity?: Severity | null;
  notes?: string | null;
  mediaUrls?: string[];     // Photos/videos from fixer
}

export interface Inspection {
  id: string;
  vehicleId: string;
  vehicleHash: string;
  fixerId: string;
  status: InspectionStatus;
  items: InspectionItem[];
  summary?: string | null;
  aiSummary?: string | null;  // Claude-generated summary (Phase 2)
  mileageAtInspection: number;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date | null;
}

export interface FixJob {
  id: string;
  inspectionId: string;
  vehicleId: string;
  fixerId: string;
  ownerId: string;
  status: FixJobStatus;
  description: string;
  estimatedCompletionAt?: Date | null;
  actualCompletionAt?: Date | null;
  estimatedCost?: number | null;
  finalCost?: number | null;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================
// API RESPONSE TYPES
// ============================================================

export interface ApiResponse<T = unknown> {
  statusCode: number;
  message?: string;
  data?: T;
}

export interface ApiError {
  statusCode: number;
  error: string;
  message: string;
  details?: Record<string, string[]>;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}


// ============================================================
// workshop UTILITY TYPES
// ============================================================

export type WorkshopStatus = 'PENDING_APPROVAL' | 'ACTIVE' | 'SUSPENDED';
export type MembershipStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'LEFT';
 
export interface Workshop {
  id: string;
  name: string;
  description: string | null;
  address: string;
  city: string;
  state: string;
  phone: string | null;
  email: string | null;
  logoUrl: string | null;
  coverImageUrl: string | null;
  specialties: string[];           // e.g. ['Engine', 'Electrical', 'Tyres']
  status: WorkshopStatus;
  adminId: string;                 // The WORKSHOP_ADMIN user's ID
  maxFixers: number;               // Always 5 in Phase 1
  currentFixerCount: number;       // Denormalised for fast listing
  featured: boolean;               // Admin-set, shows on landing page
  rating: number | null;           // Computed from completed fix jobs (Phase 3)
  totalInspections: number;        // Lifetime count
  totalFixJobs: number;            // Lifetime count
  createdAt: Date;
  updatedAt: Date;
}
 
export interface WorkshopMember {
  id: string;
  workshopId: string;
  fixerId: string;
  status: MembershipStatus;
  joinedAt: Date | null;
  leftAt: Date | null;
  rejectionReason: string | null;
  // Populated in list responses
  fixer?: Pick<BaseUser, 'id' | 'firstName' | 'lastName' | 'email'>;
}
 
// Stats returned by GET /workshops/:id/stats (workshop admin only)
export interface WorkshopStats {
  workshopId: string;
  period: { from: string; to: string };
 
  // Top-level
  totalInspections: number;
  completedInspections: number;
  totalFixJobs: number;
  completedFixJobs: number;
  deliveredFixJobs: number;
  totalRevenue: number;            // Sum of finalCost on delivered jobs
  currency: string;
 
  // Per-fixer breakdown
  byFixer: Array<{
    fixerId: string;
    fixerName: string;
    inspections: number;
    fixJobs: number;
    completedFixJobs: number;
    revenue: number;
    avgFixJobDurationHours: number | null;
  }>;
 
  // Over-time (weekly buckets for the period)
  trend: Array<{
    week: string;   // ISO date of Monday
    inspections: number;
    fixJobs: number;
    revenue: number;
  }>;
}