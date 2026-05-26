'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Car, Wrench, Loader2, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import { ApiClientError } from '@/lib/api';

const registerSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Enter a valid email address'),
  phone: z.string().optional(),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain an uppercase letter')
    .regex(/[0-9]/, 'Must contain a number'),
  role: z.enum(['OWNER', 'FIXER']),
  workshopName: z.string().optional(),
  workshopAddress: z.string().optional(),
}).refine((d) => d.role !== 'FIXER' || !!d.workshopName, {
  message: 'Workshop name is required for fixer accounts',
  path: ['workshopName'],
});

type RegisterForm = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const { register: registerUser, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const defaultRole = (searchParams.get('role') as 'OWNER' | 'FIXER') ?? 'OWNER';
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, isLoading, router]);

  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } =
    useForm<RegisterForm>({
      resolver: zodResolver(registerSchema),
      defaultValues: { role: defaultRole },
    });

  const selectedRole = watch('role');

  const onSubmit = async (data: RegisterForm) => {
    try {
      await registerUser(data);
      document.cookie = 'mc_session=1; path=/; max-age=604800; SameSite=Lax';
      router.push('/dashboard');
    } catch (error) {
      if (error instanceof ApiClientError) {
        toast.error(error.message);
      } else {
        toast.error('Something went wrong. Please try again.');
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-8">
          <Car className="h-7 w-7 text-brand-600" />
          <span className="text-2xl font-bold text-gray-900">Motacare</span>
        </div>

        <div className="card p-8">
          <h1 className="text-xl font-semibold text-gray-900 mb-1">Create your account</h1>
          <p className="text-sm text-gray-500 mb-6">Free to get started</p>

          {/* Role Selector */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            {(['OWNER', 'FIXER'] as const).map((role) => (
              <button
                key={role}
                type="button"
                onClick={() => setValue('role', role)}
                className={`flex items-center gap-2 rounded-lg border p-3 text-sm font-medium transition-all ${
                  selectedRole === role
                    ? 'border-brand-600 bg-brand-50 text-brand-700'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                {role === 'OWNER'
                  ? <Car className="h-4 w-4 shrink-0" />
                  : <Wrench className="h-4 w-4 shrink-0" />}
                {role === 'OWNER' ? 'Car Owner' : 'Workshop / Fixer'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">First name</label>
                <input {...register('firstName')} className="input" placeholder="John" />
                {errors.firstName && <p className="mt-1 text-xs text-red-600">{errors.firstName.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Last name</label>
                <input {...register('lastName')} className="input" placeholder="Doe" />
                {errors.lastName && <p className="mt-1 text-xs text-red-600">{errors.lastName.message}</p>}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email address</label>
              <input {...register('email')} type="email" className="input" placeholder="you@example.com" />
              {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone (optional)</label>
              <input {...register('phone')} type="tel" className="input" placeholder="+234 800 000 0000" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <div className="relative">
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  className="input pr-10"
                  placeholder="Min. 8 chars, 1 uppercase, 1 number"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>}
            </div>

            {/* Fixer-only fields */}
            {selectedRole === 'FIXER' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Workshop name</label>
                  <input {...register('workshopName')} className="input" placeholder="e.g. Ade Motors" />
                  {errors.workshopName && <p className="mt-1 text-xs text-red-600">{errors.workshopName.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Workshop address (optional)</label>
                  <input {...register('workshopAddress')} className="input" placeholder="12 Bode Thomas St, Lagos" />
                </div>
              </>
            )}

            <button type="submit" disabled={isSubmitting} className="btn-primary w-full py-2.5">
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isSubmitting ? 'Creating account…' : 'Create account'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-gray-500 mt-6">
          Already have an account?{' '}
          <Link href="/login" className="text-brand-600 font-medium hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}