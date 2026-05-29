'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Car, Plus, Fuel, Settings2, ChevronRight } from 'lucide-react';
import { vehicleApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { Vehicle } from '@motacare/shared-types';
import { formatDate } from '@/lib/utils';

export default function VehiclesPage() {
  const { user } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    vehicleApi.list({ limit: 20 })
      .then((res) => { setVehicles(res.data); setTotal(res?.pagination?.total ?? 0); })
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vehicles</h1>
          <p className="text-gray-500 mt-0.5 text-sm">
            {isLoading ? '…' : `${total} registered`}
          </p>
        </div>
        {user?.role === 'OWNER' && (
          <Link href="/dashboard/vehicles/register" className="btn-primary">
            <Plus className="h-4 w-4" />
            Register vehicle
          </Link>
        )}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card h-24 animate-pulse bg-gray-100 border-0" />
          ))}
        </div>
      ) : (!vehicles || vehicles.length === 0) ? (
        <div className="card p-16 text-center">
          <Car className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-700 mb-2">No vehicles registered</h2>
          <p className="text-sm text-gray-400 mb-6">
            Register your car to start tracking inspections and maintenance history.
          </p>
          {user?.role === 'OWNER' && (
            <Link href="/dashboard/vehicles/register" className="btn-primary inline-flex">
              <Plus className="h-4 w-4" /> Register your first vehicle
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {vehicles.map((v) => (
            <Link
              key={v.id}
              href={`/dashboard/vehicles/${v.hash}`}
              className="card p-5 flex items-center gap-4 hover:shadow-md transition-shadow group"
            >
              {/* Car icon */}
              <div className="h-12 w-12 rounded-xl bg-brand-50 flex items-center justify-center shrink-0">
                <Car className="h-6 w-6 text-brand-600" />
              </div>

              {/* Details */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-gray-900">
                    {v.year} {v.make} {v.model}
                  </h3>
                  <span className={`badge text-xs ${v.status === 'ACTIVE' ? 'text-green-700 bg-green-50' : 'text-gray-500 bg-gray-100'}`}>
                    {v.status}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                  <span>{v.licensePlate}</span>
                  <span>·</span>
                  <span className="flex items-center gap-1">
                    <Fuel className="h-3 w-3" /> {v.fuelType}
                  </span>
                  <span>·</span>
                  <span className="flex items-center gap-1">
                    <Settings2 className="h-3 w-3" /> {v.transmissionType}
                  </span>
                </div>
                <p className="text-xs text-gray-300 mt-1">
                  Registered {formatDate(v.createdAt)}
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