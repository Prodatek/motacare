import { describe, expect, it } from 'vitest';
import { completeInspectionSchema } from '../inspection.schema';

describe('completeInspectionSchema', () => {
  it('accepts the legacy summary-only payload and normalizes it to COMPLETED', () => {
    const parsed = completeInspectionSchema.safeParse({ summary: 'Vehicle passed inspection' });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data).toEqual({
        outcome: 'COMPLETED',
        summary: 'Vehicle passed inspection',
      });
    }
  });

  it('accepts the newer outcome-based payload', () => {
    const parsed = completeInspectionSchema.safeParse({
      outcome: 'NEEDS_FOLLOWUP',
      summary: 'Needs brake repair',
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data).toEqual({
        outcome: 'NEEDS_FOLLOWUP',
        summary: 'Needs brake repair',
      });
    }
  });
});
