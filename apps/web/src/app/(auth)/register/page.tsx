'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Car, Loader2, Eye, EyeOff, Wrench, User } from 'lucide-react';
import { toast } from 'sonner';
import { authApi, setAccessToken, saveRefreshToken, ApiClientError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
 


type Role = 'OWNER' | 'FIXER';
 
export default function RegisterPage() {
  const { setUser } = useAuth() as any;
  const router      = useRouter();
  const params      = useSearchParams();
 
  const [role, setRole]           = useState<Role>((params.get('role') as Role) ?? 'OWNER');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName]   = useState('');
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [showPw, setShowPw]       = useState(false);
  const [isLoading, setIsLoading] = useState(false);
 
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const result = await authApi.register({ email, password, firstName, lastName, role });
      setAccessToken(result.tokens.accessToken);
      saveRefreshToken(result.tokens.refreshToken);
      if (setUser) setUser(result.user);
      toast.success(`Welcome to Motacare, ${firstName}!`);
      router.push('/dashboard');
    } catch (error) {
      if (error instanceof ApiClientError) {
        toast.error(error.message);
      } else {
        toast.error('Registration failed — please try again');
      }
    } finally {
      setIsLoading(false);
    }
  };
 
  return (
    <main style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      background: 'var(--surface-bg)',
    }}>
 
      {/* ── Logo — links back to homepage ── */}
      <Link href="/" style={{
        display: 'flex', alignItems: 'center', gap: 10,
        textDecoration: 'none', marginBottom: 32,
      }}>
        <div style={{
          width: 40, height: 40,
          background: 'linear-gradient(135deg,#ef4444,#b91c1c)',
          borderRadius: 12,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Car style={{ width: 20, height: 20, color: '#fff' }} />
        </div>
        <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
          Motacare
        </span>
      </Link>
 
      {/* ── Card ── */}
      <div className="card" style={{ width: '100%', maxWidth: 440, padding: '36px 32px' }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px' }}>
          Create your account
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '0 0 24px' }}>
          Join Motacare — it&apos;s free to get started
        </p>
 
        {/* ── Role selector ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 24 }}>
          {([
            { value: 'OWNER', label: 'Car Owner', sub: 'Track my vehicles', icon: <User style={{ width: 18, height: 18 }} /> },
            { value: 'FIXER', label: 'Workshop / Fixer', sub: 'Manage inspections', icon: <Wrench style={{ width: 18, height: 18 }} /> },
          ] as const).map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => setRole(r.value)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                gap: 4, padding: '12px 14px', borderRadius: 12, cursor: 'pointer',
                border: role === r.value ? '2px solid var(--brand-500)' : '1px solid var(--surface-border)',
                background: role === r.value ? 'rgba(239,68,68,0.08)' : 'var(--surface-card)',
                transition: 'all 0.15s',
              }}
            >
              <div style={{ color: role === r.value ? 'var(--brand-400)' : 'var(--text-tertiary)' }}>{r.icon}</div>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{r.label}</span>
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{r.sub}</span>
            </button>
          ))}
        </div>
 
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>First name</label>
              <input value={firstName} onChange={(e) => setFirstName(e.target.value)}
                placeholder="Adebayo" required className="input" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>Last name</label>
              <input value={lastName} onChange={(e) => setLastName(e.target.value)}
                placeholder="Okafor" required className="input" />
            </div>
          </div>
 
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>Email address</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com" required autoComplete="email" className="input" />
          </div>
 
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 8 characters, one uppercase, one number"
                required minLength={8}
                autoComplete="new-password"
                className="input"
                style={{ paddingRight: 40 }}
              />
              <button type="button" onClick={() => setShowPw((p) => !p)} style={{
                position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-tertiary)', padding: 0, display: 'flex',
              }}>
                {showPw ? <EyeOff style={{ width: 16, height: 16 }} /> : <Eye style={{ width: 16, height: 16 }} />}
              </button>
            </div>
          </div>
 
          <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: 0 }}>
            By creating an account you agree to our{' '}
            <Link href="/terms" style={{ color: 'var(--brand-400)', textDecoration: 'none' }}>Terms</Link> and{' '}
            <Link href="/privacy" style={{ color: 'var(--brand-400)', textDecoration: 'none' }}>Privacy Policy</Link>.
          </p>
 
          <button
            type="submit"
            disabled={isLoading}
            className="btn-primary"
            style={{ marginTop: 4, height: 44, fontSize: 15, justifyContent: 'center' }}
          >
            {isLoading && <Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} />}
            {isLoading ? 'Creating account…' : 'Create account'}
          </button>
        </form>
 
        <p style={{ margin: '20px 0 0', textAlign: 'center', fontSize: 14, color: 'var(--text-secondary)' }}>
          Already have an account?{' '}
          <Link href="/login" style={{ color: 'var(--brand-400)', fontWeight: 500, textDecoration: 'none' }}>
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}