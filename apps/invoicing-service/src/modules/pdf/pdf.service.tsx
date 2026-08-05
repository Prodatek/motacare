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

// Fetches the logo image bytes ourselves and inlines them as a data URI,
// rather than letting @react-pdf/renderer's <Image> fetch the URL directly
// at render time — a slow/unreachable/non-image logoUrl would otherwise
// throw mid-render and take the whole PDF down with it. Any failure here
// just means the PDF renders without a logo, never a broken document.
async function fetchLogoDataUri(logoUrl: string): Promise<string | undefined> {
  try {
    const res = await fetch(logoUrl, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return undefined;
    const contentType = res.headers.get('content-type') ?? '';
    if (!contentType.startsWith('image/')) return undefined;
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.byteLength === 0 || buffer.byteLength > 2_000_000) return undefined; // sanity cap: 2MB
    return `data:${contentType};base64,${buffer.toString('base64')}`;
  } catch {
    return undefined;
  }
}

async function fetchWorkshopBranding(workshopId: string): Promise<WorkshopBranding> {
  try {
    const res = await fetch(`${env.WORKSHOP_SERVICE_URL}/workshops/${workshopId}`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return { name: 'Workshop' };
    const body = (await res.json()) as { data: any };
    const w = body.data;
    const logoDataUri = w?.logoUrl ? await fetchLogoDataUri(w.logoUrl) : undefined;
    return {
      name: w?.name ?? 'Workshop',
      address: w?.address ?? null,
      city: w?.city ?? null,
      state: w?.state ?? null,
      phone: w?.phone ?? null,
      email: w?.email ?? null,
      logoDataUri,
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
