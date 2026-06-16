'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Clock, Loader2, CheckCircle2, Package, Wrench, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { fixJobApi, ApiClientError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDate, formatCurrency, statusColour, cn } from '@/lib/utils';
import type { FixJob } from '@motacare/shared-types';

type FixJobWithHistory = FixJob & {
  statusHistory: Array<{
    id: string;
    fromStatus: string | null;
    toStatus: string;
    changedBy: string;
    notes: string | null;
    changedAt: string;
  }>;
};

// Valid transitions map (mirrors the backend)
const NEXT_STATUSES: Record<string, string[]> = {
  PENDING:        ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS:    ['AWAITING_PARTS', 'COMPLETED', 'CANCELLED'],
  AWAITING_PARTS: ['IN_PROGRESS', 'CANCELLED'],
  COMPLETED:      ['DELIVERED'],
  DELIVERED:      [],
  CANCELLED:      [],
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending',
  IN_PROGRESS: 'In Progress',
  AWAITING_PARTS: 'Awaiting Parts',
  COMPLETED: 'Completed',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
};

export default function FixJobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();

  const [job, setJob] = useState<FixJobWithHistory | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [repairNotes, setRepairNotes] = useState('');
  const [finalCost, setFinalCost] = useState('');

  const isFixer = user?.role === 'FIXER' || user?.role === 'ADMIN';
  const nextStatuses = job ? NEXT_STATUSES[job.status] ?? [] : [];

  useEffect(() => {
    fixJobApi.get(id)
      .then((res) => {
        // API now enriches job with `fixer` and `vehicle` fields — accept them as any
        setJob(res as any);
        setRepairNotes((res as any).repairNotes ?? '');
        setFinalCost((res as any).finalCost ?? '');
      })
      .catch(() => toast.error('Failed to load fix job'))
      .finally(() => setIsLoading(false));
  }, [id]);

  const updateStatus = async (newStatus: string) => {
    if (!job) return;
    setIsUpdating(true);
    try {
      const updated = await fixJobApi.update(id, {
        status: newStatus,
        repairNotes: repairNotes || undefined,
        finalCost: finalCost ? Number(finalCost) : undefined,
      });
      setJob({ ...updated as FixJobWithHistory, statusHistory: job.statusHistory });
      toast.success(`Job moved to ${STATUS_LABELS[newStatus]}`);
    } catch (error) {
      if (error instanceof ApiClientError) toast.error(error.message);
      else toast.error('Update failed');
    } finally {
      setIsUpdating(false);
    }
  };

  const saveNotes = async () => {
    setIsUpdating(true);
    try {
      await fixJobApi.update(id, { repairNotes });
      toast.success('Notes saved');
    } catch {
      toast.error('Failed to save notes');
    } finally {
      setIsUpdating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500">Fix job not found.</p>
        <Link href="/dashboard/fix-jobs" className="btn-secondary mt-4 inline-flex">Back</Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <Link href="/dashboard/fix-jobs" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft className="h-4 w-4" /> Back to fix jobs
      </Link>

      {/* Header */}
      <div className="card p-6 mb-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span className={`badge ${statusColour(job.status)}`}>
                {STATUS_LABELS[job.status]}
              </span>
              <span className="text-xs text-gray-400">{formatDate(job.createdAt)}</span>
            </div>
            <p className="text-base font-medium text-gray-900">{job.description}</p>
            <div className="text-sm text-gray-500 mt-1">
              {job.fixer && (
                <div>Fixer: {job.fixer.firstName} {job.fixer.lastName}</div>
              )}
              {job.vehicle && (
                <div>Vehicle: {job.vehicle.make} {job.vehicle.model} {job.vehicle.year ? `(${job.vehicle.year})` : ''}</div>
              )}
            </div>
          </div>
        </div>

        {/* Cost & timing row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5 pt-5 border-t border-gray-100">
          {[
            {
              label: 'Estimated cost',
              value: job.estimatedCost ? formatCurrency(Number(job.estimatedCost), job.currency) : '—',
            },
            {
              label: 'Final cost',
              value: job.finalCost ? formatCurrency(Number(job.finalCost), job.currency) : '—',
            },
            {
              label: 'Est. completion',
              value: job.estimatedCompletionAt ? formatDate(job.estimatedCompletionAt) : '—',
            },
            {
              label: 'Completed',
              value: job.actualCompletionAt ? formatDate(job.actualCompletionAt) : '—',
            },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-xs text-gray-400 mb-0.5">{label}</p>
              <p className="text-sm font-medium text-gray-900">{value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-5 mb-5">
        {/* Status transitions — fixer only */}
        {isFixer && nextStatuses.length > 0 && (
          <div className="card p-5">
            <h3 className="font-semibold text-gray-900 mb-3 text-sm">Move to next status</h3>
            <div className="space-y-2">
              {nextStatuses.map((status) => (
                <button
                  key={status}
                  onClick={() => updateStatus(status)}
                  disabled={isUpdating}
                  className={cn(
                    'w-full flex items-center justify-between px-4 py-3 rounded-lg border text-sm font-medium transition-all',
                    status === 'CANCELLED'
                      ? 'border-red-200 text-red-600 hover:bg-red-50'
                      : status === 'DELIVERED' || status === 'COMPLETED'
                        ? 'border-green-200 text-green-700 hover:bg-green-50'
                        : 'border-brand-200 text-brand-700 hover:bg-brand-50',
                  )}
                >
                  <span>{STATUS_LABELS[status]}</span>
                  {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Final cost + notes — fixer only */}
        {isFixer && (
          <div className="card p-5">
            <h3 className="font-semibold text-gray-900 mb-3 text-sm">Repair details</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Final cost ({job.currency})</label>
                <input
                  type="number"
                  value={finalCost}
                  onChange={(e) => setFinalCost(e.target.value)}
                  className="input text-sm"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Repair notes</label>
                <textarea
                  value={repairNotes}
                  onChange={(e) => setRepairNotes(e.target.value)}
                  rows={3}
                  className="input text-sm resize-none"
                  placeholder="Describe what was done…"
                />
              </div>
              <button
                onClick={saveNotes}
                disabled={isUpdating}
                className="btn-secondary text-sm w-full"
              >
                {isUpdating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Save details
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Status History */}
      {job.statusHistory?.length > 0 && (
        <div className="card p-6">
          <h3 className="font-semibold text-gray-900 mb-4 text-sm">Status history</h3>
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-3.5 top-0 bottom-0 w-px bg-gray-100" />
            <div className="space-y-4">
              {job.statusHistory.map((entry, i) => (
                <div key={entry.id} className="flex items-start gap-4 relative">
                  <div className={cn(
                    'h-7 w-7 rounded-full flex items-center justify-center shrink-0 z-10 border-2 border-white',
                    entry.toStatus === 'DELIVERED' || entry.toStatus === 'COMPLETED'
                      ? 'bg-green-100'
                      : entry.toStatus === 'CANCELLED'
                        ? 'bg-red-100'
                        : 'bg-brand-100',
                  )}>
                    <Wrench className="h-3 w-3 text-gray-600" />
                  </div>
                  <div className="flex-1 min-w-0 pb-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`badge text-xs ${statusColour(entry.toStatus)}`}>
                        {STATUS_LABELS[entry.toStatus] ?? entry.toStatus}
                      </span>
                      <span className="text-xs text-gray-400">
                        {formatDate(entry.changedAt)}
                      </span>
                    </div>
                    {entry.notes && (
                      <p className="text-xs text-gray-500 mt-0.5 italic">{entry.notes}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}