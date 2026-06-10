import { describe, it, expect } from 'vitest';
import {
  STATIC_CHECKLIST,
  ALL_CHECK_IDS,
  CHECK_ID_TO_CATEGORY,
  buildInitialInspectionItems,
  computeChecklistStats,
} from '../checklist';

// ============================================================
// CHECKLIST INTEGRITY TESTS
// These tests protect against accidental changes to the
// checklist structure that would break existing inspections.
// ============================================================

describe('STATIC_CHECKLIST', () => {

  it('has exactly 8 categories', () => {
    expect(STATIC_CHECKLIST).toHaveLength(8);
  });

  it('categories are ordered sequentially from 1', () => {
    STATIC_CHECKLIST.forEach((cat, idx) => {
      expect(cat.order).toBe(idx + 1);
    });
  });

  it('every category has at least 3 items', () => {
    STATIC_CHECKLIST.forEach((cat) => {
      expect(cat.items.length).toBeGreaterThanOrEqual(3);
    });
  });

  it('all check IDs are unique across the entire checklist', () => {
    const seen = new Set<string>();
    for (const id of ALL_CHECK_IDS) {
      expect(seen.has(id), `Duplicate check ID: ${id}`).toBe(false);
      seen.add(id);
    }
  });

  it('all check IDs are snake_case', () => {
    const snakeCaseRegex = /^[a-z][a-z0-9_]*$/;
    ALL_CHECK_IDS.forEach((id) => {
      expect(id, `Check ID '${id}' is not snake_case`).toMatch(snakeCaseRegex);
    });
  });

  it('every item has a non-empty description', () => {
    STATIC_CHECKLIST.forEach((cat) => {
      cat.items.forEach((item) => {
        expect(item.description.length, `Item '${item.id}' has empty description`).toBeGreaterThan(20);
      });
    });
  });

  it('every item has a valid severity', () => {
    const validSeverities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
    STATIC_CHECKLIST.forEach((cat) => {
      cat.items.forEach((item) => {
        expect(validSeverities, `Item '${item.id}' has invalid severity`).toContain(item.severity);
      });
    });
  });

  it('CHECK_ID_TO_CATEGORY maps every check ID to a category', () => {
    ALL_CHECK_IDS.forEach((id) => {
      expect(CHECK_ID_TO_CATEGORY[id], `No category mapping for: ${id}`).toBeDefined();
    });
  });

  it('brake-related items are HIGH or CRITICAL severity', () => {
    const brakeCategory = STATIC_CHECKLIST.find((c) => c.id === 'brakes');
    expect(brakeCategory).toBeDefined();
    brakeCategory!.items.forEach((item) => {
      expect(['HIGH', 'MEDIUM', 'CRITICAL']).toContain(item.severity);
    });
  });
});

// ============================================================
// buildInitialInspectionItems
// ============================================================

describe('buildInitialInspectionItems()', () => {
  const FAKE_INSPECTION_ID = 'test-inspection-uuid';

  it('creates one item per checklist entry', () => {
    const items = buildInitialInspectionItems(FAKE_INSPECTION_ID);
    expect(items).toHaveLength(ALL_CHECK_IDS.length);
  });

  it('seeds all items as NOT_CHECKED', () => {
    const items = buildInitialInspectionItems(FAKE_INSPECTION_ID);
    items.forEach((item) => {
      expect(item.status).toBe('NOT_CHECKED');
    });
  });

  it('attaches the correct inspectionId to every item', () => {
    const items = buildInitialInspectionItems(FAKE_INSPECTION_ID);
    items.forEach((item) => {
      expect(item.inspectionId).toBe(FAKE_INSPECTION_ID);
    });
  });

  it('seeds empty notes and mediaUrls', () => {
    const items = buildInitialInspectionItems(FAKE_INSPECTION_ID);
    items.forEach((item) => {
      expect(item.notes).toBeNull();
      expect(item.mediaUrls).toEqual([]);
    });
  });
});

// ============================================================
// computeChecklistStats
// ============================================================

describe('computeChecklistStats()', () => {
  const makeItems = (statuses: Array<{ status: string; severity: string | null; checkName: string }>) =>
    statuses;

  it('counts passed, failed, warnings, and not checked correctly', () => {
    const items = makeItems([
      { status: 'PASS', severity: null, checkName: 'Oil Level' },
      { status: 'PASS', severity: null, checkName: 'Oil Condition' },
      { status: 'FAIL', severity: 'HIGH', checkName: 'Brake Pads' },
      { status: 'WARNING', severity: 'MEDIUM', checkName: 'Air Filter' },
      { status: 'NOT_CHECKED', severity: null, checkName: 'Horn' },
    ]);

    const stats = computeChecklistStats(items);

    expect(stats.total).toBe(5);
    expect(stats.passed).toBe(2);
    expect(stats.failed).toBe(1);
    expect(stats.warnings).toBe(1);
    expect(stats.notChecked).toBe(1);
    expect(stats.criticalFails).toHaveLength(0);
  });

  it('identifies CRITICAL failures by name', () => {
    const items = makeItems([
      { status: 'FAIL', severity: 'CRITICAL', checkName: 'Brake Lines' },
      { status: 'FAIL', severity: 'CRITICAL', checkName: 'Wheel Nut Torque' },
      { status: 'FAIL', severity: 'HIGH', checkName: 'Oil Leaks' },
    ]);

    const stats = computeChecklistStats(items);

    expect(stats.criticalFails).toContain('Brake Lines');
    expect(stats.criticalFails).toContain('Wheel Nut Torque');
    expect(stats.criticalFails).not.toContain('Oil Leaks');
  });

  it('returns zero counts for an empty inspection', () => {
    const stats = computeChecklistStats([]);
    expect(stats.total).toBe(0);
    expect(stats.passed).toBe(0);
    expect(stats.criticalFails).toHaveLength(0);
  });

  it('flags an all-passed inspection with no critical fails', () => {
    const items = Array.from({ length: 10 }, (_, i) => ({
      status: 'PASS',
      severity: null,
      checkName: `Check ${i}`,
    }));

    const stats = computeChecklistStats(items);
    expect(stats.passed).toBe(10);
    expect(stats.failed).toBe(0);
    expect(stats.criticalFails).toHaveLength(0);
  });
});