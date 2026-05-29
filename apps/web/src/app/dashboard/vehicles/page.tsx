'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Car, Plus, Fuel, Settings2, ChevronRight,
  Search, ClipboardCheck, X, Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { vehicleApi, inspectionApi, ApiClientError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { Vehicle } from '@motacare/shared-types';
import { formatDate, cn } from '@/lib/utils';

// ── Start Inspection Modal ──────────────────────────────────

function StartInspectionModal({
  vehicle,
  onClose,
  onCreated,
}: {
  vehicle: Vehicle;
  onClose: () => void;
  onCreated: (inspectionId: string) => void;
}) {
  const [mileage, setMileage] = useState('');
  const [symptoms, setSymptoms] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mileage || Number(mileage) < 0) {
      toast.error('Please enter the current mileage');
      return;
    }
    setIsSubmitting(true);
    try {
      const inspection = await inspectionApi.create(
        vehicle.hash,
        Number(mileage),
        symptoms
          ? symptoms.split('\n').map((s) => s.trim()).filter(Boolean)
          : undefined,
      );
      toast.success('Inspection session started!');
      onCreated((inspection as any).id);
    } catch (error) {
      if (error instanceof ApiClientError) toast.error(error.message);
      else toast.error('Failed to start inspection');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-semibold text-gray-900">Start Inspection</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {vehicle.year} {vehicle.make} {vehicle.model} — {vehicle.licensePlate}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Current mileage (km) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={mileage}
              onChange={(e) => setMileage(e.target.value)}
              className="input"
              placeholder={`At least ${vehicle.mileageAtRegistration.toLocaleString()} km`}
              min={vehicle.mileageAtRegistration}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Owner-reported symptoms
              <span className="text-gray-400 font-normal ml-1">(optional — one per line)</span>
            </label>
            <textarea
              value={symptoms}
              onChange={(e) => setSymptoms(e.target.value)}
              rows={3}
              className="input resize-none text-sm"
              placeholder={'Strange noise when braking\nEngine light came on\nFuel consumption increased'}
            />
            <p className="text-xs text-gray-400 mt-1">
              These are sent to the AI to generate a tailored checklist for this vehicle.
            </p>
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary flex-1"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isSubmitting ? 'Starting…' : 'Start inspection'}
            </button>
            <button type="button" onClick={onClose} className="btn-secondary px-5">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────

export default function VehiclesPage() {
  const { user } = useAuth();
  const router = useRouter();

  const isFixer = user?.role === 'FIXER' || user?.role === 'ADMIN';
  const isOwner = user?.role === 'OWNER';

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);

  // Debounce search input — don't hammer the API on every keystroke
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  const loadVehicles = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await vehicleApi.list({
        limit: 30,
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
      });
      setVehicles(res?.data ?? []);
      setTotal(res?.pagination?.total ?? 0);
    } catch {
      setVehicles([]);
      setTotal(0);
    } finally {
      setIsLoading(false);
    }
  }, [debouncedSearch]);

  useEffect(() => { loadVehicles(); }, [loadVehicles]);

  const handleInspectionCreated = (inspectionId: string) => {
    setSelectedVehicle(null);
    router.push(`/dashboard/inspections/${inspectionId}`);
  };

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vehicles</h1>
          <p className="text-gray-500 mt-0.5 text-sm">
            {isLoading ? '…' : `${total} ${isFixer ? 'registered vehicles' : 'your vehicles'}`}
          </p>
        </div>
        {isOwner && (
          <Link href="/dashboard/vehicles/register" className="btn-primary">
            <Plus className="h-4 w-4" />
            Register vehicle
          </Link>
        )}
      </div>

      {/* Search bar — fixers only */}
      {isFixer && (
        <div className="relative mb-5">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by plate, make, model, or VIN…"
            className="input pl-10 pr-10"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card h-24 animate-pulse bg-gray-100 border-0" />
          ))}
        </div>
      ) : vehicles.length === 0 ? (
        <div className="card p-16 text-center">
          <Car className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-700 mb-2">
            {debouncedSearch ? 'No vehicles found' : 'No vehicles registered'}
          </h2>
          <p className="text-sm text-gray-400 mb-6">
            {debouncedSearch
              ? `No results for "${debouncedSearch}". Try a different search term.`
              : isOwner
                ? 'Register your car to start tracking inspections and maintenance history.'
                : 'No vehicles are registered in the system yet.'}
          </p>
          {isOwner && !debouncedSearch && (
            <Link href="/dashboard/vehicles/register" className="btn-primary inline-flex">
              <Plus className="h-4 w-4" /> Register your first vehicle
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {vehicles.map((v) => (
            <div
              key={v.id}
              className="card p-5 flex items-center gap-4 hover:shadow-md transition-shadow"
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
                  <span className={cn(
                    'badge text-xs',
                    v.status === 'ACTIVE' ? 'text-green-700 bg-green-50' : 'text-gray-500 bg-gray-100',
                  )}>
                    {v.status}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                  <span className="font-mono">{v.licensePlate}</span>
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
                  {isFixer && (
                    <span className="ml-2 font-mono text-gray-300">
                      {v.hash.slice(0, 12)}…
                    </span>
                  )}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0">
                {/* Fixer: start inspection button */}
                {isFixer && v.status === 'ACTIVE' && (
                  <button
                    onClick={() => setSelectedVehicle(v)}
                    className="btn-primary text-xs px-3 py-1.5 gap-1.5"
                    title="Start inspection for this vehicle"
                  >
                    <ClipboardCheck className="h-3.5 w-3.5" />
                    Inspect
                  </button>
                )}

                {/* View detail */}
                <Link
                  href={`/dashboard/vehicles/${v.hash}`}
                  className="btn-secondary text-xs px-3 py-1.5"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Start Inspection Modal */}
      {selectedVehicle && (
        <StartInspectionModal
          vehicle={selectedVehicle}
          onClose={() => setSelectedVehicle(null)}
          onCreated={handleInspectionCreated}
        />
      )}
    </div>
  );
}