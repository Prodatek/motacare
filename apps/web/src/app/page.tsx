'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  Car, ClipboardCheck, Shield, Zap, LogOut, ArrowRight,
  MapPin, Star, ChevronRight, Wrench, Users,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';

// ============================================================
// TYPES
// ============================================================

interface Workshop {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  address: string;
  city: string;
  state: string;
  specialties: string[];
  currentFixerCount: number;
  maxFixers: number;
  featured: boolean;
  totalInspections: number;
  totalFixJobs: number;
  // hardcoded-only fields
  _hardcoded?: true;
  _tagline?: string;
  _badge?: string;
}

// ============================================================
// HARDCODED SHOWCASE WORKSHOPS
// These three always appear first — they represent the product
// promise before real workshops accumulate.
// Real registered workshops fill the remaining slots below them.
// ============================================================

const HARDCODED_WORKSHOPS: Workshop[] = [
  {
    id: '__hc_1__',
    name: 'Prodatek Auto Centre',
    slug: 'prodatek-auto-centre',
    description: 'Lagos\'s premier AI-documented workshop. Every inspection fully transparent — owners get digital reports in minutes.',
    address: '14 Admiralty Way', city: 'Lagos', state: 'Lagos State',
    specialties: ['Engine', 'Electrical', 'Diagnostics', 'AC & Cooling'],
    currentFixerCount: 5, maxFixers: 5,
    featured: true, totalInspections: 340, totalFixJobs: 218,
    _hardcoded: true, _badge: 'Founding Workshop',
  },
  {
    id: '__hc_2__',
    name: 'Abuja Precision Garage',
    slug: 'abuja-precision-garage',
    description: 'Specialists in German and Japanese vehicles. Certified fixers, live job tracking for every customer.',
    address: '3 Gwarimpa Estate', city: 'Abuja', state: 'FCT',
    specialties: ['Transmission', 'Brakes', 'Suspension', 'Tyres'],
    currentFixerCount: 4, maxFixers: 5,
    featured: true, totalInspections: 190, totalFixJobs: 142,
    _hardcoded: true, _badge: 'Top Rated',
  },
  {
    id: '__hc_3__',
    name: 'Swift Fix Ibadan',
    slug: 'swift-fix-ibadan',
    description: 'Fast turnaround, fair pricing. Serving Ibadan car owners with full digital maintenance records since 2024.',
    address: '22 Ring Road', city: 'Ibadan', state: 'Oyo State',
    specialties: ['Engine', 'Fluids', 'Brakes', 'Body & Paint'],
    currentFixerCount: 3, maxFixers: 5,
    featured: false, totalInspections: 115, totalFixJobs: 88,
    _hardcoded: true,
  },
];

// ============================================================
// FEATURED WORKSHOP CARD
// ============================================================

function WorkshopCard({ w }: { w: Workshop }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: w._hardcoded
        ? '1px solid rgba(239,68,68,0.2)'
        : '1px solid rgba(255,255,255,0.08)',
      borderRadius: 16,
      padding: '20px',
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
      position: 'relative',
    }}>
      {/* Badge — hardcoded cards get a coloured tag, registered get "Verified" */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        {(w._badge || w._hardcoded) && (
          <span style={{
            background: w._badge === 'Top Rated'
              ? 'rgba(251,191,36,0.15)' : 'rgba(239,68,68,0.12)',
            color: w._badge === 'Top Rated' ? '#fbbf24' : 'var(--brand-400)',
            fontSize: 10, padding: '3px 8px', borderRadius: 999,
            fontWeight: 600, letterSpacing: '0.4px',
          }}>
            {w._badge ?? '★ SHOWCASE'}
          </span>
        )}
        {!w._hardcoded && (
          <span style={{
            background: 'rgba(34,197,94,0.12)', color: '#4ade80',
            fontSize: 10, padding: '3px 8px', borderRadius: 999,
            fontWeight: 600, letterSpacing: '0.4px',
          }}>✓ VERIFIED</span>
        )}
      </div>

      {/* Name + location row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 4px' }}>{w.name}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-tertiary)', fontSize: 12 }}>
            <MapPin style={{ width: 11, height: 11 }} />
            {w.city}, {w.state}
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            {w.currentFixerCount}<span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>/{w.maxFixers}</span>
          </p>
          <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: 0 }}>fixers</p>
        </div>
      </div>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55, margin: 0 }}>
          {w.description.length > 100 ? `${w.description.slice(0, 100)}…` : w.description}
        </p>

      {/* Specialties */}
      {w.specialties?.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {w.specialties.slice(0, 4).map((s) => (
            <span key={s} style={{
              background: 'rgba(239,68,68,0.1)',
              color: 'var(--brand-400)',
              fontSize: 11,
              padding: '2px 8px',
              borderRadius: 6,
              fontWeight: 500,
            }}>{s}</span>
          ))}
          {w.specialties.length > 4 && (
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>+{w.specialties.length - 4} more</span>
          )}
        </div>
      )}

      {/* Stats footer */}
      <div style={{
        display: 'flex',
        gap: 20,
        paddingTop: 12,
        borderTop: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div>
          <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{w.totalInspections}</p>
          <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: 0 }}>Inspections</p>
        </div>
        <div>
          <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{w.totalFixJobs}</p>
          <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: 0 }}>Fix Jobs</p>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// MAIN PAGE
