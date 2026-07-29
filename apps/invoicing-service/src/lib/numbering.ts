import { sql } from 'drizzle-orm';
import { documentCounters } from '../db/schema';

// ============================================================
// DOCUMENT NUMBERING
// Gap-free, per-workshop sequential numbers (Q-2026-000123 /
// INV-2026-000456). Must be called inside the same
// db.transaction() as the quote/invoice insert it numbers, so a
// rolled-back create never leaves a gap in the sequence.
// ============================================================

export async function nextDocumentNumber(
  tx: any,
  workshopId: string,
  docType: 'QUOTE' | 'INVOICE',
): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = docType === 'QUOTE' ? 'Q' : 'INV';

  const [row] = await tx
    .insert(documentCounters)
    .values({ workshopId, docType, lastNumber: 1 })
    .onConflictDoUpdate({
      target: [documentCounters.workshopId, documentCounters.docType],
      set: {
        lastNumber: sql`${documentCounters.lastNumber} + 1`,
        updatedAt: new Date(),
      },
    })
    .returning({ lastNumber: documentCounters.lastNumber });

  return `${prefix}-${year}-${String(row.lastNumber).padStart(6, '0')}`;
}
