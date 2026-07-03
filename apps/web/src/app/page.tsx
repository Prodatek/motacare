'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  Car, ClipboardCheck, Shield, Zap, LogOut, ArrowRight,
  MapPin, ChevronRight, Wrench, Star,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';

// ── Workshop shape (inline to avoid any import issues) ───────

interface FeaturedWorkshop {
  id: string;
  name: string;
  description: string | null;
  city: string;
  state: string;
  specialties: string[];
  currentFixerCount: number;
  maxFixers: number;
  totalInspections: number;
  totalFixJobs: number;
  featured: boolean;
  isSeeded?: boolean;
}

// ── Workshop card ─────────────────────────────────────────────

function WorkshopCard({ w }: { w: FeaturedWorkshop }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 16,
      padding: 20,
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
              {w.name}
            </span>
            {w.featured && (
              <span style={{
                background: 'rgba(251,191,36,0.15)', color: '#fbbf24',
                fontSize: 10, padding: '2px 8px', borderRadius: 999, fontWeight: 600,
              }}>
                ★ FEATURED
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-tertiary)', fontSize: 12 }}>
            <MapPin style={{ width: 11, height: 11 }} />
            {w.city}, {w.state}
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            {w.currentFixerCount}
            <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>/{w.maxFixers}</span>
          </p>
          <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: 0 }}>fixers</p>
        </div>
      </div>

      {/* Description */}
      {w.description && (
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55, margin: 0 }}>
          {w.description.length > 110 ? `${w.description.slice(0, 110)}…` : w.description}
        </p>
      )}

      {/* Specialties */}
      {w.specialties?.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {w.specialties.slice(0, 4).map((s) => (
            <span key={s} style={{
              background: 'rgba(239,68,68,0.1)', color: 'var(--brand-400)',
              fontSize: 11, padding: '2px 8px', borderRadius: 6, fontWeight: 500,
            }}>{s}</span>
          ))}
          {w.specialties.length > 4 && (
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
              +{w.specialties.length - 4} more
            </span>
          )}
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'flex', gap: 20, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div>
          <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            {w.totalInspections}
          </p>
          <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: 0 }}>Inspections</p>
        </div>
        <div>
          <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            {w.totalFixJobs}
          </p>
          <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: 0 }}>Fix Jobs</p>
        </div>
      </div>
    </div>
  );
}

// ── Skeleton card ─────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div style={{
      height: 220, borderRadius: 16,
      background: 'rgba(255,255,255,0.04)',
      animation: 'pulse 1.5s ease-in-out infinite',
    }} />
  );
}

// ── Main page ─────────────────────────────────────────────────

