'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Car, ClipboardCheck, Wrench, Plus,
  Trash2, Loader2, MessageSquare, AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDate, formatCurrency, statusColour, cn } from '@/lib/utils';
import { ApiClientError } from '@/lib/api';

interface CustomerNote {
  id: string;
  type: 'GENERAL' | 'PREFERENCE' | 'WARNING' | 'FOLLOWUP';
  content: string;
  createdAt: string;
}

interface CustomerProfile {
  ownerId: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string | null;
  totalInspections: number;
  totalFixJobs: number;
  totalSpend: number;
  lastVisitAt: string | null;
  firstVisitAt: string | null;
  vehicles: Array<{ hash: string; make: string; model: string; year: number; licensePlate: string }>;
  notes: CustomerNote[];
  jobs: any[];
}

const NOTE_TYPE_COLOURS: Record<string, string> = {
  GENERAL:    'bg-gray-100 text-gray-700',
  PREFERENCE: 'bg-blue-50 text-blue-700',
  WARNING:    'bg-red-50 text-red-700',
  FOLLOWUP:   'bg-amber-50 text-amber-700',
};

export default function CustomerDetailPage() {
  const { customerId } = useParams<{ customerId: string }>();
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Note form state
  const [noteType, setNoteType] = useState<CustomerNote['type']>('GENERAL');
  const [noteContent, setNoteContent] = useState('');
  const [isSavingNote, setIsSavingNote] = useState(false);

  useEffect(() => {
    fetch(`/api/crm/customers/${customerId}`)
      .then((r) => r.json())
      .then((b) => setProfile(b?.data))
      .finally(() => setIsLoading(false));
  }, [customerId]);

  const saveNote = async () => {
    if (!noteContent.trim()) { toast.error('Note content is required'); return; }
    setIsSavingNote(true);
    try {
      const res = await fetch(`/api/crm/customers/${customerId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: noteType, content: noteContent.trim() }),
      });
      const body = await res.json();
      const newNote = body?.data;
      if (newNote && profile) {
        setProfile({ ...profile, notes: [newNote, ...profile.notes] });
        setNoteContent('');
        toast.success('Note saved');
      }
    } catch { toast.error('Failed to save note'); }
    finally { setIsSavingNote(false); }
  };

  const deleteNote = async (noteId: string) => {
    if (!confirm('Delete this note?')) return;
    const res = await fetch(`/api/crm/notes/${noteId}`, { method: 'DELETE' });
    if (res.ok && profile) {
      setProfile({ ...profile, notes: profile.notes.filter((n) => n.id !== noteId) });
      toast.success('Note deleted');
    }
  };

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
    </div>
  );

  if (!profile) return (
    <div className="text-center py-16">
      <p className="text-gray-500">Customer not found.</p>
      <Link href="/dashboard/crm/customers" className="btn-secondary mt-4 inline-flex">Back</Link>
    </div>
  );

  return (
    <div className="max-w-4xl">
      <Link href="/dashboard/crm/customers" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft className="h-4 w-4" /> Back to customers
      </Link>

      {/* ── Customer header ── */}
      <div className="card p-6 mb-5">
        <div className="flex items-start gap-4">
          <div className="h-14 w-14 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-bold text-xl shrink-0">
            {profile.ownerName.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-gray-900">{profile.ownerName}</h1>
            <p className="text-sm text-gray-500">{profile.ownerEmail}</p>
            {profile.ownerPhone && <p className="text-sm text-gray-400">{profile.ownerPhone}</p>}
          </div>
        </div>

        {/* Lifetime stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5 pt-5 border-t border-gray-100">
          {[
            { label: 'Fix jobs',         value: profile.totalFixJobs },
            { label: 'Inspections',      value: profile.totalInspections },
            { label: 'Total spend',      value: formatCurrency(profile.totalSpend, 'NGN') },
            { label: 'Customer since',   value: profile.firstVisitAt ? formatDate(profile.firstVisitAt) : '—' },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-xs text-gray-400 mb-0.5">{label}</p>
              <p className="text-sm font-semibold text-gray-900">{value}</p>
            </div>
          ))}
        </div>

        {/* Vehicles this fixer has worked on */}
        {profile.vehicles?.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-400 mb-2">Vehicles seen</p>
            <div className="flex flex-wrap gap-2">
              {profile.vehicles.map((v) => (
                <Link key={v.hash} href={`/dashboard/vehicles/${v.hash}`}
                  className="badge flex items-center gap-1.5 text-xs bg-gray-50 text-gray-700 hover:bg-gray-100">
                  <Car className="h-3 w-3" />
                  {v.year} {v.make} {v.model} — {v.licensePlate}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        {/* ── Fix Job History ── */}
        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Wrench className="h-4 w-4 text-gray-400" /> Fix Job History
          </h2>
          {!profile.jobs?.length ? (
            <p className="text-sm text-gray-400 text-center py-6">No fix jobs yet</p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {profile.jobs.map((job: any) => (
                <Link key={job.id} href={`/dashboard/fix-jobs/${job.id}`}
                  className="flex items-center justify-between rounded-lg p-3 hover:bg-gray-50 transition-colors">
                  <div>
                    <p className="text-sm font-medium text-gray-900 truncate max-w-[180px]">{job.description}</p>
                    <p className="text-xs text-gray-400">{formatDate(job.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {job.finalCost && <span className="text-xs font-medium text-gray-700">{formatCurrency(Number(job.finalCost), job.currency ?? 'NGN')}</span>}
                    <span className={cn('badge text-xs', statusColour(job.status))}>{job.status.replace('_', ' ')}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* ── Notes ── */}
        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-gray-400" /> Private Notes
          </h2>

          {/* Add note */}
          <div className="mb-4 space-y-2">
            <div className="flex gap-2">
              {(['GENERAL','PREFERENCE','WARNING','FOLLOWUP'] as const).map((t) => (
                <button key={t} onClick={() => setNoteType(t)}
                  className={cn('text-xs px-2 py-1 rounded-md border font-medium transition-colors',
                    noteType === t ? NOTE_TYPE_COLOURS[t] + ' border-current' : 'border-gray-200 text-gray-400 hover:border-gray-300')}>
                  {t}
                </button>
              ))}
            </div>
            <textarea
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              rows={2}
              placeholder="Add a private note about this customer…"
              className="input resize-none text-sm"
            />
            <button onClick={saveNote} disabled={isSavingNote} className="btn-primary text-sm w-full justify-center">
              {isSavingNote ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              Save note
            </button>
          </div>

          {/* Existing notes */}
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {profile.notes.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">No notes yet</p>
            ) : profile.notes.map((note) => (
              <div key={note.id} className="rounded-lg border border-gray-100 p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-md', NOTE_TYPE_COLOURS[note.type])}>
                    {note.type}
                  </span>
                  <button onClick={() => deleteNote(note.id)} className="text-gray-300 hover:text-red-400">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <p className="text-sm text-gray-700">{note.content}</p>
                <p className="text-xs text-gray-400 mt-1">{formatDate(note.createdAt)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}