// ============================================================

export default function HomePage() {
  const { isAuthenticated, isLoading, user, logout } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [featuredWorkshops, setFeaturedWorkshops] = useState<Workshop[]>([]);
  const [workshopsLoading, setWorkshopsLoading] = useState(true);
  const [workshopsError, setWorkshopsError] = useState(false);

  useEffect(() => setMounted(true), []);

  // Load featured workshops — completely independent of auth.
  // Uses a direct fetch to /api/workshops/featured so it works
  // even if workshopApi is not imported into this file.
  useEffect(() => {
    setWorkshopsLoading(true);
    setWorkshopsError(false);

    fetch('/api/workshops/featured')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((body) => {
        // The gateway returns { statusCode: 200, data: [...], pagination: {...} }
        const workshops = body?.data ?? [];
        setFeaturedWorkshops(Array.isArray(workshops) ? workshops : []);
      })
      .catch((err) => {
        console.warn('[homepage] Could not load featured workshops:', err.message);
        setWorkshopsError(true);
        setFeaturedWorkshops([]);
      })
      .finally(() => setWorkshopsLoading(false));
  }, []);

  return (
    <main style={{ minHeight: '100vh', position: 'relative', zIndex: 1 }}>

      {/* ── Nav ── */}
      <nav style={{
        borderBottom: '1px solid var(--surface-border)',
        backdropFilter: 'blur(16px)',
        background: 'rgba(13,15,20,0.88)',
        position: 'sticky', top: 0, zIndex: 10,
        padding: '0 24px',
      }}>
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
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', marginRight: 4 }}>
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
            Motacare gives workshops and car owners a shared, transparent record of every inspection and fix — no more word of mouth.
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

      {/* ── How it works ── */}
      <section style={{ padding: '60px 24px 80px' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <h2 style={{ fontSize: 30, textAlign: 'center', marginBottom: 48, color: 'var(--text-primary)' }}>How Motacare works</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
            {[
              { icon: <Car style={{ width: 22, height: 22 }} />, colour: 'brand', title: 'Register your vehicle', body: 'Every car gets a unique identity hash — a secure link between vehicle and owner that never changes.' },
              { icon: <ClipboardCheck style={{ width: 22, height: 22 }} />, colour: 'green', title: 'AI-guided inspection', body: 'Fixers work through an intelligent 44-point checklist. Every finding is recorded with photos and notes.' },
              { icon: <Shield style={{ width: 22, height: 22 }} />, colour: 'purple', title: 'Full history, forever', body: "Owners receive documented reports for every visit. Your car's full maintenance history, always accessible." },
            ].map((f) => (
              <div key={f.title} className="card" style={{ padding: '24px' }}>
                <div className={`icon-box ${f.colour}`} style={{ marginBottom: 16 }}>{f.icon}</div>
                <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: 'var(--text-primary)' }}>{f.title}</h3>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Featured Workshops ── */}
      {/* Always renders the section shell — shows skeleton while loading,
          hides gracefully if empty or errored */}
      <section style={{
        padding: '60px 24px 80px',
        background: 'rgba(255,255,255,0.015)',
        borderTop: '1px solid rgba(255,255,255,0.05)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>

          {/* Section header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h2 style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 6px' }}>
                Featured Workshops
              </h2>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0 }}>
                Trusted workshops using Motacare to deliver transparent, documented service
              </p>
            </div>
            <Link href="/workshops" style={{
              display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 14, color: 'var(--brand-400)',
              textDecoration: 'none', fontWeight: 500,
            }}>
              View all <ChevronRight style={{ width: 15, height: 15 }} />
            </Link>
          </div>

          {/* Loading skeleton */}
          {workshopsLoading && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
              {[1, 2, 3].map((i) => (
                <div key={i} style={{
                  height: 200, borderRadius: 16,
                  background: 'rgba(255,255,255,0.04)',
                  animation: 'pulse 1.5s ease-in-out infinite',
                }} />
              ))}
            </div>
          )}

          {/* Error state — fail silently, show nothing */}
          {!workshopsLoading && workshopsError && (
            <p style={{ color: 'var(--text-tertiary)', fontSize: 14, textAlign: 'center', padding: '40px 0' }}>
              Workshops unavailable right now — check back soon.
            </p>
          )}

          {/* Empty state */}
          {!workshopsLoading && !workshopsError && featuredWorkshops.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <Wrench style={{ width: 40, height: 40, color: 'var(--text-tertiary)', margin: '0 auto 12px' }} />
              <p style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>
                No featured workshops yet — be the first to{' '}
                <Link href="/register?role=FIXER" style={{ color: 'var(--brand-400)' }}>create one</Link>.
              </p>
            </div>
          )}

          {/* Workshop grid */}
          {!workshopsLoading && !workshopsError && featuredWorkshops.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
              {featuredWorkshops.map((w) => (
                <WorkshopCard key={w.id} w={w} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{ borderTop: '1px solid var(--surface-border)', padding: '24px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
        © {new Date().getFullYear()} Motacare by Prodatek. All rights reserved.
      </footer>
    </main>
  );
}