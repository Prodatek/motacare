import { getAnthropicClient, MOTACARE_MODEL, AiError } from './client';

// ============================================================
// TYPES
// ============================================================

export interface InspectionItemResult {
  category: string;
  checkName: string;
  status: 'PASS' | 'FAIL' | 'WARNING' | 'NOT_CHECKED';
  severity: string | null;
  notes: string | null;
}

export interface InspectionSummaryInput {
  vehicle: {
    make: string;
    model: string;
    year: number;
    mileageAtInspection: number;
    fuelType: string;
  };
  fixer: {
    firstName: string;
    workshopName?: string | null;
  };
  items: InspectionItemResult[];
  fixerSummary: string;           // The fixer's own written summary
  inspectionDate: string;
}

export interface AiInspectionSummary {
  headline: string;               // One-line verdict e.g. "Vehicle in fair condition — 3 issues need attention"
  overallCondition: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'UNSAFE';
  ownerFacingReport: string;      // Plain-English report for the vehicle owner
  criticalActions: string[];      // Immediate actions required (safety-critical)
  recommendedActions: string[];   // Should be done soon but not safety-critical
  advisoryNotes: string[];        // Good-to-know observations
  estimatedUrgency: 'IMMEDIATE' | 'WITHIN_WEEK' | 'WITHIN_MONTH' | 'ROUTINE';
  generatedAt: string;
}

// ============================================================
// PROMPT BUILDER
// ============================================================

function buildSummaryPrompt(input: InspectionSummaryInput): string {
  const { vehicle: v, fixer, items, fixerSummary } = input;

  const failed = items.filter((i) => i.status === 'FAIL');
  const warnings = items.filter((i) => i.status === 'WARNING');
  const passed = items.filter((i) => i.status === 'PASS');
  const criticalFails = failed.filter((i) => i.severity === 'CRITICAL');

  return `You are Motacare's inspection report writer. Generate a clear, professional summary of a vehicle inspection.

## Vehicle
${v.year} ${v.make} ${v.model} — ${v.mileageAtInspection.toLocaleString()} km — ${v.fuelType}

## Inspection Results
- Total checks: ${items.length}
- Passed: ${passed.length}
- Failed: ${failed.length} (${criticalFails.length} critical)
- Warnings: ${warnings.length}

## Failed Items
${failed.length === 0 ? 'None' : failed.map((i) => `- [${i.severity ?? 'UNKNOWN'}] ${i.category.toUpperCase()} — ${i.checkName}${i.notes ? `: "${i.notes}"` : ''}`).join('\n')}

## Warning Items
${warnings.length === 0 ? 'None' : warnings.map((i) => `- ${i.category.toUpperCase()} — ${i.checkName}${i.notes ? `: "${i.notes}"` : ''}`).join('\n')}

## Fixer's Notes
"${fixerSummary}"

## Workshop
${fixer.workshopName ?? 'Independent technician'} — inspected by ${fixer.firstName}

## Your Task
Write an inspection summary that:
1. Is written for a NON-TECHNICAL vehicle owner — use plain language
2. Prioritises safety-critical issues clearly and urgently
3. Is honest but not alarmist — contextualise issues by severity
4. Groups related issues together logically
5. Gives clear guidance on what needs to happen next

Respond with ONLY valid JSON — no markdown, no explanation:
{
  "headline": "One-line verdict under 15 words",
  "overallCondition": "EXCELLENT" | "GOOD" | "FAIR" | "POOR" | "UNSAFE",
  "ownerFacingReport": "2-4 paragraph plain English report for the owner",
  "criticalActions": ["action1", "action2"],
  "recommendedActions": ["action1"],
  "advisoryNotes": ["note1"],
  "estimatedUrgency": "IMMEDIATE" | "WITHIN_WEEK" | "WITHIN_MONTH" | "ROUTINE"
}`;
}

// ============================================================
// INSPECTION SUMMARY GENERATOR
// ============================================================

export async function generateInspectionSummary(
  input: InspectionSummaryInput,
): Promise<AiInspectionSummary> {
  const client = getAnthropicClient();

  try {
    const response = await client.messages.create({
      model: MOTACARE_MODEL,
      max_tokens: 2000,
      temperature: 0.3,
      system: `You are Motacare's inspection report AI. You translate technical vehicle inspection results into 
clear, honest reports that vehicle owners can understand and act on. You always respond with valid JSON only.`,
      messages: [
        {
          role: 'user',
          content: buildSummaryPrompt(input),
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new AiError('No text content in response');
    }

    const rawJson = textBlock.text
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();

    const parsed = JSON.parse(rawJson) as AiInspectionSummary;

    return {
      ...parsed,
      generatedAt: new Date().toISOString(),
    };

  } catch (error) {
    // Fallback — generate a basic summary from the raw data
    console.error('[ai-summary] Generation failed, using fallback:', error);

    const failed = input.items.filter((i) => i.status === 'FAIL');
    const criticalFails = failed.filter((i) => i.severity === 'CRITICAL');

    const overallCondition =
      criticalFails.length > 0 ? 'UNSAFE' :
      failed.length > 3        ? 'POOR' :
      failed.length > 0        ? 'FAIR' :
      input.items.filter((i) => i.status === 'WARNING').length > 2 ? 'FAIR' : 'GOOD';

    return {
      headline: failed.length > 0
        ? `Vehicle has ${failed.length} issue${failed.length > 1 ? 's' : ''} requiring attention`
        : 'Vehicle passed inspection with no major issues',
      overallCondition,
      ownerFacingReport: input.fixerSummary,
      criticalActions: criticalFails.map((i) => `Address ${i.checkName} immediately`),
      recommendedActions: failed
        .filter((i) => i.severity !== 'CRITICAL')
        .map((i) => `Fix ${i.checkName}`),
      advisoryNotes: input.items
        .filter((i) => i.status === 'WARNING')
        .map((i) => `Monitor ${i.checkName}`),
      estimatedUrgency: criticalFails.length > 0 ? 'IMMEDIATE' : failed.length > 0 ? 'WITHIN_WEEK' : 'ROUTINE',
      generatedAt: new Date().toISOString(),
    };
  }
}