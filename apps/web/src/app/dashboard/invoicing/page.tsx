import Link from 'next/link';
import { BookOpen, FileText, Receipt, TrendingUp } from 'lucide-react';

const TILES = [
  { href: '/dashboard/invoicing/quotes',   label: 'Quotes',   desc: 'Build and send customer quotes', icon: FileText },
  { href: '/dashboard/invoicing/invoices', label: 'Invoices', desc: 'Manage invoices and record payments', icon: Receipt },
  { href: '/dashboard/invoicing/catalog',  label: 'Catalog',  desc: 'Reusable parts and labor line items', icon: BookOpen },
  { href: '/dashboard/invoicing/reports',  label: 'Reports',  desc: 'Revenue, collections, and outstanding balances', icon: TrendingUp },
];

export default function InvoicingHomePage() {
  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Quotes & Invoices</h1>
        <p className="text-gray-500 text-sm mt-0.5">Build customer documents and track your workshop's finances</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {TILES.map(({ href, label, desc, icon: Icon }) => (
          <Link key={href} href={href} className="card p-6 hover:shadow-md transition-shadow group">
            <Icon className="h-6 w-6 text-brand-600 mb-3" />
            <p className="font-semibold text-gray-900 group-hover:text-brand-700">{label}</p>
            <p className="text-sm text-gray-500 mt-1">{desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
