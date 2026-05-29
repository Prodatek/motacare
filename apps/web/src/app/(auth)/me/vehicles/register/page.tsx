'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { vehicleApi, ApiClientError } from '@/lib/api';

const schema = z.object({
  vin: z.string().length(17, 'VIN must be exactly 17 characters')
    .regex(/^[A-HJ-NPR-Z0-9]{17}$/i, 'VIN contains invalid characters (no I, O, Q)'),
  licensePlate: z.string().min(2).max(20),
  make: z.string().min(1, 'Make is required'),
  model: z.string().min(1, 'Model is required'),
  year: z.coerce.number().int().min(1900).max(new Date().getFullYear() + 1),
  color: z.string().optional(),
  fuelType: z.enum(['PETROL', 'DIESEL', 'ELECTRIC', 'HYBRID', 'CNG', 'LPG']),
  transmissionType: z.enum(['MANUAL', 'AUTOMATIC', 'CVT']),
  engineCapacity: z.string().optional(),
  mileageAtRegistration: z.coerce.number().int().min(0).default(0),
});

type FormData = z.infer<typeof schema>;

export default function RegisterVehiclePage() {
  const router = useRouter();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { fuelType: 'PETROL', transmissionType: 'MANUAL', mileageAtRegistration: 0 },
  });

  const onSubmit = async (data: FormData) => {
    try {
      const vehicle = await vehicleApi.register(data);
      toast.success('Vehicle registered successfully!');
      router.push(`/dashboard/vehicles/${vehicle.hash}`);
    } catch (error) {
      if (error instanceof ApiClientError) {
        toast.error(error.message);
      } else {
        toast.error('Failed to register vehicle. Please try again.');
      }
    }
  };

  const Field = ({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <Link href="/dashboard/vehicles" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft className="h-4 w-4" /> Back to vehicles
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Register a vehicle</h1>
        <p className="text-gray-500 text-sm mt-1">
          Fill in your vehicle details. The VIN creates a permanent identity for your car.
        </p>
      </div>

      <div className="card p-8">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

          {/* VIN — most important field */}
          <Field label="VIN (Vehicle Identification Number) *" error={errors.vin?.message}>
            <input
              {...register('vin')}
              className="input font-mono uppercase"
              placeholder="e.g. JH4KA7532MC000001"
              maxLength={17}
            />
            <p className="mt-1 text-xs text-gray-400">
              17 characters — found on dashboard, driver door frame, or vehicle documents.
            </p>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Make *" error={errors.make?.message}>
              <input {...register('make')} className="input" placeholder="e.g. Toyota" />
            </Field>
            <Field label="Model *" error={errors.model?.message}>
              <input {...register('model')} className="input" placeholder="e.g. Camry" />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Year *" error={errors.year?.message}>
              <input {...register('year')} type="number" className="input" placeholder="e.g. 2019" />
            </Field>
            <Field label="Colour" error={errors.color?.message}>
              <input {...register('color')} className="input" placeholder="e.g. Pearl White" />
            </Field>
          </div>

          <Field label="License plate *" error={errors.licensePlate?.message}>
            <input {...register('licensePlate')} className="input uppercase" placeholder="e.g. LAG-001-AA" />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Fuel type *" error={errors.fuelType?.message}>
              <select {...register('fuelType')} className="input bg-white">
                {['PETROL', 'DIESEL', 'ELECTRIC', 'HYBRID', 'CNG', 'LPG'].map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </Field>
            <Field label="Transmission *" error={errors.transmissionType?.message}>
              <select {...register('transmissionType')} className="input bg-white">
                {['MANUAL', 'AUTOMATIC', 'CVT'].map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Engine capacity" error={errors.engineCapacity?.message}>
              <input {...register('engineCapacity')} className="input" placeholder="e.g. 2.0L" />
            </Field>
            <Field label="Current mileage (km)" error={errors.mileageAtRegistration?.message}>
              <input {...register('mileageAtRegistration')} type="number" className="input" placeholder="e.g. 45000" />
            </Field>
          </div>

          <div className="pt-2 flex gap-3">
            <button type="submit" disabled={isSubmitting} className="btn-primary px-8">
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isSubmitting ? 'Registering…' : 'Register vehicle'}
            </button>
            <Link href="/dashboard/vehicles" className="btn-secondary px-6">Cancel</Link>
          </div>
        </form>
      </div>
    </div>
  );
}