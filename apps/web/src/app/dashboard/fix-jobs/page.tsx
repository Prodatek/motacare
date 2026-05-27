'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Wrench, ChevronRight, Clock, CheckCircle2, AlertCircle, XCircle, Package } from 'lucide-react';
import { fixJobApi } from '@/lib/api';
import type { FixJob } from '@motacare/shared-types';
import { formatDate, statusColour, formatCurrency } from '@/lib/utils';
import { useAuth } from '@/lib/auth';

const STATUS_ICON: Record<string, React.ReactNode> = {
  PENDING:        <Clock className="h-4 w-4 text-gray-400" />,
  IN_PROGRESS:    <Wrench className="h-4 w-4 text-brand-500" />,
  AWAITING_PARTS: <Package className="h-4 w-4 text-orange-400" />,
  COMPLETED:      <CheckCircle2 className="h-4 w-4 text-green-500" />,
  DELIVERED:      <CheckCircle2 className="h-4 w-4 text-blue-500" />,
  CANCELLED:      <XCircle className="h-4 w-4 text-red-400" />,
};

export default function FixJobsPage() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<FixJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState<string>('');

  useEffect(() => {
    setIsLoading(true);
    fixJobApi.list({ limit: 50, ...(filter ? { status: filter } : {}) })
      .then((res) => {
        setJobs(res?.data ?? []);
        setTotal(res?.pagination?.total ?? 0);
      })
      .catch(() => setJobs([]))
      .finally(() => setIsLoading(false));
  }, [filter]);

  const STATUS_FILTERS = ['', 'PENDING', 'IN_PROGRESS', 'AWAITING_PARTS', 'COMPLETED', 'DELIVERED', 'CANCELLED'];

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Fix Jobs</h1>
        <p className="text-gray-500 mt-0.5 text-sm">
          {isLoading ? '…' : `${total} total jobs`}
        </p>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-2 flex-wrap mb-5">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s || 'all'}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filter === s
                ? 'bg-brand-600 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'
            }`}
          >
            {s || 'All'}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card h-24 animate-pulse bg-gray-100 border-0" />
          ))}
        </div>
      ) : jobs.length === 0 ? (
        <div className="card p-16 text-center">
          <Wrench className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-700 mb-2">No fix jobs yet</h2>
          <p className="text-sm text-gray-400">
            {user?.role === 'FIXER'
              ? 'Fix jobs are created from completed inspections.'
              : 'Fix jobs will appear here when your workshop starts a repair.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => (
            <Link
              key={job.id}
              href={`/dashboard/fix-jobs/${job.id}`}
              className="card p-5 flex items-center gap-4 hover:shadow-md transition-shadow group"
            >
              {/* Status icon */}
              <div className="h-10 w-10 rounded-lg bg-gray-50 flex items-center justify-center shrink-0">
                {STATUS_ICON[job.status] ?? <Wrench className="h-5 w-5 text-gray-300" />}
              </div>

              {/* Details */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                  <span className={`badge ${statusColour(job.status)}`}>
                    {job.status.replace('_', ' ')}
                  </span>
                  <span className="text-xs text-gray-400">{formatDate(job.createdAt)}</span>
                </div>
                <p className="text-sm font-medium text-gray-900 truncate">{job.description}</p>
                <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
                  {job.estimatedCompletionAt && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Due {formatDate(job.estimatedCompletionAt)}
                    </span>
                  )}
                  {job.estimatedCost && (
                    <span>{formatCurrency(Number(job.estimatedCost), job.currency)}</span>
                  )}
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