// ============================================================
// @motacare/ai-client — public API
// ============================================================

export { getAnthropicClient, MOTACARE_MODEL, AiError } from './client';
export { generateDynamicChecklist } from './checklist-generator';
export { generateInspectionSummary } from './inspection-summary';
export { STATIC_CHECKLIST } from './static-checklist-ref';

export type { VehicleContext, DynamicChecklistOptions, DynamicChecklistResult, DynamicChecklistCategory, DynamicChecklistItem } from './checklist-generator';
export type { InspectionSummaryInput, AiInspectionSummary, InspectionItemResult } from './inspection-summary';
export type { ChecklistCategory, ChecklistItem } from './static-checklist-ref';