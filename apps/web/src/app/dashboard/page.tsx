'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Car, ClipboardCheck, Wrench, Plus, ArrowRight, TrendingUp } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { vehicleApi, inspectionApi, fixJobApi } from '@/lib/api';
import type { Vehicle, FixJob } from '@motacare/shared-types';
import { formatDate } from '@/lib/utils';

const ACTIVE_STATUSES = ['PENDING', 'IN_PROGRESS', 'AWAITING_PARTS'];

function StatCard({ label, value, icon, colour, subtext, href }: {
  label: string; value: number | string; icon: React.ReactNode;
  colour: string; subtext?: string; href: string;
}) {
  const colours: Record<string, { icon: string; glow: string; text: string }> = {
    brand:  { icon: 'rgba(239,68,68,0.15)',  glow: 'rgba(239,68,68,0.06)',  text: '#f87171' },
    green:  { icon: 'rgba(16,185,129,0.15)', glow: 'rgba(16,185,129,0.06)', text: '#34d399' },
    amber:  { icon: 'rgba(245,158,11,0.15)', glow: 'rgba(245,158,11,0.06)', text: '#fbbf24' },
  };
  const c = colours[colour] ?? colours.brand;

  return (
    <Link href={href} style={{ textDecoration: 'none', display: 'block' }}>
      <div className="card" style={{ padding: 20, cursor: 'pointer', background: `linear-gradient(135deg, ${c.glow}, var(--surface-1))`, position: 'relative', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: c.icon, display: 'flex', alignItems: 'center', justifyContent: 'center', color: c.text }}>
            {icon}
          </div>
          <ArrowRight style={{ width: 16, height: 16, color: 'var(--text-tertiary)' }} />
        </div>
        <p style={{ margin: '0 0 4px', fontSize: 32, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-1px' }}>{value}</p>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>{label}</p>
        {subtext && <p style={{ margin: '4px 0 0', fontSize: 12, color: c.text }}>{subtext}</p>}
      </div>
    </Link>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const today = new Date().toLocaleDateString('en-NG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [fixJobs, setFixJobs] = useState<FixJob[]>([]);
  const [vehicleTotal, setVehicleTotal] = useState(0);
  const [inspectionTotal, setInspectionTotal] = useState(0);
  const [activeFixJobTotal, setActiveFixJobTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [v, i, f, af] = await Promise.allSettled([
          vehicleApi.list({ limit: 5 }),
          inspectionApi.list({ limit: 1 }),
          fixJobApi.list({ limit: 5 }),
          fixJobApi.list({ limit: 1, statuses: ACTIVE_STATUSES }),
        ]);
        if (v.status === 'fulfilled') { setVehicles(v.value?.data ?? []); setVehicleTotal(v.value?.pagination?.total ?? 0); }
        if (i.status === 'fulfilled') setInspectionTotal(i.value?.pagination?.total ?? 0);
        if (f.status === 'fulfilled') setFixJobs(f.value?.data ?? []);
        if (af.status === 'fulfilled') setActiveFixJobTotal(af.value?.pagination?.total ?? 0);
      } finally { setIsLoading(false); }
    }
    load();
  }, []);

  const statusColour: Record<string, string> = {
    ACTIVE: 'status-active', PENDING: 'status-pending', IN_PROGRESS: 'status-progress',
    COMPLETED: 'status-completed', NEEDS_FOLLOWUP: 'status-followup',
    CANCELLED: 'status-cancelled', DELIVERED: 'status-delivered', DRAFT: 'status-draft',
  };

  return (
    <div style={{ maxWidth: 1000 }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <p style={{ margin: '0 0 4px', fontSize: 12, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>{today}</p>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
          Good day, {user?.firstName} 👋
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--text-secondary)' }}>Here's what's happening across your account.</p>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 24 }}>
        <StatCard label="Registered vehicles"  value={isLoading ? '–' : vehicleTotal}     icon={<Car style={{ width: 20, height: 20 }} />}           colour="brand" href="/dashboard/vehicles"   subtext={vehicleTotal > 0 ? `${vehicleTotal} total` : undefined} />
        <StatCard label="Total inspections"    value={isLoading ? '–' : inspectionTotal}  icon={<ClipboardCheck style={{ width: 20, height: 20 }} />} colour="green" href="/dashboard/inspections" />
        <StatCard label="Active fix jobs"      value={isLoading ? '–' : activeFixJobTotal} icon={<Wrench style={{ width: 20, height: 20 }} />}          colour="amber" href="/dashboard/fix-jobs" subtext={activeFixJobTotal > 0 ? '● Live' : undefined} />
      </div>

      {/* Content grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16 }}>

        {/* Recent vehicles */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Recent vehicles</h2>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {user?.role === 'OWNER' && (
                <Link href="/dashboard/vehicles/register" className="btn-primary" style={{ height: 28, padding: '0 10px', fontSize: 12 }}>
                  <Plus style={{ width: 12, height: 12 }} /> Add
                </Link>
              )}
              <Link href="/dashboard/vehicles" style={{ fontSize: 12, color: 'var(--brand-400)', textDecoration: 'none' }}>View all →</Link>
            </div>
          </div>

          {isLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 52, borderRadius: 8 }} />)}
            </div>
          ) : vehicles.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <Car style={{ width: 32, height: 32, color: 'var(--text-tertiary)', margin: '0 auto 8px' }} />
              <p style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>No vehicles registered yet</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {vehicles.map(v => (
                <Link key={v.id} href={`/dashboard/vehicles/${v.hash}`}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--surface-1)', borderRadius: 8, textDecoration: 'none', transition: 'background 0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface-1)')}
                >
                  <div style={{ width: 34, height: 34, borderRadius: 8, background: 'rgba(239,68,68,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Car style={{ width: 16, height: 16, color: 'var(--brand-400)' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {v.year} {v.make} {v.model}
                    </p>
                    <p style={{ margin: 0, fontSize: 12, color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>{v.licensePlate}</p>
                  </div>
                  <span className={`badge ${v.status === 'ACTIVE' ? 'status-active' : 'status-cancelled'}`}>{v.status}</span>
                </Link>
              ))}
            </div>
          )}

          {vehicleTotal > vehicles.length && (
            <p style={{ fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center', marginTop: 12 }}>
              Showing {vehicles.length} of {vehicleTotal}
            </p>
          )}
        </div>

        {/* Recent fix jobs */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Recent fix jobs</h2>
            <Link href="/dashboard/fix-jobs" style={{ fontSize: 12, color: 'var(--brand-400)', textDecoration: 'none' }}>View all →</Link>
          </div>

          {isLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 52, borderRadius: 8 }} />)}
            </div>
          ) : fixJobs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <Wrench style={{ width: 32, height: 32, color: 'var(--text-tertiary)', margin: '0 auto 8px' }} />
              <p style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>No fix jobs yet</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {fixJobs.map(job => {
                const borderColours: Record<string, string> = {
                  IN_PROGRESS: '#f59e0b', PENDING: '#6366f1', AWAITING_PARTS: '#ef4444',
                  COMPLETED: '#10b981', DELIVERED: '#6366f1', CANCELLED: '#6b7280',
                };
                return (
                  <Link key={job.id} href={`/dashboard/fix-jobs/${job.id}`}
                    style={{ display: 'block', padding: '10px 12px', background: 'var(--surface-1)', borderRadius: 8, textDecoration: 'none', borderLeft: `3px solid ${borderColours[job.status] ?? 'var(--surface-border2)'}`, transition: 'background 0.15s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface-1)')}
                  >
                    <p style={{ margin: '0 0 3px', fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{job.description}</p>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span className={`badge ${statusColour[job.status] ?? ''}`} style={{ fontSize: 11 }}>{job.status.replace('_', ' ')}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{formatDate(job.createdAt)}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}