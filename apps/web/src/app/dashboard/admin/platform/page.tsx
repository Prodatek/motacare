'use client';

import { useEffect, useState } from 'react';
import {
  Users, Car, ClipboardCheck, Wrench, Building2, CreditCard,
  TrendingUp, Eye, AlertTriangle, RefreshCw, Loader2,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { formatCurrency } from '@/lib/utils';

interface PlatformMetrics {
  users:         { total: number; owners: number; fixers: number; workshopAdmins: number; newThisMonth: number };
  vehicles:      { total: number; active: number };
  inspections:   { total: number; thisMonth: number; completed: number; inProgress: number };
  fixJobs:       { total: number; thisMonth: number; delivered: number; totalRevenue: number };
  workshops:     { total: number; active: number; pendingApproval: number; totalViews: number };
  subscriptions: { free: number; pro: number; workshop: number; totalMonthlyRevenue: number };
  updatedAt: string;
}

function MetricCard({ label, value, sub, icon, colour, alert }: {
  label: string; value: string | number; sub?: string;
  icon: React.ReactNode; colour: string; alert?: boolean;
}) {
  return (
    <div className={`card p-5 ${alert ? 'border-orange-300' : ''}`}>
      <div className={`inline-flex h-10 w-10 items-center justify-center rounded-xl mb-3 ${colour}`}>
        {icon}
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-sm text-gray-500">{label}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      {alert && <p className="text-xs text-orange-500 mt-1 font-medium">⚠ Needs attention</p>}
    </div>
  );
}

export default function AdminPlatformPage() {
  const { user } = useAuth();
  const router   = useRouter();
  const [metrics, setMetrics] = useState<PlatformMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Guard — only ADMIN can see this page
  useEffect(() => {
    if (user && user.role !== 'ADMIN') router.replace('/dashboard');
  }, [user, router]);

  const load = async (refresh = false) => {
    if (refresh) setIsRefreshing(true);
    else setIsLoading(true);
    try {
      const res = await fetch('/api/admin/platform/metrics');
      if (res.ok) {
        const body = await res.json();
        setMetrics(body.data);
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
    </div>
  );

  if (!metrics) return (
    <div className="text-center py-16 text-gray-500">Failed to load platform metrics</div>
  );

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Platform Overview</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Updated {new Date(metrics.updatedAt).toLocaleTimeString()}
          </p>
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

      {/* Users */}
      <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Users</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <MetricCard label="Total users"       value={metrics.users.total}          sub={`+${metrics.users.newThisMonth} this month`} icon={<Users className="h-5 w-5" />} colour="bg-brand-50 text-brand-600" />
        <MetricCard label="Car owners"        value={metrics.users.owners}         icon={<Car className="h-5 w-5" />}                colour="bg-blue-50 text-blue-600" />
        <MetricCard label="Fixers"            value={metrics.users.fixers}         icon={<Wrench className="h-5 w-5" />}            colour="bg-orange-50 text-orange-600" />
        <MetricCard label="Workshop admins"   value={metrics.users.workshopAdmins} icon={<Building2 className="h-5 w-5" />}         colour="bg-purple-50 text-purple-600" />
      </div>

      {/* Activity */}
      <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Activity (this month)</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <MetricCard label="Inspections"  value={metrics.inspections.thisMonth} sub={`${metrics.inspections.inProgress} in progress`} icon={<ClipboardCheck className="h-5 w-5" />} colour="bg-green-50 text-green-600" />
        <MetricCard label="Fix jobs"     value={metrics.fixJobs.thisMonth}     sub={`${metrics.fixJobs.delivered} delivered`}         icon={<Wrench className="h-5 w-5" />}           colour="bg-yellow-50 text-yellow-600" />
        <MetricCard label="Revenue (NGN)" value={formatCurrency(metrics.fixJobs.totalRevenue, 'NGN')} icon={<TrendingUp className="h-5 w-5" />} colour="bg-emerald-50 text-emerald-600" />
        <MetricCard label="Vehicles registered" value={metrics.vehicles.active} sub={`${metrics.vehicles.total} total`} icon={<Car className="h-5 w-5" />} colour="bg-sky-50 text-sky-600" />
      </div>

      {/* Workshops */}
      <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Workshops</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <MetricCard label="Active workshops"    value={metrics.workshops.active}          icon={<Building2 className="h-5 w-5" />} colour="bg-indigo-50 text-indigo-600" />
        <MetricCard label="Pending approval"    value={metrics.workshops.pendingApproval} icon={<AlertTriangle className="h-5 w-5" />} colour="bg-orange-50 text-orange-600" alert={metrics.workshops.pendingApproval > 0} />
        <MetricCard label="Total profile views" value={metrics.workshops.totalViews}      icon={<Eye className="h-5 w-5" />}        colour="bg-pink-50 text-pink-600" />
        <MetricCard label="Total workshops"     value={metrics.workshops.total}           icon={<Building2 className="h-5 w-5" />} colour="bg-gray-50 text-gray-600" />
      </div>

      {/* Subscriptions */}
      <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Subscriptions</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <MetricCard label="Free tier"     value={metrics.subscriptions.free}               icon={<CreditCard className="h-5 w-5" />} colour="bg-gray-50 text-gray-600" />
        <MetricCard label="Pro tier"      value={metrics.subscriptions.pro}                icon={<CreditCard className="h-5 w-5" />} colour="bg-brand-50 text-brand-600" />
        <MetricCard label="Workshop tier" value={metrics.subscriptions.workshop}           icon={<CreditCard className="h-5 w-5" />} colour="bg-purple-50 text-purple-600" />
        <MetricCard label="Monthly MRR (NGN)" value={formatCurrency(metrics.subscriptions.totalMonthlyRevenue, 'NGN')} icon={<TrendingUp className="h-5 w-5" />} colour="bg-green-50 text-green-600" />
      </div>
    </div>
  );
}