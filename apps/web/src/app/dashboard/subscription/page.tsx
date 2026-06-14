'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Check, X, Loader2, CreditCard, AlertTriangle,
  Car, ClipboardCheck, Wrench, FileText, Gauge, Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { subscriptionApi, ApiClientError } from '@/lib/api';
import type { PlansResponse, Subscription } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn, formatDate } from '@/lib/utils';

type Tier = 'FREE' | 'PRO' | 'WORKSHOP';
type Interval = 'MONTHLY' | 'YEARLY';

const TIER_ORDER: Tier[] = ['FREE', 'PRO', 'WORKSHOP'];

const TIER_HIGHLIGHT: Record<Tier, string> = {
  FREE: 'border-gray-200',
  PRO: 'border-brand-500 ring-2 ring-brand-100',
  WORKSHOP: 'border-purple-300',
};

const TIER_BADGE: Record<Tier, string> = {
  FREE: '',
  PRO: 'Most popular',
  WORKSHOP: 'For workshops',
};

function formatNGN(amount: number): string {
  if (amount === 0) return 'Free';
  return new Intl.NumberFormat('en-NG', {
    style: 'currency', currency: 'NGN', maximumFractionDigits: 0,
  }).format(amount);
}

function FeatureRow({ label, value, icon }: { label: string; value: string | boolean; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 text-sm">
      <div className="text-gray-400 shrink-0">{icon}</div>
      <span className="text-gray-600 flex-1">{label}</span>
      {typeof value === 'boolean' ? (
        value
          ? <Check className="h-4 w-4 text-green-500 shrink-0" />
          : <X className="h-4 w-4 text-gray-300 shrink-0" />
      ) : (
        <span className="font-medium text-gray-900 shrink-0">{value}</span>
      )}
    </div>
  );
}

