'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, CheckCircle2, XCircle, AlertTriangle, Minus,
  Loader2, ChevronDown, ChevronUp, Wrench, X, MessageSquare,
} from 'lucide-react';
import { toast } from 'sonner';
import { inspectionApi, fixJobApi, ApiClientError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn, severityColour, statusColour, formatDate } from '@/lib/utils';

// ── Types ────────────────────────────────────────────────────

type CheckStatus = 'PASS' | 'FAIL' | 'WARNING' | 'NOT_CHECKED';
type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | null;
type Outcome = 'COMPLETED' | 'NEEDS_FOLLOWUP' | 'DRAFT';

interface ItemState {
  checkId: string;
  checkName: string;
  category: string;
  status: CheckStatus;
  severity: Severity;
  notes: string | null;
  // Local editing state
  editingNote: boolean;
  draftNote: string;
  isSaving: boolean;
}

// ── Config ───────────────────────────────────────────────────

const OUTCOME_BUTTONS: {
  value: Outcome;
  label: string;
  description: string;
  colour: string;
  icon: React.ReactNode;
}[] = [
  {
    value: 'COMPLETED',
    label: 'Mark Complete',
    description: 'All checks done — vehicle ready',
    colour: 'border-green-500 bg-green-50 text-green-700 hover:bg-green-100',
    icon: <CheckCircle2 className="h-5 w-5" />,
  },
  {
    value: 'NEEDS_FOLLOWUP',
    label: 'Needs Follow-up',
    description: 'Issues found — repairs required',
    colour: 'border-orange-400 bg-orange-50 text-orange-700 hover:bg-orange-100',
    icon: <AlertTriangle className="h-5 w-5" />,
  },
  {
    value: 'DRAFT',
    label: 'Save as Draft',
    description: 'Pause and continue later',
    colour: 'border-gray-300 bg-gray-50 text-gray-600 hover:bg-gray-100',
    icon: <Minus className="h-5 w-5" />,
  },
];

const ITEM_BUTTONS: {
  value: CheckStatus;
  label: string;
  icon: React.ReactNode;
  activeColour: string;
}[] = [
  { value: 'PASS',        label: 'Pass',    icon: <CheckCircle2 className="h-4 w-4" />,    activeColour: 'border-green-500 bg-green-50 text-green-700' },
  { value: 'FAIL',        label: 'Fail',    icon: <XCircle className="h-4 w-4" />,          activeColour: 'border-red-500 bg-red-50 text-red-700' },
  { value: 'WARNING',     label: 'Warning', icon: <AlertTriangle className="h-4 w-4" />,    activeColour: 'border-yellow-400 bg-yellow-50 text-yellow-700' },
  { value: 'NOT_CHECKED', label: 'N/A',     icon: <Minus className="h-4 w-4" />,            activeColour: 'border-gray-300 bg-gray-50 text-gray-400' },
];

// ── Create Fix Job Modal ─────────────────────────────────────

function CreateFixJobModal({
  inspection, onClose, onCreated,
}: {
  inspection: any;
  onClose: () => void;
  onCreated: (jobId: string) => void;
}) {
  const [description, setDescription] = useState('');
  const [estimatedCost, setEstimatedCost] = useState('');
  const [estimatedDate, setEstimatedDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const lines = (inspection.items ?? [])
      .filter((i: any) => i.status === 'FAIL' || i.status === 'WARNING')
      .map((i: any) => {
        const sev = i.severity ? ` [${i.severity}]` : '';
        const note = i.notes ? ` — ${i.notes}` : '';
        return `• ${i.checkName}${sev}${note}`;
      })
      .join('\n');
    if (lines) setDescription(`Issues found during inspection:\n${lines}`);
  }, [inspection]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) { toast.error('Description is required'); return; }
    setIsSubmitting(true);
    try {
      const job = await fixJobApi.createFixJob({
        inspectionId: inspection.id,
        vehicleHash: inspection.vehicleHash,
        ownerId: inspection.ownerId,
        description: description.trim(),
        ...(estimatedDate ? { estimatedCompletionAt: new Date(estimatedDate).toISOString() } : {}),
        ...(estimatedCost ? { estimatedCost: Number(estimatedCost) } : {}),
      });
      toast.success('Fix job created!');
      onCreated((job as any).id);
    } catch (error) {
      if (error instanceof ApiClientError) toast.error(error.message);
      else toast.error('Failed to create fix job');
    } finally { setIsSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Create Fix Job</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Work description *</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)}
              rows={6} className="input resize-none text-sm" required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Estimated cost (NGN)</label>
              <input type="number" value={estimatedCost} onChange={(e) => setEstimatedCost(e.target.value)}
                className="input text-sm" placeholder="e.g. 45000" min="0" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Target completion</label>
              <input type="date" value={estimatedDate} onChange={(e) => setEstimatedDate(e.target.value)}
                className="input text-sm" min={new Date().toISOString().split('T')[0]} />
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={isSubmitting} className="btn-primary flex-1">
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isSubmitting ? 'Creating…' : 'Create fix job'}
            </button>
            <button type="button" onClick={onClose} className="btn-secondary px-5">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Notes Summary (for owner and fixer to read) ───────────────

