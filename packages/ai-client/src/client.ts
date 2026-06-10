import Anthropic from '@anthropic-ai/sdk';

// ============================================================
// ANTHROPIC CLIENT
// Single shared instance used by all AI features.
// Configured with sensible defaults for a production service.
// ============================================================

let _client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      throw new Error(
        'ANTHROPIC_API_KEY is not set. Add it to your .env file.',
      );
    }

    _client = new Anthropic({
      apiKey,
      maxRetries: 2,          // Retry transient errors automatically
      timeout: 30_000,        // 30s timeout — inspection checklist must be fast
    });
  }
  return _client;
}

// ============================================================
// MODEL CONSTANT
// All AI features use the same model for consistency.
// Update here to upgrade across the whole app.
// ============================================================

export const MOTACARE_MODEL = 'claude-sonnet-4-20250514';

// ============================================================
// SHARED AI ERROR
// ============================================================

export class AiError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'AiError';
  }
}