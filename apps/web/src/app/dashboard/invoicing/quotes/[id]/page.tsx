'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Download, Loader2, Send, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { invoicingApi, ApiClientError } from '@/lib/api';
import type { Quote } from '@motacare/shared-types';
import { formatCurrency, formatDate } from '@/lib/utils';
import { StatusBadge } from '@/components/invoicing/StatusBadge';
import { DocumentForm, type DocumentFormValues } from '@/components/invoicing/DocumentForm';

export default function QuoteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      setQuote(await invoicingApi.getQuote(id));
    } catch (err) {
      if (err instanceof ApiClientError) toast.error(err.message);
    } finally { setIsLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function action(fn: () => Promise<any>, successMsg: string) {
    setBusy(true);
    try {
      await fn();
      toast.success(successMsg);
      load();
    } catch (err) {
      if (err instanceof ApiClientError) toast.error(err.message);
    } finally { setBusy(false); }
  }

  async function handleSaveEdit(values: DocumentFormValues) {
    await invoicingApi.updateQuote(id, {
      customerName: values.customerName,
      customerContact: values.customerContact,
      customerAddress: values.customerAddress || undefined,
      vehicleDescription: values.vehicleDescription || undefined,
      currency: values.currency,
      taxRate: values.taxRate,
      discountAmount: values.discountAmount,
      notes: values.notes || undefined,
      validUntil: values.dateField || undefined,
      lineItems: values.lineItems,
    });
    toast.success('Quote updated');
    load();
  }

  if (isLoading) return <Loader2 className="h-6 w-6 animate-spin text-gray-400" />;
  if (!quote) return <p className="text-gray-500">Quote not found.</p>;

  if (quote.status === 'DRAFT') {
    return (
      <div>
        <div className="mb-6 flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-bold text-gray-900">{quote.quoteNumber}</h1>
          <StatusBadge status={quote.status} />
        </div>
        <DocumentForm
          kind="QUOTE"
          submitLabel="Save Changes"
          initialValues={{
            customerName: quote.customerName,
            customerContact: quote.customerContact,
            customerAddress: quote.customerAddress ?? '',
            vehicleDescription: quote.vehicleDescription ?? '',
            currency: quote.currency,
            taxRate: quote.taxRate,
            discountAmount: quote.discountAmount,
            notes: quote.notes ?? '',
            dateField: quote.validUntil ? new Date(quote.validUntil).toISOString().slice(0, 10) : '',
            lineItems: quote.lineItems.map((li) => ({
              catalogItemId: li.catalogItemId ?? undefined,
              description: li.description,
              kind: li.kind ?? undefined,
              quantity: li.quantity,
              unit: li.unit,
              unitPrice: li.unitPrice,
            })),
          }}
          onSubmit={handleSaveEdit}
        />
        <div className="max-w-3xl flex gap-3 mt-4">
          <button disabled={busy} onClick={() => action(() => invoicingApi.sendQuote(id), 'Quote sent')} className="btn-primary">
            <Send className="h-4 w-4" /> Send to Customer
          </button>
          <button
            disabled={busy}
            onClick={() => { if (confirm('Delete this draft quote?')) action(() => invoicingApi.deleteQuote(id).then(() => router.push('/dashboard/invoicing/quotes')), 'Quote deleted'); }}
            className="btn-danger"
          >
            <Trash2 className="h-4 w-4" /> Delete
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900">{quote.quoteNumber}</h1>
            <StatusBadge status={quote.status} />
          </div>
          <p className="text-gray-500 text-sm mt-0.5">Created {formatDate(quote.createdAt)}</p>
        </div>
        <button
          disabled={busy}
          onClick={() => action(() => invoicingApi.downloadQuotePdf(quote.id, quote.quoteNumber), 'Downloading…')}
          className="btn-secondary"
        >
          <Download className="h-4 w-4" /> PDF
        </button>
      </div>

      <div className="card p-5 mb-4">
        <h2 className="text-sm font-semibold text-gray-900 mb-2">Customer</h2>
        <p className="text-sm text-gray-900">{quote.customerName}</p>
        <p className="text-sm text-gray-500">{quote.customerContact}</p>
        {quote.customerAddress && <p className="text-sm text-gray-500">{quote.customerAddress}</p>}
        {quote.vehicleDescription && <p className="text-sm text-gray-500 mt-1">{quote.vehicleDescription}</p>}
      </div>

      <div className="card overflow-hidden mb-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <th className="text-left px-3 py-2 font-medium">Description</th>
              <th className="text-right px-3 py-2 font-medium">Qty</th>
              <th className="text-right px-3 py-2 font-medium">Price</th>
              <th className="text-right px-3 py-2 font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {quote.lineItems.map((li) => (
              <tr key={li.id} className="border-t border-gray-100">
                <td className="px-3 py-2">{li.description}</td>
                <td className="px-3 py-2 text-right">{li.quantity} {li.unit}</td>
                <td className="px-3 py-2 text-right">{formatCurrency(li.unitPrice, quote.currency)}</td>
                <td className="px-3 py-2 text-right font-medium">{formatCurrency(li.lineTotal, quote.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="border-t border-gray-100 px-3 py-3 flex flex-col items-end gap-1 text-sm">
          <div className="flex justify-between w-56 text-gray-500"><span>Subtotal</span><span>{formatCurrency(quote.subtotal, quote.currency)}</span></div>
          {quote.discountAmount > 0 && <div className="flex justify-between w-56 text-gray-500"><span>Discount</span><span>-{formatCurrency(quote.discountAmount, quote.currency)}</span></div>}
          {quote.taxRate > 0 && <div className="flex justify-between w-56 text-gray-500"><span>Tax ({quote.taxRate}%)</span><span>{formatCurrency(quote.taxAmount, quote.currency)}</span></div>}
          <div className="flex justify-between w-56 text-gray-900 font-semibold text-base border-t border-gray-100 pt-1"><span>Total</span><span>{formatCurrency(quote.total, quote.currency)}</span></div>
        </div>
      </div>

      {quote.notes && (
        <div className="card p-5 mb-4">
          <h2 className="text-sm font-semibold text-gray-900 mb-1">Notes</h2>
          <p className="text-sm text-gray-600 whitespace-pre-wrap">{quote.notes}</p>
        </div>
      )}

      <div className="flex gap-3 flex-wrap">
        {quote.status === 'SENT' && (
          <>
            <button disabled={busy} onClick={() => action(() => invoicingApi.acceptQuote(id), 'Quote accepted')} className="btn-primary">Mark Accepted</button>
            <button
              disabled={busy}
              onClick={() => { const reason = prompt('Reason for rejection (optional)') ?? undefined; action(() => invoicingApi.rejectQuote(id, reason), 'Quote rejected'); }}
              className="btn-secondary"
            >
              Mark Rejected
            </button>
          </>
        )}
        {quote.status === 'ACCEPTED' && !quote.convertedInvoiceId && (
          <button
            disabled={busy}
            onClick={() => action(async () => {
              const invoice = await invoicingApi.convertQuoteToInvoice(id);
              router.push(`/dashboard/invoicing/invoices/${invoice.id}`);
            }, 'Converted to invoice')}
            className="btn-primary"
          >
            Convert to Invoice
          </button>
        )}
        {quote.convertedInvoiceId && (
          <button onClick={() => router.push(`/dashboard/invoicing/invoices/${quote.convertedInvoiceId}`)} className="btn-secondary">
            View Invoice
          </button>
        )}
      </div>
    </div>
  );
}
