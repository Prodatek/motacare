import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';

// ============================================================
// SHARED QUOTE/INVOICE PDF LAYOUT
// One layout, parameterized by `kind`, used by both
// QuoteDocument.tsx and InvoiceDocument.tsx. Rendered on-demand
// per request — nothing here is persisted to disk.
// ============================================================

export interface DocumentLineItemView {
  description: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface PaymentView {
  paidAt: string;
  method: string;
  amount: number;
  reference?: string | null;
}

export interface WorkshopBranding {
  name: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  phone?: string | null;
  email?: string | null;
}

export interface DocumentData {
  kind: 'QUOTE' | 'INVOICE';
  documentNumber: string;
  status: string;
  issueDate: string;
  secondaryDate?: { label: string; value: string } | null; // validUntil (quote) or dueDate (invoice)
  workshop: WorkshopBranding;
  customer: {
    name: string;
    contact: string;
    address?: string | null;
    vehicleDescription?: string | null;
  };
  currency: string;
  lineItems: DocumentLineItemView[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  discountAmount: number;
  total: number;
  amountPaid?: number;
  amountDue?: number;
  payments?: PaymentView[];
  notes?: string | null;
}

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 10, fontFamily: 'Helvetica', color: '#1f2937' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  workshopName: { fontSize: 16, fontWeight: 700, marginBottom: 4 },
  muted: { color: '#6b7280' },
  docTitle: { fontSize: 20, fontWeight: 700, textAlign: 'right', marginBottom: 4 },
  docNumber: { fontSize: 11, textAlign: 'right', color: '#6b7280' },
  statusBadge: { fontSize: 9, textAlign: 'right', marginTop: 6, fontWeight: 700 },
  section: { marginBottom: 18 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between' },
  label: { fontSize: 8, color: '#6b7280', textTransform: 'uppercase', marginBottom: 3, letterSpacing: 0.5 },
  value: { fontSize: 10.5 },
  table: { marginTop: 8, borderTop: '1 solid #e5e7eb' },
  tableHeaderRow: {
    flexDirection: 'row', backgroundColor: '#f9fafb',
    paddingVertical: 6, paddingHorizontal: 4, borderBottom: '1 solid #e5e7eb',
  },
  tableRow: {
    flexDirection: 'row', paddingVertical: 6, paddingHorizontal: 4,
    borderBottom: '1 solid #f3f4f6',
  },
  colDescription: { flex: 4 },
  colQty: { flex: 1, textAlign: 'right' },
  colUnit: { flex: 1, textAlign: 'center' },
  colPrice: { flex: 1.4, textAlign: 'right' },
  colTotal: { flex: 1.4, textAlign: 'right' },
  th: { fontSize: 8, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 },
  totalsBlock: { marginTop: 16, alignItems: 'flex-end' },
  totalsRow: { flexDirection: 'row', justifyContent: 'space-between', width: 220, paddingVertical: 2 },
  totalsLabel: { color: '#6b7280' },
  grandTotalRow: {
    flexDirection: 'row', justifyContent: 'space-between', width: 220,
    paddingTop: 6, marginTop: 4, borderTop: '1 solid #e5e7eb',
  },
  grandTotalLabel: { fontSize: 11, fontWeight: 700 },
  grandTotalValue: { fontSize: 11, fontWeight: 700 },
  paymentsTable: { marginTop: 20 },
  footer: { marginTop: 28, paddingTop: 12, borderTop: '1 solid #e5e7eb', fontSize: 8.5, color: '#6b7280' },
  brandFooter: { position: 'absolute', bottom: 24, left: 36, right: 36, fontSize: 8, color: '#9ca3af', textAlign: 'center' },
});

const STATUS_COLORS: Record<string, string> = {
  DRAFT: '#6b7280',
  SENT: '#2563eb',
  ACCEPTED: '#16a34a',
  REJECTED: '#dc2626',
  EXPIRED: '#9ca3af',
  PARTIALLY_PAID: '#d97706',
  PAID: '#16a34a',
  OVERDUE: '#dc2626',
  VOID: '#6b7280',
};

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function DocumentLayout({ data }: { data: DocumentData }) {
  const { workshop, customer } = data;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.workshopName}>{workshop.name}</Text>
            {workshop.address ? <Text style={styles.muted}>{workshop.address}</Text> : null}
            {(workshop.city || workshop.state) ? (
              <Text style={styles.muted}>{[workshop.city, workshop.state].filter(Boolean).join(', ')}</Text>
            ) : null}
            {workshop.phone ? <Text style={styles.muted}>{workshop.phone}</Text> : null}
            {workshop.email ? <Text style={styles.muted}>{workshop.email}</Text> : null}
          </View>
          <View>
            <Text style={styles.docTitle}>{data.kind === 'QUOTE' ? 'QUOTE' : 'INVOICE'}</Text>
            <Text style={styles.docNumber}>{data.documentNumber}</Text>
            <Text style={[styles.statusBadge, { color: STATUS_COLORS[data.status] ?? '#374151' }]}>
              {data.status.replace('_', ' ')}
            </Text>
          </View>
        </View>

