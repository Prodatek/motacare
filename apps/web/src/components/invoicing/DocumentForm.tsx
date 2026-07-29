'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { LineItemsEditor } from './LineItemsEditor';
import type { LineItemInput } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

export interface DocumentFormValues {
  customerName: string;
  customerContact: string;
  customerAddress: string;
  vehicleDescription: string;
  currency: string;
  taxRate: number;
  discountAmount: number;
  notes: string;
  dateField: string; // validUntil (quote) or dueDate (invoice), yyyy-mm-dd
  lineItems: LineItemInput[];
}

const DEFAULTS: DocumentFormValues = {
  customerName: '',
  customerContact: '',
  customerAddress: '',
  vehicleDescription: '',
  currency: 'NGN',
  taxRate: 0,
  discountAmount: 0,
  notes: '',
  dateField: '',
  lineItems: [],
};

export function DocumentForm({
  kind,
  initialValues,
  submitLabel,
  onSubmit,
}: {
  kind: 'QUOTE' | 'INVOICE';
  initialValues?: Partial<DocumentFormValues>;
  submitLabel: string;
  onSubmit: (values: DocumentFormValues) => Promise<void>;
}) {
  const [values, setValues] = useState<DocumentFormValues>({ ...DEFAULTS, ...initialValues });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof DocumentFormValues>(key: K, val: DocumentFormValues[K]) =>
    setValues((v) => ({ ...v, [key]: val }));

  const subtotal = values.lineItems.reduce((sum, li) => sum + li.quantity * li.unitPrice, 0);
  const taxAmount = subtotal * (values.taxRate / 100);
  const total = Math.max(0, subtotal + taxAmount - values.discountAmount);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!values.customerName.trim() || !values.customerContact.trim()) {
      setError('Customer name and contact are required');
      return;
    }
    if (values.lineItems.length === 0) {
      setError('Add at least one line item');
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(values);
    } catch (err: any) {
      setError(err?.message ?? 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-900">Customer</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Customer name *</label>
            <input className="input" value={values.customerName} onChange={(e) => set('customerName', e.target.value)} required />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Phone / email *</label>
            <input className="input" value={values.customerContact} onChange={(e) => set('customerContact', e.target.value)} required />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-500 mb-1">Address</label>
            <input className="input" value={values.customerAddress} onChange={(e) => set('customerAddress', e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-500 mb-1">Vehicle (optional)</label>
            <input className="input" placeholder="e.g. Toyota Camry 2018 — ABC-123XY" value={values.vehicleDescription} onChange={(e) => set('vehicleDescription', e.target.value)} />
          </div>
        </div>
      </div>

      <div className="card p-5 space-y-3">
        <h2 className="text-sm font-semibold text-gray-900">Line Items</h2>
        <LineItemsEditor currency={values.currency} value={values.lineItems} onChange={(items) => set('lineItems', items)} />
      </div>

      <div className="card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-900">Terms</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Tax rate (%)</label>
            <input type="number" min={0} max={100} step="0.01" className="input" value={values.taxRate} onChange={(e) => set('taxRate', Number(e.target.value))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Discount ({values.currency})</label>
            <input type="number" min={0} step="0.01" className="input" value={values.discountAmount} onChange={(e) => set('discountAmount', Number(e.target.value))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">{kind === 'QUOTE' ? 'Valid until' : 'Due date'}</label>
            <input type="date" className="input" value={values.dateField} onChange={(e) => set('dateField', e.target.value)} />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Notes</label>
          <textarea className="input" rows={3} value={values.notes} onChange={(e) => set('notes', e.target.value)} />
        </div>

        <div className="border-t border-gray-100 pt-3 flex flex-col items-end gap-1 text-sm">
          <div className="flex justify-between w-56 text-gray-500"><span>Subtotal</span><span>{formatCurrency(subtotal, values.currency)}</span></div>
          {values.discountAmount > 0 && <div className="flex justify-between w-56 text-gray-500"><span>Discount</span><span>-{formatCurrency(values.discountAmount, values.currency)}</span></div>}
          {values.taxRate > 0 && <div className="flex justify-between w-56 text-gray-500"><span>Tax ({values.taxRate}%)</span><span>{formatCurrency(taxAmount, values.currency)}</span></div>}
          <div className="flex justify-between w-56 text-gray-900 font-semibold text-base border-t border-gray-100 pt-1"><span>Total</span><span>{formatCurrency(total, values.currency)}</span></div>
        </div>
      </div>

      <button type="submit" disabled={submitting} className="btn-primary">
        {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
        {submitLabel}
      </button>
    </form>
  );
}