export default function SubscriptionPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();

  const [plans, setPlans] = useState<PlansResponse | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [billingInterval, setBillingInterval] = useState<Interval>('MONTHLY');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  // Show a toast if redirected back from Stripe
  useEffect(() => {
    if (searchParams.get('success') === 'true') {
      toast.success('Subscription activated! It may take a few seconds to reflect below.');
    } else if (searchParams.get('cancelled') === 'true') {
      toast('Checkout cancelled — no changes were made.');
    }
  }, [searchParams]);

  const load = async () => {
    setIsLoading(true);
    try {
      const [plansRes, subRes] = await Promise.allSettled([
        subscriptionApi.getPlans(),
        subscriptionApi.getMySubscription(),
      ]);
      if (plansRes.status === 'fulfilled') setPlans(plansRes.value);
      if (subRes.status === 'fulfilled') setSubscription(subRes.value);
    } catch {
      toast.error('Failed to load subscription details');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleUpgrade = async (tier: Tier) => {
    if (tier === 'FREE') return;
    setActionLoading(`checkout-${tier}`);
    try {
      const { url } = await subscriptionApi.createCheckout(tier as 'PRO' | 'WORKSHOP', billingInterval);
      window.location.href = url;
    } catch (error) {
      if (error instanceof ApiClientError) toast.error(error.message);
      else toast.error('Failed to start checkout');
      setActionLoading(null);
    }
  };

  const handleManageBilling = async () => {
    setActionLoading('portal');
    try {
      const { url } = await subscriptionApi.createPortalSession(window.location.href);
      window.location.href = url;
    } catch (error) {
      if (error instanceof ApiClientError) toast.error(error.message);
      else toast.error('Failed to open billing portal');
      setActionLoading(null);
    }
  };

  const handleCancel = async (immediately: boolean) => {
    setActionLoading('cancel');
    try {
      const updated = await subscriptionApi.cancel(immediately);
      setSubscription(updated);
      toast.success(
        immediately
          ? 'Subscription cancelled immediately'
          : 'Subscription will end at the current billing period',
      );
      setShowCancelConfirm(false);
    } catch (error) {
      if (error instanceof ApiClientError) toast.error(error.message);
      else toast.error('Failed to cancel subscription');
    } finally {
      setActionLoading(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
      </div>
    );
  }

  const currentTier = subscription?.tier ?? 'FREE';

  return (
    <div className="max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Subscription</h1>
        <p className="text-gray-500 mt-0.5 text-sm">
          Manage your plan, billing, and usage limits
        </p>
      </div>

      {/* ── Current Plan Card ── */}
      {subscription && (
        <div className="card p-6 mb-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-xs text-gray-400 mb-1">Current plan</p>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-gray-900">
                  {plans?.[currentTier]?.name ?? currentTier}
                </h2>
                <span className={cn(
                  'badge text-xs',
                  subscription.status === 'ACTIVE'   ? 'text-green-700 bg-green-50' :
                  subscription.status === 'TRIALING' ? 'text-blue-700 bg-blue-50' :
                  subscription.status === 'PAST_DUE' ? 'text-orange-700 bg-orange-50' :
                  'text-gray-500 bg-gray-100',
                )}>
                  {subscription.status === 'TRIALING' ? 'Trial' : subscription.status.replace('_', ' ')}
                </span>
              </div>

              {subscription.status === 'PAST_DUE' && (
                <p className="text-sm text-orange-600 mt-2 flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4" />
                  Your last payment failed. Update your payment method to avoid losing access.
                </p>
              )}

              {subscription.trialEndsAt && subscription.status === 'TRIALING' && (
                <p className="text-sm text-gray-500 mt-2">
                  Trial ends {formatDate(subscription.trialEndsAt)}
                </p>
              )}

              {subscription.currentPeriodEnd && currentTier !== 'FREE' && (
                <p className="text-sm text-gray-500 mt-2">
                  {subscription.cancelAtPeriodEnd
                    ? `Access ends ${formatDate(subscription.currentPeriodEnd)} — subscription will not renew`
                    : `Renews ${formatDate(subscription.currentPeriodEnd)}`}
                </p>
              )}
            </div>

            {/* Actions */}
            {currentTier !== 'FREE' && (
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  onClick={handleManageBilling}
                  disabled={actionLoading === 'portal'}
                  className="btn-secondary text-sm"
                >
                  {actionLoading === 'portal'
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <CreditCard className="h-4 w-4" />}
                  Manage billing
                </button>
                {!subscription.cancelAtPeriodEnd && (
                  <button
                    onClick={() => setShowCancelConfirm(true)}
                    className="btn-secondary text-sm text-red-600 hover:bg-red-50"
                  >
                    Cancel plan
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Usage limits */}
          <div className="grid grid-cols-3 gap-4 mt-5 pt-5 border-t border-gray-100">
            {[
              { label: 'Vehicles', value: subscription.vehiclesAllowed, icon: <Car className="h-4 w-4" /> },
              { label: 'Inspections / mo', value: subscription.inspectionsPerMonth, icon: <ClipboardCheck className="h-4 w-4" /> },
              { label: 'Fixers', value: subscription.fixersAllowed, icon: <Wrench className="h-4 w-4" /> },
            ].map(({ label, value, icon }) => (
              <div key={label} className="text-center">
                <div className="flex items-center justify-center gap-1.5 text-gray-400 mb-1">
                  {icon}
                  <span className="text-xs">{label}</span>
                </div>
                <p className="text-lg font-bold text-gray-900">
                  {value === -1 ? '∞' : value}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Cancel confirmation ── */}
      {showCancelConfirm && (
        <div className="card p-5 mb-6 border-red-200 bg-red-50/50">
          <p className="text-sm font-medium text-gray-900 mb-1">Cancel your subscription?</p>
          <p className="text-sm text-gray-500 mb-4">
            You can cancel now and lose access immediately, or wait until your current
            billing period ends (you keep access until then, no refund either way).
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleCancel(false)}
              disabled={actionLoading === 'cancel'}
              className="btn-secondary text-sm"
            >
              {actionLoading === 'cancel' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Cancel at period end
            </button>
            <button
              onClick={() => handleCancel(true)}
              disabled={actionLoading === 'cancel'}
              className="btn-secondary text-sm text-red-600 hover:bg-red-100"
            >
              Cancel immediately
            </button>
            <button
              onClick={() => setShowCancelConfirm(false)}
              className="btn-secondary text-sm"
            >
              Never mind
            </button>
          </div>
        </div>
      )}

      {/* ── Billing interval toggle ── */}
      <div className="flex items-center justify-center gap-1 mb-6">
        <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1">
          {(['MONTHLY', 'YEARLY'] as Interval[]).map((interval) => (
            <button
              key={interval}
              onClick={() => setBillingInterval(interval)}
              className={cn(
                'px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
                billingInterval === interval
                  ? 'bg-brand-600 text-white'
                  : 'text-gray-500 hover:text-gray-700',
              )}
            >
              {interval === 'MONTHLY' ? 'Monthly' : 'Yearly'}
              {interval === 'YEARLY' && (
                <span className="ml-1.5 text-xs opacity-80">Save ~17%</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Plan comparison cards ── */}
      {plans && (
        <div className="grid md:grid-cols-3 gap-5">
          {TIER_ORDER.map((tier) => {
            const plan = plans[tier];
            const isCurrent = tier === currentTier;
            const price = billingInterval === 'MONTHLY' ? plan.price.monthly : plan.price.yearly;
            const period = billingInterval === 'MONTHLY' ? '/month' : '/year';

            return (
              <div
                key={tier}
                className={cn(
                  'card p-6 flex flex-col relative',
                  TIER_HIGHLIGHT[tier],
                )}
              >
                {TIER_BADGE[tier] && (
                  <span className={cn(
                    'absolute -top-3 left-1/2 -translate-x-1/2 badge text-xs',
                    tier === 'PRO' ? 'bg-brand-600 text-white' : 'bg-purple-100 text-purple-700',
                  )}>
                    {tier === 'PRO' && <Sparkles className="h-3 w-3 mr-1" />}
                    {TIER_BADGE[tier]}
                  </span>
                )}

                <h3 className="font-bold text-lg text-gray-900 mt-2">{plan.name}</h3>
                <p className="text-xs text-gray-400 mt-1 mb-4 min-h-[32px]">{plan.description}</p>

                <div className="mb-5">
                  <span className="text-3xl font-bold text-gray-900">
                    {tier === 'FREE' ? 'Free' : formatNGN(price)}
                  </span>
                  {tier !== 'FREE' && (
                    <span className="text-sm text-gray-400">{period}</span>
                  )}
                </div>

                <div className="space-y-2.5 mb-6 flex-1">
                  <FeatureRow
                    label="Vehicles"
                    value={plan.features.vehiclesAllowed === -1 ? 'Unlimited' : String(plan.features.vehiclesAllowed)}
                    icon={<Car className="h-4 w-4" />}
                  />
                  <FeatureRow
                    label="Inspections / month"
                    value={plan.features.inspectionsPerMonth === -1 ? 'Unlimited' : String(plan.features.inspectionsPerMonth)}
                    icon={<ClipboardCheck className="h-4 w-4" />}
                  />
                  <FeatureRow
                    label="Fixers"
                    value={plan.features.fixersAllowed === -1 ? 'Unlimited' : String(plan.features.fixersAllowed)}
                    icon={<Wrench className="h-4 w-4" />}
                  />
                  <FeatureRow label="PDF report exports" value={plan.features.canExportReports} icon={<FileText className="h-4 w-4" />} />
                  <FeatureRow label="OBD diagnostics" value={plan.features.canAccessObd} icon={<Gauge className="h-4 w-4" />} />
                  <FeatureRow label="AI inspection summaries" value={plan.features.canAccessAiSummary} icon={<Sparkles className="h-4 w-4" />} />
                </div>

                {isCurrent ? (
                  <button disabled className="btn-secondary w-full justify-center opacity-60 cursor-default">
                    Current plan
                  </button>
                ) : tier === 'FREE' ? (
                  <button disabled className="btn-secondary w-full justify-center opacity-40 cursor-default">
                    Free forever
                  </button>
                ) : (
                  <button
                    onClick={() => handleUpgrade(tier)}
                    disabled={actionLoading === `checkout-${tier}`}
                    className={cn(
                      'w-full justify-center',
                      tier === 'PRO' ? 'btn-primary' : 'btn-secondary',
                    )}
                  >
                    {actionLoading === `checkout-${tier}`
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : null}
                    {currentTier === 'FREE' ? 'Upgrade' : 'Switch plan'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {user?.role === 'FIXER' && (
        <p className="text-xs text-gray-400 mt-6 text-center">
          Note: fixer accounts operate under the vehicle owner's plan limits for inspections.
        </p>
      )}
    </div>
  );
}