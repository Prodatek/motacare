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
}