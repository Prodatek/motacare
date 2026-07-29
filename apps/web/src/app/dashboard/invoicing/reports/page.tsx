'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { invoicingApi, ApiClientError } from '@/lib/api';
import type { FinancialSummary, FinancialTrendPoint, TopCustomer } from '@motacare/shared-types';
import { formatCurrency } from '@/lib/utils';

function Tile({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'warn' | 'bad' }) {
  const toneClass = tone === 'good' ? 'text-green-600' : tone === 'warn' ? 'text-amber-600' : tone === 'bad' ? 'text-red-600' : 'text-gray-900';
  return (
    <div className="card p-5">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${toneClass}`}>{value}</p>
    </div>
  );
}

export default function ReportsPage() {
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [trend, setTrend] = useState<FinancialTrendPoint[]>([]);
  const [topCustomers, setTopCustomers] = useState<TopCustomer[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const [s, t, c] = await Promise.all([
        invoicingApi.getFinancialSummary(),
        invoicingApi.getFinancialTrend(),
        invoicingApi.getTopCustomers({ limit: 5 }),
      ]);
      setSummary(s);
      setTrend(t);
      setTopCustomers(c);
    } catch (err) {
      if (err instanceof ApiClientError) toast.error(err.message);
    } finally { setIsLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (isLoading) return <Loader2 className="h-6 w-6 animate-spin text-gray-400" />;

  const maxTrend = Math.max(1, ...trend.map((p) => Math.max(p.invoiced, p.collected)));
  const currency = 'NGN';

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Financial Reports</h1>
        <p className="text-gray-500 text-sm mt-0.5">Last 12 months, based on your workshop's quotes, invoices, and payments</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <Tile label="Invoiced" value={formatCurrency(summary?.totalInvoiced ?? 0, currency)} />
        <Tile label="Collected" value={formatCurrency(summary?.totalCollected ?? 0, currency)} tone="good" />
        <Tile label="Outstanding" value={formatCurrency(summary?.outstanding ?? 0, currency)} tone="warn" />
        <Tile label="Overdue" value={formatCurrency(summary?.overdue ?? 0, currency)} tone="bad" />
      </div>

      <div className="card p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-900">Invoiced vs Collected</h2>
          <span className="text-xs text-gray-400">
            Quote conversion: {summary ? Math.round(summary.conversionRate * 100) : 0}%
          </span>
        </div>
        {trend.length === 0 ? (
          <p className="text-sm text-gray-400 py-8 text-center">No data yet for this period.</p>
        ) : (
          <div className="flex items-end gap-3 h-40">
            {trend.map((p) => (
              <div key={p.month} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                <div className="w-full flex items-end gap-0.5 h-32">
                  <div className="flex-1 bg-brand-200 rounded-t" style={{ height: `${(p.invoiced / maxTrend) * 100}%` }} title={`Invoiced: ${formatCurrency(p.invoiced, currency)}`} />
                  <div className="flex-1 bg-green-400 rounded-t" style={{ height: `${(p.collected / maxTrend) * 100}%` }} title={`Collected: ${formatCurrency(p.collected, currency)}`} />
                </div>
                <span className="text-[10px] text-gray-400 truncate w-full text-center">
                  {new Date(p.month).toLocaleDateString('en-GB', { month: 'short' })}
                </span>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-brand-200 inline-block" /> Invoiced</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-green-400 inline-block" /> Collected</span>
        </div>
      </div>

      <div className="card p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Top Customers</h2>
        {topCustomers.length === 0 ? (
          <div className="text-center py-8">
            <TrendingUp className="h-8 w-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-400">No invoiced customers yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {topCustomers.map((c, i) => (
              <div key={c.ownerId ?? `${c.customerName}-${i}`} className="py-2.5 flex items-center justify-between text-sm">
                <div>
                  <p className="text-gray-900 font-medium">{c.customerName}</p>
                  <p className="text-xs text-gray-400">{c.invoiceCount} invoice{c.invoiceCount !== 1 ? 's' : ''}</p>
                </div>
                <span className="font-semibold text-gray-900">{formatCurrency(c.totalSpend, currency)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
