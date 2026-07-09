'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users, Car, ClipboardCheck, Wrench, Building2, CreditCard,
  TrendingUp, Eye, AlertTriangle, RefreshCw, Loader2, Activity,
} from 'lucide-react';
import { toast } from 'sonner';
import { adminApi, ApiClientError } from '@/lib/api';
import type { PlatformMetrics } from '@/lib/api';
import { useAuth } from '@/lib/auth';

function formatNGN(n: number): string {
  if (n >= 1_000_000) return `₦${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `₦${(n / 1_000).toFixed(0)}K`;
  return `₦${n.toLocaleString()}`;
}

function StatCard({ label, value, sub, icon, colour, alert = false }: {
  label: string; value: string | number; sub?: string;
  icon: React.ReactNode; colour: string; alert?: boolean;
}) {
  return (
    <div className={`card p-5 ${alert ? 'border-orange-300 bg-orange-50/30' : ''}`}>
      <div className={`inline-flex h-10 w-10 items-center justify-center rounded-xl mb-3 ${colour}`}>
        {icon}
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-sm text-gray-500 mt-0.5">{label}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      {alert && <p className="text-xs text-orange-500 mt-1 font-semibold">Needs attention</p>}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mt-8 mb-3">
      {children}
    </h2>
  );
}

export default function AdminPlatformPage() {
  const { user } = useAuth();
  const router   = useRouter();
  const [metrics, setMetrics]       = useState<PlatformMetrics | null>(null);
  const [isLoading, setIsLoading]   = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    if (user && user.role !== 'ADMIN') {
      router.replace('/dashboard');
    }
  }, [user, router]);

  const load = async (refresh = false) => {
    if (refresh) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      // adminApi.getMetrics() uses request() which adds Authorization header
      const data = await adminApi.getMetrics();
      setMetrics(data);
      setLastUpdated(new Date());
    } catch (err) {
      if (err instanceof ApiClientError) {
        toast.error(`Failed to load metrics: ${err.message}`);
      } else {
        toast.error('Failed to load platform metrics');
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (isLoading) {
    return (
      <div>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Platform Overview</h1>
            <p className="text-sm text-gray-400 mt-0.5">Loading metrics…</p>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="card h-28 animate-pulse bg-gray-100 border-0" />
          ))}
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="text-center py-20">
        <Activity className="h-12 w-12 text-gray-300 mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-gray-700 mb-2">Could not load metrics</h2>
        <p className="text-sm text-gray-400 mb-6">
          Make sure admin-service is running and all downstream services are healthy.
        </p>
        <button onClick={() => load()} className="btn-primary">Try again</button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Platform Overview</h1>
          {lastUpdated && (
            <p className="text-xs text-gray-400 mt-0.5">
              Last updated {lastUpdated.toLocaleTimeString()}
            </p>
          )}
        </div>
        <button
          onClick={() => load(true)}
          disabled={isRefreshing}
          className="btn-secondary text-sm"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* ── Users ── */}
      <SectionLabel>Users</SectionLabel>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Total users"      value={metrics.users.total}          sub={`+${metrics.users.newThisMonth} this month`} icon={<Users className="h-5 w-5" />}    colour="bg-brand-50 text-brand-600" />
        <StatCard label="Car owners"       value={metrics.users.owners}         icon={<Car className="h-5 w-5" />}                 colour="bg-blue-50 text-blue-600" />
        <StatCard label="Fixers"           value={metrics.users.fixers}         icon={<Wrench className="h-5 w-5" />}              colour="bg-orange-50 text-orange-600" />
        <StatCard label="Workshop admins"  value={metrics.users.workshopAdmins} icon={<Building2 className="h-5 w-5" />}           colour="bg-purple-50 text-purple-600" />
      </div>

      {/* ── Activity ── */}
      <SectionLabel>Activity this month</SectionLabel>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Inspections" value={metrics.inspections.thisMonth}  sub={`${metrics.inspections.inProgress} in progress`}  icon={<ClipboardCheck className="h-5 w-5" />} colour="bg-green-50 text-green-600" />
        <StatCard label="Fix jobs"    value={metrics.fixJobs.thisMonth}      sub={`${metrics.fixJobs.delivered} delivered`}          icon={<Wrench className="h-5 w-5" />}         colour="bg-yellow-50 text-yellow-600" />
        <StatCard label="Revenue"     value={formatNGN(metrics.fixJobs.totalRevenue)} sub="from delivered jobs"               icon={<TrendingUp className="h-5 w-5" />}      colour="bg-emerald-50 text-emerald-600" />
        <StatCard label="Vehicles"    value={metrics.vehicles.active}        sub={`${metrics.vehicles.total} total`}              icon={<Car className="h-5 w-5" />}            colour="bg-sky-50 text-sky-600" />
      </div>

      {/* ── Workshops ── */}
      <SectionLabel>Workshops</SectionLabel>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Active"          value={metrics.workshops.active}          icon={<Building2 className="h-5 w-5" />}      colour="bg-indigo-50 text-indigo-600" />
        <StatCard label="Pending review"  value={metrics.workshops.pendingApproval} icon={<AlertTriangle className="h-5 w-5" />} colour="bg-orange-50 text-orange-600" alert={metrics.workshops.pendingApproval > 0} />
        <StatCard label="Profile views"   value={metrics.workshops.totalViews}      icon={<Eye className="h-5 w-5" />}           colour="bg-pink-50 text-pink-600" />
        <StatCard label="Total"           value={metrics.workshops.total}           icon={<Building2 className="h-5 w-5" />}      colour="bg-gray-50 text-gray-600" />
      </div>

      {/* ── Subscriptions ── */}
      <SectionLabel>Subscriptions</SectionLabel>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Free tier"      value={metrics.subscriptions.free}               icon={<CreditCard className="h-5 w-5" />} colour="bg-gray-50 text-gray-500" />
        <StatCard label="Pro tier"       value={metrics.subscriptions.pro}                icon={<CreditCard className="h-5 w-5" />} colour="bg-brand-50 text-brand-600" />
        <StatCard label="Workshop tier"  value={metrics.subscriptions.workshop}           icon={<CreditCard className="h-5 w-5" />} colour="bg-purple-50 text-purple-600" />
        <StatCard label="Monthly MRR"    value={formatNGN(metrics.subscriptions.totalMonthlyRevenue)} icon={<TrendingUp className="h-5 w-5" />} colour="bg-green-50 text-green-600" />
      </div>
    </div>
  );
}