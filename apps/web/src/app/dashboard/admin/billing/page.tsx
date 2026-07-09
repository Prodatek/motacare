'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { CreditCard, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { adminApi, ApiClientError } from '@/lib/api';
import type { AdminSubscription } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDate, cn } from '@/lib/utils';

const TIER_COLOURS: Record<string, string> = {
  FREE:     'bg-gray-100 text-gray-600',
  PRO:      'bg-brand-50 text-brand-700',
  WORKSHOP: 'bg-purple-50 text-purple-700',
};

const STATUS_COLOURS: Record<string, string> = {
  ACTIVE:   'bg-green-50 text-green-700',
  TRIALING: 'bg-blue-50 text-blue-700',
  PAST_DUE: 'bg-orange-50 text-orange-700',
  CANCELED: 'bg-red-50 text-red-700',
  FREE:     'bg-gray-100 text-gray-500',
};

export default function AdminBillingPage() {
  const { user } = useAuth();
  const router   = useRouter();

  const [subs, setSubs]     = useState<AdminSubscription[]>([]);
  const [total, setTotal]   = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage]     = useState(1);
  const [tierFilter, setTierFilter] = useState('');
  const [isLoading, setIsLoading]   = useState(true);

  useEffect(() => {
    if (user && user.role !== 'ADMIN') router.replace('/dashboard');
  }, [user, router]);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await adminApi.listSubscriptions({
        page, limit: 25,
        tier: tierFilter || undefined,
      });
      setSubs((res as any)?.data ?? []);
      const pag = (res as any)?.pagination;
      setTotal(pag?.total ?? 0);
      setTotalPages(pag?.totalPages ?? 1);
    } catch (err) {
      if (err instanceof ApiClientError) toast.error(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [page, tierFilter]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Billing</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {isLoading ? '…' : `${total.toLocaleString()} subscriptions`}
          </p>
        </div>

        <div className="inline-flex border border-gray-200 rounded-lg overflow-hidden">
          {[{ label: 'All', value: '' }, { label: 'Free', value: 'FREE' }, { label: 'Pro', value: 'PRO' }, { label: 'Workshop', value: 'WORKSHOP' }].map(({ label, value }) => (
            <button
              key={value}
              onClick={() => { setTierFilter(value); setPage(1); }}
              className={cn(
                'px-4 py-2 text-sm font-medium transition-colors',
                tierFilter === value ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-700',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
          </div>
        ) : subs.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <CreditCard className="h-10 w-10 mx-auto mb-3 text-gray-300" />
            No subscriptions found
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {['User ID', 'Plan', 'Status', 'Vehicles', 'Inspections/mo', 'Period end', 'Since'].map((h) => (
                    <th key={h} className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide px-4 py-3 first:pl-5 last:pr-5">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {subs.map((s) => (
                  <tr key={s.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3 pl-5">
                      <span className="font-mono text-xs text-gray-500">{s.userId.slice(0, 8)}…</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('badge text-xs font-semibold', TIER_COLOURS[s.tier] ?? 'bg-gray-100 text-gray-600')}>
                        {s.tier}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('badge text-xs', STATUS_COLOURS[s.status] ?? 'bg-gray-100 text-gray-500')}>
                        {s.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {s.vehiclesAllowed === -1 ? '∞' : s.vehiclesAllowed}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {(s as any).inspectionsPerMonth === -1 ? '∞' : (s as any).inspectionsPerMonth ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {s.currentPeriodEnd ? formatDate(s.currentPeriodEnd) : '—'}
                    </td>
                    <td className="px-4 py-3 pr-5 text-xs text-gray-400">
                      {formatDate(s.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-gray-400">Page {page} of {totalPages}</p>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary text-sm disabled:opacity-40">
              <ChevronLeft className="h-4 w-4" /> Previous
            </button>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="btn-secondary text-sm disabled:opacity-40">
              Next <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}