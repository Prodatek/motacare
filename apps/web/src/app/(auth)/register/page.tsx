'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Car, Loader2, Eye, EyeOff, Wrench, User, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { authApi, setAccessToken, saveRefreshToken, ApiClientError } from '@/lib/api';
import { useAuth } from '@/lib/auth';

type Role = 'OWNER' | 'FIXER';

const ROLE_CONFIG: Record<Role, {
  label: string;
  icon: React.ReactNode;
  headline: string;
  description: string;
  accent: string;
}> = {
  OWNER: {
    label: 'Car Owner',
    icon: <User style={{ width: 20, height: 20 }} />,
    headline: 'I own a vehicle',
    description: 'Track your car or Fleets\'s full history, receive documented inspection reports, and stay informed about every fix made to your vehicle.',
    accent: '#3b82f6',
  },
  FIXER: {
    label: 'Workshop / Fixer',
    icon: <Wrench style={{ width: 20, height: 20 }} />,
    headline: 'I Fix Vehicles',
    description: 'Manage inspections and fix jobs for multiple clients, build your workshop profile, and give every customer a transparent documented service record.',
    accent: '#ef4444',
  },
};

export default function RegisterPage() {
  const { setUser } = useAuth() as any;
  const router      = useRouter();
  const params      = useSearchParams();

  const [role, setRole]             = useState<Role>((params.get('role') as Role) ?? 'OWNER');
  const [firstName, setFirstName]   = useState('');
  const [lastName, setLastName]     = useState('');
  const [email, setEmail]           = useState('');
  const [password, setPassword]     = useState('');
  const [showPw, setShowPw]         = useState(false);
  const [isLoading, setIsLoading]   = useState(false);

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
      if (error instanceof ApiClientError) toast.error(error.message);
      else toast.error('Registration failed — please try again');
    } finally {
      setIsLoading(false);
    }
  };

  const cfg = ROLE_CONFIG[role];

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

      {/* ── Logo → homepage ── */}
      <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', marginBottom: 28 }}>
        <div style={{ width: 40, height: 40, background: 'linear-gradient(135deg,#ef4444,#b91c1c)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Car style={{ width: 20, height: 20, color: '#fff' }} />
        </div>
        <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>Motacare</span>
      </Link>

      {/* ── Card ── */}
      <div className="card" style={{ width: '100%', maxWidth: 460, padding: '32px' }}>
        <h1 style={{ fontSize: 21, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px' }}>
          Create your account
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '0 0 24px' }}>
          Join Motacare — it&apos;s free to get started
        </p>

        {/* ── Role selector ── */}
        <div style={{ marginBottom: 20 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>
            I am joining as
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {(Object.entries(ROLE_CONFIG) as [Role, typeof ROLE_CONFIG[Role]][]).map(([value, config]) => {
              const selected = role === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setRole(value)}
                  style={{
                    position: 'relative',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    gap: 6,
                    padding: '14px 14px 12px',
                    borderRadius: 14,
                    cursor: 'pointer',
                    border: selected
                      ? `2px solid ${config.accent}`
                      : '2px solid var(--surface-border)',
                    background: selected
                      ? `${config.accent}12`
                      : 'var(--surface-card)',
                    transition: 'all 0.15s',
                    textAlign: 'left',
                  }}
                >
                  {/* Green checkmark — only visible when selected */}
                  {selected && (
                    <div style={{
                      position: 'absolute', top: 10, right: 10,
                      color: '#22c55e',
                    }}>
                      <CheckCircle2 style={{ width: 18, height: 18 }} />
                    </div>
                  )}

                  {/* Icon */}
                  <div style={{
                    color: selected ? config.accent : 'var(--text-tertiary)',
                    transition: 'color 0.15s',
                  }}>
                    {config.icon}
                  </div>

                  {/* Label */}
                  <span style={{
                    fontSize: 13, fontWeight: 700,
                    color: selected ? 'var(--text-primary)' : 'var(--text-secondary)',
                    paddingRight: selected ? 20 : 0,
                  }}>
                    {config.label}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Description of selected role — updates dynamically */}
          <div style={{
            marginTop: 12,
            padding: '12px 14px',
            borderRadius: 10,
            background: `${cfg.accent}0d`,
            border: `1px solid ${cfg.accent}25`,
            fontSize: 13,
            color: 'var(--text-secondary)',
            lineHeight: 1.55,
            transition: 'all 0.2s',
          }}>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{cfg.headline}</span>
            {' — '}
            {cfg.description}
          </div>
        </div>

        {/* ── Form fields ── */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>
                First name
              </label>
              <input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Adebayo"
                required
                className="input"
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>
                Last name
              </label>
              <input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Okafor"
                required
                className="input"
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>
              Email address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
              className="input"
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 8 chars, one uppercase, one number"
                required
                minLength={8}
                autoComplete="new-password"
                className="input"
                style={{ paddingRight: 40 }}
              />
              <button
                type="button"
                onClick={() => setShowPw((p) => !p)}
                style={{
                  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-tertiary)', padding: 0, display: 'flex',
                }}
              >
                {showPw ? <EyeOff style={{ width: 16, height: 16 }} /> : <Eye style={{ width: 16, height: 16 }} />}
              </button>
            </div>
          </div>

          <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: 0 }}>
            By creating an account you agree to our{' '}
            <Link href="/terms" style={{ color: 'var(--brand-400)', textDecoration: 'none' }}>Terms</Link>
            {' '}and{' '}
            <Link href="/privacy" style={{ color: 'var(--brand-400)', textDecoration: 'none' }}>Privacy Policy</Link>.
          </p>

          <button
            type="submit"
            disabled={isLoading}
            className="btn-primary"
            style={{ height: 44, fontSize: 15, justifyContent: 'center', marginTop: 4 }}
          >
            {isLoading && <Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} />}
            {isLoading ? 'Creating account…' : `Create ${role === 'OWNER' ? 'owner' : 'workshop'} account`}
          </button>
        </form>

        <p style={{ margin: '18px 0 0', textAlign: 'center', fontSize: 14, color: 'var(--text-secondary)' }}>
          Already have an account?{' '}
          <Link href="/login" style={{ color: 'var(--brand-400)', fontWeight: 500, textDecoration: 'none' }}>
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}