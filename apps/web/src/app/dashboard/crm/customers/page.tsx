'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { Search, X, Users, Loader2, ChevronRight, Wrench, Clock } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { formatDate, formatCurrency } from '@/lib/utils';

interface Customer {
  ownerId: string;
  ownerName: string;
  totalFixJobs: number;
  totalSpend: number;
  lastVisitAt: string | null;
  firstVisitAt: string | null;
}

export default function CrmCustomersPage() {
  const { user } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const debounceRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(debounceRef.current);
  }, [search]);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const qs = new URLSearchParams({ limit: '30' });
      if (debouncedSearch) qs.set('search', debouncedSearch);
      const res = await fetch(`/api/crm/customers?${qs}`);
      if (res.ok) {
        const body = await res.json();
        setCustomers(body?.data?.customers ?? []);
        setTotal(body?.data?.total ?? 0);
      }
    } finally { setIsLoading(false); }
  }, [debouncedSearch]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
        <p className="text-gray-500 text-sm mt-0.5">
          {isLoading ? '…' : `${total} customers you've worked with`}
        </p>
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search customers by name or email…"
          className="input pl-10 pr-10"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3].map((i) => <div key={i} className="card h-20 animate-pulse bg-gray-100 border-0" />)}
        </div>
      ) : customers.length === 0 ? (
        <div className="card p-16 text-center">
          <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-700 mb-2">No customers yet</h2>
          <p className="text-sm text-gray-400">
            {debouncedSearch ? `No results for "${debouncedSearch}"` : 'Complete your first fix job to see customers here.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {customers.map((c) => (
            <Link
              key={c.ownerId}
              href={`/dashboard/crm/customers/${c.ownerId}`}
              className="card p-5 flex items-center justify-between gap-4 hover:shadow-md transition-shadow group"
            >
              <div className="flex items-center gap-4">
                {/* Avatar */}
                <div className="h-10 w-10 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-semibold text-sm shrink-0">
                  {(c.ownerName || 'U').charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{c.ownerName || 'Unknown customer'}</p>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
                    <span className="flex items-center gap-1">
                      <Wrench className="h-3 w-3" /> {c.totalFixJobs} fix job{c.totalFixJobs !== 1 ? 's' : ''}
                    </span>
                    {c.totalSpend > 0 && (
                      <span>{formatCurrency(c.totalSpend, 'NGN')} spent</span>
                    )}
                    {c.lastVisitAt && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" /> Last visit {formatDate(c.lastVisitAt)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-gray-300 group-hover:text-gray-400 shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}