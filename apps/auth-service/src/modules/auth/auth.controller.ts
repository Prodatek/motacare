import type { FastifyRequest, FastifyReply } from 'fastify';
import { AuthService, ConflictError, UnauthorizedError, ValidationError, NotFoundError } from './auth.service';
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  changePasswordSchema,
} from './auth.schema';

// ============================================================
// AUTH CONTROLLER
// Handles request parsing, delegates to AuthService,
// maps service errors to HTTP responses.
// ============================================================

export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // POST /auth/register
  async register(request: FastifyRequest, reply: FastifyReply) {
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Validation Error',
        message: 'Invalid request body',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    try {
      const result = await this.authService.register(parsed.data);
      return reply.status(201).send({
        statusCode: 201,
        message: 'Account created successfully',
        data: result,
      });
    } catch (error) {
      return this.handleError(error, reply);
    }
  }

  // POST /auth/login
  async login(request: FastifyRequest, reply: FastifyReply) {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Validation Error',
        message: 'Invalid request body',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    try {
      const result = await this.authService.login(parsed.data, {
        userAgent: request.headers['user-agent'],
        ipAddress: request.ip,
      });
      return reply.status(200).send({
        statusCode: 200,
        message: 'Login successful',
        data: result,
      });
    } catch (error) {
      return this.handleError(error, reply);
    }
  }

  // POST /auth/refresh
  async refresh(request: FastifyRequest, reply: FastifyReply) {
    const parsed = refreshTokenSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Validation Error',
        message: 'refreshToken is required',
      });
    }

    try {
      const tokens = await this.authService.refreshTokens(parsed.data.refreshToken);
      return reply.status(200).send({
        statusCode: 200,
        message: 'Tokens refreshed',
        data: tokens,
      });
    } catch (error) {
      return this.handleError(error, reply);
    }
  }

  // POST /auth/logout
  async logout(request: FastifyRequest, reply: FastifyReply) {
    const parsed = refreshTokenSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Validation Error',
        message: 'refreshToken is required',
      });
    }

    try {
      await this.authService.logout(parsed.data.refreshToken);
      return reply.status(200).send({
        statusCode: 200,
        message: 'Logged out successfully',
      });
    } catch (error) {
      return this.handleError(error, reply);
    }
  }

  // GET /auth/me  (protected route)
  async getProfile(request: FastifyRequest, reply: FastifyReply) {
    try {
      // userId is injected by the authenticate middleware
      const userId = (request.user as { sub: string }).sub;
      const user = await this.authService.getProfile(userId);
      return reply.status(200).send({
        statusCode: 200,
        data: user,
      });
    } catch (error) {
      return this.handleError(error, reply);
    }
  }

  // ----------------------------------------------------------
  // ERROR HANDLER — maps domain errors to HTTP status codes
  // ----------------------------------------------------------

  private handleError(error: unknown, reply: FastifyReply) {
    if (error instanceof ConflictError) {
      return reply.status(409).send({ statusCode: 409, error: 'Conflict', message: error.message });
    }
    if (error instanceof UnauthorizedError) {
      return reply.status(401).send({ statusCode: 401, error: 'Unauthorized', message: error.message });
    }
    if (error instanceof ValidationError) {
      return reply.status(400).send({ statusCode: 400, error: 'Validation Error', message: error.message });
    }
    if (error instanceof NotFoundError) {
      return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: error.message });
    }

    // Unhandled error — log and return 500
    console.error('Unhandled error in auth controller:', error);
    return reply.status(500).send({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'An unexpected error occurred',
    });
  }
}