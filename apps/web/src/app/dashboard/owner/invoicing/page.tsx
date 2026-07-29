'use client';

import { useCallback, useEffect, useState } from 'react';
import { Download, FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { invoicingApi, ApiClientError } from '@/lib/api';
import type { Invoice, Quote } from '@motacare/shared-types';
import { formatCurrency, formatDate } from '@/lib/utils';
import { StatusBadge } from '@/components/invoicing/StatusBadge';

export default function OwnerInvoicingPage() {
  const [tab, setTab] = useState<'quotes' | 'invoices'>('invoices');
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const [q, inv] = await Promise.all([
        invoicingApi.listQuotes({ limit: 50 }),
        invoicingApi.listInvoices({ limit: 50 }),
      ]);
      setQuotes(q.data);
      setInvoices(inv.data);
    } catch (err) {
      if (err instanceof ApiClientError) toast.error(err.message);
    } finally { setIsLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function respond(id: string, accept: boolean) {
    setBusyId(id);
    try {
      if (accept) await invoicingApi.acceptQuote(id);
      else await invoicingApi.rejectQuote(id);
      toast.success(accept ? 'Quote accepted' : 'Quote rejected');
      load();
    } catch (err) {
      if (err instanceof ApiClientError) toast.error(err.message);
    } finally { setBusyId(null); }
  }

  async function downloadQuote(q: Quote) {
    setBusyId(q.id);
    try { await invoicingApi.downloadQuotePdf(q.id, q.quoteNumber); }
    catch (err) { if (err instanceof ApiClientError) toast.error(err.message); }
    finally { setBusyId(null); }
  }

  async function downloadInvoice(inv: Invoice) {
    setBusyId(inv.id);
    try { await invoicingApi.downloadInvoicePdf(inv.id, inv.invoiceNumber); }
    catch (err) { if (err instanceof ApiClientError) toast.error(err.message); }
    finally { setBusyId(null); }
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Quotes & Invoices</h1>
        <p className="text-gray-500 text-sm mt-0.5">Documents from your workshop</p>
      </div>

      <div className="flex gap-2 mb-5 border-b border-gray-200">
        {(['invoices', 'quotes'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t ? 'border-brand-600 text-brand-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'invoices' ? 'Invoices' : 'Quotes'}
          </button>
        ))}
      </div>

      {isLoading ? (
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      ) : tab === 'quotes' ? (
        quotes.length === 0 ? (
          <div className="card p-16 text-center">
            <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-sm text-gray-400">No quotes yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {quotes.map((q) => (
              <div key={q.id} className="card p-5 flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-900">{q.quoteNumber}</p>
                    <StatusBadge status={q.status} />
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5">{formatCurrency(q.total, q.currency)} · {formatDate(q.createdAt)}</p>
                </div>
                <div className="flex items-center gap-2">
                  {q.status === 'SENT' && (
                    <>
                      <button disabled={busyId === q.id} onClick={() => respond(q.id, true)} className="btn-primary py-1.5 px-3 text-xs">Accept</button>
                      <button disabled={busyId === q.id} onClick={() => respond(q.id, false)} className="btn-secondary py-1.5 px-3 text-xs">Reject</button>
                    </>
                  )}
                  <button disabled={busyId === q.id} onClick={() => downloadQuote(q)} className="btn-secondary py-1.5 px-3 text-xs">
                    <Download className="h-3.5 w-3.5" /> PDF
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : invoices.length === 0 ? (
        <div className="card p-16 text-center">
          <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-sm text-gray-400">No invoices yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {invoices.map((inv) => (
            <div key={inv.id} className="card p-5 flex items-center justify-between gap-4 flex-wrap">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-gray-900">{inv.invoiceNumber}</p>
                  <StatusBadge status={inv.status} />
                </div>
                <p className="text-sm text-gray-500 mt-0.5">
                  {formatCurrency(inv.total, inv.currency)}
                  {inv.amountDue > 0 && inv.status !== 'VOID' ? ` · ${formatCurrency(inv.amountDue, inv.currency)} due` : ''}
                </p>
              </div>
              <button disabled={busyId === inv.id} onClick={() => downloadInvoice(inv)} className="btn-secondary py-1.5 px-3 text-xs">
                <Download className="h-3.5 w-3.5" /> PDF
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
