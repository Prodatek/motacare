'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Car, ClipboardCheck, Wrench, Plus, ArrowRight } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { vehicleApi, inspectionApi, fixJobApi } from '@/lib/api';
import type { Vehicle, Inspection, FixJob } from '@motacare/shared-types';
import { formatDate, statusColour } from '@/lib/utils';

const ACTIVE_FIX_JOB_STATUSES = ['PENDING', 'IN_PROGRESS', 'AWAITING_PARTS'];

export default function DashboardPage() {
  const { user } = useAuth();

  // Recent items shown in the lists below (capped at 5 — intentional)
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [fixJobs, setFixJobs] = useState<FixJob[]>([]);

  // Accurate totals for the stat cards (NOT capped by list limit)
  const [vehicleTotal, setVehicleTotal] = useState(0);
  const [inspectionTotal, setInspectionTotal] = useState(0);
  const [activeFixJobTotal, setActiveFixJobTotal] = useState(0);

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [v, i, f, activeF] = await Promise.allSettled([
          vehicleApi.list({ limit: 5 }),
          inspectionApi.list({ limit: 5 }),
          fixJobApi.list({ limit: 5 }),
          // Separate call: pagination.total here gives the ACCURATE
          // count of active fix jobs across ALL pages, regardless
          // of the limit:5 used for the "recent" list above.
          fixJobApi.list({ limit: 1, statuses: ACTIVE_FIX_JOB_STATUSES }),
        ]);

        if (v.status === 'fulfilled') {
          setVehicles(v.value?.data ?? []);
          setVehicleTotal(v.value?.pagination?.total ?? 0);
        }
        if (i.status === 'fulfilled') {
          setInspectionTotal(i.value?.pagination?.total ?? 0);
        }
        if (f.status === 'fulfilled') {
          setFixJobs(f.value?.data ?? []);
        }
        if (activeF.status === 'fulfilled') {
          setActiveFixJobTotal(activeF.value?.pagination?.total ?? 0);
        }
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  return (
    <div className="max-w-5xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Good day, {user?.firstName} 👋
        </h1>
        <p className="text-gray-500 mt-1">Here&apos;s what&apos;s happening across your account.</p>
      </div>

      {/* Stats — these now reflect TRUE totals via pagination.total,
          not just the length of a 5-item "recent" list */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Registered vehicles', value: vehicleTotal,     icon: Car,            href: '/dashboard/vehicles',   color: 'text-brand-600 bg-brand-50' },
          { label: 'Inspections',         value: inspectionTotal,  icon: ClipboardCheck, href: '/dashboard/inspections', color: 'text-green-600 bg-green-50' },
          { label: 'Active fix jobs',     value: activeFixJobTotal, icon: Wrench,        href: '/dashboard/fix-jobs',   color: 'text-orange-600 bg-orange-50' },
        ].map(({ label, value, icon: Icon, href, color }) => (
          <Link key={label} href={href} className="card p-5 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <div className={`inline-flex h-10 w-10 items-center justify-center rounded-lg ${color}`}>
                <Icon className="h-5 w-5" />
              </div>
              <ArrowRight className="h-4 w-4 text-gray-300" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{isLoading ? '–' : value}</p>
            <p className="text-sm text-gray-500 mt-0.5">{label}</p>
          </Link>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Recent vehicles */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Recent vehicles</h2>
            <Link href="/dashboard/vehicles" className="text-sm text-brand-600 hover:underline">View all</Link>
          </div>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : vehicles.length === 0 ? (
            <div className="text-center py-8">
              <Car className="h-8 w-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-400">No vehicles yet</p>
              {user?.role === 'OWNER' && (
                <Link href="/dashboard/vehicles/register" className="btn-primary mt-3 text-xs px-3 py-1.5 inline-flex">
                  <Plus className="h-3 w-3" /> Register vehicle
                </Link>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {vehicles.map((v) => (
                <Link
                  key={v.id}
                  href={`/dashboard/vehicles/${v.hash}`}
                  className="flex items-center justify-between rounded-lg p-3 hover:bg-gray-50 transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {v.year} {v.make} {v.model}
                    </p>
                    <p className="text-xs text-gray-400">{v.licensePlate}</p>
                  </div>
                  <span className={`badge ${v.status === 'ACTIVE' ? 'text-green-700 bg-green-50' : 'text-gray-600 bg-gray-100'}`}>
                    {v.status}
                  </span>
                </Link>
              ))}
            </div>
          )}
          {vehicleTotal > vehicles.length && (
            <p className="text-xs text-gray-400 mt-3 text-center">
              Showing {vehicles.length} of {vehicleTotal}
            </p>
          )}
        </div>

        {/* Recent fix jobs */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Recent fix jobs</h2>
            <Link href="/dashboard/fix-jobs" className="text-sm text-brand-600 hover:underline">View all</Link>
          </div>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : fixJobs.length === 0 ? (
            <div className="text-center py-8">
              <Wrench className="h-8 w-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-400">No fix jobs yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {fixJobs.map((job) => (
                <Link
                  key={job.id}
                  href={`/dashboard/fix-jobs/${job.id}`}
                  className="flex items-center justify-between rounded-lg p-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{job.description}</p>
                    <p className="text-xs text-gray-400">{formatDate(job.createdAt)}</p>
                  </div>
                  <span className={`badge ml-2 shrink-0 ${statusColour(job.status)}`}>
                    {job.status.replace('_', ' ')}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}