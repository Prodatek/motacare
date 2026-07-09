'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search, X, Star, StarOff, Building2, MapPin,
  Loader2, CheckCircle, XCircle, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { adminApi, workshopApi, ApiClientError } from '@/lib/api';
import type { Workshop } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDate, cn } from '@/lib/utils';

const STATUS_COLOURS: Record<string, string> = {
  ACTIVE:           'bg-green-50 text-green-700',
  PENDING_APPROVAL: 'bg-amber-50 text-amber-700',
  SUSPENDED:        'bg-red-50 text-red-700',
};

export default function AdminWorkshopsPage() {
  const { user } = useAuth();
  const router   = useRouter();

  const [workshops, setWorkshops] = useState<Workshop[]>([]);
  const [total, setTotal]         = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage]           = useState(1);
  const [search, setSearch]       = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [actionId, setActionId]   = useState<string | null>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (user && user.role !== 'ADMIN') router.replace('/dashboard');
  }, [user, router]);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 400);
    return () => clearTimeout(debounceRef.current);
  }, [search]);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      // Use workshopApi.list which queries all workshops (admin sees all statuses via internal route)
      const res = await workshopApi.list({ page, limit: 20, search: debouncedSearch || undefined });
      setWorkshops(res?.data ?? []);
      setTotal(res?.pagination?.total ?? 0);
      setTotalPages(res?.pagination?.totalPages ?? 1);
    } catch (err) {
      if (err instanceof ApiClientError) toast.error(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [page, debouncedSearch]);

  useEffect(() => { load(); }, [load]);

  const toggleFeatured = async (w: Workshop) => {
    setActionId(w.id);
    try {
      await adminApi.setFeatured(w.id, !w.featured);
      toast.success(w.featured ? 'Removed from featured' : 'Added to featured');
      setWorkshops((prev) => prev.map((x) => x.id === w.id ? { ...x, featured: !w.featured } : x));
    } catch (err) {
      if (err instanceof ApiClientError) toast.error(err.message);
    } finally { setActionId(null); }
  };

  const toggleStatus = async (w: Workshop) => {
    setActionId(w.id);
    try {
      if (w.status === 'ACTIVE') {
        await adminApi.suspendWorkshop(w.id);
        toast.success('Workshop suspended');
        setWorkshops((prev) => prev.map((x) => x.id === w.id ? { ...x, status: 'SUSPENDED' } : x));
      } else {
        await adminApi.activateWorkshop(w.id);
        toast.success('Workshop activated');
        setWorkshops((prev) => prev.map((x) => x.id === w.id ? { ...x, status: 'ACTIVE' } : x));
      }
    } catch (err) {
      if (err instanceof ApiClientError) toast.error(err.message);
    } finally { setActionId(null); }
  };

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Workshops</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {isLoading ? '…' : `${total} workshops`}
          </p>
        </div>
      </div>

      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text" value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or city…"
          className="input pl-10 pr-9"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
          </div>
        ) : workshops.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Building2 className="h-10 w-10 mx-auto mb-3 text-gray-300" />
            No workshops found
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {workshops.map((w) => (
              <div key={w.id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <span className="font-medium text-gray-900">{w.name}</span>
                    {w.featured && <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />}
                    <span className={cn('badge text-xs', STATUS_COLOURS[w.status] ?? 'bg-gray-100 text-gray-500')}>
                      {w.status.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-gray-400">
                    <MapPin className="h-3 w-3" />
                    {w.city}, {w.state}
                    <span className="mx-1">·</span>
                    {w.currentFixerCount}/{w.maxFixers} fixers
                    <span className="mx-1">·</span>
                    {w.totalFixJobs} fix jobs
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {/* Featured toggle */}
                  <button
                    onClick={() => toggleFeatured(w)}
                    disabled={actionId === w.id}
                    className={cn('p-1.5 rounded-lg transition-colors', w.featured ? 'text-amber-500 hover:bg-amber-50' : 'text-gray-300 hover:text-amber-400 hover:bg-amber-50')}
                    title={w.featured ? 'Remove from featured' : 'Add to featured'}
                  >
                    {actionId === w.id ? <Loader2 className="h-4 w-4 animate-spin" /> : w.featured ? <Star className="h-4 w-4 fill-amber-400" /> : <StarOff className="h-4 w-4" />}
                  </button>

                  {/* Suspend / activate */}
                  <button
                    onClick={() => toggleStatus(w)}
                    disabled={actionId === w.id}
                    className={cn('p-1.5 rounded-lg transition-colors', w.status === 'ACTIVE' ? 'text-red-400 hover:bg-red-50' : 'text-green-500 hover:bg-green-50')}
                    title={w.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                  >
                    {w.status === 'ACTIVE' ? <XCircle className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            ))}
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