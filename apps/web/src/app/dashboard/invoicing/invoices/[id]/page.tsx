'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Download, Loader2, Send, Trash2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { invoicingApi, ApiClientError } from '@/lib/api';
import type { Invoice, PaymentMethod } from '@motacare/shared-types';
import { formatCurrency, formatDate } from '@/lib/utils';
import { StatusBadge } from '@/components/invoicing/StatusBadge';
import { DocumentForm, type DocumentFormValues } from '@/components/invoicing/DocumentForm';

const PAYMENT_METHODS: PaymentMethod[] = ['CASH', 'BANK_TRANSFER', 'MOBILE_MONEY', 'CARD', 'CHEQUE', 'OTHER'];

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [paymentReference, setPaymentReference] = useState('');

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      setInvoice(await invoicingApi.getInvoice(id));
    } catch (err) {
      if (err instanceof ApiClientError) toast.error(err.message);
    } finally { setIsLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function action(fn: () => Promise<any>, successMsg: string) {
    setBusy(true);
    try {
      await fn();
      toast.success(successMsg);
      load();
    } catch (err) {
      if (err instanceof ApiClientError) toast.error(err.message);
    } finally { setBusy(false); }
  }

  async function handleSaveEdit(values: DocumentFormValues) {
    await invoicingApi.updateInvoice(id, {
      customerName: values.customerName,
      customerContact: values.customerContact,
      customerAddress: values.customerAddress || undefined,
      vehicleDescription: values.vehicleDescription || undefined,
      currency: values.currency,
      taxRate: values.taxRate,
      discountAmount: values.discountAmount,
      notes: values.notes || undefined,
      dueDate: values.dateField || undefined,
      lineItems: values.lineItems,
    });
    toast.success('Invoice updated');
    load();
  }

  async function submitPayment(e: React.FormEvent) {
    e.preventDefault();
    const amount = Number(paymentAmount);
    if (Number.isNaN(amount) || amount <= 0) { toast.error('Enter a valid amount'); return; }
    setBusy(true);
    try {
      await invoicingApi.recordPayment(id, { amount, method: paymentMethod, reference: paymentReference || undefined });
      toast.success('Payment recorded');
      setShowPaymentForm(false);
      setPaymentAmount('');
      setPaymentReference('');
      load();
    } catch (err) {
      if (err instanceof ApiClientError) toast.error(err.message);
    } finally { setBusy(false); }
  }

  if (isLoading) return <Loader2 className="h-6 w-6 animate-spin text-gray-400" />;
  if (!invoice) return <p className="text-gray-500">Invoice not found.</p>;

  if (invoice.status === 'DRAFT') {
    return (
      <div>
        <div className="mb-6 flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-bold text-gray-900">{invoice.invoiceNumber}</h1>
          <StatusBadge status={invoice.status} />
        </div>
        <DocumentForm
          kind="INVOICE"
          submitLabel="Save Changes"
          initialValues={{
            customerName: invoice.customerName,
            customerContact: invoice.customerContact,
            customerAddress: invoice.customerAddress ?? '',
            vehicleDescription: invoice.vehicleDescription ?? '',
            currency: invoice.currency,
            taxRate: invoice.taxRate,
            discountAmount: invoice.discountAmount,
            notes: invoice.notes ?? '',
            dateField: invoice.dueDate ? new Date(invoice.dueDate).toISOString().slice(0, 10) : '',
            lineItems: invoice.lineItems.map((li) => ({
              catalogItemId: li.catalogItemId ?? undefined,
              description: li.description,
              kind: li.kind ?? undefined,
              quantity: li.quantity,
              unit: li.unit,
              unitPrice: li.unitPrice,
            })),
          }}
          onSubmit={handleSaveEdit}
        />
        <div className="max-w-3xl flex gap-3 mt-4">
          <button disabled={busy} onClick={() => action(() => invoicingApi.sendInvoice(id), 'Invoice sent')} className="btn-primary">
            <Send className="h-4 w-4" /> Send to Customer
          </button>
          <button
            disabled={busy}
            onClick={() => { if (confirm('Delete this draft invoice?')) action(() => invoicingApi.deleteInvoice(id).then(() => router.push('/dashboard/invoicing/invoices')), 'Invoice deleted'); }}
            className="btn-danger"
          >
            <Trash2 className="h-4 w-4" /> Delete
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900">{invoice.invoiceNumber}</h1>
            <StatusBadge status={invoice.status} />
          </div>
          <p className="text-gray-500 text-sm mt-0.5">
            Issued {formatDate(invoice.issueDate)}{invoice.dueDate ? ` · Due ${formatDate(invoice.dueDate)}` : ''}
          </p>
        </div>
        <button
          disabled={busy}
          onClick={() => action(() => invoicingApi.downloadInvoicePdf(invoice.id, invoice.invoiceNumber), 'Downloading…')}
          className="btn-secondary"
        >
          <Download className="h-4 w-4" /> PDF
        </button>
      </div>

      <div className="card p-5 mb-4">
        <h2 className="text-sm font-semibold text-gray-900 mb-2">Customer</h2>
        <p className="text-sm text-gray-900">{invoice.customerName}</p>
        <p className="text-sm text-gray-500">{invoice.customerContact}</p>
        {invoice.customerAddress && <p className="text-sm text-gray-500">{invoice.customerAddress}</p>}
        {invoice.vehicleDescription && <p className="text-sm text-gray-500 mt-1">{invoice.vehicleDescription}</p>}
      </div>

      <div className="card overflow-hidden mb-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <th className="text-left px-3 py-2 font-medium">Description</th>
              <th className="text-right px-3 py-2 font-medium">Qty</th>
              <th className="text-right px-3 py-2 font-medium">Price</th>
              <th className="text-right px-3 py-2 font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lineItems.map((li) => (
              <tr key={li.id} className="border-t border-gray-100">
                <td className="px-3 py-2">{li.description}</td>
                <td className="px-3 py-2 text-right">{li.quantity} {li.unit}</td>
                <td className="px-3 py-2 text-right">{formatCurrency(li.unitPrice, invoice.currency)}</td>
                <td className="px-3 py-2 text-right font-medium">{formatCurrency(li.lineTotal, invoice.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="border-t border-gray-100 px-3 py-3 flex flex-col items-end gap-1 text-sm">
          <div className="flex justify-between w-56 text-gray-500"><span>Subtotal</span><span>{formatCurrency(invoice.subtotal, invoice.currency)}</span></div>
          {invoice.discountAmount > 0 && <div className="flex justify-between w-56 text-gray-500"><span>Discount</span><span>-{formatCurrency(invoice.discountAmount, invoice.currency)}</span></div>}
          {invoice.taxRate > 0 && <div className="flex justify-between w-56 text-gray-500"><span>Tax ({invoice.taxRate}%)</span><span>{formatCurrency(invoice.taxAmount, invoice.currency)}</span></div>}
          <div className="flex justify-between w-56 text-gray-900 font-semibold text-base border-t border-gray-100 pt-1"><span>Total</span><span>{formatCurrency(invoice.total, invoice.currency)}</span></div>
          <div className="flex justify-between w-56 text-gray-500"><span>Paid</span><span>{formatCurrency(invoice.amountPaid, invoice.currency)}</span></div>
          <div className="flex justify-between w-56 font-semibold"><span>Balance Due</span><span>{formatCurrency(invoice.amountDue, invoice.currency)}</span></div>
        </div>
      </div>

      <div className="card p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-900">Payments</h2>
          {invoice.status !== 'VOID' && invoice.amountDue > 0 && (
            <button onClick={() => setShowPaymentForm((v) => !v)} className="text-sm text-brand-600 hover:text-brand-700 font-medium">
              {showPaymentForm ? 'Cancel' : '+ Record Payment'}
            </button>
          )}
        </div>

        {showPaymentForm && (
          <form onSubmit={submitPayment} className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4 p-3 bg-gray-50 rounded-lg">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Amount</label>
              <input type="number" min={0} step="0.01" max={invoice.amountDue} required className="input" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Method</label>
              <select className="input" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}>
                {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Reference (optional)</label>
              <input type="text" className="input" value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} />
            </div>
            <div className="sm:col-span-3">
              <button type="submit" disabled={busy} className="btn-primary">Record Payment</button>
            </div>
          </form>
        )}

        {!invoice.payments || invoice.payments.length === 0 ? (
          <p className="text-sm text-gray-400">No payments recorded yet.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {invoice.payments.map((p) => (
              <div key={p.id} className="py-2 flex items-center justify-between text-sm">
                <div>
                  <span className="text-gray-900">{p.method.replace('_', ' ')}</span>
                  <span className="text-gray-400 ml-2">{formatDate(p.paidAt)}</span>
                  {p.reference && <span className="text-gray-400 ml-2">Ref: {p.reference}</span>}
                </div>
                <span className="font-medium text-gray-900">{formatCurrency(p.amount, invoice.currency)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {invoice.notes && (
        <div className="card p-5 mb-4">
          <h2 className="text-sm font-semibold text-gray-900 mb-1">Notes</h2>
          <p className="text-sm text-gray-600 whitespace-pre-wrap">{invoice.notes}</p>
        </div>
      )}

      {invoice.status !== 'PAID' && invoice.status !== 'VOID' && (
        <button
          disabled={busy}
          onClick={() => { const reason = prompt('Reason for voiding (optional)') ?? undefined; action(() => invoicingApi.voidInvoice(id, reason), 'Invoice voided'); }}
          className="btn-secondary"
        >
          <XCircle className="h-4 w-4" /> Void Invoice
        </button>
      )}
    </div>
  );
}
