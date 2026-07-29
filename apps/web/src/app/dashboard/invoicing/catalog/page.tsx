'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { BookOpen, Loader2, Pencil, Search, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { invoicingApi, ApiClientError } from '@/lib/api';
import type { CatalogItem } from '@motacare/shared-types';
import { formatCurrency, formatDate } from '@/lib/utils';

export default function CatalogPage() {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sort, setSort] = useState<'usage' | 'recent' | 'alpha'>('usage');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(debounceRef.current);
  }, [search]);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await invoicingApi.listCatalogItems({ limit: 50, search: debouncedSearch || undefined, sort });
      setItems(res.data);
      setTotal(res.pagination.total);
    } catch (err) {
      if (err instanceof ApiClientError) toast.error(err.message);
    } finally { setIsLoading(false); }
  }, [debouncedSearch, sort]);

  useEffect(() => { load(); }, [load]);

  async function saveEdit(id: string) {
    const price = Number(editPrice);
    if (Number.isNaN(price) || price < 0) { toast.error('Enter a valid price'); return; }
    try {
      await invoicingApi.updateCatalogItem(id, { defaultUnitPrice: price });
      toast.success('Price updated');
      setEditingId(null);
      load();
    } catch (err) {
      if (err instanceof ApiClientError) toast.error(err.message);
    }
  }

  async function remove(id: string) {
    if (!confirm('Remove this item from the catalog? It will no longer appear in autocomplete.')) return;
    try {
      await invoicingApi.deleteCatalogItem(id);
      toast.success('Item removed');
      load();
    } catch (err) {
      if (err instanceof ApiClientError) toast.error(err.message);
    }
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Catalog</h1>
        <p className="text-gray-500 text-sm mt-0.5">
          {isLoading ? '…' : `${total} reusable items — auto-saved from your quotes and invoices`}
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text" value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search catalog…"
            className="input pl-10 pr-9"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <select value={sort} onChange={(e) => setSort(e.target.value as any)} className="input sm:w-48">
          <option value="usage">Most used</option>
          <option value="recent">Recently used</option>
          <option value="alpha">Alphabetical</option>
        </select>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="card h-16 animate-pulse bg-gray-100 border-0" />)}</div>
      ) : items.length === 0 ? (
        <div className="card p-16 text-center">
          <BookOpen className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-700 mb-2">Catalog is empty</h2>
          <p className="text-sm text-gray-400">Items you type into quotes and invoices are saved here automatically.</p>
        </div>
      ) : (
        <div className="card overflow-hidden divide-y divide-gray-100">
          {items.map((item) => (
            <div key={item.id} className="p-4 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="font-medium text-gray-900 truncate">{item.description}</p>
                <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400 flex-wrap">
                  <span className="badge bg-gray-100 text-gray-600">{item.kind}</span>
                  <span>Used {item.usageCount}×</span>
                  {item.lastUsedAt && <span>Last used {formatDate(item.lastUsedAt)}</span>}
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {editingId === item.id ? (
                  <>
                    <input
                      type="number" min={0} step="0.01" autoFocus
                      value={editPrice}
                      onChange={(e) => setEditPrice(e.target.value)}
                      className="input w-28 py-1"
                    />
                    <button onClick={() => saveEdit(item.id)} className="btn-primary py-1 px-3 text-xs">Save</button>
                    <button onClick={() => setEditingId(null)} className="btn-secondary py-1 px-3 text-xs">Cancel</button>
                  </>
                ) : (
                  <>
                    <span className="text-sm text-gray-700 w-28 text-right">{formatCurrency(item.defaultUnitPrice, item.currency)} / {item.defaultUnit}</span>
                    <button onClick={() => { setEditingId(item.id); setEditPrice(String(item.defaultUnitPrice)); }} className="text-gray-400 hover:text-gray-700">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button onClick={() => remove(item.id)} className="text-gray-300 hover:text-red-500">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
