'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Plus, Search, Trash2 } from 'lucide-react';
import { invoicingApi, type LineItemInput } from '@/lib/api';
import type { CatalogItem } from '@motacare/shared-types';
import { formatCurrency } from '@/lib/utils';

// ============================================================
// LINE ITEMS EDITOR
// Shared between the quote and invoice builders. Items can be
// picked from the workshop's reusable catalog (autocomplete) or
// typed fresh — either way, on save the backend auto-upserts the
// description into the catalog so it's there next time.
// ============================================================

const EMPTY_ITEM: LineItemInput = { description: '', quantity: 1, unit: 'pcs', unitPrice: 0 };

export function LineItemsEditor({
  currency,
  value,
  onChange,
}: {
  currency: string;
  value: LineItemInput[];
  onChange: (items: LineItemInput[]) => void;
}) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<CatalogItem[]>([]);
  const [showResults, setShowResults] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (!search.trim()) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await invoicingApi.listCatalogItems({ search, limit: 8, sort: 'usage' });
        setResults(res.data);
      } catch { setResults([]); }
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [search]);

  const addFromCatalog = useCallback((item: CatalogItem) => {
    onChange([...value, {
      catalogItemId: item.id,
      description: item.description,
      kind: item.kind,
      quantity: 1,
      unit: item.defaultUnit,
      unitPrice: item.defaultUnitPrice,
    }]);
    setSearch('');
    setResults([]);
    setShowResults(false);
  }, [value, onChange]);

  const addCustom = useCallback(() => {
    onChange([...value, { ...EMPTY_ITEM }]);
  }, [value, onChange]);

  const updateRow = useCallback((index: number, patch: Partial<LineItemInput>) => {
    const next = value.slice();
    next[index] = { ...next[index], ...patch };
    // Editing description on a row that came from the catalog
    // detaches it — it's now a fresh line item on next save.
    if (patch.description !== undefined) next[index].catalogItemId = undefined;
    onChange(next);
  }, [value, onChange]);

  const removeRow = useCallback((index: number) => {
    onChange(value.filter((_, i) => i !== index));
  }, [value, onChange]);

  const subtotal = value.reduce((sum, li) => sum + (li.quantity || 0) * (li.unitPrice || 0), 0);

  return (
    <div>
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setShowResults(true); }}
          onFocus={() => setShowResults(true)}
          placeholder="Search your catalog (parts, labor, services)…"
          className="input pl-10"
        />
        {showResults && results.length > 0 && (
          <div className="absolute z-10 mt-1 w-full card max-h-64 overflow-y-auto">
            {results.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => addFromCatalog(item)}
                className="w-full text-left px-4 py-2.5 hover:bg-gray-50 flex items-center justify-between gap-3 border-b border-gray-100 last:border-0"
              >
                <span className="text-sm text-gray-900 truncate">{item.description}</span>
                <span className="text-xs text-gray-400 shrink-0">{formatCurrency(item.defaultUnitPrice, currency)} / {item.defaultUnit}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <th className="text-left px-3 py-2 font-medium">Description</th>
              <th className="text-right px-3 py-2 font-medium w-20">Qty</th>
              <th className="text-left px-3 py-2 font-medium w-24">Unit</th>
              <th className="text-right px-3 py-2 font-medium w-28">Price</th>
              <th className="text-right px-3 py-2 font-medium w-28">Total</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {value.length === 0 ? (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-gray-400 text-sm">No items yet — search above or add a custom item</td></tr>
            ) : value.map((li, i) => (
              <tr key={i} className="border-t border-gray-100">
                <td className="px-3 py-2">
                  <input
                    type="text" value={li.description}
                    onChange={(e) => updateRow(i, { description: e.target.value })}
                    placeholder="Item description"
                    className="w-full border-0 focus:ring-0 text-sm p-0 bg-transparent"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number" min={0} step="0.01" value={li.quantity}
                    onChange={(e) => updateRow(i, { quantity: Number(e.target.value) })}
                    className="w-full border-0 focus:ring-0 text-sm p-0 text-right bg-transparent"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="text" value={li.unit}
                    onChange={(e) => updateRow(i, { unit: e.target.value })}
                    className="w-full border-0 focus:ring-0 text-sm p-0 bg-transparent"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number" min={0} step="0.01" value={li.unitPrice}
                    onChange={(e) => updateRow(i, { unitPrice: Number(e.target.value) })}
                    className="w-full border-0 focus:ring-0 text-sm p-0 text-right bg-transparent"
                  />
                </td>
                <td className="px-3 py-2 text-right text-gray-700 font-medium">
                  {formatCurrency((li.quantity || 0) * (li.unitPrice || 0), currency)}
                </td>
                <td className="px-3 py-2 text-right">
                  <button type="button" onClick={() => removeRow(i)} className="text-gray-300 hover:text-red-500">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="border-t border-gray-100 px-3 py-2 flex items-center justify-between">
          <button type="button" onClick={addCustom} className="inline-flex items-center gap-1 text-sm text-brand-600 hover:text-brand-700 font-medium">
            <Plus className="h-4 w-4" /> Custom item
          </button>
          <span className="text-sm text-gray-500">Subtotal: <span className="font-semibold text-gray-900">{formatCurrency(subtotal, currency)}</span></span>
        </div>
      </div>
    </div>
  );
}