function NotesSummary({ items }: { items: ItemState[] }) {
  const noted = items.filter((i) => i.notes && i.notes.trim().length > 0);
  if (noted.length === 0) return null;

  const bySeverityGroup = {
    issues:   noted.filter((i) => i.status === 'FAIL'),
    warnings: noted.filter((i) => i.status === 'WARNING'),
    passed:   noted.filter((i) => i.status === 'PASS'),
  };

  return (
    <div className="card p-6 mb-5">
      <h3 className="font-semibold text-gray-900 mb-4">Fixer Notes Summary</h3>
      <p className="text-xs text-gray-400 mb-4">
        Notes added by the fixer during inspection — visible to both fixer and owner.
      </p>

      {bySeverityGroup.issues.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-2">Issues</p>
          <div className="space-y-2">
            {bySeverityGroup.issues.map((item) => (
              <div key={item.checkId} className="flex gap-3 text-sm">
                <XCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                <div>
                  <span className="font-medium text-gray-800">{item.checkName}</span>
                  {item.severity && (
                    <span className={cn('badge text-xs ml-2 border', severityColour(item.severity))}>
                      {item.severity}
                    </span>
                  )}
                  <p className="text-gray-500 mt-0.5 italic">"{item.notes}"</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {bySeverityGroup.warnings.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-yellow-600 uppercase tracking-wide mb-2">Warnings</p>
          <div className="space-y-2">
            {bySeverityGroup.warnings.map((item) => (
              <div key={item.checkId} className="flex gap-3 text-sm">
                <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0 mt-0.5" />
                <div>
                  <span className="font-medium text-gray-800">{item.checkName}</span>
                  <p className="text-gray-500 mt-0.5 italic">"{item.notes}"</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {bySeverityGroup.passed.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-green-600 uppercase tracking-wide mb-2">Observations on passed items</p>
          <div className="space-y-2">
            {bySeverityGroup.passed.map((item) => (
              <div key={item.checkId} className="flex gap-3 text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                <div>
                  <span className="font-medium text-gray-800">{item.checkName}</span>
                  <p className="text-gray-500 mt-0.5 italic">"{item.notes}"</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────

export default function InspectionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();

  const [inspection, setInspection] = useState<any>(null);
  const [items, setItems] = useState<ItemState[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const [summaryText, setSummaryText] = useState('');
  const [pendingOutcome, setPendingOutcome] = useState<Outcome | null>(null);
  const [isSubmittingOutcome, setIsSubmittingOutcome] = useState(false);
  const [showFixJobModal, setShowFixJobModal] = useState(false);

  const isFixer = user?.role === 'FIXER' || user?.role === 'ADMIN';
  const isOwner = user?.role === 'OWNER';
  const isEditable = isFixer && (inspection?.status === 'IN_PROGRESS' || inspection?.status === 'DRAFT');
  const canFinalise = isEditable;
  const showFixJobButton = isFixer && (inspection?.status === 'COMPLETED' || inspection?.status === 'NEEDS_FOLLOWUP');

  useEffect(() => {
    inspectionApi.get(id)
      .then((res) => {
        setInspection(res);
        setSummaryText(res.summary ?? '');
        setItems((res.items as any[]).map((item: any) => ({
          checkId: item.checkId,
          checkName: item.checkName,
          category: item.category,
          status: item.status,
          severity: item.severity,
          notes: item.notes,
          editingNote: false,
          draftNote: item.notes ?? '',
          isSaving: false,
        })));
        const failedCats = new Set<string>(
          (res.items as any[])
            .filter((i: any) => i.status === 'FAIL' || i.status === 'WARNING')
            .map((i: any) => i.category as string),
        );
        setExpandedCategories(failedCats.size > 0 ? failedCats : new Set(['engine']));
      })
      .finally(() => setIsLoading(false));
  }, [id]);

  // ── Save status + optional note together ──
  const saveItem = useCallback(async (
    checkId: string,
    status: CheckStatus,
    notes?: string | null,
  ) => {
    setItems((prev) => prev.map((i) =>
      i.checkId === checkId ? { ...i, status, isSaving: true, editingNote: false } : i,
    ));
    try {
      await inspectionApi.updateItem(id, {
        checkId,
        status,
        notes: notes !== undefined ? (notes?.trim() || null) : undefined,
      });
      setItems((prev) => prev.map((i) =>
        i.checkId === checkId
          ? { ...i, isSaving: false, notes: notes !== undefined ? (notes?.trim() || null) : i.notes }
          : i,
      ));
    } catch {
      toast.error('Failed to save — please try again');
      setItems((prev) => prev.map((i) =>
        i.checkId === checkId ? { ...i, isSaving: false } : i,
      ));
    }
  }, [id]);

  // ── Save note only (status unchanged) ──
  const saveNote = useCallback(async (checkId: string) => {
    const item = items.find((i) => i.checkId === checkId);
    if (!item) return;

    setItems((prev) => prev.map((i) =>
      i.checkId === checkId ? { ...i, isSaving: true } : i,
    ));
    try {
      await inspectionApi.updateItem(id, {
        checkId,
        status: item.status,
        notes: item.draftNote.trim() || null,
      });
      setItems((prev) => prev.map((i) =>
        i.checkId === checkId
          ? { ...i, isSaving: false, editingNote: false, notes: item.draftNote.trim() || null }
          : i,
      ));
    } catch {
      toast.error('Failed to save note');
      setItems((prev) => prev.map((i) =>
        i.checkId === checkId ? { ...i, isSaving: false } : i,
      ));
    }
  }, [id, items]);

  const toggleNote = (checkId: string) => {
    setItems((prev) => prev.map((i) =>
      i.checkId === checkId
        ? { ...i, editingNote: !i.editingNote, draftNote: i.notes ?? '' }
        : { ...i, editingNote: false },
    ));
  };

  const setDraftNote = (checkId: string, value: string) => {
    setItems((prev) => prev.map((i) =>
      i.checkId === checkId ? { ...i, draftNote: value } : i,
    ));
  };

  const submitOutcome = async (outcome: Outcome) => {
    if ((outcome === 'COMPLETED' || outcome === 'NEEDS_FOLLOWUP') && summaryText.trim().length < 5) {
      toast.error('Please write a summary before marking as ' + outcome.replace('_', ' ').toLowerCase());
      setPendingOutcome(outcome);
      return;
    }
    setIsSubmittingOutcome(true);
    try {
      const updated = await inspectionApi.complete(id, outcome, summaryText.trim() || undefined);
      setInspection({ ...inspection, ...updated, items: inspection.items });
      toast.success(
        outcome === 'DRAFT' ? 'Saved as draft' :
        outcome === 'COMPLETED' ? 'Inspection marked complete ✓' : 'Marked as needs follow-up',
      );
      setPendingOutcome(null);
    } catch (error) {
      if (error instanceof ApiClientError) toast.error(error.message);
      else toast.error('Failed to update inspection');
    } finally { setIsSubmittingOutcome(false); }
  };

  const toggleCategory = (cat: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  };

  const grouped = items.reduce<Record<string, ItemState[]>>((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {});

  const stats = inspection?.stats;

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

  return (
    <div className="max-w-3xl">
      <Link href="/dashboard/inspections"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft className="h-4 w-4" /> Back to inspections
      </Link>

      {/* ── Header ── */}
      <div className="card p-6 mb-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={cn('badge', statusColour(inspection.status))}>
                {inspection.status.replace(/_/g, ' ')}
              </span>
              <span className="text-xs text-gray-400">{formatDate(inspection.createdAt)}</span>
            </div>
            <p className="text-xs text-gray-400 font-mono">Vehicle: {inspection.vehicleHash?.slice(0, 24)}…</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {inspection.mileageAtInspection?.toLocaleString()} km at inspection
            </p>
          </div>

          {stats && (
            <div className="flex gap-4 text-center">
              {[
                { label: 'Pass',      value: stats.passed,     c: 'text-green-600' },
                { label: 'Fail',      value: stats.failed,     c: 'text-red-600' },
                { label: 'Warn',      value: stats.warnings,   c: 'text-yellow-600' },
                { label: 'Unchecked', value: stats.notChecked, c: 'text-gray-400' },
              ].map(({ label, value, c }) => (
                <div key={label}>
                  <p className={cn('text-xl font-bold', c)}>{value}</p>
                  <p className="text-xs text-gray-400">{label}</p>
                </div>
              ))}
            </div>
          )}
        </div>

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

        {showFixJobButton && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <button onClick={() => setShowFixJobModal(true)} className="btn-primary gap-2">
              <Wrench className="h-4 w-4" /> Start Fix Job
            </button>
            <p className="text-xs text-gray-400 mt-1.5">Create a repair job from this inspection</p>
          </div>
        )}
      </div>

      {/* ── Notes Summary — visible to owner and fixer once any notes exist ── */}
      <NotesSummary items={items} />

      {/* ── Checklist ── */}
      <div className="space-y-3 mb-5">
        {Object.entries(grouped).map(([category, catItems]) => {
          const isOpen = expandedCategories.has(category);
          const failCount = catItems.filter((i) => i.status === 'FAIL').length;
          const warnCount = catItems.filter((i) => i.status === 'WARNING').length;
          const passCount = catItems.filter((i) => i.status === 'PASS').length;
          const hasNotes  = catItems.some((i) => i.notes);

          return (
            <div key={category} className="card overflow-hidden">
              <button
                onClick={() => toggleCategory(category)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors text-left"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-gray-900 capitalize">
                    {category.replace(/_/g, ' ')}
                  </span>
                  {failCount > 0 && <span className="badge text-red-700 bg-red-50">{failCount} fail</span>}
                  {warnCount > 0 && <span className="badge text-yellow-700 bg-yellow-50">{warnCount} warn</span>}
                  {failCount === 0 && warnCount === 0 && passCount === catItems.length && passCount > 0 && (
                    <span className="badge text-green-700 bg-green-50">✓ all pass</span>
                  )}
                  {hasNotes && (
                    <span className="badge text-brand-700 bg-brand-50">
                      <MessageSquare className="h-2.5 w-2.5 mr-1" />notes
                    </span>
                  )}
                </div>
                {isOpen ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
              </button>

              {isOpen && (
                <div className="divide-y divide-gray-100 border-t border-gray-100">
                  {catItems.map((item) => (
                    <div key={item.checkId} className="px-5 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900">{item.checkName}</p>

                          {/* Saved note display */}
                          {item.notes && !item.editingNote && (
                            <p className="text-xs text-gray-500 mt-1 italic">"{item.notes}"</p>
                          )}

                          {/* Severity badge */}
                          {item.severity && item.status === 'FAIL' && (
                            <span className={cn('badge mt-1 text-xs border', severityColour(item.severity))}>
                              {item.severity}
                            </span>
                          )}

                          {/* ── Inline note editor (fixer only, editable states) ── */}
                          {item.editingNote && isEditable && (
                            <div className="mt-2">
                              <textarea
                                value={item.draftNote}
                                onChange={(e) => setDraftNote(item.checkId, e.target.value)}
                                rows={2}
                                autoFocus
                                placeholder="Add a note about this check (what you observed, measurements, etc.)…"
                                className="input text-xs resize-none w-full"
                              />
                              <div className="flex gap-2 mt-1.5">
                                <button
                                  onClick={() => saveNote(item.checkId)}
                                  disabled={item.isSaving}
                                  className="text-xs btn-primary px-3 py-1"
                                >
                                  {item.isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Save note'}
                                </button>
                                <button
                                  onClick={() => toggleNote(item.checkId)}
                                  className="text-xs btn-secondary px-3 py-1"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Controls */}
                        <div className="flex flex-col items-end gap-2 shrink-0">
                          {isEditable ? (
                            <>
                              {/* Status buttons */}
                              <div className="flex gap-1">
                                {ITEM_BUTTONS.map(({ value, icon, activeColour, label }) => (
                                  <button
                                    key={value}
                                    onClick={() => saveItem(item.checkId, value)}
                                    disabled={item.isSaving}
                                    title={label}
                                    className={cn(
                                      'h-8 w-8 rounded-md border-2 flex items-center justify-center transition-all',
                                      item.status === value
                                        ? activeColour
                                        : 'border-gray-200 text-gray-300 hover:border-gray-300',
                                      item.isSaving && 'opacity-50 cursor-wait',
                                    )}
                                  >
                                    {item.isSaving && item.status === value
                                      ? <Loader2 className="h-3 w-3 animate-spin" />
                                      : icon}
                                  </button>
                                ))}
                              </div>

                              {/* Add/edit note toggle button */}
                              <button
                                onClick={() => toggleNote(item.checkId)}
                                className={cn(
                                  'flex items-center gap-1 text-xs rounded-md px-2 py-1 border transition-colors',
                                  item.editingNote
                                    ? 'border-brand-300 bg-brand-50 text-brand-700'
                                    : item.notes
                                      ? 'border-gray-200 bg-gray-50 text-gray-600 hover:border-brand-300'
                                      : 'border-dashed border-gray-300 text-gray-400 hover:border-brand-300 hover:text-brand-600',
                                )}
                              >
                                <MessageSquare className="h-3 w-3" />
                                {item.notes ? 'Edit note' : 'Add note'}
                              </button>
                            </>
                          ) : (
                            // Read-only status badge
                            <span className={cn('badge', statusColour(item.status))}>
                              {item.status.replace(/_/g, ' ')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Finalise Panel (fixer, editable) ── */}
      {canFinalise && (
        <div className="card p-6 mb-5 border-brand-100">
          <h3 className="font-semibold text-gray-900 mb-1">Finalise inspection</h3>
          <p className="text-sm text-gray-500 mb-4">
            A summary is required for Completed and Needs Follow-up outcomes.
            Your item notes above are automatically included in the owner report.
          </p>
          <textarea
            value={summaryText}
            onChange={(e) => setSummaryText(e.target.value)}
            rows={3}
            className={cn(
              'input resize-none mb-4',
              pendingOutcome && summaryText.trim().length < 5 ? 'border-red-300 focus:ring-red-400' : '',
            )}
            placeholder="Overall vehicle condition and any additional observations…"
          />
          {pendingOutcome && summaryText.trim().length < 5 && (
            <p className="text-xs text-red-600 -mt-3 mb-4">
              A summary is required for this outcome.
            </p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {OUTCOME_BUTTONS.map(({ value, label, description, colour, icon }) => (
              <button
                key={value}
                onClick={() => submitOutcome(value)}
                disabled={isSubmittingOutcome}
                className={cn(
                  'flex flex-col items-start gap-1 rounded-xl border-2 p-4 text-left transition-all',
                  colour,
                  isSubmittingOutcome && 'opacity-50 cursor-wait',
                )}
              >
                <div className="flex items-center gap-2 font-medium text-sm">
                  {isSubmittingOutcome ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
                  {label}
                </div>
                <p className="text-xs opacity-70">{description}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Read-only summary (completed inspections) ── */}
      {inspection.summary && !canFinalise && (
        <div className="card p-6 mb-5">
          <h3 className="font-semibold text-gray-900 mb-2">Inspection summary</h3>
          <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{inspection.summary}</p>
          {inspection.completedAt && (
            <p className="text-xs text-gray-400 mt-3">Completed {formatDate(inspection.completedAt)}</p>
          )}
        </div>
      )}

      {/* ── Fix Job Modal ── */}
      {showFixJobModal && (
        <CreateFixJobModal
          inspection={{ ...inspection, items }}
          onClose={() => setShowFixJobModal(false)}
          onCreated={(jobId) => {
            setShowFixJobModal(false);
            router.push(`/dashboard/fix-jobs/${jobId}`);
          }}
        />
      )}
    </div>
  );
}