        <View style={[styles.section, styles.sectionRow]}>
          <View>
            <Text style={styles.label}>Bill To</Text>
            <Text style={styles.value}>{customer.name}</Text>
            <Text style={styles.muted}>{customer.contact}</Text>
            {customer.address ? <Text style={styles.muted}>{customer.address}</Text> : null}
            {customer.vehicleDescription ? <Text style={styles.muted}>{customer.vehicleDescription}</Text> : null}
          </View>
          <View>
            <Text style={styles.label}>Issue Date</Text>
            <Text style={styles.value}>{formatDate(data.issueDate)}</Text>
            {data.secondaryDate ? (
              <>
                <Text style={[styles.label, { marginTop: 8 }]}>{data.secondaryDate.label}</Text>
                <Text style={styles.value}>{formatDate(data.secondaryDate.value)}</Text>
              </>
            ) : null}
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.colDescription, styles.th]}>Description</Text>
            <Text style={[styles.colQty, styles.th]}>Qty</Text>
            <Text style={[styles.colUnit, styles.th]}>Unit</Text>
            <Text style={[styles.colPrice, styles.th]}>Unit Price</Text>
            <Text style={[styles.colTotal, styles.th]}>Total</Text>
          </View>
          {data.lineItems.map((li, i) => (
            <View key={i} style={styles.tableRow}>
              <Text style={styles.colDescription}>{li.description}</Text>
              <Text style={styles.colQty}>{li.quantity}</Text>
              <Text style={styles.colUnit}>{li.unit}</Text>
              <Text style={styles.colPrice}>{formatMoney(li.unitPrice, data.currency)}</Text>
              <Text style={styles.colTotal}>{formatMoney(li.lineTotal, data.currency)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.totalsBlock}>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Subtotal</Text>
            <Text>{formatMoney(data.subtotal, data.currency)}</Text>
          </View>
          {data.discountAmount > 0 ? (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Discount</Text>
              <Text>-{formatMoney(data.discountAmount, data.currency)}</Text>
            </View>
          ) : null}
          {data.taxRate > 0 ? (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Tax ({data.taxRate}%)</Text>
              <Text>{formatMoney(data.taxAmount, data.currency)}</Text>
            </View>
          ) : null}
          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>Total</Text>
            <Text style={styles.grandTotalValue}>{formatMoney(data.total, data.currency)}</Text>
          </View>
          {data.kind === 'INVOICE' ? (
            <>
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>Amount Paid</Text>
                <Text>{formatMoney(data.amountPaid ?? 0, data.currency)}</Text>
              </View>
              <View style={styles.totalsRow}>
                <Text style={[styles.totalsLabel, { fontWeight: 700 }]}>Amount Due</Text>
                <Text style={{ fontWeight: 700 }}>{formatMoney(data.amountDue ?? 0, data.currency)}</Text>
              </View>
            </>
          ) : null}
        </View>

        {data.kind === 'INVOICE' && data.payments && data.payments.length > 0 ? (
          <View style={styles.paymentsTable}>
            <Text style={styles.label}>Payments Received</Text>
            <View style={styles.table}>
              <View style={styles.tableHeaderRow}>
                <Text style={[{ flex: 1.5 }, styles.th]}>Date</Text>
                <Text style={[{ flex: 1.5 }, styles.th]}>Method</Text>
                <Text style={[{ flex: 2 }, styles.th]}>Reference</Text>
                <Text style={[{ flex: 1.5, textAlign: 'right' }, styles.th]}>Amount</Text>
              </View>
              {data.payments.map((p, i) => (
                <View key={i} style={styles.tableRow}>
                  <Text style={{ flex: 1.5 }}>{formatDate(p.paidAt)}</Text>
                  <Text style={{ flex: 1.5 }}>{p.method.replace('_', ' ')}</Text>
                  <Text style={{ flex: 2 }}>{p.reference ?? '—'}</Text>
                  <Text style={{ flex: 1.5, textAlign: 'right' }}>{formatMoney(p.amount, data.currency)}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {data.notes ? (
          <View style={styles.footer}>
            <Text style={styles.label}>Notes</Text>
            <Text>{data.notes}</Text>
          </View>
        ) : null}

        <Text style={styles.brandFooter}>Generated by Motacare</Text>
      </Page>
    </Document>
  );
}
