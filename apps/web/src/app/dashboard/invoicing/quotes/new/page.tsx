'use client';

import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { invoicingApi } from '@/lib/api';
import { DocumentForm, type DocumentFormValues } from '@/components/invoicing/DocumentForm';

export default function NewQuotePage() {
  const router = useRouter();

  async function handleSubmit(values: DocumentFormValues) {
    const quote = await invoicingApi.createQuote({
      customerName: values.customerName,
      customerContact: values.customerContact,
      customerAddress: values.customerAddress || undefined,
      vehicleDescription: values.vehicleDescription || undefined,
      currency: values.currency,
      taxRate: values.taxRate,
      discountAmount: values.discountAmount,
      notes: values.notes || undefined,
      validUntil: values.dateField || undefined,
      lineItems: values.lineItems,
    });
    toast.success(`Quote ${quote.quoteNumber} created`);
    router.push(`/dashboard/invoicing/quotes/${quote.id}`);
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">New Quote</h1>
        <p className="text-gray-500 text-sm mt-0.5">Build a quote to send to a customer</p>
      </div>
      <DocumentForm kind="QUOTE" submitLabel="Create Quote" onSubmit={handleSubmit} />
    </div>
  );
}
