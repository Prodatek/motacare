'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Car, ClipboardCheck, LayoutDashboard, LogOut, Wrench, Menu, X, CreditCard } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';

const NAV = [
  { label: 'Dashboard',   href: '/dashboard',              icon: LayoutDashboard },
  { label: 'Vehicles',    href: '/dashboard/vehicles',     icon: Car },
  { label: 'Inspections', href: '/dashboard/inspections',  icon: ClipboardCheck },
  { label: 'Fix Jobs',    href: '/dashboard/fix-jobs',     icon: Wrench },
  { label: 'Subscription', href: '/dashboard/subscription', icon: CreditCard },
];

function getInitials(first?: string, last?: string) {
  return `${(first?.[0] ?? '').toUpperCase()}${(last?.[0] ?? '').toUpperCase()}`;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading, isAuthenticated, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.push('/login');
  }, [isLoading, isAuthenticated, router]);

  useEffect(() => { setOpen(false); }, [pathname]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-brand-600 flex items-center justify-center animate-pulse">
            <Car className="h-5 w-5 text-white" />
          </div>
          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Loading…</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) return null;

  return (
    <div className="min-h-screen flex" style={{ position: 'relative', zIndex: 1 }}>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-20 lg:hidden"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
          onClick={() => setOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside className={cn(
        'fixed inset-y-0 left-0 z-30 flex flex-col transition-transform duration-200 lg:static lg:translate-x-0',
        open ? 'translate-x-0' : '-translate-x-full',
      )} style={{ width: 228, borderRight: '1px solid var(--surface-border)', backdropFilter: 'blur(16px)', background: 'rgba(13,15,20,0.92)' }}>

        {/* Logo */}
        <div style={{ padding: '20px 20px 18px', borderBottom: '1px solid var(--surface-border)' }}>
          <div className="flex items-center justify-between">
            <Link href="/dashboard" className="flex items-center gap-2.5" style={{ textDecoration: 'none' }}>
              <div style={{ width: 36, height: 36, background: 'linear-gradient(135deg, #ef4444, #b91c1c)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Car className="h-4.5 w-4.5 text-white" style={{ width: 18, height: 18 }} />
              </div>
              <div>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.4px' }}>Motacare</p>
                <p style={{ margin: 0, fontSize: 10, color: 'var(--text-tertiary)' }}>by Prodatek</p>
              </div>
            </Link>
            <button onClick={() => setOpen(false)} className="lg:hidden btn-ghost" style={{ padding: 4 }}>
              <X style={{ width: 18, height: 18 }} />
            </button>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '10px 10px', overflowY: 'auto' }}>
          <p className="nav-section-label">Main</p>
          {NAV.map(({ label, href, icon: Icon }) => {
            const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href + '/'));
            return (
              <Link key={href} href={href} className={cn('nav-link', active && 'active')}>
                <Icon style={{ width: 16, height: 16, flexShrink: 0 }} />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* User footer */}
        <div style={{ padding: '14px 16px', borderTop: '1px solid var(--surface-border)' }}>
          <div className="flex items-center gap-2.5">
            <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg,#ef4444,#7f1d1d)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
              {getInitials(user.firstName, user.lastName)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user.firstName} {user.lastName}
              </p>
              <p style={{ margin: 0, fontSize: 11, color: 'var(--text-tertiary)' }}>{user.role}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="btn-ghost"
            style={{ marginTop: 10, width: '100%', justifyContent: 'flex-start', fontSize: 13 }}
          >
            <LogOut style={{ width: 15, height: 15 }} />
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Mobile topbar */}
        <header className="lg:hidden flex items-center justify-between px-4 py-3 sticky top-0 z-10"
          style={{ borderBottom: '1px solid var(--surface-border)', backdropFilter: 'blur(16px)', background: 'rgba(13,15,20,0.92)' }}>
          <div className="flex items-center gap-3">
            <button onClick={() => setOpen(true)} className="btn-ghost" style={{ padding: 6 }}>
              <Menu style={{ width: 20, height: 20 }} />
            </button>
            <Link href="/dashboard" className="flex items-center gap-2" style={{ textDecoration: 'none' }}>
              <div style={{ width: 28, height: 28, background: 'linear-gradient(135deg,#ef4444,#b91c1c)', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Car style={{ width: 14, height: 14, color: '#fff' }} />
              </div>
              <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>Motacare</span>
            </Link>
          </div>
          <button onClick={logout} className="btn-ghost" style={{ fontSize: 13 }}>
            <LogOut style={{ width: 15, height: 15 }} />
          </button>
        </header>

        <main style={{ flex: 1, padding: '28px 28px 40px' }}>
          {children}
        </main>
      </div>
    </div>
  );
}