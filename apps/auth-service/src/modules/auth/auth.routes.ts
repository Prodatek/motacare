import type { FastifyInstance } from 'fastify';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

// ============================================================
// AUTH ROUTES
// All routes are prefixed with /auth (set in main.ts)
// ============================================================

export async function authRoutes(fastify: FastifyInstance) {
  const authService = new AuthService(fastify.jwt.sign.bind(fastify.jwt));
  const authController = new AuthController(authService);

  // ----------------------------------------------------------
  // PUBLIC ROUTES
  // ----------------------------------------------------------

  fastify.post(
    '/register',
    {
      schema: {
        tags: ['Auth'],
        summary: 'Register a new user account',
        body: {
          type: 'object',
          required: ['email', 'password', 'firstName', 'lastName'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 8 },
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            phone: { type: 'string' },
            role: { type: 'string', enum: ['OWNER', 'FIXER'] },
            workshopName: { type: 'string' },
            workshopAddress: { type: 'string' },
          },
        },
      },
    },
    (req, rep) => authController.register(req, rep),
  );

  fastify.post(
    '/login',
    {
      schema: {
        tags: ['Auth'],
        summary: 'Login with email and password',
        body: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string' },
          },
        },
      },
    },
    (req, rep) => authController.login(req, rep),
  );

  fastify.post(
    '/refresh',
    {
      schema: {
        tags: ['Auth'],
        summary: 'Get a new access token using a refresh token',
        body: {
          type: 'object',
          required: ['refreshToken'],
          properties: {
            refreshToken: { type: 'string' },
          },
        },
      },
    },
    (req, rep) => authController.refresh(req, rep),
  );

  fastify.post(
    '/logout',
    {
      schema: {
        tags: ['Auth'],
        summary: 'Logout and revoke the refresh token',
        body: {
          type: 'object',
          required: ['refreshToken'],
          properties: {
            refreshToken: { type: 'string' },
          },
        },
      },
    },
    (req, rep) => authController.logout(req, rep),
  );

  // ----------------------------------------------------------
  // PROTECTED ROUTES — require a valid JWT
  // ----------------------------------------------------------

  fastify.get(
    '/me',
    {
      onRequest: [fastify.authenticate],
      schema: {
        tags: ['Auth'],
        summary: 'Get the currently authenticated user profile',
        security: [{ bearerAuth: [] }],
      },
    },
    (req, rep) => authController.getProfile(req, rep),
  );

  // ----------------------------------------------------------
  // INTERNAL ROUTES
  // Only reachable inside the Docker network — not exposed publicly.
  // Used by other services for cross-service lookups.
  // ----------------------------------------------------------

  // Used by vehicle-service during ownership transfer
  fastify.post(
    '/internal/user-by-email',
    {
      schema: {
        tags: ['Internal'],
        summary: 'Internal: look up a user ID by email address',
        hide: true, // Hidden from public Swagger docs
        body: {
          type: 'object',
          required: ['email'],
          properties: { email: { type: 'string', format: 'email' } },
        },
      },
    },
    async (request, reply) => {
      const { email } = request.body as { email: string };
      const { eq } = await import('drizzle-orm');
      const { db } = await import('../../db');
      const { users } = await import('../../db/schema');

      const user = await db.query.users.findFirst({
        where: eq(users.email, email.toLowerCase()),
        columns: { id: true, email: true, firstName: true, lastName: true, role: true, isActive: true },
      });

      if (!user || !user.isActive) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'User not found' });
      }

      return reply.status(200).send({ statusCode: 200, data: user });
    },
  );
   // Used by alert-service to resolve user email + name for notifications
  fastify.post(
    '/internal/user-by-id',
    {
      schema: {
        tags: ['Internal'],
        summary: 'Internal: look up a user by their ID',
        hide: true,
        body: {
          type: 'object',
          required: ['userId'],
          properties: { userId: { type: 'string', format: 'uuid' } },
        },
      },
    },
    async (request, reply) => {
      const { userId } = request.body as { userId: string };
      const { eq } = await import('drizzle-orm');
      const { db } = await import('../../db');
      const { users } = await import('../../db/schema');
 
      const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
        columns: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
        },
      });
 
      if (!user || !user.isActive) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'User not found',
        });
      }
 
      return reply.status(200).send({ statusCode: 200, data: user });
    },
  );

  // Called by workshop-service when a fixer is approved / leaves
  
  fastify.post(
    '/internal/update-user-role',
    { schema: { hide: true } },
    async (request, reply) => {
      const { userId, role, workshopId } = request.body as {
        userId: string;
        role: 'FIXER' | 'WORKSHOP_ADMIN';
        workshopId: string | null;
      };
 
      const { eq } = await import('drizzle-orm');
      const { db } = await import('../../db');
      const { users } = await import('../../db/schema');
 
      await db
        .update(users)
        .set({
          role:        role as any,
          workshopId:  workshopId,
          updatedAt:   new Date(),
        })
        .where(eq(users.id, userId));
 
      return reply.status(200).send({ statusCode: 200, message: 'Role updated' });
    },
  );

  // Internal: look up a user by ID (used by other services to display names)
  fastify.get(
    '/internal/user/:id',
    {
      schema: {
        tags: ['Internal'],
        summary: 'Internal: look up a user by id',
        hide: true,
        params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      },
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const { eq } = await import('drizzle-orm');
        const { db } = await import('../../db');
        const { users } = await import('../../db/schema');

        const user = await db.query.users.findFirst({
          where: eq(users.id, id),
          columns: { id: true, firstName: true, lastName: true, role: true, isActive: true },
        });

        if (!user || !user.isActive) {
          return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'User not found' });
        }

        return reply.status(200).send({ statusCode: 200, data: user });
      } catch (err) {
        console.error('Internal user lookup failed:', err);
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Lookup failed' });
      }
    },
  );
  fastify.get('/auth/internal/users', async (request, reply) => {
    const { page = '1', limit = '20', role, search, isActive, sort } = request.query as any;
    const { eq, ilike, and, desc, asc, count, or } = await import('drizzle-orm');
    const { db } = await import('../../db');
    const { users } = await import('../../db/schema');
 
    const conditions: any[] = [];
    if (role)     conditions.push(eq(users.role, role));
    if (isActive !== undefined) conditions.push(eq(users.isActive, isActive === 'true'));
    if (search) conditions.push(or(
      ilike(users.email, `%${search}%`),
      ilike(users.firstName, `%${search}%`),
      ilike(users.lastName, `%${search}%`),
    ));
 
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const pageNum = Number(page);
    const limitNum = Math.min(Number(limit), 100);
    const offset = (pageNum - 1) * limitNum;
 
    const [rows, [{ value: total }]] = await Promise.all([
      db.select({
        id: users.id, email: users.email, firstName: users.firstName,
        lastName: users.lastName, role: users.role, isActive: users.isActive,
        createdAt: users.createdAt, subscriptionTier: users.subscriptionTier,
      }).from(users).where(where).orderBy(desc(users.createdAt)).limit(limitNum).offset(offset),
      db.select({ value: count() }).from(users).where(where),
    ]);
 
    return reply.status(200).send({
      statusCode: 200,
      data: rows,
      pagination: { total: Number(total), page: pageNum, limit: limitNum, totalPages: Math.ceil(Number(total) / limitNum) },
    });
  });

   fastify.post('/auth/internal/set-user-active', async (request, reply) => {
    const { userId, isActive } = request.body as { userId: string; isActive: boolean };
    const { eq } = await import('drizzle-orm');
    const { db } = await import('../../db');
    const { users } = await import('../../db/schema');
    await db.update(users).set({ isActive, updatedAt: new Date() }).where(eq(users.id, userId));
    return reply.status(200).send({ statusCode: 200, message: isActive ? 'User reactivated' : 'User suspended' });
  });


   // ── GET ALL USERS (admin-service) ───────────────────────────
  fastify.get('/internal/users', { schema: { hide: true } }, async (request, reply) => {
    const {
      page = '1', limit = '20', role, search, isActive, sort = 'createdAt:desc',
    } = request.query as Record<string, string>;
 
    const { eq, ilike, and, desc, count, or, sql } = await import('drizzle-orm');
    const { db } = await import('../../db');
    const { users } = await import('../../db/schema');
 
    const conditions: any[] = [];
    if (role)     conditions.push(eq(users.role as any, role));
    if (isActive !== undefined) conditions.push(eq(users.isActive, isActive === 'true'));
    if (search) {
      conditions.push(or(
        ilike(users.email,     `%${search}%`),
        ilike(users.firstName, `%${search}%`),
        ilike(users.lastName,  `%${search}%`),
      ));
    }
 
    const where    = conditions.length > 0 ? and(...conditions) : undefined;
    const pageNum  = Math.max(1, Number(page));
    const limitNum = Math.min(100, Math.max(1, Number(limit)));
    const offset   = (pageNum - 1) * limitNum;
 
    const [rows, [{ value: total }]] = await Promise.all([
      db
        .select({
          id:               users.id,
          email:            users.email,
          firstName:        users.firstName,
          lastName:         users.lastName,
          role:             users.role,
          isActive:         users.isActive,
          subscriptionTier: users.subscriptionTier,
          workshopId:       users.workshopId,
          createdAt:        users.createdAt,
          lastLoginAt:      users.lastLoginAt,
        })
        .from(users)
        .where(where)
        .orderBy(desc(users.createdAt))
        .limit(limitNum)
        .offset(offset),
      db.select({ value: count() }).from(users).where(where),
    ]);
 
    return reply.status(200).send({
      statusCode: 200,
      data: rows,
      pagination: {
        total:      Number(total),
        page:       pageNum,
        limit:      limitNum,
        totalPages: Math.ceil(Number(total) / limitNum),
      },
    });
  });
 
  // ── GET USER BY ID (workshop-service, admin-service) ────────
  fastify.post('/internal/user-by-id', { schema: { hide: true } }, async (request, reply) => {
    const { userId } = request.body as { userId: string };
    if (!userId) {
      return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'userId required' });
    }
    const { eq } = await import('drizzle-orm');
    const { db } = await import('../../db');
    const { users } = await import('../../db/schema');
 
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: {
        id: true, email: true, firstName: true, lastName: true,
        role: true, phone: true, isActive: true, workshopId: true,
        subscriptionTier: true, createdAt: true,
        passwordHash: false, emailVerificationToken: false,
      },
    });
 
    if (!user) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'User not found' });
    return reply.status(200).send({ statusCode: 200, data: user });
  });
 
  // ── SUSPEND / REACTIVATE USER (admin-service) ────────────────
  fastify.post('/internal/set-user-active', { schema: { hide: true } }, async (request, reply) => {
    const { userId, isActive } = request.body as { userId: string; isActive: boolean };
    if (!userId || isActive === undefined) {
      return reply.status(400).send({ statusCode: 400, message: 'userId and isActive required' });
    }
    const { eq } = await import('drizzle-orm');
    const { db } = await import('../../db');
    const { users } = await import('../../db/schema');
 
    await db
      .update(users)
      .set({ isActive, updatedAt: new Date() })
      .where(eq(users.id, userId));
 
    return reply.status(200).send({
      statusCode: 200,
      message: isActive ? 'User reactivated successfully' : 'User suspended successfully',
    });
  });
 
  // ── CHANGE USER ROLE (admin-service, workshop-service) ────────
  fastify.post('/internal/update-user-role', { schema: { hide: true } }, async (request, reply) => {
    const { userId, role, workshopId = null } = request.body as {
      userId: string;
      role: string;
      workshopId?: string | null;
    };
    if (!userId || !role) {
      return reply.status(400).send({ statusCode: 400, message: 'userId and role required' });
    }
    const { eq } = await import('drizzle-orm');
    const { db } = await import('../../db');
    const { users } = await import('../../db/schema');
 
    await db
      .update(users)
      .set({ role: role as any, workshopId: workshopId ?? null, updatedAt: new Date() })
      .where(eq(users.id, userId));
 
    return reply.status(200).send({ statusCode: 200, message: 'Role updated' });
  });
 
  // ── PLATFORM STATS (admin-service) ───────────────────────────
  fastify.get('/internal/stats', { schema: { hide: true } }, async (_request, reply) => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
 
    const { sql, gte, count } = await import('drizzle-orm');
    const { db } = await import('../../db');
    const { users } = await import('../../db/schema');
 
    const [totals, monthly] = await Promise.all([
      db.select({
        total: count(users.id),
        byRole: sql<string>`json_build_object(
          'OWNER',          COUNT(*) FILTER (WHERE role = 'OWNER'),
          'FIXER',          COUNT(*) FILTER (WHERE role = 'FIXER'),
          'WORKSHOP_ADMIN', COUNT(*) FILTER (WHERE role = 'WORKSHOP_ADMIN'),
          'ADMIN',          COUNT(*) FILTER (WHERE role = 'ADMIN')
        )`,
      }).from(users),
 
      db.select({ value: count() })
        .from(users)
        .where(gte(users.createdAt, startOfMonth)),
    ]);
 
    return reply.status(200).send({
      statusCode: 200,
      data: {
        total:        Number(totals[0]?.total ?? 0),
        byRole:       totals[0]?.byRole ?? {},
        newThisMonth: Number(monthly[0]?.value ?? 0),
      },
    });
  });
}