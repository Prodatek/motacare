'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Wrench, Users, ClipboardCheck, TrendingUp, Star,
  CheckCircle2, Clock, AlertCircle, Plus, Loader2,
  ArrowRight, ChevronRight, X, LogOut, DollarSign, Eye,
} from 'lucide-react';
import { toast } from 'sonner';
import { workshopApi, ApiClientError } from '@/lib/api';
import type { Workshop, WorkshopMember, WorkshopStats } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn, formatDate, formatCurrency } from '@/lib/utils';

// ── Helpers ──────────────────────────────────────────────────

const SPECIALTIES = [
  'Engine', 'Brakes', 'Tyres', 'Electrical', 'Fluids',
  'Transmission', 'Body & Paint', 'Exhaust', 'AC & Cooling',
  'Suspension', 'Diagnostics', 'Fabrication',
];

// ── Stat Card ────────────────────────────────────────────────

function StatCard({ label, value, sub, icon, colour }: {
  label: string; value: string | number; sub?: string;
  icon: React.ReactNode; colour: string;
}) {
  return (
    <div className="card p-5">
      <div className={cn('inline-flex h-10 w-10 items-center justify-center rounded-xl mb-3', colour)}>
        {icon}
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-sm text-gray-500">{label}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

// ── JOIN FORM (fixer without a workshop) ─────────────────────

function JoinWorkshopView({ onJoined }: { onJoined: () => void }) {
  const [tab, setTab] = useState<'browse' | 'create'>('browse');
  const [workshops, setWorkshops] = useState<Workshop[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Create workshop form
  const [createForm, setCreateForm] = useState({
    name: '', description: '', address: '', city: '', state: '',
    phone: '', email: '', specialties: [] as string[],
  });
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    workshopApi.list({ limit: 20, search: search || undefined })
      .then((r) => setWorkshops(r?.data ?? []))
      .finally(() => setIsLoading(false));
  }, [search]);

  const handleJoin = async () => {
    if (!selectedId) { toast.error('Select a workshop first'); return; }
    setIsSubmitting(true);
    try {
      await workshopApi.join(selectedId, note || undefined);
      toast.success('Join request sent! You\'ll be notified when the admin approves you.');
      onJoined();
    } catch (e) {
      if (e instanceof ApiClientError) toast.error(e.message);
      else toast.error('Failed to submit request');
    } finally { setIsSubmitting(false); }
  };

  const handleCreate = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (createForm.specialties.length === 0) { toast.error('Select at least one specialty'); return; }
    setIsCreating(true);
    try {
      await workshopApi.create(createForm as any);
      toast.success('Workshop created! It\'s pending admin approval. You\'ll be notified when it goes live.');
      onJoined();
    } catch (e) {
      if (e instanceof ApiClientError) toast.error(e.message);
      else toast.error('Failed to create workshop');
    } finally { setIsCreating(false); }
  };

  const toggleSpecialty = (s: string) => {
    setCreateForm((prev) => ({
      ...prev,
      specialties: prev.specialties.includes(s)
        ? prev.specialties.filter((x) => x !== s)
        : [...prev.specialties, s],
    }));
  };

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Workshops</h1>
        <p className="text-gray-500 text-sm mt-0.5">
          Join an existing workshop or create your own
        </p>
      </div>

      {/* Tabs */}
      <div className="inline-flex rounded-xl border border-gray-200 bg-white p-1 mb-6">
        {(['browse', 'create'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={cn(
            'px-5 py-2 rounded-lg text-sm font-medium transition-colors capitalize',
            tab === t ? 'bg-brand-600 text-white' : 'text-gray-500 hover:text-gray-700',
          )}>
            {t === 'browse' ? 'Join a workshop' : 'Create a workshop'}
          </button>
        ))}
      </div>

      {tab === 'browse' ? (
        <div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or city…"
            className="input mb-4"
          />

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <div key={i} className="card h-20 animate-pulse bg-gray-100 border-0" />)}
            </div>
          ) : workshops.length === 0 ? (
            <div className="card p-12 text-center">
              <Wrench className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No workshops found. Try creating one!</p>
            </div>
          ) : (
            <div className="space-y-3 mb-5">
              {workshops.map((w) => (
                <div
                  key={w.id}
                  onClick={() => setSelectedId(w.id === selectedId ? null : w.id)}
                  className={cn(
                    'card p-5 cursor-pointer transition-all',
                    selectedId === w.id ? 'border-brand-500 ring-2 ring-brand-100' : 'hover:border-gray-300',
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="font-semibold text-gray-900">{w.name}</h3>
                        {w.featured && (
                          <span className="badge text-xs bg-amber-50 text-amber-700">
                            <Star className="h-2.5 w-2.5 mr-1" />Featured
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500">{w.city}, {w.state}</p>
                      {w.specialties.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {w.specialties.map((s) => (
                            <span key={s} className="badge text-xs bg-brand-50 text-brand-700">{s}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-medium text-gray-900">{w.currentFixerCount}/{w.maxFixers}</p>
                      <p className="text-xs text-gray-400">fixers</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {selectedId && (
            <div className="card p-5 border-brand-200 bg-brand-50/30">
              <h3 className="font-semibold text-gray-900 mb-3">Your application message</h3>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                className="input resize-none text-sm mb-3"
                placeholder="Tell the workshop admin about your experience, specialties, and why you'd like to join (optional but recommended)…"
              />
              <button onClick={handleJoin} disabled={isSubmitting} className="btn-primary">
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Send join request
              </button>
            </div>
          )}
        </div>
      ) : (
        <form onSubmit={handleCreate} className="card p-6 space-y-4">
          <h2 className="font-semibold text-gray-900 text-base mb-1">Create your workshop</h2>
          <p className="text-sm text-gray-500">
            New workshops go through a brief review before going live. Usually approved within 24 hours.
          </p>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Workshop name *</label>
              <input required value={createForm.name}
                onChange={(e) => setCreateForm((p) => ({ ...p, name: e.target.value }))}
                className="input" placeholder="e.g. Ade Motors" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea value={createForm.description} rows={2}
                onChange={(e) => setCreateForm((p) => ({ ...p, description: e.target.value }))}
                className="input resize-none text-sm" placeholder="What makes your workshop special…" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Address *</label>
              <input required value={createForm.address}
                onChange={(e) => setCreateForm((p) => ({ ...p, address: e.target.value }))}
                className="input" placeholder="Street address" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">City *</label>
              <input required value={createForm.city}
                onChange={(e) => setCreateForm((p) => ({ ...p, city: e.target.value }))}
                className="input" placeholder="Lagos" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">State *</label>
              <input required value={createForm.state}
                onChange={(e) => setCreateForm((p) => ({ ...p, state: e.target.value }))}
                className="input" placeholder="Lagos State" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input value={createForm.phone}
                onChange={(e) => setCreateForm((p) => ({ ...p, phone: e.target.value }))}
                className="input" placeholder="+234..." />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" value={createForm.email}
                onChange={(e) => setCreateForm((p) => ({ ...p, email: e.target.value }))}
                className="input" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Specialties * (pick 1–6)</label>
            <div className="flex flex-wrap gap-2">
              {SPECIALTIES.map((s) => (
                <button key={s} type="button" onClick={() => toggleSpecialty(s)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                    createForm.specialties.includes(s)
                      ? 'bg-brand-600 border-brand-600 text-white'
                      : 'border-gray-200 text-gray-600 hover:border-brand-300',
                  )}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          <button type="submit" disabled={isCreating} className="btn-primary w-full justify-center">
            {isCreating && <Loader2 className="h-4 w-4 animate-spin" />}
            Create workshop
          </button>
        </form>
      )}
    </div>
  );
}

// ── FIXER VIEW (in a workshop, not admin) ────────────────────

function FixerWorkshopView({ workshop, memberId }: { workshop: Workshop; memberId?: string }) {
  const router = useRouter();
  const [isLeaving, setIsLeaving] = useState(false);

  const handleLeave = async () => {
    if (!confirm('Are you sure you want to leave this workshop?')) return;
    setIsLeaving(true);
    try {
      await workshopApi.leave(workshop.id);
      toast.success('You have left the workshop');
      router.refresh();
    } catch (e) {
      if (e instanceof ApiClientError) toast.error(e.message);
    } finally { setIsLeaving(false); }
  };

  return (
    <div className="max-w-3xl">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{workshop.name}</h1>
          <p className="text-gray-500 text-sm mt-0.5">{workshop.city}, {workshop.state}</p>
        </div>
        <button onClick={handleLeave} disabled={isLeaving}
          className="btn-secondary text-sm text-red-600 hover:bg-red-50 shrink-0">
          {isLeaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
          Leave
        </button>
      </div>

      <div className="card p-6 mb-5">
        {workshop.description && (
          <p className="text-sm text-gray-600 mb-4">{workshop.description}</p>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Fixers',      value: `${workshop.currentFixerCount}/${workshop.maxFixers}` },
            { label: 'Inspections', value: workshop.totalInspections },
            { label: 'Fix Jobs',    value: workshop.totalFixJobs },
            { label: 'Status',      value: workshop.status },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-xs text-gray-400 mb-0.5">{label}</p>
              <p className="text-sm font-semibold text-gray-900">{value}</p>
            </div>
          ))}
        </div>
        {workshop.specialties.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-4 pt-4 border-t border-gray-100">
            {workshop.specialties.map((s) => (
              <span key={s} className="badge text-xs bg-brand-50 text-brand-700">{s}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── WORKSHOP ADMIN VIEW ──────────────────────────────────────

function WorkshopAdminView({ workshop }: { workshop: Workshop }) {
  const [stats, setStats] = useState<WorkshopStats | null>(null);
  const [pending, setPending] = useState<WorkshopMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [handlingId, setHandlingId] = useState<string | null>(null);

  useEffect(() => {
    Promise.allSettled([
      workshopApi.getStats(workshop.id),
      workshopApi.getPending(workshop.id),
    ]).then(([statsRes, pendingRes]) => {
      if (statsRes.status === 'fulfilled') setStats(statsRes.value);
      if (pendingRes.status === 'fulfilled') setPending(pendingRes.value as WorkshopMember[]);
    }).finally(() => setIsLoading(false));
  }, [workshop.id]);

  const handleMember = async (memberId: string, action: 'APPROVE' | 'REJECT') => {
    setHandlingId(memberId);
    try {
      await workshopApi.handleMember(workshop.id, memberId, action);
      toast.success(`Member ${action.toLowerCase()}d`);
      setPending((p) => p.filter((m) => m.id !== memberId));
    } catch (e) {
      if (e instanceof ApiClientError) toast.error(e.message);
    } finally { setHandlingId(null); }
  };

  const formatNGN = (v: number) =>
    new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(v);

  return (
    <div className="max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{workshop.name}</h1>
        <p className="text-gray-500 text-sm mt-0.5">{workshop.city}, {workshop.state} · Workshop Admin</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {[1, 2, 3, 4].map((i) => <div key={i} className="card h-28 animate-pulse bg-gray-100 border-0" />)}
        </div>
      ) : stats && (
        <>
          {/* Top stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <StatCard label="Total inspections" value={stats.totalInspections}
              sub={`${stats.completedInspections} completed`}
              icon={<ClipboardCheck className="h-5 w-5" />} colour="bg-blue-50 text-blue-600" />
            <StatCard label="Fix jobs" value={stats.totalFixJobs}
              sub={`${stats.deliveredFixJobs} delivered`}
              icon={<Wrench className="h-5 w-5" />} colour="bg-orange-50 text-orange-600" />
            <StatCard label="Revenue (30 days)" value={formatNGN(stats.totalRevenue)}
              icon={<TrendingUp className="h-5 w-5" />} colour="bg-green-50 text-green-600" />
            <StatCard label="Team" value={`${workshop.currentFixerCount}/${workshop.maxFixers}`}
              sub="fixers"
              icon={<Users className="h-5 w-5" />} colour="bg-purple-50 text-purple-600" />
            <StatCard label="Profile views" value={stats.viewCount ?? 0}
              sub="all time"
              icon={<Eye className="h-5 w-5" />} colour="bg-sky-50 text-sky-600" />
          </div>

          {/* Per-fixer breakdown */}
          {stats.byFixer.length > 0 && (
            <div className="card p-6 mb-6">
              <h2 className="font-semibold text-gray-900 mb-4">Team performance</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      {['Fixer', 'Inspections', 'Fix Jobs', 'Completed', 'Revenue', 'Avg Duration'].map((h) => (
                        <th key={h} className="text-left text-xs text-gray-400 font-medium pb-2 pr-4">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {stats.byFixer.map((f) => (
                      <tr key={f.fixerId} className="border-b border-gray-50 last:border-0">
                        <td className="py-3 pr-4 font-medium text-gray-900">{f.fixerName}</td>
                        <td className="py-3 pr-4 text-gray-600">{f.inspections}</td>
                        <td className="py-3 pr-4 text-gray-600">{f.fixJobs}</td>
                        <td className="py-3 pr-4">
                          <span className={cn('badge text-xs', f.completedFixJobs > 0 ? 'text-green-700 bg-green-50' : 'text-gray-500 bg-gray-100')}>
                            {f.completedFixJobs}
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-gray-600">{formatNGN(f.revenue)}</td>
                        <td className="py-3 text-gray-400 text-xs">
                          {f.avgFixJobDurationHours != null
                            ? `${f.avgFixJobDurationHours.toFixed(1)}h`
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Pending join requests */}
      {pending.length > 0 && (
        <div className="card p-6">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            Join requests
            <span className="badge bg-orange-50 text-orange-700">{pending.length}</span>
          </h2>
          <div className="space-y-3">
            {pending.map((req) => (
              <div key={req.id} className="flex items-start justify-between gap-4 rounded-xl border border-gray-100 p-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 font-mono text-xs text-gray-400">
                    {req.fixerId}
                  </p>
                  {req.joinRequestNote && (
                    <p className="text-sm text-gray-500 mt-1 italic">"{req.joinRequestNote}"</p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">{formatDate(req.createdAt)}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => handleMember(req.id, 'APPROVE')}
                    disabled={handlingId === req.id}
                    className="btn-primary text-xs px-3 py-1.5"
                  >
                    {handlingId === req.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                    Approve
                  </button>
                  <button
                    onClick={() => handleMember(req.id, 'REJECT')}
                    disabled={handlingId === req.id}
                    className="btn-secondary text-xs px-3 py-1.5 text-red-600 hover:bg-red-50"
                  >
                    <X className="h-3 w-3" />
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Page — routes to the right view ─────────────────────

export default function WorkshopPage() {
  const { user } = useAuth();
  const [workshop, setWorkshop] = useState<Workshop | null>(null);
  const [membershipStatus, setMembershipStatus] = useState<'none' | 'pending' | 'approved'>('none');
  const [isLoading, setIsLoading] = useState(true);

  const load = async () => {
  if (!user) return;
  setIsLoading(true);
 
  try {
    const workshopId = (user as any).workshopId as string | undefined | null;
 
    if (workshopId) {
      // Fixer already belongs to a workshop — load it
      try {
        const w = await workshopApi.get(workshopId);
        setWorkshop(w);
        setMembershipStatus('approved');
      } catch (err) {
        // Workshop-service unreachable, DB not migrated, or record deleted.
        // Degrade gracefully — show the join form instead of a crash.
        console.warn('[workshop] Could not load workshop', workshopId, err);
        setMembershipStatus('none');
        setWorkshop(null);
      }
    } else {
      // No workshop yet — show join/create form
      setMembershipStatus('none');
      setWorkshop(null);
    }
  } finally {
    setIsLoading(false);
  }
};

  useEffect(() => { load(); }, [user]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
      </div>
    );
  }

  // No workshop — show join/create form
  if (membershipStatus === 'none' || !workshop) {
    return <JoinWorkshopView onJoined={load} />;
  }

  // Workshop admin
  if (user?.role === 'WORKSHOP_ADMIN' && workshop.adminId === user.id) {
    return <WorkshopAdminView workshop={workshop} />;
  }

  // Regular fixer in a workshop
  return <FixerWorkshopView workshop={workshop} />;
}