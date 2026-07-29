import { sql } from 'drizzle-orm';
import { db } from '../../db';
import type { ReportRangeInput, TopCustomersQueryInput } from './reports.schema';

// ============================================================
// FINANCIAL REPORTS — derived via aggregate SQL over
// invoices + payments + quotes. No dedicated summary table:
// per-workshop volumes are small enough that this is simpler
// and always consistent with the source rows. Revisit with a
// materialized view only if that assumption stops holding.
// ============================================================

function resolveRange(input: { from?: Date; to?: Date }) {
  const to = input.to ?? new Date();
  const from = input.from ?? new Date(to.getFullYear() - 1, to.getMonth(), to.getDate());
  return { from, to };
}

export class ReportsService {

  async getSummary(workshopId: string, input: ReportRangeInput) {
    const { from, to } = resolveRange(input);

    const [invoicedRow] = (await db.execute(sql`
      SELECT COALESCE(SUM(total), 0)::float AS total
      FROM invoices
      WHERE workshop_id = ${workshopId}
        AND status != 'VOID'
        AND issue_date BETWEEN ${from} AND ${to}
    `)).rows as any[];

    const [collectedRow] = (await db.execute(sql`
      SELECT COALESCE(SUM(amount), 0)::float AS total
      FROM payments
      WHERE workshop_id = ${workshopId}
        AND paid_at BETWEEN ${from} AND ${to}
    `)).rows as any[];

    const [outstandingRow] = (await db.execute(sql`
      SELECT COALESCE(SUM(amount_due), 0)::float AS total
      FROM invoices
      WHERE workshop_id = ${workshopId}
        AND status IN ('SENT', 'PARTIALLY_PAID', 'OVERDUE')
    `)).rows as any[];

    const [overdueRow] = (await db.execute(sql`
      SELECT COALESCE(SUM(amount_due), 0)::float AS total
      FROM invoices
      WHERE workshop_id = ${workshopId}
        AND status = 'OVERDUE'
    `)).rows as any[];

    const [conversionRow] = (await db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE status = 'ACCEPTED')::float AS accepted,
        COUNT(*) FILTER (WHERE status IN ('SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED'))::float AS decided
      FROM quotes
      WHERE workshop_id = ${workshopId}
        AND sent_at BETWEEN ${from} AND ${to}
    `)).rows as any[];

    const decided = Number(conversionRow?.decided ?? 0);
    const accepted = Number(conversionRow?.accepted ?? 0);

    return {
      period: { from: from.toISOString(), to: to.toISOString() },
      totalInvoiced: Number(invoicedRow?.total ?? 0),
      totalCollected: Number(collectedRow?.total ?? 0),
      outstanding: Number(outstandingRow?.total ?? 0),
      overdue: Number(overdueRow?.total ?? 0),
      conversionRate: decided > 0 ? accepted / decided : 0,
    };
  }

  async getTrend(workshopId: string, input: ReportRangeInput) {
    const { from, to } = resolveRange(input);

    const invoicedRows = (await db.execute(sql`
      SELECT date_trunc('month', issue_date) AS month, COALESCE(SUM(total), 0)::float AS total
      FROM invoices
      WHERE workshop_id = ${workshopId}
        AND status != 'VOID'
        AND issue_date BETWEEN ${from} AND ${to}
      GROUP BY 1 ORDER BY 1
    `)).rows as any[];

    const collectedRows = (await db.execute(sql`
      SELECT date_trunc('month', paid_at) AS month, COALESCE(SUM(amount), 0)::float AS total
      FROM payments
      WHERE workshop_id = ${workshopId}
        AND paid_at BETWEEN ${from} AND ${to}
      GROUP BY 1 ORDER BY 1
    `)).rows as any[];

    const byMonth = new Map<string, { month: string; invoiced: number; collected: number }>();
    for (const row of invoicedRows) {
      const key = new Date(row.month).toISOString();
      byMonth.set(key, { month: key, invoiced: Number(row.total), collected: 0 });
    }
    for (const row of collectedRows) {
      const key = new Date(row.month).toISOString();
      const existing = byMonth.get(key);
      if (existing) existing.collected = Number(row.total);
      else byMonth.set(key, { month: key, invoiced: 0, collected: Number(row.total) });
    }

    return [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month));
  }

  async getTopCustomers(workshopId: string, input: TopCustomersQueryInput) {
    const { from, to } = resolveRange(input);

    const rows = (await db.execute(sql`
      SELECT
        COALESCE(owner_id::text, customer_name) AS key,
        customer_name,
        owner_id,
        SUM(total)::float AS total_spend,
        COUNT(*)::int AS invoice_count
      FROM invoices
      WHERE workshop_id = ${workshopId}
        AND status != 'VOID'
        AND issue_date BETWEEN ${from} AND ${to}
      GROUP BY key, customer_name, owner_id
      ORDER BY total_spend DESC
      LIMIT ${input.limit}
    `)).rows as any[];

    return rows.map((r) => ({
      ownerId: r.owner_id,
      customerName: r.customer_name,
      totalSpend: Number(r.total_spend),
      invoiceCount: Number(r.invoice_count),
    }));
  }
}
