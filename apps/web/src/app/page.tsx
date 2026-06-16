'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Car, ClipboardCheck, Shield, Zap, LogOut, ArrowRight } from 'lucide-react';
import { useAuth } from '@/lib/auth';

export default function HomePage() {
  const { isAuthenticated, isLoading, user, logout } = useAuth();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <main style={{ minHeight: '100vh', position: 'relative', zIndex: 1 }}>

      {/* ── Nav ── */}
      <nav style={{ borderBottom: '1px solid var(--surface-border)', backdropFilter: 'blur(16px)', background: 'rgba(13,15,20,0.88)', position: 'sticky', top: 0, zIndex: 10, padding: '0 24px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 60 }}>
          <Link href={isAuthenticated ? '/dashboard' : '/'} style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <div style={{ width: 36, height: 36, background: 'linear-gradient(135deg,#ef4444,#b91c1c)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Car style={{ width: 18, height: 18, color: '#fff' }} />
            </div>
            <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.4px' }}>Motacare</span>
          </Link>

          {mounted && !isLoading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {isAuthenticated ? (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', marginRight: 4 }} className="hidden sm:flex">
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{user?.firstName} {user?.lastName}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{user?.role}</span>
                  </div>
                  <Link href="/dashboard" className="btn-primary">Go to Dashboard</Link>
                  <button onClick={logout} className="btn-secondary" style={{ gap: 6 }}>
                    <LogOut style={{ width: 15, height: 15 }} /> Sign out
                  </button>
                </>
              ) : (
                <>
                  <Link href="/login" className="btn-secondary">Sign in</Link>
                  <Link href="/register" className="btn-primary">Get started</Link>
                </>
              )}
            </div>
          )}
        </div>
      </nav>

      {/* ── Hero ── */}
      <section style={{ padding: '100px 24px 80px', textAlign: 'center', position: 'relative' }}>
        {/* Extra red radial glow in the hero */}
        <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: 600, height: 400, background: 'radial-gradient(ellipse, rgba(220,38,38,0.15) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <div style={{ maxWidth: 760, margin: '0 auto', position: 'relative' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 999, padding: '4px 14px', marginBottom: 24 }}>
            <Zap style={{ width: 13, height: 13, color: 'var(--brand-400)' }} />
            <span style={{ fontSize: 12, color: 'var(--brand-400)', fontWeight: 500 }}>AI-Assisted Vehicle Diagnostics</span>
          </div>

          <h1 style={{ fontSize: 52, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.1, letterSpacing: '-1px', marginBottom: 20 }}>
            Professional car maintenance,<br />
            <span style={{ color: 'var(--brand-500)' }}>fully documented.</span>
          </h1>

          <p style={{ fontSize: 18, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 36, maxWidth: 520, margin: '0 auto 36px' }}>
            Motacare gives workshops and car owners a shared, transparent record of
            every inspection and fix — no more word of mouth.
          </p>

          {mounted && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
              {isAuthenticated ? (
                <Link href="/dashboard" className="btn-primary" style={{ height: 46, padding: '0 28px', fontSize: 15 }}>
                  Go to Dashboard <ArrowRight style={{ width: 16, height: 16 }} />
                </Link>
              ) : (
                <>
                  <Link href="/register?role=OWNER" className="btn-primary" style={{ height: 46, padding: '0 28px', fontSize: 15 }}>
                    Register your car <ArrowRight style={{ width: 16, height: 16 }} />
                  </Link>
                  <Link href="/register?role=FIXER" className="btn-secondary" style={{ height: 46, padding: '0 28px', fontSize: 15 }}>
                    I'm a workshop
                  </Link>
                </>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ── Features ── */}
      <section style={{ padding: '60px 24px 80px' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <h2 style={{ fontSize: 30, textAlign: 'center', marginBottom: 48, color: 'var(--text-primary)' }}>How Motacare works</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
            {[
              { icon: <Car style={{ width: 22, height: 22 }} />, colour: 'brand', title: 'Register your vehicle', body: 'Every car gets a unique identity hash — a secure link between vehicle and owner that never changes.' },
              { icon: <ClipboardCheck style={{ width: 22, height: 22 }} />, colour: 'green', title: 'AI-guided inspection', body: 'Fixers work through an intelligent 44-point checklist. Every finding is recorded with photos and notes.' },
              { icon: <Shield style={{ width: 22, height: 22 }} />, colour: 'purple', title: 'Full history, forever', body: 'Owners receive documented reports for every visit. Your car\'s full maintenance history, always accessible.' },
            ].map((f) => (
              <div key={f.title} className="card" style={{ padding: '24px' }}>
                <div className={`icon-box ${f.colour}`} style={{ marginBottom: 16 }}>
                  {f.icon}
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: 'var(--text-primary)' }}>{f.title}</h3>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{ borderTop: '1px solid var(--surface-border)', padding: '24px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
        © {new Date().getFullYear()} Motacare by Prodatek. All rights reserved.
      </footer>
    </main>
  );
}