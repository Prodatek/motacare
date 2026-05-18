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
}