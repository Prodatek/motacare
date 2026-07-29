import { DocumentLayout, type WorkshopBranding } from './DocumentLayout';
import type { InvoiceWithLineItems } from '../../invoices/invoices.service';

export function InvoiceDocument({ invoice, workshop }: { invoice: InvoiceWithLineItems; workshop: WorkshopBranding }) {
  return (
    <DocumentLayout
      data={{
        kind: 'INVOICE',
        documentNumber: invoice.invoiceNumber,
        status: invoice.status,
        issueDate: invoice.issueDate.toString(),
        secondaryDate: invoice.dueDate ? { label: 'Due Date', value: invoice.dueDate.toString() } : null,
        workshop,
        customer: {
          name: invoice.customerName,
          contact: invoice.customerContact,
          address: invoice.customerAddress,
          vehicleDescription: invoice.vehicleDescription,
        },
        currency: invoice.currency,
        lineItems: invoice.lineItems.map((li) => ({
          description: li.description,
          unit: li.unit,
          quantity: Number(li.quantity),
          unitPrice: Number(li.unitPrice),
          lineTotal: Number(li.lineTotal),
        })),
        subtotal: Number(invoice.subtotal),
        taxRate: Number(invoice.taxRate),
        taxAmount: Number(invoice.taxAmount),
        discountAmount: Number(invoice.discountAmount),
        total: Number(invoice.total),
        amountPaid: Number(invoice.amountPaid),
        amountDue: Number(invoice.amountDue),
        payments: (invoice.payments ?? []).map((p) => ({
          paidAt: p.paidAt.toString(),
          method: p.method,
          amount: Number(p.amount),
          reference: p.reference,
        })),
        notes: invoice.notes,
      }}
    />
  );
}
