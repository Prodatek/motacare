'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle2, XCircle, AlertTriangle, Minus, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { inspectionApi, fixJobApi, ApiClientError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn, severityColour, statusColour, formatDate } from '@/lib/utils';

type CheckStatus = 'PASS' | 'FAIL' | 'WARNING' | 'NOT_CHECKED';
type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | null;

interface InspectionItemState {
  checkId: string;
  checkName: string;
  category: string;
  status: CheckStatus;
  severity: Severity;
  notes: string | null;
  isDirty: boolean;
  isSaving: boolean;
}

const STATUS_BUTTONS: { value: CheckStatus; label: string; icon: React.ReactNode; colour: string }[] = [
  { value: 'PASS',    label: 'Pass',    icon: <CheckCircle2 className="h-4 w-4" />,    colour: 'border-green-500 bg-green-50 text-green-700' },
  { value: 'FAIL',    label: 'Fail',    icon: <XCircle className="h-4 w-4" />,         colour: 'border-red-500 bg-red-50 text-red-700' },
  { value: 'WARNING', label: 'Warning', icon: <AlertTriangle className="h-4 w-4" />,   colour: 'border-yellow-500 bg-yellow-50 text-yellow-700' },
  { value: 'NOT_CHECKED', label: 'N/A', icon: <Minus className="h-4 w-4" />,           colour: 'border-gray-300 bg-gray-50 text-gray-500' },
];

