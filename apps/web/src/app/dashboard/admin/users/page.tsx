'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search, X, UserCheck, UserX, Shield, Loader2,
  ChevronLeft, ChevronRight, User, Wrench, Building2,
} from 'lucide-react';
import { toast } from 'sonner';
import { adminApi, ApiClientError } from '@/lib/api';
import type { AdminUser } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDate, cn } from '@/lib/utils';

const ROLE_COLOURS: Record<string, string> = {
  OWNER:          'bg-blue-50 text-blue-700',
  FIXER:          'bg-orange-50 text-orange-700',
  WORKSHOP_ADMIN: 'bg-purple-50 text-purple-700',
  ADMIN:          'bg-red-50 text-red-700',
};

const ROLE_OPTIONS = ['', 'OWNER', 'FIXER', 'WORKSHOP_ADMIN', 'ADMIN'];

export default function AdminUsersPage() {
  const { user }  = useAuth();
  const router    = useRouter();

  const [users, setUsers]         = useState<AdminUser[]>([]);
  const [total, setTotal]         = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage]           = useState(1);
  const [search, setSearch]       = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [actionUserId, setActionUserId] = useState<string | null>(null);

  const debounceRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (user && user.role !== 'ADMIN') router.replace('/dashboard');
  }, [user, router]);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(debounceRef.current);
  }, [search]);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const isActive = statusFilter === 'all' ? undefined : statusFilter === 'active';
      const res = await adminApi.listUsers({
        page,
        limit: 20,
        role:     roleFilter || undefined,
        search:   debouncedSearch || undefined,
        isActive,
      });
      setUsers((res as any)?.data ?? []);
      const pag = (res as any)?.pagination;
      setTotal(pag?.total ?? 0);
      setTotalPages(pag?.totalPages ?? 1);
    } catch (err) {
      if (err instanceof ApiClientError) toast.error(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [page, debouncedSearch, roleFilter, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const handleSuspend = async (userId: string, currentlyActive: boolean) => {
    setActionUserId(userId);
    try {
      if (currentlyActive) {
        await adminApi.suspendUser(userId);
        toast.success('User suspended');
      } else {
        await adminApi.reactivateUser(userId);
        toast.success('User reactivated');
      }
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, isActive: !currentlyActive } : u));
    } catch (err) {
      if (err instanceof ApiClientError) toast.error(err.message);
    } finally {
      setActionUserId(null);
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    setActionUserId(userId);
    try {
      await adminApi.setUserRole(userId, newRole);
      toast.success('Role updated');
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, role: newRole } : u));
    } catch (err) {
      if (err instanceof ApiClientError) toast.error(err.message);
    } finally {
      setActionUserId(null);
    }
  };

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Users</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {isLoading ? '…' : `${total.toLocaleString()} total users`}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or email…"
            className="input pl-10 pr-9"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <select
          value={roleFilter}
          onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
          className="input w-auto"
        >
          <option value="">All roles</option>
          <option value="OWNER">Owners</option>
          <option value="FIXER">Fixers</option>
          <option value="WORKSHOP_ADMIN">Workshop Admins</option>
          <option value="ADMIN">Admins</option>
        </select>

        <div className="inline-flex border border-gray-200 rounded-lg overflow-hidden">
          {(['all', 'active', 'suspended'] as const).map((s) => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); setPage(1); }}
              className={cn(
                'px-4 py-2 text-sm font-medium capitalize transition-colors',
                statusFilter === s ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-700',
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <User className="h-10 w-10 mx-auto mb-3 text-gray-300" />
            No users found
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {['User', 'Role', 'Plan', 'Status', 'Joined', 'Actions'].map((h) => (
                    <th key={h} className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide px-4 py-3 first:pl-5 last:pr-5">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 pl-5">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-semibold text-xs shrink-0">
                          {u.firstName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{u.firstName} {u.lastName}</p>
                          <p className="text-xs text-gray-400">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('badge text-xs font-semibold', ROLE_COLOURS[u.role] ?? 'bg-gray-100 text-gray-700')}>
                        {u.role.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-gray-500">{u.subscriptionTier}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('badge text-xs', u.isActive ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700')}>
                        {u.isActive ? 'Active' : 'Suspended'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">{formatDate(u.createdAt)}</td>
                    <td className="px-4 py-3 pr-5">
                      <div className="flex items-center gap-2">
                        {/* Role change */}
                        <select
                          value={u.role}
                          onChange={(e) => handleRoleChange(u.id, e.target.value)}
                          disabled={actionUserId === u.id || u.id === user?.id}
                          className="text-xs border border-gray-200 rounded-md px-2 py-1 bg-white text-gray-600 disabled:opacity-40"
                        >
                          {ROLE_OPTIONS.filter(Boolean).map((r) => (
                            <option key={r} value={r}>{r.replace('_', ' ')}</option>
                          ))}
                        </select>

                        {/* Suspend / reactivate */}
                        <button
                          onClick={() => handleSuspend(u.id, u.isActive)}
                          disabled={actionUserId === u.id || u.id === user?.id}
                          className={cn(
                            'p-1.5 rounded-lg transition-colors disabled:opacity-40',
                            u.isActive
                              ? 'text-red-400 hover:bg-red-50'
                              : 'text-green-500 hover:bg-green-50',
                          )}
                          title={u.isActive ? 'Suspend user' : 'Reactivate user'}
                        >
                          {actionUserId === u.id
                            ? <Loader2 className="h-4 w-4 animate-spin" />
                            : u.isActive ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-gray-400">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary text-sm disabled:opacity-40">
              <ChevronLeft className="h-4 w-4" /> Previous
            </button>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="btn-secondary text-sm disabled:opacity-40">
              Next <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}