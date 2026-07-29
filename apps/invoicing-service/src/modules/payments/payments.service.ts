import { eq, and, desc } from 'drizzle-orm';
import { db } from '../../db';
import { invoices, payments, type Payment, type Invoice } from '../../db/schema';
import { NotFoundError, ForbiddenError, ConflictError, BadRequestError } from '../../errors';
import type { RecordPaymentInput } from './payments.schema';

export interface PaymentScope {
  workshopId?: string;
  ownerId?: string;
}

async function getInvoiceInScope(invoiceId: string, scope: PaymentScope): Promise<Invoice> {
  const invoice = await db.query.invoices.findFirst({ where: eq(invoices.id, invoiceId) });
  if (!invoice) throw new NotFoundError('Invoice not found');
  if (scope.workshopId && invoice.workshopId !== scope.workshopId) {
    throw new ForbiddenError('You do not have access to this invoice');
  }
  if (scope.ownerId && invoice.ownerId !== scope.ownerId) {
    throw new ForbiddenError('You do not have access to this invoice');
  }
  return invoice;
}

function nextStatus(amountDue: number, amountPaid: number): Invoice['status'] {
  if (amountDue <= 0) return 'PAID';
  if (amountPaid > 0) return 'PARTIALLY_PAID';
  return 'SENT';
}

export class PaymentsService {

  async listPayments(invoiceId: string, scope: PaymentScope): Promise<Payment[]> {
    await getInvoiceInScope(invoiceId, scope);
    return db.query.payments.findMany({
      where: eq(payments.invoiceId, invoiceId),
      orderBy: [desc(payments.paidAt)],
    });
  }

  async recordPayment(
    invoiceId: string,
    workshopId: string,
    recordedBy: string,
    input: RecordPaymentInput,
  ): Promise<{ payment: Payment; invoice: Invoice }> {
    const invoice = await getInvoiceInScope(invoiceId, { workshopId });

    if (invoice.status === 'DRAFT' || invoice.status === 'VOID') {
      throw new ConflictError(`Cannot record a payment against a ${invoice.status} invoice`);
    }

    const currentAmountDue = Number(invoice.amountDue);
    if (input.amount > currentAmountDue) {
      throw new BadRequestError(
        `Payment of ${input.amount} exceeds the outstanding balance of ${currentAmountDue}`,
      );
    }

    return db.transaction(async (tx) => {
      const [payment] = await tx.insert(payments).values({
        invoiceId,
        workshopId,
        amount: String(input.amount),
        method: input.method,
        paidAt: input.paidAt,
        reference: input.reference,
        note: input.note,
        recordedBy,
      }).returning();

      const newAmountPaid = Number(invoice.amountPaid) + input.amount;
      const newAmountDue = Number(invoice.total) - newAmountPaid;
      const status = nextStatus(newAmountDue, newAmountPaid);

      const [updatedInvoice] = await tx.update(invoices)
        .set({
          amountPaid: String(newAmountPaid),
          amountDue: String(Math.max(0, newAmountDue)),
          status,
          paidAt: status === 'PAID' ? new Date() : invoice.paidAt,
          updatedAt: new Date(),
        })
        .where(eq(invoices.id, invoiceId))
        .returning();

      return { payment, invoice: updatedInvoice };
    });
  }

  async deletePayment(paymentId: string, workshopId: string): Promise<void> {
    const payment = await db.query.payments.findFirst({ where: eq(payments.id, paymentId) });
    if (!payment) throw new NotFoundError('Payment not found');
    if (payment.workshopId !== workshopId) {
      throw new ForbiddenError('You do not have access to this payment');
    }

    const invoice = await db.query.invoices.findFirst({ where: eq(invoices.id, payment.invoiceId) });
    if (!invoice) throw new NotFoundError('Invoice not found');

    await db.transaction(async (tx) => {
      await tx.delete(payments).where(eq(payments.id, paymentId));

      const newAmountPaid = Math.max(0, Number(invoice.amountPaid) - Number(payment.amount));
      const newAmountDue = Number(invoice.total) - newAmountPaid;
      const status = nextStatus(newAmountDue, newAmountPaid);

      await tx.update(invoices)
        .set({
          amountPaid: String(newAmountPaid),
          amountDue: String(Math.max(0, newAmountDue)),
          status,
          paidAt: status === 'PAID' ? invoice.paidAt : null,
          updatedAt: new Date(),
        })
        .where(eq(invoices.id, invoice.id));
    });
  }
}
