import { z } from 'zod';
import { getAnthropicClient, MOTACARE_MODEL, AiError } from './client';
import { STATIC_CHECKLIST, type ChecklistCategory } from './static-checklist-ref';

// ============================================================
// TYPES
// ============================================================

export interface VehicleContext {
  make: string;
  model: string;
  year: number;
  fuelType: string;
  transmissionType: string;
  engineCapacity?: string | null;
  mileageAtInspection: number;
}

export interface DynamicChecklistOptions {
  vehicleContext: VehicleContext;
  reportedSymptoms?: string[];   // Issues the owner reported before drop-off
  previousFailures?: string[];   // Check IDs that failed on the last inspection
  priorityAreas?: string[];      // e.g. ['brakes', 'engine'] — fixer wants to focus here
}

export interface DynamicChecklistItem {
  id: string;
  name: string;
  description: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  aiReason?: string;             // Why Claude added/prioritised this item
  isAiGenerated: boolean;        // true = added by AI, false = from static list
}

export interface DynamicChecklistCategory {
  id: string;
  name: string;
  icon: string;
  order: number;
  items: DynamicChecklistItem[];
  aiPriorityReason?: string;     // Why Claude ordered this category first
}

export interface DynamicChecklistResult {
  categories: DynamicChecklistCategory[];
  aiSummaryHint: string;         // Short prompt for the fixer before they start
  vehicleRiskProfile: 'LOW' | 'MEDIUM' | 'HIGH';
  generatedAt: string;
  fallbackUsed: boolean;         // true if we fell back to static list
}

// ============================================================
// CLAUDE RESPONSE SCHEMA
// We ask Claude to return structured JSON and validate it here.
// This is the contract between us and the AI.
// ============================================================

const aiChecklistItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().min(10),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  aiReason: z.string().optional(),
  isAiGenerated: z.boolean(),
});

const aiChecklistCategorySchema = z.object({
  id: z.string(),
  name: z.string(),
  icon: z.string(),
  order: z.number(),
  items: z.array(aiChecklistItemSchema).min(1),
  aiPriorityReason: z.string().optional(),
});

const aiChecklistResponseSchema = z.object({
  categories: z.array(aiChecklistCategorySchema).min(1),
  aiSummaryHint: z.string(),
  vehicleRiskProfile: z.enum(['LOW', 'MEDIUM', 'HIGH']),
});

// ============================================================
// PROMPT BUILDER
// ============================================================

function buildChecklistPrompt(options: DynamicChecklistOptions): string {
  const { vehicleContext: v, reportedSymptoms, previousFailures, priorityAreas } = options;

  const vehicleAge = new Date().getFullYear() - v.year;
  const mileageFormatted = v.mileageAtInspection.toLocaleString();

  return `You are Motacare's AI inspection assistant. Generate a comprehensive, vehicle-specific inspection checklist.

## Vehicle Details
- Make/Model: ${v.make} ${v.model} (${v.year})
- Age: ${vehicleAge} year${vehicleAge !== 1 ? 's' : ''}
- Fuel Type: ${v.fuelType}
- Transmission: ${v.transmissionType}
- Engine: ${v.engineCapacity ?? 'Unknown'}
- Current Mileage: ${mileageFormatted} km

${reportedSymptoms?.length ? `## Owner-Reported Symptoms\n${reportedSymptoms.map((s) => `- ${s}`).join('\n')}\n` : ''}
${previousFailures?.length ? `## Previously Failed Checks\n${previousFailures.map((f) => `- ${f}`).join('\n')}\n` : ''}
${priorityAreas?.length ? `## Priority Areas\n${priorityAreas.map((a) => `- ${a}`).join('\n')}\n` : ''}

## Your Task
Generate a tailored inspection checklist based on:
1. **Known issues** for ${v.make} ${v.model} of this generation
2. **Age and mileage** wear patterns (${vehicleAge} years, ${mileageFormatted} km)
3. **Fuel type considerations** (${v.fuelType}-specific checks)
4. **Reported symptoms** — elevate severity and add targeted checks
5. **Previous failures** — include re-checks with increased priority

## Base Categories (always include these 8, you may add items or reorder within)
engine, brakes, tyres, electrical, fluids, transmission, body, exhaust

## Rules
- Keep existing check IDs when reusing static items (do not rename them)
- New AI-generated items must have unique IDs prefixed with "ai_" (e.g. "ai_timing_chain_wear")
- Set isAiGenerated: true only for items you are adding beyond the standard list
- Descriptions must be specific and actionable — tell the fixer exactly what to look for
- Categories should be ordered by priority given this specific vehicle's risk profile
- vehicleRiskProfile: HIGH if vehicle is old/high-mileage/has reported symptoms, MEDIUM if moderate, LOW if new/low-mileage
- aiSummaryHint: a single sentence briefing the fixer on the main concern for this car

## Static Checklist Reference
Here are the standard items to include (you must include all of these, plus add relevant ones):
${JSON.stringify(STATIC_CHECKLIST.map((c) => ({
  id: c.id,
  name: c.name,
  items: c.items.map((i) => ({ id: i.id, name: i.name, severity: i.severity })),
})), null, 2)}

Respond with ONLY valid JSON matching this exact structure — no markdown, no explanation:
{
  "categories": [...],
  "aiSummaryHint": "string",
  "vehicleRiskProfile": "LOW" | "MEDIUM" | "HIGH"
}`;
}

// ============================================================
// DYNAMIC CHECKLIST GENERATOR
// ============================================================

export async function generateDynamicChecklist(
  options: DynamicChecklistOptions,
): Promise<DynamicChecklistResult> {
  const client = getAnthropicClient();

  try {
    const response = await client.messages.create({
      model: MOTACARE_MODEL,
      max_tokens: 8000,
      temperature: 0.2,    // Low temperature = consistent, structured output
      system: `You are Motacare's vehicle inspection AI. You produce structured JSON checklists for automotive technicians. 
You have deep knowledge of common failure modes by vehicle make, model, age, and mileage.
Always respond with valid JSON only — no prose, no markdown fences.`,
      messages: [
        {
          role: 'user',
          content: buildChecklistPrompt(options),
        },
      ],
    });

    // Extract text content from response
    const textBlock = response.content.find((b) => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new AiError('Claude returned no text content');
    }

    // Strip any accidental markdown fences
    const rawJson = textBlock.text
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();

    // Parse and validate
    const parsed = JSON.parse(rawJson);
    const validated = aiChecklistResponseSchema.parse(parsed);

    return {
      ...validated,
      generatedAt: new Date().toISOString(),
      fallbackUsed: false,
    };

  } catch (error) {
    // ──────────────────────────────────────────────────────
    // FALLBACK — if AI fails for any reason, return the
    // static checklist so the inspection can still proceed.
    // This is critical — we never want AI downtime to block
    // a fixer from doing their job.
    // ──────────────────────────────────────────────────────
    console.error('[ai-checklist] Generation failed, using static fallback:', error);

    const fallbackCategories: DynamicChecklistCategory[] = STATIC_CHECKLIST.map((cat) => ({
      ...cat,
      items: cat.items.map((item) => ({
        ...item,
        isAiGenerated: false,
      })),
    }));

    return {
      categories: fallbackCategories,
      aiSummaryHint: 'Standard inspection checklist. Check all items carefully.',
      vehicleRiskProfile: 'MEDIUM',
      generatedAt: new Date().toISOString(),
      fallbackUsed: true,
    };
  }
}