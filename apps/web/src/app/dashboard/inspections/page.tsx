'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  ClipboardCheck, ChevronRight, CheckCircle2,
  AlertCircle, Clock, Search, X, Plus,
} from 'lucide-react';
import { inspectionApi } from '@/lib/api';
import type { Inspection } from '@motacare/shared-types';
import { formatDate, statusColour, cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';

const STATUS_ICON: Record<string, React.ReactNode> = {
  COMPLETED:      <CheckCircle2 className="h-4 w-4 text-green-500" />,
  NEEDS_FOLLOWUP: <AlertCircle className="h-4 w-4 text-orange-500" />,
  IN_PROGRESS:    <Clock className="h-4 w-4 text-brand-500" />,
  DRAFT:          <Clock className="h-4 w-4 text-gray-400" />,
};

const STATUS_FILTERS = ['', 'IN_PROGRESS', 'COMPLETED', 'NEEDS_FOLLOWUP', 'DRAFT'] as const;
const STATUS_LABELS: Record<string, string> = {
  '': 'All',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  NEEDS_FOLLOWUP: 'Needs Follow-up',
  DRAFT: 'Draft',
};

export default function InspectionsPage() {
  const { user } = useAuth();
  const isFixer = user?.role === 'FIXER' || user?.role === 'ADMIN';

  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [vehicleHashFilter, setVehicleHashFilter] = useState('');

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await inspectionApi.list({
        limit: 30,
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(vehicleHashFilter ? { vehicleHash: vehicleHashFilter } : {}),
      });
      setInspections(res?.data ?? []);
      setTotal(res?.pagination?.total ?? 0);
    } catch {
      setInspections([]);
      setTotal(0);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, vehicleHashFilter]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inspections</h1>
          <p className="text-gray-500 mt-0.5 text-sm">
            {isLoading ? '…' : `${total} total`}
          </p>
        </div>
        {/* Fixers start inspections from the vehicles page */}
        {isFixer && (
          <Link href="/dashboard/vehicles" className="btn-primary">
            <ClipboardCheck className="h-4 w-4" />
            Start new
          </Link>
        )}
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-2 flex-wrap mb-5">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s || 'all'}
            onClick={() => setStatusFilter(s)}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
              statusFilter === s
                ? 'bg-brand-600 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300',
            )}
          >
            {STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {/* Loading skeletons */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card h-20 animate-pulse bg-gray-100 border-0" />
          ))}
        </div>
      ) : inspections.length === 0 ? (
        <div className="card p-16 text-center">
          <ClipboardCheck className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-700 mb-2">No inspections yet</h2>
          <p className="text-sm text-gray-400 max-w-xs mx-auto">
            {isFixer
              ? 'Go to the Vehicles page and click "Inspect" on any active vehicle to start.'
              : 'Inspections will appear here when your workshop checks your vehicle.'}
          </p>
          {isFixer && (
            <Link href="/dashboard/vehicles" className="btn-primary inline-flex mt-5">
              <Plus className="h-4 w-4" /> Go to vehicles
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {inspections.map((inspection) => (
            <Link
              key={inspection.id}
              href={`/dashboard/inspections/${inspection.id}`}
              className="card p-5 flex items-center gap-4 hover:shadow-md transition-shadow group"
            >
              {/* Status icon */}
              <div className="h-10 w-10 rounded-lg bg-gray-50 flex items-center justify-center shrink-0 border border-gray-100">
                {STATUS_ICON[inspection.status] ?? <ClipboardCheck className="h-5 w-5 text-gray-400" />}
              </div>

              {/* Details */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className={cn('badge', statusColour(inspection.status))}>
                    {inspection.status.replace(/_/g, ' ')}
                  </span>
                  <span className="text-xs text-gray-400">
                    {formatDate(inspection.createdAt)}
                  </span>
                </div>

                {/* Vehicle hash — will be replaced with resolved name in a future phase */}
                <p className="text-xs text-gray-400 font-mono truncate">
                  Vehicle: {inspection.vehicleHash.slice(0, 20)}…
                </p>

                {/* Stats if available */}
                <p className="text-xs text-gray-400 mt-0.5">
                  {inspection.mileageAtInspection.toLocaleString()} km at inspection
                </p>
              </div>

              {/* Summary snippet */}
              {inspection.summary && (
                <p className="hidden sm:block text-xs text-gray-400 max-w-[180px] truncate">
                  {inspection.summary}
                </p>
              )}

              <ChevronRight className="h-5 w-5 text-gray-300 group-hover:text-gray-400 shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}