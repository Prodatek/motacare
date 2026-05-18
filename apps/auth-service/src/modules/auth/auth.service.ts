import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { eq, and } from 'drizzle-orm';
import { db } from '../../db';
import { users, refreshTokens, type User, type UserRole } from '../../db/schema';
import { env } from '../../config/env';
import type { RegisterInput, LoginInput } from './auth.schema';

// ============================================================
// TYPES
// ============================================================

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

export interface AuthResult {
  user: SafeUser;
  tokens: TokenPair;
}

// User object safe to return to the client (no password hash)
export type SafeUser = Omit<User, 'passwordHash' | 'emailVerificationToken'>;

// JWT sign function injected from Fastify — avoids circular dependency
export type SignFunction = (payload: object, options?: { expiresIn: string }) => string;

// ============================================================
// AUTH SERVICE
// ============================================================

export class AuthService {
  constructor(private readonly sign: SignFunction) {}

  // ----------------------------------------------------------
  // REGISTER
  // ----------------------------------------------------------

  async register(input: RegisterInput): Promise<AuthResult> {
    // 1. Check if email already exists
    const existing = await db.query.users.findFirst({
      where: eq(users.email, input.email.toLowerCase()),
    });

    if (existing) {
      throw new ConflictError('An account with this email already exists');
    }

    // 2. Validate fixer-specific fields
    if (input.role === 'FIXER' && !input.workshopName) {
      throw new ValidationError('Workshop name is required for fixer accounts');
    }

    // 3. Hash password
    const passwordHash = await bcrypt.hash(input.password, env.BCRYPT_SALT_ROUNDS);

    // 4. Create user
    const [newUser] = await db
      .insert(users)
      .values({
        email: input.email.toLowerCase(),
        passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone,
        role: input.role as UserRole,
        workshopName: input.workshopName,
        workshopAddress: input.workshopAddress,
        emailVerificationToken: crypto.randomBytes(32).toString('hex'),
      })
      .returning();

    // 5. Generate tokens
    const tokens = await this.generateTokenPair(newUser.id, newUser.role);

    return {
      user: this.sanitizeUser(newUser),
      tokens,
    };
  }

  // ----------------------------------------------------------
  // LOGIN
  // ----------------------------------------------------------

  async login(input: LoginInput, meta: { userAgent?: string; ipAddress?: string } = {}): Promise<AuthResult> {
    // 1. Find user
    const user = await db.query.users.findFirst({
      where: eq(users.email, input.email.toLowerCase()),
    });

    if (!user) {
      // Use same error as wrong password to prevent user enumeration
      throw new UnauthorizedError('Invalid email or password');
    }

    // 2. Check account is active
    if (!user.isActive) {
      throw new UnauthorizedError('This account has been deactivated');
    }

    // 3. Verify password
    const passwordMatch = await bcrypt.compare(input.password, user.passwordHash);
    if (!passwordMatch) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // 4. Update last login timestamp
    await db
      .update(users)
      .set({ lastLoginAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, user.id));

    // 5. Generate tokens (store refresh token with session metadata)
    const tokens = await this.generateTokenPair(user.id, user.role, meta);

    return {
      user: this.sanitizeUser(user),
      tokens,
    };
  }

  // ----------------------------------------------------------
  // REFRESH TOKENS
  // ----------------------------------------------------------

  async refreshTokens(token: string): Promise<TokenPair> {
    // 1. Find the stored refresh token
    const storedToken = await db.query.refreshTokens.findFirst({
      where: and(eq(refreshTokens.token, token), eq(refreshTokens.isRevoked, false)),
      with: { user: true },
    });

    if (!storedToken) {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }

    // 2. Check expiry
    if (new Date() > storedToken.expiresAt) {
      // Revoke it
      await db
        .update(refreshTokens)
        .set({ isRevoked: true })
        .where(eq(refreshTokens.id, storedToken.id));
      throw new UnauthorizedError('Refresh token has expired. Please log in again.');
    }

    // 3. Revoke old token (token rotation — each refresh issues a new pair)
    await db
      .update(refreshTokens)
      .set({ isRevoked: true })
      .where(eq(refreshTokens.id, storedToken.id));

    // 4. Find user and issue new pair
    const user = await db.query.users.findFirst({
      where: eq(users.id, storedToken.userId),
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedError('User not found or account deactivated');
    }

    return this.generateTokenPair(user.id, user.role);
  }

  // ----------------------------------------------------------
  // LOGOUT — revokes a specific refresh token
  // ----------------------------------------------------------

  async logout(token: string): Promise<void> {
    await db
      .update(refreshTokens)
      .set({ isRevoked: true })
      .where(eq(refreshTokens.token, token));
  }

  // ----------------------------------------------------------
  // GET PROFILE
  // ----------------------------------------------------------

  async getProfile(userId: string): Promise<SafeUser> {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    return this.sanitizeUser(user);
  }

  // ----------------------------------------------------------
  // PRIVATE HELPERS
  // ----------------------------------------------------------

  private async generateTokenPair(
    userId: string,
    role: string,
    meta: { userAgent?: string; ipAddress?: string } = {},
  ): Promise<TokenPair> {
    const accessToken = this.sign(
      { sub: userId, role },
      { expiresIn: env.JWT_EXPIRES_IN },
    );

    // Opaque refresh token stored in DB
    const rawRefreshToken = crypto.randomBytes(64).toString('hex');

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    await db.insert(refreshTokens).values({
      userId,
      token: rawRefreshToken,
      expiresAt,
      userAgent: meta.userAgent,
      ipAddress: meta.ipAddress,
    });

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      expiresIn: env.JWT_EXPIRES_IN,
    };
  }

  private sanitizeUser(user: User): SafeUser {
    const { passwordHash, emailVerificationToken, ...safe } = user;
    return safe;
  }
}

// ============================================================
// CUSTOM ERRORS — caught by the controller for clean HTTP responses
// ============================================================

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}

export class UnauthorizedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}