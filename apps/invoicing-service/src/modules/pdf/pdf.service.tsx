import { renderToStream } from '@react-pdf/renderer';
import { env } from '../../config/env';
import { QuotesService, type QuoteScope } from '../quotes/quotes.service';
import { InvoicesService, type InvoiceScope } from '../invoices/invoices.service';
import { QuoteDocument } from './templates/QuoteDocument';
import { InvoiceDocument } from './templates/InvoiceDocument';
import type { WorkshopBranding } from './templates/DocumentLayout';

// ============================================================
// PDF SERVICE
// Renders on-demand and returns a Node Readable stream — nothing
// is written to disk. Workshop branding is fetched live from
// workshop-service since invoicing-service doesn't own it.
// ============================================================

const quotesService = new QuotesService();
const invoicesService = new InvoicesService();

async function fetchWorkshopBranding(workshopId: string): Promise<WorkshopBranding> {
  try {
    const res = await fetch(`${env.WORKSHOP_SERVICE_URL}/workshops/${workshopId}`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return { name: 'Workshop' };
    const body = (await res.json()) as { data: any };
    const w = body.data;
    return {
      name: w?.name ?? 'Workshop',
      address: w?.address ?? null,
      city: w?.city ?? null,
      state: w?.state ?? null,
      phone: w?.phone ?? null,
      email: w?.email ?? null,
    };
  } catch {
    return { name: 'Workshop' };
  }
}

export async function renderQuotePdf(id: string, scope: QuoteScope) {
  const quote = await quotesService.getQuote(id, scope);
  const workshop = await fetchWorkshopBranding(quote.workshopId);
  const stream = await renderToStream(<QuoteDocument quote={quote} workshop={workshop} />);
  return { stream, filename: `Quote-${quote.quoteNumber}.pdf` };
}

export async function renderInvoicePdf(id: string, scope: InvoiceScope) {
  const invoice = await invoicesService.getInvoice(id, scope);
  const workshop = await fetchWorkshopBranding(invoice.workshopId);
  const stream = await renderToStream(<InvoiceDocument invoice={invoice} workshop={workshop} />);
  return { stream, filename: `Invoice-${invoice.invoiceNumber}.pdf` };
}
