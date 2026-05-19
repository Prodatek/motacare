import Link from 'next/link';
import { Car, ClipboardCheck, Shield, Zap } from 'lucide-react';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="border-b border-gray-100 px-6 py-4">
        <div className="mx-auto max-w-6xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Car className="h-6 w-6 text-brand-600" />
            <span className="text-xl font-bold text-gray-900">Motacare</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="btn-secondary text-sm">
              Sign in
            </Link>
            <Link href="/register" className="btn-primary text-sm">
              Get started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 py-24 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700 mb-6">
          <Zap className="h-3 w-3" />
          AI-Assisted Vehicle Diagnostics
        </div>
        <h1 className="text-5xl font-bold text-gray-900 leading-tight mb-6">
          Professional car maintenance,
          <br />
          <span className="text-brand-600">fully documented.</span>
        </h1>
        <p className="text-xl text-gray-500 max-w-2xl mx-auto mb-10">
          Motacare gives workshops and car owners a shared, transparent record of
          every inspection and fix — no more word of mouth.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link href="/register?role=OWNER" className="btn-primary px-8 py-3 text-base">
            Register your car
          </Link>
          <Link href="/register?role=FIXER" className="btn-secondary px-8 py-3 text-base">
            I&apos;m a workshop
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="bg-gray-50 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            How Motacare works
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: <Car className="h-6 w-6 text-brand-600" />,
                title: 'Register your vehicle',
                description:
                  'Every car gets a unique identity hash — a secure link between vehicle and owner that never changes.',
              },
              {
                icon: <ClipboardCheck className="h-6 w-6 text-brand-600" />,
                title: 'AI-guided inspection',
                description:
                  'Fixers work through an intelligent checklist covering 44 checks across 8 systems. Every finding is recorded.',
              },
              {
                icon: <Shield className="h-6 w-6 text-brand-600" />,
                title: 'Full history, forever',
                description:
                  'Owners receive documented reports for every visit. Your car\'s full maintenance history, always accessible.',
              },
            ].map((f) => (
              <div key={f.title} className="card p-6">
                <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50">
                  {f.icon}
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8 text-center text-sm text-gray-400">
        <p>© {new Date().getFullYear()} Motacare by Prodatek. All rights reserved.</p>
      </footer>
    </main>
  );
}