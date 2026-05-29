'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Car, Fuel, Settings2, Calendar, Hash,
  ClipboardCheck, Loader2, AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { vehicleApi, inspectionApi, ApiClientError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { Vehicle, Inspection } from '@motacare/shared-types';
import { formatDate, statusColour, cn } from '@/lib/utils';
import { X } from 'lucide-react';

// ── Start Inspection Modal (reused from vehicles list) ──────

function StartInspectionModal({
  vehicle,
  onClose,
  onCreated,
}: {
  vehicle: Vehicle;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [mileage, setMileage] = useState(String(vehicle.mileageAtRegistration));
  const [symptoms, setSymptoms] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const inspection = await inspectionApi.create(
        vehicle.hash,
        Number(mileage),
        symptoms ? symptoms.split('\n').map((s) => s.trim()).filter(Boolean) : undefined,
      );
      toast.success('Inspection started!');
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
          <h2 className="font-semibold text-gray-900">Start Inspection</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Current mileage (km) *
            </label>
            <input
              type="number"
              value={mileage}
              onChange={(e) => setMileage(e.target.value)}
              className="input"
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
              placeholder={'Strange noise when braking\nFuel consumption increased'}
            />
          </div>
          <div className="flex gap-3">
            <button type="submit" disabled={isSubmitting} className="btn-primary flex-1">
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

// ── Vehicle Detail Page ─────────────────────────────────────

export default function VehicleDetailPage() {
  const { hash } = useParams<{ hash: string }>();
  const { user } = useAuth();
  const router = useRouter();

  const isFixer = user?.role === 'FIXER' || user?.role === 'ADMIN';

  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showInspectModal, setShowInspectModal] = useState(false);

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      try {
        const [v, insp] = await Promise.allSettled([
          vehicleApi.get(hash),
          inspectionApi.list({ vehicleHash: hash, limit: 10 }),
        ]);
        if (v.status === 'fulfilled') setVehicle(v.value);
        if (insp.status === 'fulfilled') setInspections(insp.value?.data ?? []);
      } catch {
        toast.error('Failed to load vehicle');
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [hash]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
      </div>
    );
  }

  if (!vehicle) {
    return (
      <div className="text-center py-16">
        <AlertTriangle className="h-12 w-12 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-500">Vehicle not found.</p>
        <Link href="/dashboard/vehicles" className="btn-secondary mt-4 inline-flex">
          Back to vehicles
        </Link>
      </div>
    );
  }

  const specs = [
    { icon: <Calendar className="h-4 w-4" />, label: 'Year', value: String(vehicle.year) },
    { icon: <Fuel className="h-4 w-4" />, label: 'Fuel', value: vehicle.fuelType },
    { icon: <Settings2 className="h-4 w-4" />, label: 'Transmission', value: vehicle.transmissionType },
    { icon: <Car className="h-4 w-4" />, label: 'Engine', value: vehicle.engineCapacity ?? '—' },
    { icon: <Hash className="h-4 w-4" />, label: 'VIN', value: vehicle.vin },
    {
      icon: <Car className="h-4 w-4" />, label: 'Mileage at registration',
      value: `${vehicle.mileageAtRegistration.toLocaleString()} km`,
    },
  ];

  return (
    <div className="max-w-3xl">
      <Link
        href="/dashboard/vehicles"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4"
      >
        <ArrowLeft className="h-4 w-4" /> Back to vehicles
      </Link>

      {/* Vehicle header */}
      <div className="card p-6 mb-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-xl bg-brand-50 flex items-center justify-center shrink-0">
              <Car className="h-7 w-7 text-brand-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                {vehicle.year} {vehicle.make} {vehicle.model}
                {vehicle.trim ? ` ${vehicle.trim}` : ''}
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <span className="font-mono text-sm text-gray-600">{vehicle.licensePlate}</span>
                <span className={cn(
                  'badge text-xs',
                  vehicle.status === 'ACTIVE' ? 'text-green-700 bg-green-50' : 'text-gray-500 bg-gray-100',
                )}>
                  {vehicle.status}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                Registered {formatDate(vehicle.createdAt)}
              </p>
            </div>
          </div>

          {/* Fixer action */}
          {isFixer && vehicle.status === 'ACTIVE' && (
            <button
              onClick={() => setShowInspectModal(true)}
              className="btn-primary"
            >
              <ClipboardCheck className="h-4 w-4" />
              Start Inspection
            </button>
          )}
        </div>

        {/* Specs grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-5 pt-5 border-t border-gray-100">
          {specs.map(({ icon, label, value }) => (
            <div key={label} className="flex items-start gap-2">
              <div className="text-gray-400 mt-0.5 shrink-0">{icon}</div>
              <div className="min-w-0">
                <p className="text-xs text-gray-400">{label}</p>
                <p className="text-sm font-medium text-gray-900 truncate">{value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Color swatch */}
        {vehicle.color && (
          <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2">
            <div className="h-4 w-4 rounded-full border border-gray-200 bg-gray-100" />
            <span className="text-sm text-gray-600">{vehicle.color}</span>
          </div>
        )}
      </div>

      {/* Inspection history */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">Inspection history</h2>
          <Link
            href={`/dashboard/inspections?vehicleHash=${vehicle.hash}`}
            className="text-sm text-brand-600 hover:underline"
          >
            View all
          </Link>
        </div>

        {inspections.length === 0 ? (
          <div className="text-center py-8">
            <ClipboardCheck className="h-8 w-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-400">No inspections recorded yet</p>
            {isFixer && vehicle.status === 'ACTIVE' && (
              <button
                onClick={() => setShowInspectModal(true)}
                className="btn-primary mt-3 text-xs px-3 py-1.5 inline-flex"
              >
                Start first inspection
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {inspections.map((insp) => (
              <Link
                key={insp.id}
                href={`/dashboard/inspections/${insp.id}`}
                className="flex items-center justify-between rounded-lg px-3 py-3 hover:bg-gray-50 transition-colors"
              >
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={cn('badge text-xs', statusColour(insp.status))}>
                      {insp.status.replace(/_/g, ' ')}
                    </span>
                    <span className="text-xs text-gray-400">{formatDate(insp.createdAt)}</span>
                  </div>
                  <p className="text-xs text-gray-400">
                    {insp.mileageAtInspection.toLocaleString()} km
                  </p>
                </div>
                <ArrowLeft className="h-4 w-4 text-gray-300 rotate-180" />
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Start Inspection Modal */}
      {showInspectModal && (
        <StartInspectionModal
          vehicle={vehicle}
          onClose={() => setShowInspectModal(false)}
          onCreated={(id) => {
            setShowInspectModal(false);
            router.push(`/dashboard/inspections/${id}`);
          }}
        />
      )}
    </div>
  );
}