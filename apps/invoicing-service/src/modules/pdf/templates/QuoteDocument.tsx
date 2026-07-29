import { DocumentLayout, type WorkshopBranding } from './DocumentLayout';
import type { QuoteWithLineItems } from '../../quotes/quotes.service';

export function QuoteDocument({ quote, workshop }: { quote: QuoteWithLineItems; workshop: WorkshopBranding }) {
  return (
    <DocumentLayout
      data={{
        kind: 'QUOTE',
        documentNumber: quote.quoteNumber,
        status: quote.status,
        issueDate: quote.createdAt.toString(),
        secondaryDate: quote.validUntil ? { label: 'Valid Until', value: quote.validUntil.toString() } : null,
        workshop,
        customer: {
          name: quote.customerName,
          contact: quote.customerContact,
          address: quote.customerAddress,
          vehicleDescription: quote.vehicleDescription,
        },
        currency: quote.currency,
        lineItems: quote.lineItems.map((li) => ({
          description: li.description,
          unit: li.unit,
          quantity: Number(li.quantity),
          unitPrice: Number(li.unitPrice),
          lineTotal: Number(li.lineTotal),
        })),
        subtotal: Number(quote.subtotal),
        taxRate: Number(quote.taxRate),
        taxAmount: Number(quote.taxAmount),
        discountAmount: Number(quote.discountAmount),
        total: Number(quote.total),
        notes: quote.notes,
      }}
    />
  );
}
