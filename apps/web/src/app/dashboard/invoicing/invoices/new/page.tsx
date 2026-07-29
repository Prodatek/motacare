'use client';

import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { invoicingApi } from '@/lib/api';
import { DocumentForm, type DocumentFormValues } from '@/components/invoicing/DocumentForm';

export default function NewInvoicePage() {
  const router = useRouter();

  async function handleSubmit(values: DocumentFormValues) {
    const invoice = await invoicingApi.createInvoice({
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
    toast.success(`Invoice ${invoice.invoiceNumber} created`);
    router.push(`/dashboard/invoicing/invoices/${invoice.id}`);
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">New Invoice</h1>
        <p className="text-gray-500 text-sm mt-0.5">Create a standalone invoice for a customer</p>
      </div>
      <DocumentForm kind="INVOICE" submitLabel="Create Invoice" onSubmit={handleSubmit} />
    </div>
  );
}
