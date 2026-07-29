'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Loader2, Plus, Receipt, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import { invoicingApi, ApiClientError } from '@/lib/api';
import type { Invoice, InvoiceStatus } from '@motacare/shared-types';
import { formatCurrency, formatDate } from '@/lib/utils';
import { StatusBadge } from '@/components/invoicing/StatusBadge';

const STATUSES: (InvoiceStatus | 'ALL')[] = ['ALL', 'DRAFT', 'SENT', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'VOID'];

export default function InvoicesListPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatus] = useState<InvoiceStatus | 'ALL'>('ALL');
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(debounceRef.current);
  }, [search]);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await invoicingApi.listInvoices({
        limit: 30, search: debouncedSearch || undefined,
        status: status === 'ALL' ? undefined : status,
      });
      setInvoices(res.data);
      setTotal(res.pagination.total);
    } catch (err) {
      if (err instanceof ApiClientError) toast.error(err.message);
    } finally { setIsLoading(false); }
  }, [debouncedSearch, status]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="max-w-3xl">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
          <p className="text-gray-500 text-sm mt-0.5">{isLoading ? '…' : `${total} invoices`}</p>
        </div>
        <Link href="/dashboard/invoicing/invoices/new" className="btn-primary">
          <Plus className="h-4 w-4" /> New Invoice
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text" value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by customer name…"
            className="input pl-10 pr-9"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value as any)} className="input sm:w-44">
          {STATUSES.map((s) => <option key={s} value={s}>{s === 'ALL' ? 'All statuses' : s.replace('_', ' ')}</option>)}
        </select>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="card h-20 animate-pulse bg-gray-100 border-0" />)}</div>
      ) : invoices.length === 0 ? (
        <div className="card p-16 text-center">
          <Receipt className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-700 mb-2">No invoices yet</h2>
          <p className="text-sm text-gray-400">Create a standalone invoice, or convert an accepted quote.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {invoices.map((inv) => (
            <Link key={inv.id} href={`/dashboard/invoicing/invoices/${inv.id}`} className="card p-5 flex items-center justify-between gap-4 hover:shadow-md transition-shadow group">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-gray-900">{inv.invoiceNumber}</p>
                  <StatusBadge status={inv.status} />
                </div>
                <p className="text-sm text-gray-600 mt-0.5">{inv.customerName}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Issued {formatDate(inv.issueDate)}{inv.dueDate ? ` · Due ${formatDate(inv.dueDate)}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0 text-right">
                <div>
                  <p className="font-semibold text-gray-900">{formatCurrency(inv.total, inv.currency)}</p>
                  {inv.amountDue > 0 && inv.status !== 'VOID' && (
                    <p className="text-xs text-amber-600">{formatCurrency(inv.amountDue, inv.currency)} due</p>
                  )}
                </div>
                <ChevronRight className="h-5 w-5 text-gray-300 group-hover:text-gray-400" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