export default function HomePage() {
  const { isAuthenticated, isLoading: authLoading, user, logout } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [workshops, setWorkshops] = useState<FeaturedWorkshop[]>([]);
  const [wsLoading, setWsLoading] = useState(true);
  const [wsError, setWsError] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    setWsLoading(true);
    setWsError(false);

    // Call /api/workshops/featured which returns 3 seeds + up to 2 real workshops
    fetch('/api/workshops/featured', { headers: { 'Content-Type': 'application/json' } })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = await res.json();

        // The endpoint returns { statusCode: 200, data: [...] }
        let list: FeaturedWorkshop[] = [];
        if (Array.isArray(body?.data)) {
          list = body.data;
        } else if (Array.isArray(body)) {
          list = body;
        }

        // If the featured endpoint returned empty for any reason,
        // fall back to /api/workshops to get any ACTIVE workshop
        if (list.length === 0) {
          const fallback = await fetch('/api/workshops?limit=5');
          if (fallback.ok) {
            const fb = await fallback.json();
            list = fb?.data ?? [];
          }
        }

        setWorkshops(list);
      })
      .catch((err) => {
        console.warn('[homepage] workshops fetch failed:', err.message);
        setWsError(true);
      })
      .finally(() => setWsLoading(false));
  }, []);

  return (
    <main style={{ minHeight: '100vh' }}>

      {/* ── Navbar ── */}
      <nav style={{
        borderBottom: '1px solid var(--surface-border)',
        backdropFilter: 'blur(16px)',
        background: 'rgba(13,15,20,0.88)',
        position: 'sticky', top: 0, zIndex: 10,
        padding: '0 24px',
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 60 }}>
          <Link href={mounted && isAuthenticated ? '/dashboard' : '/'} style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <div style={{ width: 36, height: 36, background: 'linear-gradient(135deg,#ef4444,#b91c1c)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Car style={{ width: 18, height: 18, color: '#fff' }} />
            </div>
            <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.4px' }}>Motacare</span>
          </Link>

          {mounted && !authLoading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {isAuthenticated ? (
                <>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{user?.firstName}</span>
                  <Link href="/dashboard" className="btn-primary">Dashboard</Link>
                  <button onClick={logout} className="btn-secondary" style={{ gap: 6 }}>
                    <LogOut style={{ width: 14, height: 14 }} /> Sign out
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
        <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: 600, height: 400, background: 'radial-gradient(ellipse, rgba(220,38,38,0.14) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ maxWidth: 740, margin: '0 auto', position: 'relative' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 999, padding: '4px 14px', marginBottom: 24 }}>
            <Zap style={{ width: 13, height: 13, color: 'var(--brand-400)' }} />
            <span style={{ fontSize: 12, color: 'var(--brand-400)', fontWeight: 500 }}>AI-Assisted Vehicle Diagnostics</span>
          </div>

          <h1 style={{ fontSize: 52, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.1, letterSpacing: '-1px', marginBottom: 20 }}>
            Professional car maintenance,<br />
            <span style={{ color: 'var(--brand-500)' }}>fully documented.</span>
          </h1>

          <p style={{ fontSize: 17, color: 'var(--text-secondary)', lineHeight: 1.65, marginBottom: 36, maxWidth: 500, margin: '0 auto 36px' }}>
            Motacare connects car owners with trusted workshops — every inspection and fix documented, transparent, and permanent.
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
                    I&apos;m a workshop
                  </Link>
                </>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ── How it works ── */}
      <section style={{ padding: '20px 24px 80px' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <h2 style={{ fontSize: 28, textAlign: 'center', marginBottom: 40, color: 'var(--text-primary)', fontWeight: 700 }}>
            How it works
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
            {[
              { icon: <Car style={{ width: 22, height: 22 }} />, title: 'Register your vehicle', body: 'Every car gets a unique identity — a secure link between vehicle and owner that never changes.' },
              { icon: <ClipboardCheck style={{ width: 22, height: 22 }} />, title: 'AI-guided inspection', body: 'Fixers work through a 44-point checklist. Every finding is recorded with photos and notes.' },
              { icon: <Shield style={{ width: 22, height: 22 }} />, title: 'Full history, forever', body: 'Owners receive documented reports for every visit — full maintenance history, always accessible.' },
            ].map((f) => (
              <div key={f.title} className="card" style={{ padding: 24 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(239,68,68,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brand-400)', marginBottom: 16 }}>
                  {f.icon}
                </div>
                <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 8, color: 'var(--text-primary)' }}>{f.title}</h3>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Featured Workshops ── */}
      <section style={{
        padding: '60px 24px 80px',
        background: 'rgba(255,255,255,0.015)',
        borderTop: '1px solid rgba(255,255,255,0.05)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <Star style={{ width: 18, height: 18, color: '#fbbf24' }} />
                <h2 style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                  Featured Workshops
                </h2>
              </div>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0 }}>
                Trusted workshops using Motacare to deliver transparent, documented vehicle service
              </p>
            </div>
            <Link href="/dashboard/workshop" style={{
              display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 13, color: 'var(--brand-400)', textDecoration: 'none', fontWeight: 500,
            }}>
              Browse all <ChevronRight style={{ width: 14, height: 14 }} />
            </Link>
          </div>

          {/* Loading */}
          {wsLoading && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 16 }}>
              <SkeletonCard /><SkeletonCard /><SkeletonCard />
            </div>
          )}

          {/* Error */}
          {!wsLoading && wsError && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-tertiary)', fontSize: 14 }}>
              <Wrench style={{ width: 36, height: 36, margin: '0 auto 12px', display: 'block' }} />
              Could not load workshops right now — check back soon.
            </div>
          )}

          {/* Workshop grid */}
          {!wsLoading && !wsError && workshops.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
              {workshops.map((w) => (
                <WorkshopCard key={w.id} w={w} />
              ))}
            </div>
          )}

          {/* No workshops at all (shouldn't happen with seeds, but just in case) */}
          {!wsLoading && !wsError && workshops.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <p style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>
                No workshops yet.{' '}
                <Link href="/register?role=FIXER" style={{ color: 'var(--brand-400)' }}>
                  Be the first to create one →
                </Link>
              </p>
            </div>
          )}

          {/* Register prompt */}
          <div style={{ marginTop: 36, textAlign: 'center' }}>
            <p style={{ fontSize: 14, color: 'var(--text-tertiary)', marginBottom: 12 }}>
              Are you a workshop owner?
            </p>
            <Link href="/register?role=FIXER" className="btn-secondary" style={{ display: 'inline-flex' }}>
              Register your workshop on Motacare
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{ borderTop: '1px solid var(--surface-border)', padding: 24, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
        © {new Date().getFullYear()} Motacare by Prodatek. All rights reserved.
      </footer>
    </main>
  );
}