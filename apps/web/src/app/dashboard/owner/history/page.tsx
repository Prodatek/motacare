'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Car, Wrench, TrendingUp, Calendar, ChevronRight,
  Download, Loader2, CheckCircle, AlertCircle, Clock,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { vehicleApi, fixJobApi } from '@/lib/api';
import type { Vehicle, FixJob } from '@/lib/api';
import { formatDate, formatCurrency, statusColour, cn } from '@/lib/utils';

interface VehicleSummary {
  vehicle: Vehicle;
  totalJobs: number;
  totalSpend: number;
  lastServiceAt: string | null;
  recentJobs: FixJob[];
}

export default function OwnerHistoryPage() {
  const { user } = useAuth();
  const [summaries, setSummaries] = useState<VehicleSummary[]>([]);
  const [totalSpend, setTotalSpend] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedVehicle, setSelectedVehicle] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const vehiclesRes = await vehicleApi.list({ limit: 50 });
        const vehicleList: Vehicle[] = vehiclesRes?.data ?? [];

        // For each vehicle, fetch its fix jobs
        const results = await Promise.allSettled(
          vehicleList.map(async (v) => {
            const jobsRes = await fixJobApi.list({ vehicleHash: v.hash, limit: 50 });
            const jobs: FixJob[] = jobsRes?.data ?? [];
            const delivered = jobs.filter((j) => j.status === 'DELIVERED');
            const spend = delivered.reduce((s, j) => s + Number(j.finalCost ?? 0), 0);
            const lastJob = jobs[0]; // already sorted by createdAt desc

            return {
              vehicle:       v,
              totalJobs:     jobs.length,
              totalSpend:    spend,
              lastServiceAt: lastJob?.updatedAt?.toString() ?? null,
              recentJobs:    jobs.slice(0, 5),
            } as VehicleSummary;
          }),
        );

        const built = results
          .filter((r): r is PromiseFulfilledResult<VehicleSummary> => r.status === 'fulfilled')
          .map((r) => r.value);

        setSummaries(built);
        setTotalSpend(built.reduce((s, v) => s + v.totalSpend, 0));

        if (built.length > 0) setSelectedVehicle(built[0].vehicle.hash);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
    </div>
  );

  const selected = summaries.find((s) => s.vehicle.hash === selectedVehicle);

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Service History</h1>
          <p className="text-gray-500 text-sm mt-0.5">Full maintenance record across all your vehicles</p>
        </div>
      </div>

      {/* Total spend banner */}
      {totalSpend > 0 && (
        <div className="card p-5 mb-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Total vehicles</p>
            <p className="text-2xl font-bold text-gray-900">{summaries.length}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Total fix jobs</p>
            <p className="text-2xl font-bold text-gray-900">{summaries.reduce((s, v) => s + v.totalJobs, 0)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Total lifetime spend</p>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalSpend, 'NGN')}</p>
          </div>
        </div>
      )}

      {summaries.length === 0 ? (
        <div className="card p-16 text-center">
          <Car className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-700 mb-2">No service history yet</h2>
          <p className="text-sm text-gray-400 mb-4">Your fix job history will appear here once work is completed.</p>
          <Link href="/dashboard/vehicles" className="btn-primary inline-flex">View my vehicles</Link>
        </div>
      ) : (
        <div className="grid md:grid-cols-3 gap-5">
          {/* Vehicle selector */}
          <div className="space-y-2">
            {summaries.map((s) => (
              <button
                key={s.vehicle.hash}
                onClick={() => setSelectedVehicle(s.vehicle.hash)}
                className={cn(
                  'w-full text-left card p-4 transition-all',
                  selectedVehicle === s.vehicle.hash ? 'border-brand-500 ring-2 ring-brand-100' : 'hover:border-gray-300',
                )}
              >
                <p className="text-sm font-semibold text-gray-900">
                  {s.vehicle.year} {s.vehicle.make} {s.vehicle.model}
                </p>
                <p className="text-xs text-gray-400">{s.vehicle.licensePlate}</p>
                <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                  <span>{s.totalJobs} jobs</span>
                  <span>{formatCurrency(s.totalSpend, 'NGN')}</span>
                </div>
              </button>
            ))}
          </div>

          {/* Job list for selected vehicle */}
          {selected && (
            <div className="md:col-span-2 card p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="font-semibold text-gray-900">
                    {selected.vehicle.year} {selected.vehicle.make} {selected.vehicle.model}
                  </h2>
                  <p className="text-xs text-gray-400">{selected.vehicle.licensePlate}</p>
                </div>
                <Link href={`/dashboard/vehicles/${selected.vehicle.hash}`} className="btn-secondary text-xs">
                  <Car className="h-3.5 w-3.5" /> Vehicle profile
                </Link>
              </div>

              {/* Job timeline */}
              {selected.recentJobs.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">No service records for this vehicle.</p>
              ) : (
                <div className="space-y-3">
                  {selected.recentJobs.map((job) => (
                    <Link
                      key={job.id}
                      href={`/dashboard/fix-jobs/${job.id}`}
                      className="flex items-start gap-3 rounded-xl p-3 hover:bg-gray-50 transition-colors group"
                    >
                      {/* Status icon */}
                      <div className="mt-0.5">
                        {job.status === 'DELIVERED' ? (
                          <CheckCircle className="h-5 w-5 text-green-500" />
                        ) : job.status === 'CANCELLED' ? (
                          <AlertCircle className="h-5 w-5 text-red-400" />
                        ) : (
                          <Clock className="h-5 w-5 text-amber-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{job.description}</p>
                        <p className="text-xs text-gray-400">{formatDate(job.createdAt)}</p>
                      </div>
                      <div className="text-right shrink-0">
                        {job.finalCost && (
                          <p className="text-sm font-semibold text-gray-900">
                            {formatCurrency(Number(job.finalCost), 'NGN')}
                          </p>
                        )}
                        <span className={cn('badge text-xs', statusColour(job.status))}>
                          {job.status.replace('_', ' ')}
                        </span>
                      </div>
                    </Link>
                  ))}

                  {selected.totalJobs > 5 && (
                    <Link
                      href={`/dashboard/fix-jobs?vehicleHash=${selected.vehicle.hash}`}
                      className="flex items-center justify-center gap-2 text-sm text-brand-600 py-2 hover:underline"
                    >
                      View all {selected.totalJobs} fix jobs <ChevronRight className="h-4 w-4" />
                    </Link>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}