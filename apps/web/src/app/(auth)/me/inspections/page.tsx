'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ClipboardCheck, ChevronRight, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import { inspectionApi } from '@/lib/api';
import type { Inspection } from '@motacare/shared-types';
import { formatDate, statusColour } from '@/lib/utils';

const STATUS_ICON: Record<string, React.ReactNode> = {
  COMPLETED:      <CheckCircle2 className="h-4 w-4 text-green-500" />,
  NEEDS_FOLLOWUP: <AlertCircle className="h-4 w-4 text-orange-500" />,
  IN_PROGRESS:    <Clock className="h-4 w-4 text-brand-500" />,
  DRAFT:          <Clock className="h-4 w-4 text-gray-400" />,
};

export default function InspectionsPage() {
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    inspectionApi.list({ limit: 20 })
      .then((res) => { setInspections(res.data); setTotal(res?.pagination?.total ?? 0); })
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Inspections</h1>
        <p className="text-gray-500 mt-0.5 text-sm">
          {isLoading ? '…' : `${total} total inspections`}
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card h-20 animate-pulse bg-gray-100 border-0" />
          ))}
        </div>
      ) : (!inspections || inspections.length === 0) ? (
        <div className="card p-16 text-center">
          <ClipboardCheck className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-700 mb-2">No inspections yet</h2>
          <p className="text-sm text-gray-400">
            Inspections are created by fixers when a vehicle comes in for a check.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {inspections.map((inspection) => (
            <Link
              key={inspection.id}
              href={`/dashboard/inspections/${inspection.id}`}
              className="card p-5 flex items-center gap-4 hover:shadow-md transition-shadow group"
            >
              <div className="h-10 w-10 rounded-lg bg-gray-50 flex items-center justify-center shrink-0">
                {STATUS_ICON[inspection.status] ?? <ClipboardCheck className="h-5 w-5 text-gray-400" />}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`badge ${statusColour(inspection.status)}`}>
                    {inspection.status.replace('_', ' ')}
                  </span>
                  <span className="text-xs text-gray-400">
                    {formatDate(inspection.createdAt)}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-0.5 truncate font-mono text-xs">
                  Vehicle: {inspection.vehicleHash.slice(0, 16)}…
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {inspection.mileageAtInspection.toLocaleString()} km at inspection
                </p>
              </div>

              <ChevronRight className="h-5 w-5 text-gray-300 group-hover:text-gray-400 shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}