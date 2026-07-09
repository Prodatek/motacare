'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  Car, Search, X, MapPin, Wrench, ChevronLeft,
  ChevronRight, Star, Users, ClipboardCheck, Loader2,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────

interface Workshop {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  city: string;
  state: string;
  phone: string | null;
  email: string | null;
  specialties: string[];
  status: string;
  currentFixerCount: number;
  maxFixers: number;
  featured: boolean;
  totalInspections: number;
  totalFixJobs: number;
  isSeeded?: boolean;
}

interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const NIGERIAN_CITIES = [
  'Lagos', 'Abuja', 'Port Harcourt', 'Kano', 'Ibadan',
  'Benin City', 'Kaduna', 'Enugu', 'Warri', 'Owerri',
];

const LIMIT = 12;

// ── Workshop Card ──────────────────────────────────────────────

function WorkshopCard({ w, onView }: { w: Workshop; onView: (id: string) => void }) {
  const capacityPct = Math.round((w.currentFixerCount / w.maxFixers) * 100);
  const isFull = w.currentFixerCount >= w.maxFixers;

  return (
    <div
      onClick={() => !w.isSeeded && onView(w.id)}
      style={{
        background: 'var(--surface-card)',
        border: '1px solid var(--surface-border)',
        borderRadius: 16,
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        cursor: w.isSeeded ? 'default' : 'pointer',
        transition: 'border-color 0.15s, transform 0.15s',
        position: 'relative',
        overflow: 'hidden',
      }}
      onMouseEnter={(e) => {
        if (!w.isSeeded) {
          (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--brand-500)';
          (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
        }
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--surface-border)';
        (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
      }}
    >
      {/* Featured ribbon */}
      {w.featured && (
        <div style={{
          position: 'absolute', top: 0, right: 0,
          background: 'rgba(251,191,36,0.15)',
          borderBottomLeftRadius: 10,
          padding: '4px 10px',
          fontSize: 10, fontWeight: 700, color: '#fbbf24',
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          <Star style={{ width: 10, height: 10 }} /> FEATURED
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, paddingRight: w.featured ? 64 : 0 }}>
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px' }}>
            {w.name}
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-tertiary)' }}>
            <MapPin style={{ width: 11, height: 11 }} />
            {w.city}, {w.state}
          </div>
        </div>
      </div>

      {/* Description */}
      {w.description && (
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55, margin: 0 }}>
          {w.description.length > 100 ? `${w.description.slice(0, 100)}…` : w.description}
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
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>+{w.specialties.length - 4}</span>
          )}
        </div>
      )}

      {/* Fixer capacity bar */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Users style={{ width: 11, height: 11 }} />
            {w.currentFixerCount}/{w.maxFixers} fixers
          </span>
          {isFull && <span style={{ fontSize: 10, background: 'rgba(239,68,68,0.15)', color: 'var(--brand-400)', padding: '1px 6px', borderRadius: 999, fontWeight: 600 }}>FULL</span>}
        </div>
        <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 999, overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 999,
            width: `${capacityPct}%`,
            background: isFull ? 'var(--brand-500)' : 'rgba(239,68,68,0.4)',
            transition: 'width 0.3s',
          }} />
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 20, paddingTop: 12, borderTop: '1px solid var(--surface-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <ClipboardCheck style={{ width: 13, height: 13, color: 'var(--text-tertiary)' }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{w.totalInspections}</span>
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>inspections</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <Wrench style={{ width: 13, height: 13, color: 'var(--text-tertiary)' }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{w.totalFixJobs}</span>
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>fix jobs</span>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────

export default function WorkshopsPage() {
  const [workshops, setWorkshops] = useState<Workshop[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [cityFilter, setCityFilter] = useState('');

  // Debounce search — don't hammer the API on every keystroke
  const debounceRef = useRef<NodeJS.Timeout>();
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1); // reset to page 1 on new search
    }, 400);
    return () => clearTimeout(debounceRef.current);
  }, [search]);

  // Fetch workshops
  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (cityFilter) params.set('city', cityFilter);

      const res = await fetch(`/api/workshops?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();

      setWorkshops(body?.data ?? []);
      setPagination(body?.pagination ?? null);
    } catch (err) {
      console.warn('[workshops] fetch failed:', err);
      setWorkshops([]);
    } finally {
      setIsLoading(false);
    }
  }, [page, debouncedSearch, cityFilter]);

  useEffect(() => { load(); }, [load]);

  // Track a view — fires when user clicks a workshop card
  // Uses fire-and-forget fetch, never blocks UX
  const trackView = (workshopId: string) => {
    fetch(`/api/workshops/${workshopId}`, { method: 'GET' })
      .catch(() => {}); // view is counted server-side on GET /:id
  };

  const totalPages = pagination?.totalPages ?? 1;
  const totalCount = pagination?.total ?? 0;

  return (
    <main style={{ minHeight: '100vh', background: 'var(--surface-bg)' }}>

      {/* ── Nav ── */}
      <nav style={{
        borderBottom: '1px solid var(--surface-border)',
        backdropFilter: 'blur(16px)',
        background: 'rgba(13,15,20,0.92)',
        position: 'sticky', top: 0, zIndex: 10,
        padding: '0 24px',
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 60 }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <div style={{ width: 34, height: 34, background: 'linear-gradient(135deg,#ef4444,#b91c1c)', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Car style={{ width: 16, height: 16, color: '#fff' }} />
            </div>
            <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.4px' }}>Motacare</span>
          </Link>
          <div style={{ display: 'flex', gap: 10 }}>
            <Link href="/login" style={{
              fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)',
              textDecoration: 'none', padding: '6px 14px', borderRadius: 8,
              border: '1px solid var(--surface-border)',
            }}>Sign in</Link>
            <Link href="/register" style={{
              fontSize: 13, fontWeight: 500, color: '#fff',
              textDecoration: 'none', padding: '6px 14px', borderRadius: 8,
              background: 'var(--brand-500)',
            }}>Get started</Link>
          </div>
        </div>
      </nav>

      {/* ── Header ── */}
      <section style={{ padding: '56px 24px 40px', textAlign: 'center' }}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <Link href="/" style={{ fontSize: 13, color: 'var(--text-tertiary)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 20 }}>
            <ChevronLeft style={{ width: 14, height: 14 }} /> Back to home
          </Link>
          <h1 style={{ fontSize: 40, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.8px', margin: '0 0 12px' }}>
            Find a Workshop
          </h1>
          <p style={{ fontSize: 16, color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 0 32px' }}>
            {totalCount > 0
              ? `${totalCount} workshops on Motacare across Nigeria`
              : 'Discover trusted workshops using Motacare'}
          </p>

          {/* Search */}
          <div style={{ position: 'relative', maxWidth: 520, margin: '0 auto' }}>
            <Search style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: 'var(--text-tertiary)', pointerEvents: 'none' }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, city, or specialty…"
              style={{
                width: '100%', height: 48, borderRadius: 12,
                border: '1px solid var(--surface-border)',
                background: 'var(--surface-card)',
                color: 'var(--text-primary)',
                fontSize: 14, padding: '0 44px 0 44px',
                outline: 'none', boxSizing: 'border-box',
              }}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                style={{
                  position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-tertiary)', padding: 0, display: 'flex',
                }}
              >
                <X style={{ width: 15, height: 15 }} />
              </button>
            )}
          </div>
        </div>
      </section>

      {/* ── City filter pills ── */}
      <section style={{ padding: '0 24px 24px', overflowX: 'auto' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
          {['All', ...NIGERIAN_CITIES].map((city) => {
            const active = city === 'All' ? cityFilter === '' : cityFilter === city;
            return (
              <button
                key={city}
                onClick={() => { setCityFilter(city === 'All' ? '' : city); setPage(1); }}
                style={{
                  padding: '6px 16px', borderRadius: 999, fontSize: 13, fontWeight: 500,
                  cursor: 'pointer', transition: 'all 0.15s',
                  border: active ? '1px solid var(--brand-500)' : '1px solid var(--surface-border)',
                  background: active ? 'rgba(239,68,68,0.12)' : 'var(--surface-card)',
                  color: active ? 'var(--brand-400)' : 'var(--text-secondary)',
                }}
              >
                {city}
              </button>
            );
          })}
        </div>
      </section>

      {/* ── Workshop grid ── */}
      <section style={{ padding: '0 24px 80px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>

          {/* Loading skeletons */}
          {isLoading && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} style={{
                  height: 260, borderRadius: 16,
                  background: 'var(--surface-card)',
                  animation: 'pulse 1.5s ease-in-out infinite',
                }} />
              ))}
            </div>
          )}

          {/* Empty state */}
          {!isLoading && workshops.length === 0 && (
            <div style={{ textAlign: 'center', padding: '80px 0' }}>
              <Wrench style={{ width: 48, height: 48, color: 'var(--text-tertiary)', margin: '0 auto 16px', display: 'block' }} />
              <h3 style={{ color: 'var(--text-primary)', margin: '0 0 8px' }}>
                {debouncedSearch || cityFilter ? 'No workshops found' : 'No workshops yet'}
              </h3>
              <p style={{ color: 'var(--text-tertiary)', fontSize: 14, margin: '0 0 24px' }}>
                {debouncedSearch
                  ? `No results for "${debouncedSearch}". Try a different search.`
                  : cityFilter
                    ? `No workshops in ${cityFilter} yet.`
                    : 'Be the first to register a workshop on Motacare.'}
              </p>
              <Link href="/register?role=FIXER" style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '10px 20px', borderRadius: 10, fontSize: 14, fontWeight: 600,
                background: 'var(--brand-500)', color: '#fff', textDecoration: 'none',
              }}>
                Register your workshop
              </Link>
            </div>
          )}

          {/* Grid */}
          {!isLoading && workshops.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
              {workshops.map((w) => (
                <WorkshopCard key={w.id} w={w} onView={trackView} />
              ))}
            </div>
          )}

          {/* Pagination */}
          {!isLoading && totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 48 }}>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500,
                  border: '1px solid var(--surface-border)', background: 'var(--surface-card)',
                  color: page === 1 ? 'var(--text-tertiary)' : 'var(--text-primary)',
                  cursor: page === 1 ? 'not-allowed' : 'pointer',
                }}
              >
                <ChevronLeft style={{ width: 15, height: 15 }} /> Previous
              </button>

              <div style={{ display: 'flex', gap: 4 }}>
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                  // Show pages near current page
                  const p = totalPages <= 7 ? i + 1 : Math.max(1, Math.min(totalPages - 6, page - 3)) + i;
                  return (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      style={{
                        width: 36, height: 36, borderRadius: 8, fontSize: 13, fontWeight: 600,
                        border: '1px solid var(--surface-border)',
                        background: p === page ? 'var(--brand-500)' : 'var(--surface-card)',
                        color: p === page ? '#fff' : 'var(--text-secondary)',
                        cursor: 'pointer',
                      }}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500,
                  border: '1px solid var(--surface-border)', background: 'var(--surface-card)',
                  color: page === totalPages ? 'var(--text-tertiary)' : 'var(--text-primary)',
                  cursor: page === totalPages ? 'not-allowed' : 'pointer',
                }}
              >
                Next <ChevronRight style={{ width: 15, height: 15 }} />
              </button>
            </div>
          )}
        </div>
      </section>

      {/* ── CTA footer ── */}
      <div style={{
        background: 'rgba(239,68,68,0.06)',
        borderTop: '1px solid rgba(239,68,68,0.15)',
        padding: '40px 24px',
        textAlign: 'center',
      }}>
        <h3 style={{ color: 'var(--text-primary)', margin: '0 0 8px', fontSize: 20 }}>
          Are you a workshop owner?
        </h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: '0 0 20px' }}>
          Join Motacare and give your customers transparent, documented vehicle service.
        </p>
        <Link href="/register?role=FIXER" style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '12px 28px', borderRadius: 10, fontSize: 15, fontWeight: 600,
          background: 'var(--brand-500)', color: '#fff', textDecoration: 'none',
        }}>
          Register your workshop — it&apos;s free
        </Link>
      </div>
    </main>
  );
}