export default function InspectionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();

  const [inspection, setInspection] = useState<any>(null);
  const [items, setItems] = useState<InspectionItemState[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [summaryText, setSummaryText] = useState('');
  const [isCompleting, setIsCompleting] = useState(false);
  const [isCreatingJob, setIsCreatingJob] = useState(false);
  const [jobDescription, setJobDescription] = useState('');
  const [jobEstimatedCost, setJobEstimatedCost] = useState<string>('');
  const [jobEstimatedCompletionAt, setJobEstimatedCompletionAt] = useState<string>('');
  const [jobCurrency, setJobCurrency] = useState('NGN');

  const isFixer = user?.role === 'FIXER' || user?.role === 'ADMIN';
  const isEditable = isFixer && (inspection?.status === 'IN_PROGRESS' || inspection?.status === 'DRAFT');

  useEffect(() => {
    inspectionApi.get(id)
      .then((res) => {
        setInspection(res);
        setItems((res.items as any[]).map((item: any) => ({
          checkId: item.checkId,
          checkName: item.checkName,
          category: item.category,
          status: item.status,
          severity: item.severity,
          notes: item.notes,
          isDirty: false,
          isSaving: false,
        })));
        // Expand all categories with failures
        const failedCats = new Set<string>(
          (res.items as any[])
            .filter((i: any) => i.status === 'FAIL' || i.status === 'WARNING')
            .map((i: any) => i.category),
        );
        setExpandedCategories(failedCats.size > 0 ? failedCats : new Set(['engine']));
      })
      .finally(() => setIsLoading(false));
  }, [id]);

  const updateItem = useCallback(async (
    checkId: string,
    status: CheckStatus,
    severity: Severity = null,
    notes: string | null = null,
  ) => {
    setItems((prev) => prev.map((item) =>
      item.checkId === checkId ? { ...item, status, severity, notes, isSaving: true } : item,
    ));

    try {
      await inspectionApi.updateItem(id, { checkId, status, severity, notes });
      setItems((prev) => prev.map((item) =>
        item.checkId === checkId ? { ...item, isSaving: false, isDirty: false } : item,
      ));
    } catch (error) {
      toast.error('Failed to save — please try again');
      setItems((prev) => prev.map((item) =>
        item.checkId === checkId ? { ...item, isSaving: false } : item,
      ));
    }
  }, [id]);

  const handleComplete = async () => {
    if (!summaryText || summaryText.length < 10) {
      toast.error('Please write a summary of at least 10 characters before completing.');
      return;
    }
    setIsCompleting(true);
    try {
      await inspectionApi.complete(id, 'COMPLETED', summaryText);
      toast.success('Inspection completed successfully');
      router.push('/dashboard/inspections');
    } catch (error) {
      if (error instanceof ApiClientError) toast.error(error.message);
      else toast.error('Failed to complete inspection');
    } finally {
      setIsCompleting(false);
    }
  };

  const toggleCategory = (cat: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  };

  // Group items by category
  const grouped = items.reduce<Record<string, InspectionItemState[]>>((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {});

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
      </div>
    );
  }

  if (!inspection) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500">Inspection not found.</p>
        <Link href="/dashboard/inspections" className="btn-secondary mt-4 inline-flex">Back</Link>
      </div>
    );
  }

  const stats = inspection.stats;

  return (
    <div className="max-w-3xl">
      <Link href="/dashboard/inspections" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft className="h-4 w-4" /> Back to inspections
      </Link>

      {/* Header card */}
      <div className="card p-6 mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`badge ${statusColour(inspection.status)}`}>
                {inspection.status.replace('_', ' ')}
              </span>
              <span className="text-xs text-gray-400">{formatDate(inspection.createdAt)}</span>
            </div>
            <p className="text-sm text-gray-500 font-mono">
              Vehicle: {inspection.vehicleHash.slice(0, 24)}…
            </p>
            <p className="text-sm text-gray-400 mt-0.5">
              {inspection.mileageAtInspection.toLocaleString()} km at inspection
            </p>
          </div>

          {/* Stats */}
          {stats && (
            <div className="flex gap-3 text-center">
              {[
                { label: 'Pass', value: stats.passed, colour: 'text-green-600' },
                { label: 'Fail', value: stats.failed, colour: 'text-red-600' },
                { label: 'Warn', value: stats.warnings, colour: 'text-yellow-600' },
                { label: 'Unchecked', value: stats.notChecked, colour: 'text-gray-400' },
              ].map(({ label, value, colour }) => (
                <div key={label}>
                  <p className={`text-xl font-bold ${colour}`}>{value}</p>
                  <p className="text-xs text-gray-400">{label}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Critical fails alert */}
        {stats?.criticalFails?.length > 0 && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3">
            <p className="text-sm font-semibold text-red-700 mb-1">
              ⚠️ {stats.criticalFails.length} critical failure{stats.criticalFails.length > 1 ? 's' : ''}
            </p>
            <ul className="text-xs text-red-600 space-y-0.5">
              {stats.criticalFails.map((name: string) => <li key={name}>• {name}</li>)}
            </ul>
          </div>
        )}
      </div>

      {/* Checklist */}
      <div className="space-y-3 mb-6">
        {Object.entries(grouped).map(([category, categoryItems]) => {
          const isOpen = expandedCategories.has(category);
          const failCount = categoryItems.filter((i) => i.status === 'FAIL').length;
          const warnCount = categoryItems.filter((i) => i.status === 'WARNING').length;
          const passCount = categoryItems.filter((i) => i.status === 'PASS').length;

          return (
            <div key={category} className="card overflow-hidden">
              {/* Category header */}
              <button
                onClick={() => toggleCategory(category)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-gray-900 capitalize">{category.replace('_', ' ')}</span>
                  <div className="flex gap-1.5">
                    {failCount > 0 && <span className="badge text-red-700 bg-red-50">{failCount} fail</span>}
                    {warnCount > 0 && <span className="badge text-yellow-700 bg-yellow-50">{warnCount} warn</span>}
                    {failCount === 0 && warnCount === 0 && passCount > 0 && (
                      <span className="badge text-green-700 bg-green-50">✓ all pass</span>
                    )}
                  </div>
                </div>
                {isOpen ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
              </button>

              {/* Items */}
              {isOpen && (
                <div className="divide-y divide-gray-100 border-t border-gray-100">
                  {categoryItems.map((item) => (
                    <div key={item.checkId} className="px-5 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900">{item.checkName}</p>
                          {item.notes && (
                            <p className="text-xs text-gray-500 mt-1 italic">{item.notes}</p>
                          )}
                          {item.severity && item.status === 'FAIL' && (
                            <span className={`badge mt-1 text-xs border ${severityColour(item.severity)}`}>
                              {item.severity}
                            </span>
                          )}
                        </div>

                        {/* Status buttons — only show when editable */}
                        {isEditable ? (
                          <div className="flex gap-1 shrink-0">
                            {STATUS_BUTTONS.map(({ value, icon, colour }) => (
                              <button
                                key={value}
                                onClick={() => updateItem(item.checkId, value)}
                                disabled={item.isSaving}
                                title={value}
                                className={cn(
                                  'h-8 w-8 rounded-md border-2 flex items-center justify-center transition-all',
                                  item.status === value ? colour : 'border-gray-200 text-gray-300 hover:border-gray-300',
                                  item.isSaving && 'opacity-50 cursor-wait',
                                )}
                              >
                                {item.isSaving && item.status === value
                                  ? <Loader2 className="h-3 w-3 animate-spin" />
                                  : icon}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <span className={`badge shrink-0 ${statusColour(item.status)}`}>
                            {item.status.replace('_', ' ')}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Complete inspection panel */}
      {isEditable && (
        <div className="card p-6 border-brand-200 bg-brand-50/30">
          <h3 className="font-semibold text-gray-900 mb-3">Complete inspection</h3>
          <textarea
            value={summaryText}
            onChange={(e) => setSummaryText(e.target.value)}
            rows={4}
            className="input resize-none mb-4"
            placeholder="Write a summary of the overall vehicle condition and key findings…"
          />
          <button
            onClick={handleComplete}
            disabled={isCompleting || summaryText.length < 10}
            className="btn-primary"
          >
            {isCompleting && <Loader2 className="h-4 w-4 animate-spin" />}
            {isCompleting ? 'Completing…' : 'Mark as complete'}
          </button>
        </div>
      )}

      {/* Read-only summary */}
      {inspection.summary && (
        <div className="card p-6 mt-4">
          <h3 className="font-semibold text-gray-900 mb-2">Inspection summary</h3>
          <p className="text-sm text-gray-600 leading-relaxed">{inspection.summary}</p>
          {inspection.completedAt && (
            <p className="text-xs text-gray-400 mt-3">Completed {formatDate(inspection.completedAt)}</p>
          )}
        </div>
      )}

      {/* Create Fix Job (visible for completed/follow-up inspections to assigned fixer) */}
      {isFixer && (inspection.status === 'COMPLETED' || inspection.status === 'NEEDS_FOLLOWUP') && (
        <div className="card p-6 mt-4">
          <h3 className="font-semibold text-gray-900 mb-3">Create fix job</h3>
          <p className="text-sm text-gray-500 mb-3">Create a repair job from this inspection so the owner can approve and pay.</p>

          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Description</label>
              <textarea
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                rows={3}
                className="input resize-none"
                placeholder="Brief description of the work required…"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Estimated cost</label>
                <input type="number" value={jobEstimatedCost} onChange={(e) => setJobEstimatedCost(e.target.value)} className="input" placeholder="0.00" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Currency</label>
                <select value={jobCurrency} onChange={(e) => setJobCurrency(e.target.value)} className="input">
                  <option>NGN</option>
                  <option>USD</option>
                  <option>EUR</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Est. completion</label>
                <input type="date" value={jobEstimatedCompletionAt} onChange={(e) => setJobEstimatedCompletionAt(e.target.value)} className="input" />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={async () => {
                  if (!jobDescription || jobDescription.length < 10) {
                    toast.error('Please provide a description of at least 10 characters');
                    return;
                  }
                  setIsCreatingJob(true);
                  try {
                    const payload = {
                      inspectionId: inspection.id,
                      vehicleHash: inspection.vehicleHash,
                      ownerId: inspection.ownerId,
                      description: jobDescription,
                      estimatedCompletionAt: jobEstimatedCompletionAt || undefined,
                      estimatedCost: jobEstimatedCost ? Number(jobEstimatedCost) : undefined,
                      currency: jobCurrency,
                    };
                    const job = await fixJobApi.createFixJob(payload);
                    toast.success('Fix job created');
                    router.push(`/dashboard/fix-jobs/${job.id}`);
                  } catch (err) {
                    if (err instanceof ApiClientError) toast.error(err.message);
                    else toast.error('Failed to create fix job');
                  } finally {
                    setIsCreatingJob(false);
                  }
                }}
                disabled={isCreatingJob}
                className="btn-primary"
              >
                {isCreatingJob ? 'Creating…' : 'Create fix job'}
              </button>
              <button onClick={() => { setJobDescription(''); setJobEstimatedCost(''); setJobEstimatedCompletionAt(''); }} className="btn-secondary">Reset</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}