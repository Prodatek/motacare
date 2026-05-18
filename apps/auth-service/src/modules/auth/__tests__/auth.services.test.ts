import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthService, ConflictError, UnauthorizedError } from '../auth.service';

// ============================================================
// AUTH SERVICE TESTS
// We mock the DB layer so tests run without a real database.
// ============================================================

// Mock the db module
vi.mock('../../../db', () => ({
  db: {
    query: {
      users: {
        findFirst: vi.fn(),
      },
      refreshTokens: {
        findFirst: vi.fn(),
      },
    },
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(() => Promise.resolve([mockUser])),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve()),
      })),
    })),
  },
}));

vi.mock('../../../config/env', () => ({
  env: {
    JWT_SECRET: 'test-secret-that-is-long-enough-for-testing',
    JWT_EXPIRES_IN: '15m',
    BCRYPT_SALT_ROUNDS: 1, // Fast hashing in tests
    NODE_ENV: 'test',
  },
}));

const mockUser = {
  id: 'user-uuid-123',
  email: 'test@motacare.com',
  passwordHash: '$2a$01$test',
  firstName: 'John',
  lastName: 'Doe',
  phone: null,
  role: 'OWNER',
  subscriptionTier: 'FREE',
  workshopName: null,
  workshopAddress: null,
  isActive: true,
  isEmailVerified: false,
  emailVerificationToken: 'token123',
  createdAt: new Date(),
  updatedAt: new Date(),
  lastLoginAt: null,
};

const mockSign = vi.fn(() => 'mock.jwt.token');

describe('AuthService', () => {
  let authService: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    authService = new AuthService(mockSign);
  });

  // ----------------------------------------------------------

  describe('register()', () => {
    it('should throw ConflictError if email already exists', async () => {
      const { db } = await import('../../../db');
      vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(mockUser as any);

      await expect(
        authService.register({
          email: 'test@motacare.com',
          password: 'Password1',
          firstName: 'John',
          lastName: 'Doe',
          role: 'OWNER',
        }),
      ).rejects.toThrow(ConflictError);
    });

    it('should throw ValidationError if FIXER has no workshopName', async () => {
      const { db } = await import('../../../db');
      vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(undefined as any);

      await expect(
        authService.register({
          email: 'fixer@motacare.com',
          password: 'Password1',
          firstName: 'Jane',
          lastName: 'Smith',
          role: 'FIXER',
          // workshopName intentionally missing
        }),
      ).rejects.toThrow('Workshop name is required');
    });

    it('should return user and tokens on successful registration', async () => {
      const { db } = await import('../../../db');
      vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(undefined as any);

      const result = await authService.register({
        email: 'new@motacare.com',
        password: 'Password1',
        firstName: 'New',
        lastName: 'User',
        role: 'OWNER',
      });

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('tokens');
      expect(result.user).not.toHaveProperty('passwordHash');
      expect(result.user).not.toHaveProperty('emailVerificationToken');
      expect(result.tokens.accessToken).toBe('mock.jwt.token');
    });
  });

  // ----------------------------------------------------------

  describe('sanitizeUser()', () => {
    it('should never expose passwordHash or emailVerificationToken', async () => {
      const { db } = await import('../../../db');
      vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(undefined as any);

      const result = await authService.register({
        email: 'safe@motacare.com',
        password: 'Password1',
        firstName: 'Safe',
        lastName: 'User',
        role: 'OWNER',
      });

      expect(result.user).not.toHaveProperty('passwordHash');
      expect(result.user).not.toHaveProperty('emailVerificationToken');
    });
  });
});